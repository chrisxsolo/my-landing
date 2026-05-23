// POST /api/admin/batch-drafts
//   Submits a Claude batch job for all unanswered inquiries (no reply_sent_at).
//   Returns: { batch_id, request_count }
//
// GET /api/admin/batch-drafts
//   Returns current batch status.
//   When ended: { batch, results: [{inquiry_id, inquiry_name, draft}] }
//   Otherwise:  { batch }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const BATCH_ID_KEY = "batch_draft_job_id";

type VaultRow = { id: string; title: string; folder: string; content: string };

const VAULT_ALWAYS_INCLUDE = new Set(["03 Client Communication", "01 SOPs", "09 AI Instructions"]);

function buildVaultContext(notes: VaultRow[]): string {
  const sections: string[] = [];
  for (const note of notes) {
    if (!VAULT_ALWAYS_INCLUDE.has(note.folder) || !note.content.trim()) continue;
    sections.push(`### ${note.folder} / ${note.title}\n${note.content.trim()}`);
  }
  return sections.join("\n\n---\n\n");
}

function buildSystemPrompt(vaultContext: string, availability: string): string {
  const vaultSection = vaultContext
    ? `\n\n---\nBUSINESS KNOWLEDGE BASE:\n\n${vaultContext}\n---`
    : "";
  return `You are Chris Solorzano, a Bay Area photographer writing real emails to real clients.

Write like a friendly, confident photographer who genuinely cares. Conversational, warm, direct. Sound like a person, not a business.

Hard rules (non-negotiable):
- Plain text only — no markdown, bold, asterisks, or bullet points
- Start with "Hi [Name]," — nothing before it
- No sign-off or name at the end — stop after the last sentence of content
- No em dashes — use commas instead
- All pricing and policies must come from the knowledge base only

Current availability:
${availability}${vaultSection}`;
}

function buildUserPrompt(inq: {
  name: string;
  email: string;
  phone: string | null;
  session_type: string | null;
  date_in_mind: string | null;
  message: string;
}): string {
  return `Draft a reply to this client inquiry:

Name: ${inq.name}
Email: ${inq.email}${inq.phone ? `\nPhone: ${inq.phone}` : ""}${inq.session_type ? `\nSession type: ${inq.session_type}` : ""}${inq.date_in_mind ? `\nDate they have in mind: ${inq.date_in_mind}` : ""}

Their message:
${inq.message}

Write the reply now.`;
}

async function fetchAvailability(): Promise<string> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/availability`, { cache: "no-store" });
    if (!res.ok) return "Availability data unavailable.";
    const json = await res.json();
    return (json as { quick_read?: string }).quick_read ?? "Availability data unavailable.";
  } catch {
    return "Check soloxsnaps.com/availability for open dates.";
  }
}

function stripSignoff(text: string): string {
  return text
    .replace(/\n+[-–]?\s*Chris\s*$/i, "")
    .replace(/\n+(?:best|thanks|cheers|warm regards|regards|sincerely)[,.]?\s*\n+chris\s*$/i, "")
    .trimEnd();
}

// ── GET — check current batch status ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const supabase = createSupabaseServerClient();
  const { data: setting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", BATCH_ID_KEY)
    .single();

  const batchId = setting?.value as string | null;
  if (!batchId) return NextResponse.json({ message: "No batch job found" }, { status: 404 });

  const client = new Anthropic({ apiKey });

  try {
    const batch = await client.messages.batches.retrieve(batchId);

    if (batch.processing_status !== "ended") {
      return NextResponse.json({ batch });
    }

    // Batch is done — fetch results
    const results: { inquiry_id: number; inquiry_name: string; draft: string }[] = [];

    // Fetch inquiry names for display
    const { data: inquiries } = await supabase
      .from("inquiries")
      .select("id, name")
      .is("reply_sent_at", null);
    const nameMap = new Map((inquiries ?? []).map(i => [String(i.id), i.name as string]));

    for await (const result of await client.messages.batches.results(batchId)) {
      if (result.result.type !== "succeeded") continue;
      const inquiryId = parseInt(result.custom_id, 10);
      if (isNaN(inquiryId)) continue;

      const raw = result.result.message.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("")
        .trim();

      const draft = stripSignoff(raw);
      results.push({
        inquiry_id: inquiryId,
        inquiry_name: nameMap.get(result.custom_id) ?? `Inquiry ${inquiryId}`,
        draft,
      });
    }

    return NextResponse.json({ batch, results });
  } catch (err) {
    console.error("[batch-drafts] GET error", err);
    return NextResponse.json({ error: "Failed to fetch batch status" }, { status: 500 });
  }
}

// ── POST — create a new batch ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const supabase = createSupabaseServerClient();

  // Fetch unanswered inquiries (no reply sent yet)
  const { data: inquiries, error: inqErr } = await supabase
    .from("inquiries")
    .select("id, name, email, phone, session_type, date_in_mind, message")
    .is("reply_sent_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (inqErr) {
    console.error("[batch-drafts] fetch inquiries error", inqErr);
    return NextResponse.json({ error: "Failed to fetch inquiries" }, { status: 500 });
  }

  if (!inquiries || inquiries.length === 0) {
    return NextResponse.json({ message: "No unanswered inquiries found" }, { status: 200 });
  }

  // Build shared context (vault notes + availability)
  const [vaultRows, availability] = await Promise.all([
    supabase
      .from("vault_notes")
      .select("id, title, folder, content")
      .then(r => (r.data ?? []) as VaultRow[]),
    fetchAvailability(),
  ]);

  const systemPrompt = buildSystemPrompt(buildVaultContext(vaultRows), availability);

  const client = new Anthropic({ apiKey });

  const requests: Anthropic.Messages.MessageCreateParamsNonStreaming[] = inquiries.map(inq => ({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    temperature: 0.9,
    system: [
      {
        type: "text" as const,
        text: systemPrompt,
        cache_control: { type: "ephemeral" as const },
      },
    ],
    messages: [{ role: "user" as const, content: buildUserPrompt(inq as Parameters<typeof buildUserPrompt>[0]) }],
  }));

  try {
    const batch = await client.messages.batches.create({
      requests: requests.map((params, i) => ({
        custom_id: String(inquiries[i].id),
        params,
      })),
    });

    // Store batch ID so we can retrieve it later
    await supabase
      .from("site_settings")
      .upsert({ key: BATCH_ID_KEY, value: batch.id, updated_at: new Date().toISOString() }, { onConflict: "key" });

    return NextResponse.json({ batch_id: batch.id, request_count: inquiries.length });
  } catch (err) {
    console.error("[batch-drafts] create batch error", err);
    return NextResponse.json({ error: "Failed to create batch job" }, { status: 500 });
  }
}
