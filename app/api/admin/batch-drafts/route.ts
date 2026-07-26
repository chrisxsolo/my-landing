// POST /api/admin/batch-drafts
//   Generates drafts for all unanswered inquiries (no reply_sent_at) in parallel.
//   Returns: { results: [{inquiry_id, inquiry_name, draft}] }
//
// GET /api/admin/batch-drafts
//   Legacy endpoint — returns 404 (batch polling no longer needed).

import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";
// Up to 200 drafts generate in parallel in one request — needs more than the
// default function timeout.
export const maxDuration = 300;

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

// ── GET — legacy polling endpoint ─────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;
  return NextResponse.json({ message: "No batch job found" }, { status: 404 });
}

// ── POST — generate drafts for all unanswered inquiries ───────────────────────

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const supabase = createSupabaseServerClient();

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

  const [vaultRows, availability] = await Promise.all([
    supabase
      .from("vault_notes")
      .select("id, title, folder, content")
      .then(r => (r.data ?? []) as VaultRow[]),
    fetchAvailability(),
  ]);

  const systemPrompt = buildSystemPrompt(buildVaultContext(vaultRows), availability);
  const client = new OpenAI({ apiKey });

  const settled = await Promise.allSettled(
    inquiries.map(async inq => {
      const res = await client.chat.completions.create({
        model: "gpt-4.1",
        max_tokens: 600,
        temperature: 0.9,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: buildUserPrompt(inq as Parameters<typeof buildUserPrompt>[0]) },
        ],
      });
      const raw = (res.choices[0]?.message?.content ?? "").trim();
      return {
        inquiry_id: inq.id as number,
        inquiry_name: inq.name as string,
        draft: stripSignoff(raw),
      };
    })
  );

  const results = settled
    .filter(
      (r): r is PromiseFulfilledResult<{ inquiry_id: number; inquiry_name: string; draft: string }> =>
        r.status === "fulfilled"
    )
    .map(r => r.value);

  const failed = settled.filter(r => r.status === "rejected").length;
  if (failed > 0) {
    console.error(`[batch-drafts] ${failed} draft(s) failed`);
  }

  return NextResponse.json({ results, request_count: inquiries.length });
}
