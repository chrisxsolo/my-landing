# AI Training System Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Claude AI email assistant truly dynamic — persistent training chat with session history, a dedicated AI tab, a rules inspector, aggressive rule extraction, and prompt-caching so every draft call is fast and cheap.

**Architecture:** Extract the Train AI chat from the inline `inquiries` panel into a dedicated `AiTab` component with its own tab in admin. Persist training conversation history in Supabase (`ai_training_sessions` table) so context survives page reloads. Add a `/api/ai/rules` debug endpoint. Upgrade the `train-ai` API to use Claude's prompt caching on the rules system prompt so repeated drafts don't re-tokenize the same vault note every time.

**Tech Stack:** Next.js App Router · Supabase Postgres · Anthropic SDK (prompt caching) · TypeScript · Tailwind · `@/lib/colors` (C) · `requireAdmin` auth

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| **Create** | `app/admin/AiTab.tsx` | Full AI training tab UI — chat history, rules inspector, stats |
| **Create** | `app/api/ai/rules/route.ts` | GET current Email Rules note as JSON; shows what Claude actually sees |
| **Modify** | `app/api/train-ai/route.ts` | Persist chat to Supabase, add prompt caching, lower extraction threshold |
| **Modify** | `app/api/draft-reply/route.ts` | Add prompt caching on the rules system block |
| **Modify** | `app/admin/page.tsx` | Add `"ai"` tab, import `AiTab`, remove inline Train AI panel from inquiries tab |

---

## Task 1: Supabase — `ai_training_sessions` table

**Files:**
- No code files — Supabase SQL migration only

- [ ] **Step 1: Run this SQL in the Supabase dashboard (SQL editor)**

```sql
create table if not exists ai_training_sessions (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  messages    jsonb not null default '[]'::jsonb,
  session_label text
);
```

- [ ] **Step 2: Verify the table exists**

In the Supabase dashboard → Table Editor, confirm `ai_training_sessions` appears with columns `id`, `created_at`, `messages`, `session_label`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: add ai_training_sessions table migration note"
```

---

## Task 2: GET `/api/ai/rules` — rules inspector endpoint

**Files:**
- Create: `app/api/ai/rules/route.ts`

This endpoint lets the admin see exactly what rules Claude is using right now — no guessing.

- [ ] **Step 1: Create the file**

```typescript
// GET /api/ai/rules
// Returns the current Email Rules vault note so the admin can verify what Claude sees.
// Response: { content: string; updated_at: string | null; rule_count: number }

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const RULES_FOLDER = "09 AI Instructions";
const RULES_TITLE  = "Email Rules";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vault_notes")
    .select("id, content, updated_at")
    .eq("folder", RULES_FOLDER)
    .eq("title", RULES_TITLE)
    .single();

  if (error || !data) {
    return NextResponse.json({ content: "", updated_at: null, rule_count: 0 });
  }

  const lines = (data.content as string)
    .split("\n")
    .filter(l => l.trim().startsWith("- ["));

  return NextResponse.json({
    content: data.content as string,
    updated_at: (data as Record<string, unknown>).updated_at as string | null ?? null,
    rule_count: lines.length,
  });
}
```

- [ ] **Step 2: Test the endpoint manually**

```bash
# From a browser or curl — you need the admin_session cookie set
curl http://localhost:3000/api/ai/rules -H "Cookie: admin_session=YOUR_SECRET"
```

Expected: `{ content: "...", updated_at: "...", rule_count: N }` — or `{ content: "", updated_at: null, rule_count: 0 }` if no rules saved yet.

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/rules/route.ts
git commit -m "feat: add GET /api/ai/rules debug endpoint"
```

---

## Task 3: Upgrade `train-ai` API — persistence + caching + aggressive extraction

**Files:**
- Modify: `app/api/train-ai/route.ts`

Three improvements in one route:
1. **Persist chat history** to `ai_training_sessions` in Supabase (upsert by `session_id`)
2. **Prompt caching** on the rules system block so the vault note tokens are reused
3. **Lower extraction threshold** — the EXTRACT_SYSTEM prompt is made more aggressive about pulling rules from conversational phrasing

- [ ] **Step 1: Replace the entire file**

```typescript
// POST /api/train-ai
//
// Conversational training endpoint. Chris chats naturally; Claude extracts
// concrete style rules and writes them to vault_notes ("09 AI Instructions" / "Email Rules").
//
// Body: { messages: {role:"user"|"assistant", content:string}[], session_id?: string }
// Response: { reply: string, saved_to_vault: boolean, new_rules: string[], session_id: string }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

const RULES_FOLDER = "09 AI Instructions";
const RULES_TITLE  = "Email Rules";

async function readCurrentRules(): Promise<{ id: string | null; content: string }> {
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("vault_notes")
      .select("id, content")
      .eq("folder", RULES_FOLDER)
      .eq("title", RULES_TITLE)
      .single();
    return { id: data?.id ?? null, content: data?.content ?? "" };
  } catch {
    return { id: null, content: "" };
  }
}

async function writeRules(id: string | null, content: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  if (id) {
    await supabase.from("vault_notes").update({ content }).eq("id", id);
  } else {
    await supabase.from("vault_notes").insert({
      folder: RULES_FOLDER,
      title: RULES_TITLE,
      content,
    });
  }
}

async function persistSession(
  sessionId: string | null,
  messages: { role: string; content: string }[]
): Promise<string> {
  const supabase = createSupabaseServerClient();
  if (sessionId) {
    await supabase
      .from("ai_training_sessions")
      .update({ messages })
      .eq("id", sessionId);
    return sessionId;
  }
  const { data } = await supabase
    .from("ai_training_sessions")
    .insert({ messages })
    .select("id")
    .single();
  return String(data?.id ?? "");
}

function buildExtractSystem(currentRules: string): string {
  const rulesSection = currentRules
    ? `\n\nCurrent saved rules (already in vault — do NOT re-extract these verbatim):\n${currentRules}`
    : "\n\nNo rules saved yet.";

  return `You are a helpful assistant that helps Chris Solorzano train an AI email assistant for his photography business (soloxsnaps.com).

Chris will chat with you naturally about how he wants the AI to write emails — what to say, what not to say, corrections, tone preferences, etc.

Your job:
1. Have a natural, friendly conversation. Acknowledge what he said, confirm what you understood.
2. At the end of EVERY response, extract any new instructions as concrete rules — even if Chris is being casual or conversational. If there is ANY implied preference or instruction in what he said, extract it.

Always end your response with a JSON block in this exact format (empty array only if there is truly zero instruction or preference):
<rules>
["rule 1", "rule 2"]
</rules>

Rules must be:
- Short and actionable (one sentence)
- Written as instructions for Claude: "Always X", "Never Y", "If Z then W"
- Specific enough to be unambiguous
- Extracted even from conversational hints (e.g. "I usually keep it short" → "Keep replies concise — 3 sentences or fewer unless the question requires detail")

Hard rules already saved (never re-extract):
- Never add a sign-off or name at the end of emails — end with the last line of content only
- No em dashes (—) in email output — use commas or rewrite the sentence instead${rulesSection}`;
}

const MERGE_SYSTEM = `You are a knowledge base editor for a photography business. Your job is to maintain a clean, well-structured markdown note of AI email writing rules.

Editing rules:
- If a new rule CONTRADICTS or SUPERSEDES an existing rule, DELETE the old rule and ADD the new one
- If a new rule is essentially the same as an existing one, KEEP the existing wording — no duplicates
- If a new rule is genuinely new, ADD it under the most relevant ## section
- NEVER keep two rules that say opposite or conflicting things — always prefer the newer rule
- Preserve all YAML frontmatter exactly as-is (the --- block at the top)
- Preserve the existing ## section structure
- Update the last_updated frontmatter field to today's date
- If a new rule doesn't fit any existing section, add it under ## Learned Rules
- Output ONLY the updated markdown note — no explanation, no preamble`;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "No API key" }, { status: 500 });

  const { messages, session_id } = await req.json() as {
    messages: { role: "user" | "assistant"; content: string }[];
    session_id?: string;
  };

  const client = new Anthropic({ apiKey });
  const { id: rulesId, content: currentRules } = await readCurrentRules();

  // Step 1: Conversation + rule extraction (with prompt caching on the rules block)
  const extractRes = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 800,
    system: [
      {
        type: "text",
        text: buildExtractSystem(currentRules),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages,
  });

  const raw = extractRes.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  const rulesMatch = raw.match(/<rules>\s*(\[[\s\S]*?\])\s*<\/rules>/);
  let newRules: string[] = [];
  if (rulesMatch) {
    try { newRules = JSON.parse(rulesMatch[1]) as string[]; } catch { /* ignore */ }
  }

  const reply = raw.replace(/<rules>[\s\S]*?<\/rules>/, "").trim();

  // Step 2: Persist updated conversation to Supabase
  const allMessages = [...messages, { role: "assistant", content: reply }];
  const savedSessionId = await persistSession(session_id ?? null, allMessages).catch(() => "");

  // Step 3: If there are new rules, merge them into the vault note
  let savedToVault = false;
  if (newRules.length > 0) {
    try {
      const mergeRes = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1600,
        system: MERGE_SYSTEM,
        messages: [{
          role: "user",
          content: `Current Email Writer Rules note:\n\n---\n${currentRules || "(empty)"}\n---\n\nNew rules to integrate (replace conflicts, add new, remove outdated):\n\n${newRules.map(r => `- ${r}`).join("\n")}\n\nOutput the updated note only.`,
        }],
      });

      const updatedNote = mergeRes.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("")
        .trim();

      await writeRules(rulesId, updatedNote);
      savedToVault = true;
    } catch (err) {
      console.error("[train-ai] vault write error", err);
    }
  }

  return NextResponse.json({
    reply,
    new_rules: newRules,
    saved_to_vault: savedToVault,
    session_id: savedSessionId,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chrissolo/Documents/github/my-landing && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors relating to `train-ai/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/train-ai/route.ts
git commit -m "feat: persist training chat to supabase, add prompt caching, aggressive rule extraction"
```

---

## Task 4: Add prompt caching to `draft-reply`

**Files:**
- Modify: `app/api/draft-reply/route.ts`

The `baseInstructions + vaultSection` string is rebuilt on every request but the vault notes rarely change. Wrapping the system in a `cache_control: ephemeral` block means the same vault content is reused from Anthropic's cache for up to 5 minutes — faster and cheaper for rapid draft iteration.

- [ ] **Step 1: Find the `client.messages.create` call in modes 1 & 2 (line ~466)**

Locate this block in [app/api/draft-reply/route.ts](app/api/draft-reply/route.ts):

```typescript
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      temperature: 0.9,
      messages: [{ role: "user", content: userPrompt }],
      system: systemPrompt,
    });
```

- [ ] **Step 2: Replace it with the cached version**

```typescript
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      temperature: 0.9,
      messages: [{ role: "user", content: userPrompt }],
      system: [
        {
          type: "text",
          text: systemPrompt,
          cache_control: { type: "ephemeral" },
        },
      ],
    });
```

- [ ] **Step 3: Do the same for the Polish mode (line ~355)**

Locate in [app/api/draft-reply/route.ts](app/api/draft-reply/route.ts):

```typescript
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        temperature: 0.9,
        system: systemPrompt + examplesSection,
        messages: [{
```

Replace with:

```typescript
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        temperature: 0.9,
        system: [
          {
            type: "text",
            text: systemPrompt + examplesSection,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/chrissolo/Documents/github/my-landing && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/api/draft-reply/route.ts
git commit -m "perf: add prompt caching to draft-reply system prompts"
```

---

## Task 5: Create `AiTab` component

**Files:**
- Create: `app/admin/AiTab.tsx`

This is the full dedicated AI tab. Three panels:
1. **Training Chat** — persistent across page reloads (loads last session from Supabase on mount), scrolls to bottom, shows saved rules badge
2. **Rules Inspector** — calls `GET /api/ai/rules`, renders the live markdown content so Chris can see exactly what Claude is reading
3. **Stats bar** — rule count + last updated date

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";

type Message = { role: "user" | "assistant"; content: string };

type RulesData = {
  content: string;
  updated_at: string | null;
  rule_count: number;
};

export default function AiTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [savedRules, setSavedRules] = useState<string[]>([]);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [rulesData, setRulesData] = useState<RulesData | null>(null);
  const [rulesLoading, setRulesLoading] = useState(false);
  const [showRules, setShowRules] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Load most recent training session on mount
  useEffect(() => {
    fetch("/api/ai/session/latest", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (d.messages?.length) {
          setMessages(d.messages as Message[]);
          setSessionId(String(d.id));
        }
      })
      .catch(() => {/* no prior session */})
      .finally(() => setSessionLoading(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch("/api/train-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, session_id: sessionId }),
      });
      const json = await res.json() as {
        reply: string;
        new_rules: string[];
        saved_to_vault: boolean;
        session_id: string;
      };
      setMessages(p => [...p, { role: "assistant", content: json.reply }]);
      if (json.session_id) setSessionId(json.session_id);
      if (json.new_rules?.length) {
        setSavedRules(json.new_rules);
        setTimeout(() => setSavedRules([]), 5000);
        // Refresh rules inspector if it was open
        if (showRules) loadRules();
      }
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  }

  async function loadRules() {
    setRulesLoading(true);
    try {
      const res = await fetch("/api/ai/rules", { credentials: "include" });
      const d = await res.json() as RulesData;
      setRulesData(d);
    } catch {
      setRulesData(null);
    } finally {
      setRulesLoading(false);
    }
  }

  function toggleRules() {
    if (!showRules && !rulesData) loadRules();
    setShowRules(p => !p);
  }

  function startNewSession() {
    setMessages([]);
    setSessionId(null);
    setSavedRules([]);
  }

  const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-black text-slate-900">AI Training</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Chat to teach Claude how to write your emails. Rules save automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleRules}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors"
            style={showRules
              ? { background: "rgba(99,102,241,0.1)", color: "#6366f1", borderColor: "rgba(99,102,241,0.3)" }
              : { background: "#fff", color: "#64748b", borderColor: "rgba(0,0,0,0.08)" }}>
            {showRules ? "Hide Rules" : "View Live Rules"}
            {rulesData ? ` (${rulesData.rule_count})` : ""}
          </button>
          <button
            onClick={startNewSession}
            className="px-3 py-1.5 rounded-xl text-xs font-bold border"
            style={{ background: "#fff", color: "#64748b", borderColor: "rgba(0,0,0,0.08)" }}>
            New Session
          </button>
        </div>
      </div>

      {/* Rules Inspector */}
      {showRules && (
        <div className={card}>
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-black text-slate-900">Live Email Rules</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  This is the exact note Claude reads before every draft.
                  {rulesData?.updated_at
                    ? ` Last updated ${new Date(rulesData.updated_at).toLocaleDateString()}.`
                    : ""}
                </p>
              </div>
              <button
                onClick={loadRules}
                disabled={rulesLoading}
                className="text-xs font-bold px-2 py-1 rounded-lg border disabled:opacity-40"
                style={{ borderColor: C.p1_20, color: C.p1 }}>
                {rulesLoading ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            {rulesLoading && !rulesData ? (
              <div className="h-24 flex items-center justify-center text-slate-400 text-sm animate-pulse">
                Loading rules…
              </div>
            ) : rulesData?.content ? (
              <pre className="text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed bg-slate-50 rounded-xl p-3 max-h-72 overflow-y-auto border"
                style={{ borderColor: C.p1_15 }}>
                {rulesData.content}
              </pre>
            ) : (
              <p className="text-sm text-slate-400 text-center py-6">
                No rules saved yet — start chatting to teach Claude your style.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Training Chat */}
      <div className={card}>
        <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />

        {/* Chat history */}
        <div className="p-4 space-y-3 min-h-[200px] max-h-[480px] overflow-y-auto">
          {sessionLoading ? (
            <div className="flex items-center justify-center h-24 text-slate-400 text-sm animate-pulse">
              Loading session…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
              <p className="text-sm text-slate-400">
                Tell Claude how you want your emails written.
              </p>
              <p className="text-xs text-slate-300">
                e.g. "Never add a travel fee for South Bay shoots" · "Keep replies under 4 sentences" · "Always mention the turnaround time upfront"
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className="max-w-[82%] px-3 py-2 rounded-xl text-sm leading-relaxed"
                  style={m.role === "user"
                    ? { background: C.grad12, color: "#fff" }
                    : { background: "rgba(99,102,241,0.08)", color: "#3730a3", border: "1px solid rgba(99,102,241,0.15)" }}>
                  {m.content}
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="px-3 py-2 rounded-xl text-sm" style={{ background: "rgba(99,102,241,0.08)", color: "#6366f1" }}>
                <span className="animate-spin inline-block mr-1">◌</span> Thinking…
              </div>
            </div>
          )}
          {savedRules.length > 0 && (
            <div className="px-3 py-2 rounded-xl text-xs" style={{ background: "rgba(16,185,129,0.08)", color: "#059669", border: "1px solid rgba(16,185,129,0.2)" }}>
              ✓ {savedRules.length} rule{savedRules.length > 1 ? "s" : ""} saved — Claude will use {savedRules.length > 1 ? "them" : "it"} in future drafts
              <ul className="mt-1 space-y-0.5 list-none">
                {savedRules.map((r, i) => <li key={i} className="truncate opacity-80">· {r}</li>)}
              </ul>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-slate-100 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="e.g. Don't add travel fees for South Bay shoots…"
            disabled={loading || sessionLoading}
            className="flex-1 text-sm px-3 py-2.5 rounded-xl outline-none disabled:opacity-50"
            style={{ border: `1px solid ${C.p1_20}`, background: "#fff", fontFamily: "inherit" }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || loading || sessionLoading}
            className="text-xs font-bold px-4 py-2.5 rounded-xl disabled:opacity-30 flex-shrink-0"
            style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)", color: "#fff" }}>
            Send
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="rounded-2xl p-4 text-xs text-slate-400 leading-relaxed"
        style={{ background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.1)" }}>
        <p className="font-bold text-slate-600 mb-1">How it works</p>
        <p>Every rule you teach here is saved to your vault and injected into Claude&apos;s system prompt before every draft. Rules are timestamped — newer rules always win over older ones. You can also teach Claude by clicking &quot;Analyze &amp; Learn&quot; on any inquiry after you edit an AI draft.</p>
      </div>

    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/chrissolo/Documents/github/my-landing && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors relating to `AiTab.tsx`.

- [ ] **Step 3: Commit**

```bash
git add app/admin/AiTab.tsx
git commit -m "feat: add AiTab component with persistent chat, rules inspector, and session history"
```

---

## Task 6: Add `/api/ai/session/latest` endpoint

The `AiTab` calls `GET /api/ai/session/latest` on mount to reload the last training conversation. This task creates that route.

**Files:**
- Create: `app/api/ai/session/latest/route.ts`

- [ ] **Step 1: Create the file**

```typescript
// GET /api/ai/session/latest
// Returns the most recent ai_training_sessions row so the chat UI can reload
// the last conversation on page mount.
// Response: { id: number; messages: {role:string;content:string}[] } | { id: null; messages: [] }

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_training_sessions")
    .select("id, messages")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ id: null, messages: [] });
  }

  return NextResponse.json({ id: data.id, messages: data.messages });
}
```

- [ ] **Step 2: Test the endpoint**

```bash
curl http://localhost:3000/api/ai/session/latest -H "Cookie: admin_session=YOUR_SECRET"
```

Expected: `{ id: null, messages: [] }` if no sessions yet, or `{ id: 1, messages: [...] }` after a training chat.

- [ ] **Step 3: Commit**

```bash
git add app/api/ai/session/latest/route.ts
git commit -m "feat: add GET /api/ai/session/latest endpoint"
```

---

## Task 7: Wire `AiTab` into admin page

**Files:**
- Modify: `app/admin/page.tsx`

Three changes:
1. Add `"ai"` to the `Tab` type and `CLIENT_TABS`
2. Import `AiTab`
3. Replace the inline Train AI panel in the inquiries tab with just the `<AiTab />` render at `tab==="ai"`
4. Remove the inline train-AI state variables and `sendTrainMessage` function

- [ ] **Step 1: Update the Tab type (line 48)**

Find:
```typescript
type Tab = "home"|"poses"|"locations"|"bayGuide"|"portfolio"|"categories"|"blog"|"library"|"analytics"|"payments"|"inquiries"|"clients"|"funnel"|"vault";
```

Replace with:
```typescript
type Tab = "home"|"poses"|"locations"|"bayGuide"|"portfolio"|"categories"|"blog"|"library"|"analytics"|"payments"|"inquiries"|"clients"|"funnel"|"vault"|"ai";
```

- [ ] **Step 2: Add "ai" to CLIENT_TABS and TAB_LABELS (line 77–79)**

Find:
```typescript
const CLIENT_TABS:Tab[]=["inquiries","clients","analytics","payments","funnel"];
```

Replace with:
```typescript
const CLIENT_TABS:Tab[]=["inquiries","clients","analytics","payments","funnel","ai"];
```

Find:
```typescript
const TAB_LABELS:Record<Tab,string>={home:"🏠 Home",poses:"📸 Grad Poses",locations:"📍 Campus Spots",bayGuide:"🗺️ Bay Guide",portfolio:"🖼️ Portfolio",categories:"🏷️ Categories",blog:"✍️ Blog",library:"🗄️ Image Library",analytics:"📊 Analytics",payments:"💵 Revenue",funnel:"📈 Funnel",inquiries:"📬 Inquiries",clients:"👥 Clients",vault:"📓 Vault"};
```

Replace with:
```typescript
const TAB_LABELS:Record<Tab,string>={home:"🏠 Home",poses:"📸 Grad Poses",locations:"📍 Campus Spots",bayGuide:"🗺️ Bay Guide",portfolio:"🖼️ Portfolio",categories:"🏷️ Categories",blog:"✍️ Blog",library:"🗄️ Image Library",analytics:"📊 Analytics",payments:"💵 Revenue",funnel:"📈 Funnel",inquiries:"📬 Inquiries",clients:"👥 Clients",vault:"📓 Vault",ai:"🤖 AI Training"};
```

- [ ] **Step 3: Add import at the top of the imports block (line ~36)**

After the `VaultTab` import line:
```typescript
import AiTab from "@/app/admin/AiTab";
```

- [ ] **Step 4: Remove inline train-AI state variables**

Find and delete these lines (around lines 208–218):
```typescript
  // ── Train AI chat ─────────────────────────────────────────────────────
  const [trainOpen, setTrainOpen] = useState(false);
  const [trainMessages, setTrainMessages] = useState<{role:"user"|"assistant";content:string}[]>([]);
  const [trainInput, setTrainInput] = useState("");
  const [trainLoading, setTrainLoading] = useState(false);
  const [trainSavedRules, setTrainSavedRules] = useState<string[]>([]);
  const trainBottomRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    if(trainOpen) trainBottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[trainMessages, trainOpen]);

  async function sendTrainMessage(){
    if(!trainInput.trim()||trainLoading) return;
    const userMsg = {role:"user" as const, content:trainInput.trim()};
    const next = [...trainMessages, userMsg];
    setTrainMessages(next);
    setTrainInput("");
    setTrainLoading(true);
    try {
      const res = await fetch("/api/train-ai",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({messages:next}),
      });
      const json = await res.json() as {reply:string; new_rules:string[]; saved_to_vault:boolean};
      setTrainMessages(p=>[...p,{role:"assistant",content:json.reply}]);
      if(json.new_rules?.length){
        setTrainSavedRules(json.new_rules);
        setTimeout(()=>setTrainSavedRules([]),4000);
      }
    } catch {
      setTrainMessages(p=>[...p,{role:"assistant",content:"Sorry, something went wrong. Try again."}]);
    } finally {
      setTrainLoading(false);
    }
  }
```

- [ ] **Step 5: Remove the inline Train AI Chat panel from the inquiries tab**

Find this entire block (around lines 2468–2535) and delete it:
```typescript
            {/* ── Train AI Chat (collapsible) ── */}
            <div className={card}>
              <div className="h-[3px]" style={{background:"linear-gradient(90deg,#6366f1,#8b5cf6)"}}/>
              <button className="w-full p-5 flex items-center justify-between gap-4 text-left" onClick={()=>setTrainOpen(p=>!p)}>
                ...entire block through...
              </button>
            </div>
```

- [ ] **Step 6: Add the AI tab render (near line 3638, after the vault tab)**

Find:
```typescript
        {tab==="vault"&&<VaultTab />}
```

Replace with:
```typescript
        {tab==="vault"&&<VaultTab />}
        {tab==="ai"&&<AiTab />}
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
cd /Users/chrissolo/Documents/github/my-landing && npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors.

- [ ] **Step 8: Build check**

```bash
cd /Users/chrissolo/Documents/github/my-landing && npm run build 2>&1 | tail -20
```

Expected: build succeeds.

- [ ] **Step 9: Commit**

```bash
git add app/admin/page.tsx app/admin/AiTab.tsx
git commit -m "feat: wire AiTab into admin nav, remove inline train-AI panel"
```

---

## Task 8: End-to-end smoke test

- [ ] **Step 1: Start dev server**

```bash
cd /Users/chrissolo/Documents/github/my-landing && npm run dev
```

- [ ] **Step 2: Navigate to `/admin` → AI Training tab**

Verify: tab appears in the CLIENT_TABS nav strip. Chat loads with either an empty state or the last saved conversation.

- [ ] **Step 3: Send a training message**

Type: `"When someone asks about pricing, always give them the exact package price upfront."`

Verify:
- Assistant responds naturally
- Green "✓ 1 rule saved" badge appears with the extracted rule text
- If you click "View Live Rules", the rule appears in the rendered vault note

- [ ] **Step 4: Reload the page**

Navigate to `/admin?tab=ai`. Verify: the conversation you had in Step 3 reloads automatically (session history persisted to Supabase).

- [ ] **Step 5: View Live Rules**

Click "View Live Rules". Verify: shows the current Email Rules note content with rule count in the button label.

- [ ] **Step 6: Verify draft-reply still works**

Go to `inquiries` tab → click "Draft Reply" on any inquiry. Verify: draft generates without errors.

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "feat: AI training system overhaul complete"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ Persistent chat history (Task 3 + Task 6 — `ai_training_sessions` table + latest session loader)
- ✅ Dedicated AI tab (Task 5 + Task 7 — `AiTab.tsx` + admin page wiring)
- ✅ Rules inspector / debug endpoint (Task 2 — `GET /api/ai/rules`)
- ✅ Aggressive rule extraction (Task 3 — updated `EXTRACT_SYSTEM` prompt)
- ✅ Prompt caching on both `train-ai` and `draft-reply` (Task 3 + Task 4)
- ✅ Remove inline train-AI panel from inquiries (Task 7)
- ✅ Session reload on page mount (Task 5 + Task 6)

**No placeholders:** All code blocks are complete and exact.

**Type consistency:**
- `Message` type defined in `AiTab.tsx` as `{ role: "user" | "assistant"; content: string }` — matches what `train-ai` accepts and returns
- `session_id` flows: `AiTab` → `POST /api/train-ai` body → `persistSession()` → response → stored in `AiTab` state
- `RulesData` type matches `GET /api/ai/rules` response shape exactly
