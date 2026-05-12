// ─────────────────────────────────────────────────────────────────────────────
// POST /api/draft-reply
//
// Admin-only endpoint. Four modes:
//
// 1. Fresh draft
//    Body: { name, email, phone?, session_type?, date_in_mind?, message }
//    Response: { draft: "Hi Ryan, ..." }
//
// 2. Refinement
//    Body: { ...same, previous_draft, feedback }
//    Response: { draft: "Hi Ryan, ..." }  (revised)
//
// 3. Analyze & learn
//    Body: { name, email, message, ai_draft, actual_sent }
//    Response: { rules: [...], written: number }
//    Claude compares AI draft vs what Chris actually sent, extracts concrete
//    style rules, deduplicates, and appends new ones to the vault note
//    "09 AI Instructions / Email Rules" in Supabase.
//
// 4. Polish / bullet-to-email
//    Body: { ...same, raw_draft }
//    Response: { draft: "Hi Ryan, ..." }
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type VaultRow = { id: string; title: string; folder: string; content: string };

async function fetchAvailability(): Promise<string> {
  try {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/availability`, { cache: "no-store" });
    if (!res.ok) return "Availability data unavailable.";
    const json = await res.json();
    return json.quick_read ?? "Availability data unavailable.";
  } catch {
    return "Availability data unavailable — tell them to check soloxsnaps.com/availability for open dates.";
  }
}

// Remove any trailing sign-off line (e.g. "Chris", "- Chris", "Best, Chris")
function stripSignoff(text: string): string {
  return text
    .replace(/\n+[-–]?\s*Chris\s*$/i, "")
    .replace(/\n+(?:best|thanks|cheers|warm regards|regards|sincerely)[,.]?\s*\n+chris\s*$/i, "")
    .trimEnd();
}

async function getAllVaultNotes(): Promise<VaultRow[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vault_notes")
    .select("id, title, folder, content");
  if (error) throw error;
  return data ?? [];
}

// Folders that always contain useful context for replies
const VAULT_ALWAYS_INCLUDE = new Set(["03 Client Communication", "01 SOPs", "09 AI Instructions"]);

const VAULT_KEYWORD_MAP: Record<string, string[]> = {
  grad:       ["02 Pricing", "07 Client Experience", "10 Templates"],
  family:     ["02 Pricing", "07 Client Experience"],
  couple:     ["02 Pricing", "07 Client Experience"],
  pricing:    ["02 Pricing"],
  reschedule: ["10 Templates"],
  cancel:     ["10 Templates"],
  confirm:    ["10 Templates"],
};

// Maps keywords → specific location note title (in "06 Locations" folder)
const LOCATION_NOTE_MAP: Record<string, string> = {
  "berkeley":                    "UC Berkeley",
  "uc berkeley":                 "UC Berkeley",
  "sfsu":                        "SF State",
  "sf state":                    "SF State",
  "san francisco state":         "SF State",
  "usf":                         "USF",
  "university of san francisco":  "USF",
  "sjsu":                        "SJSU",
  "san jose state":              "SJSU",
  "csueb":                       "CSUEB",
  "cal state east bay":          "CSUEB",
  "east bay":                    "CSUEB",
  "hayward":                     "CSUEB",
  "legion of honor":             "Legion of Honor",
  "palace of fine arts":         "SF Outdoor Spots",
  "sutro":                       "SF Outdoor Spots",
  "ocean beach":                 "SF Outdoor Spots",
  "baker beach":                 "SF Outdoor Spots",
  "dolores park":                "SF Outdoor Spots",
  "alamo square":                "SF Outdoor Spots",
  "crissy field":                "SF Outdoor Spots",
  "golden gate park":            "SF Outdoor Spots",
};

function buildVaultContext(notes: VaultRow[], sessionType?: string, message?: string): string {
  const haystack = `${sessionType ?? ""} ${message ?? ""}`.toLowerCase();

  const foldersToInclude = new Set(VAULT_ALWAYS_INCLUDE);
  const specificTitles = new Set<string>(); // location note titles to prioritize

  // Folder-level keyword matching
  for (const [kw, folders] of Object.entries(VAULT_KEYWORD_MAP)) {
    if (haystack.includes(kw)) folders.forEach(f => foldersToInclude.add(f));
  }

  // Location-specific note matching
  for (const [kw, title] of Object.entries(LOCATION_NOTE_MAP)) {
    if (haystack.includes(kw)) specificTitles.add(title);
  }

  // If location keyword present but no specific note matched, include whole Locations folder
  const locationKeywords = ["location", "campus", "shoot at", "shoot in", "session at"];
  if (locationKeywords.some(k => haystack.includes(k)) && specificTitles.size === 0) {
    foldersToInclude.add("06 Locations");
  }

  const sections: string[] = [];
  const seen = new Set<string>();

  // Specific location notes first (highest priority)
  for (const note of notes) {
    if (note.folder === "06 Locations" && specificTitles.has(note.title)) {
      const key = `${note.folder}/${note.title}`;
      if (seen.has(key) || !note.content.trim()) continue;
      seen.add(key);
      sections.push(`### ${note.folder} / ${note.title}\n${note.content.trim()}`);
    }
  }

  // Folder-level notes
  for (const note of notes) {
    if (!foldersToInclude.has(note.folder)) continue;
    const key = `${note.folder}/${note.title}`;
    if (seen.has(key) || !note.content.trim()) continue;
    seen.add(key);
    sections.push(`### ${note.folder} / ${note.title}\n${note.content.trim()}`);
  }

  return sections.join("\n\n---\n\n");
}

function buildMergeSystem(today: string): string {
  return `You are a knowledge base editor for a photography business. Your job is to maintain a clean, well-structured markdown note of AI email writing rules.

Each rule in the note is timestamped in the format [YYYY-MM-DD] at the start of the line (e.g. "- [2026-05-11] always mention the travel fee upfront").
New rules being integrated today are dated ${today}.

Editing rules:
- If a new rule CONTRADICTS or SUPERSEDES an existing rule: DELETE the old rule, ADD the new one with today's date [${today}]
- When two rules conflict, ALWAYS prefer the one with the NEWER date — recency is the single source of truth
- If a new rule is essentially the same as an existing one: KEEP the existing rule unchanged (do not re-date it)
- If a new rule is genuinely new: ADD it under the most relevant ## section with today's date [${today}]
- NEVER keep two rules that say opposite or conflicting things
- Preserve all YAML frontmatter exactly as-is (the --- block at the top)
- Update the "updated" frontmatter field to ${today}
- Preserve the existing ## section structure
- If a new rule doesn't fit any existing section, add it under ## Learned Rules
- Output ONLY the updated markdown note — no explanation, no preamble`;
}

async function mergeRulesToVault(newRules: string[], apiKey: string): Promise<number> {
  if (newRules.length === 0) return 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("vault_notes")
      .select("id, content")
      .eq("folder", "09 AI Instructions")
      .eq("title", "Email Rules")
      .single();

    const existing = data?.content ?? "";

    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2000,
      system: buildMergeSystem(today),
      messages: [{
        role: "user",
        content: `Current Email Rules note:\n\n---\n${existing}\n---\n\nNew rules to integrate (dated ${today}):\n\n${newRules.map(r => `- [${today}] ${r}`).join("\n")}\n\nOutput the updated note only.`,
      }],
    });

    const updated = res.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    if (data?.id) {
      await supabase.from("vault_notes").update({ content: updated }).eq("id", data.id);
    } else {
      await supabase.from("vault_notes").insert({
        folder: "09 AI Instructions",
        title: "Email Rules",
        content: updated,
      });
    }

    return newRules.length;
  } catch (err) {
    console.error("Failed to merge rules to vault:", err);
    return 0;
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 }
    );
  }

  // gmail_examples is the only array field; everything else is a plain string
  let body: Record<string, string> & { gmail_examples?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const {
    name, email, session_type, date_in_mind, message, phone,
    previous_draft, feedback, ai_draft, actual_sent,
    thread_context, raw_draft, latest_message_body, latest_message_from,
    gmail_examples,
  } = body;
  const perfect_draft = (body as Record<string, unknown>).perfect_draft === true;

  if (!name || !email || !message) {
    return NextResponse.json(
      { error: "name, email, and message are required." },
      { status: 400 }
    );
  }

  const isAnalyze    = Boolean(ai_draft && actual_sent);
  const isRefinement = !isAnalyze && Boolean(previous_draft && feedback);
  const isPolish     = !isAnalyze && !isRefinement && Boolean(raw_draft);

  // ── Mode 3: Analyze & learn ──────────────────────────────────────────────
  if (isAnalyze) {
    try {
      const client = new Anthropic({ apiKey });

      const systemPrompt = perfect_draft
        ? `You are a writing-style analyst. An AI-generated email draft was sent to a client without any edits — meaning it was perfect. Your job is to extract concrete style rules from this email that describe what made it good and should be preserved in future drafts. Each rule should be a single actionable instruction (e.g. "keep replies to 3 sentences or fewer for pricing questions", "open with a direct answer before adding context", "use a warm but efficient tone — no filler phrases"). No fluff, no praise, no explanation — just the rules, one per line, starting with a dash.`
        : `You are a writing-style analyst. Your job is to compare two email drafts and produce a short, concrete list of style rules that capture how the final version differs from the draft. Each rule should be a single actionable instruction (e.g. "skip the opening weather comment", "be more direct — cut the warm-up sentences", "always mention the turnaround time"). No fluff, no praise, no explanation — just the rules, one per line, starting with a dash.`;

      const userContent = perfect_draft
        ? `This AI-generated draft was sent to a client exactly as written — no edits were made. Extract concrete style rules from it that should be preserved in future drafts.\n\n---\n${ai_draft}\n---\n\nList the style rules, one per line starting with a dash, nothing else.`
        : `Here is the AI-generated draft:\n\n---\n${ai_draft}\n---\n\nHere is what Chris actually sent instead:\n\n---\n${actual_sent}\n---\n\nList the concrete style rules Claude should follow in future drafts based on the differences. Output only the rules, one per line starting with a dash, nothing else.`;

      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      });

      const raw = response.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();

      const rules = raw
        .split("\n")
        .map(line => line.replace(/^[-–•*]\s*/, "").trim())
        .filter(line => line.length > 0);

      const written = await mergeRulesToVault(rules, apiKey);

      return NextResponse.json({ rules, written });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Claude analyze error:", msg);
      return NextResponse.json({ error: `Analysis failed: ${msg}` }, { status: 500 });
    }
  }

  // Fetch vault notes once for modes 1, 2, 4
  let allNotes: VaultRow[] = [];
  try {
    allNotes = await getAllVaultNotes();
  } catch (err) {
    console.error("[draft-reply] vault fetch error", err);
  }

  // ── Mode 4: Polish / bullet-to-email ────────────────────────────────────────
  if (isPolish) {
    const [availability, vaultContext] = await Promise.all([
      fetchAvailability(),
      Promise.resolve(buildVaultContext(allNotes, session_type, message)),
    ]);

    const vaultSection = vaultContext
      ? `\n\n---\nBUSINESS KNOWLEDGE BASE (Obsidian vault — single source of truth for all pricing, policies, tone rules, and templates. Use this and only this for business facts):\n\n${vaultContext}\n---`
      : "";

    const systemPrompt = `You are Chris Solorzano, a Bay Area photography business owner. You run soloxsnaps.com.

All business knowledge — pricing, policies, tone, communication rules — comes exclusively from the Obsidian vault below. Do not invent facts not in the vault.

Format rules (always apply):
- Plain text only — no markdown, no bold, no asterisks, no bullet points in the output
- Start directly with "Hi [Name]," — no subject line
- Do NOT add a sign-off or name at the end — end the email with the last line of content only
- Never include email headers, timestamps, or "to:" lines
- No em dashes (—) — use commas or rewrite the sentence instead` + vaultSection;

    const examples = Array.isArray(gmail_examples) ? gmail_examples as string[] : [];
    const examplesSection = examples.length
      ? `\n\nREAL EXAMPLES — past emails Chris actually sent for similar situations (study the tone, length, structure, and phrasing closely and mirror it):\n\n${examples.map((ex, i) => `--- Example ${i + 1} ---\n${ex}`).join("\n\n")}\n\n---`
      : "";

    try {
      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: systemPrompt + examplesSection,
        messages: [{
          role: "user",
          content: `Polish the following rough email draft into a proper, well-formatted email in your voice.

Fix any typos, improve the flow, and make it sound natural and professional. If it's written as bullet points or fragments, convert it to proper paragraphs.
${examples.length ? `\nIMPORTANT — tone matching: You have been given real past emails Chris sent for similar situations. Match the tone, warmth, sentence length, and phrasing style from those examples as closely as possible while still covering the content in the rough draft.` : ""}
IMPORTANT — transcription error correction: This draft may have been dictated via voice-to-text, so it may contain speech recognition mistakes (wrong words that sound similar to the intended word). Use the conversation context below to identify and fix these errors. For example, if the draft says "Palisades of Fine Arts" but the conversation mentions "Palace of Fine Arts", correct it. Always trust what the client said in the conversation over what appears in the rough draft.

This is a reply to ${name} about a ${session_type ?? "photography"} session.
${thread_context ? `\nConversation context (use this to fix any transcription errors in the draft):\n---\n${thread_context}\n---` : ""}
Rough draft:
---
${raw_draft}
---

Output only the polished email body, nothing else.`,
        }],
      });

      let draft = response.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();

      draft = draft.replace(
        /^(?:[^\n]*<[^\n@>]+@[^\n>]+>[^\n]*\n[^\n]+at\s+\d+:\d+[^\n]*\n(?:to\s+[^\n]+\n)?[\s\n]*)/, ""
      ).trimStart();
      draft = stripSignoff(draft);

      return NextResponse.json({ draft });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Polish failed: ${msg}` }, { status: 500 });
    }
  }

  // ── Modes 1 & 2: Fresh draft or refinement ───────────────────────────────

  const [availability, vaultContext] = await Promise.all([
    fetchAvailability(),
    Promise.resolve(buildVaultContext(allNotes, session_type, message)),
  ]);

  const baseInstructions = `You are Chris Solorzano, a Bay Area photography business owner. You run soloxsnaps.com.

All business knowledge — pricing, add-ons, travel fees, policies, tone rules, communication structure — comes exclusively from the Obsidian vault below. Do not invent or assume any facts not present in the vault.

Format rules (always apply, non-negotiable):
- Plain text only — no markdown, no bold, no asterisks, no bullet points in the output
- Start directly with "Hi [Name]," — no subject line, no "Dear"
- Do NOT add a sign-off or name at the end — end the email with the last line of content only
- NEVER include email headers, timestamps, sender lines, or "to:" lines
- Output only the reply body itself, starting with "Hi [Name],"
- No em dashes (—) — use commas or rewrite the sentence instead`;

  const vaultSection = vaultContext
    ? `\n\n---\nBUSINESS KNOWLEDGE BASE (Obsidian vault — single source of truth. Use this and only this for all business facts, pricing, policies, and tone):\n\n${vaultContext}\n---`
    : "";

  const systemPrompt = baseInstructions + vaultSection;

  const threadSection = thread_context
    ? `\n\nFull email conversation history with this client (oldest first — use this for context, don't repeat what's already been said):\n\n${thread_context}`
    : "";

  const userPrompt = isRefinement
    ? `You wrote this draft reply for a client inquiry:

---
${previous_draft}
---

Chris reviewed it and wants this changed: "${feedback}"

Rewrite the reply incorporating that feedback. Keep everything else the same unless it conflicts with the requested change. Output only the revised reply, nothing else.`
    : latest_message_body && latest_message_from !== "me"
      ? `Draft a reply to the most recent email from ${name}.

Client info:
Name: ${name}
Email: ${email}${phone ? `\nPhone: ${phone}` : ""}${session_type ? `\nSession type: ${session_type}` : ""}${date_in_mind ? `\nDate they have in mind: ${date_in_mind}` : ""}

Their most recent email (this is what you are replying to):
${latest_message_body}

Current availability:
${availability}${threadSection}

Write the reply now. Focus on responding to what they said in their most recent email.`
      : `Draft a reply to this client inquiry:

Name: ${name}
Email: ${email}${phone ? `\nPhone: ${phone}` : ""}${session_type ? `\nSession type: ${session_type}` : ""}${date_in_mind ? `\nDate they have in mind: ${date_in_mind}` : ""}

Their message:
${message}

Current availability:
${availability}${threadSection}

Write the reply now.`;

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });

    let draft = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    draft = draft.replace(
      /^(?:[^\n]*<[^\n@>]+@[^\n>]+>[^\n]*\n[^\n]+at\s+\d+:\d+[^\n]*\n(?:to\s+[^\n]+\n)?[\s\n]*)/, ""
    ).trimStart();
    draft = stripSignoff(draft);

    return NextResponse.json({ draft });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Claude draft-reply error:", msg);
    return NextResponse.json(
      { error: `Draft failed: ${msg}` },
      { status: 500 }
    );
  }
}
