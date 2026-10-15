// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/learn — learn a writing preference from an edit.
//
// Body: { ai_draft, actual_sent, mode?: "auto" | "review" }
//
//   auto    — deterministic only. Zero API calls. This is what runs after a
//             send, so sending an email never costs anything and never
//             silently changes how future drafts are written. It writes one
//             measurement row (ai_draft_outcomes): word counts, a similarity
//             ratio and the kinds of edit found, never any email content, and
//             never a writing rule.
//   review  — deterministic, then ONE Claude call to phrase the stylistic
//             edits as rules. Candidates are saved as `pending`; they only
//             affect drafts once approved via POST /api/ai/rules.
//
// Replaces the previous analyze mode, which made two calls, treated every
// one-word change as a style rule, and rewrote the whole rules note at a token
// limit below the note's own length.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { resolveEmailModelConfig, createEmailModelCaller, friendlyModelError } from "@/lib/ai/emailModel";
import { fetchWritingRules, insertWritingRule, recordUsage, recordDraftOutcome } from "@/lib/ai/aiEmailStore";
import { analyzeEditsDeterministically, learnFromEdit } from "@/lib/ai/learnFromEdit";
import { buildDraftOutcome } from "@/lib/ai/draftOutcome";

export const dynamic = "force-dynamic";

type Body = {
  ai_draft?: string;
  actual_sent?: string;
  mode?: string;
  /** Present when this ran from a send, which is what makes it measurable. */
  inquiry_id?: number | string | null;
  was_regenerated?: boolean;
};

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const aiDraft = (body.ai_draft ?? "").trim();
  const sentDraft = (body.actual_sent ?? "").trim();
  if (!aiDraft || !sentDraft) {
    return NextResponse.json({ error: "ai_draft and actual_sent are required." }, { status: 400 });
  }

  const existingRules = await fetchWritingRules();
  const wantsRules = (body.mode ?? "auto").toLowerCase() === "review";

  // ── Deterministic path: free, and the default ────────────────────────────
  if (!wantsRules) {
    const result = analyzeEditsDeterministically({ aiDraft, sentDraft, existingRules });

    // Keep the measurement. This path already computed the diff on every send
    // and then discarded it, so the system could say what a draft cost but
    // never whether Chris sent it. Metrics only, no email bodies, and still no
    // writing rule: measuring an edit and learning from it stay separate.
    const inquiryId = Number(body.inquiry_id);
    await recordDraftOutcome(buildDraftOutcome({
      inquiryId: Number.isFinite(inquiryId) && inquiryId > 0 ? inquiryId : null,
      aiDraft,
      sentDraft,
      wasRegenerated: Boolean(body.was_regenerated),
      edits: result.edits,
    }));

    return NextResponse.json({
      edits: result.edits,
      candidates: [],
      message: result.message,
      api_calls: 0,
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 503 });
  }

  const modelConfig = resolveEmailModelConfig();

  try {
    const result = await learnFromEdit(
      { aiDraft, sentDraft, existingRules },
      createEmailModelCaller(apiKey, modelConfig),
    );

    if (result.usage) {
      await recordUsage({
        operation: "learn",
        model: result.usage.model,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        duration_ms: result.usage.duration_ms,
        success: true,
      });
    }

    // New candidates are persisted as pending so they survive a page reload and
    // show up in the approval queue. Duplicates and conflicts are not written:
    // a duplicate is already stored, and a conflict needs a decision first.
    const saved = await Promise.all(
      result.candidates
        .filter((candidate) => candidate.intake.verdict === "new")
        .map(async (candidate) => {
          const row = await insertWritingRule({
            rule: candidate.rule,
            category: "style",
            status: "pending",
            source: "learn-from-edit",
          });
          return row ? { id: row.id, rule: row.rule } : null;
        }),
    );

    return NextResponse.json({
      edits: result.edits,
      candidates: result.candidates,
      pending: saved.filter(Boolean),
      message: result.message,
      api_calls: result.deterministicOnly ? 0 : 1,
    });
  } catch (err) {
    console.error("[ai/learn] failed:", err);
    await recordUsage({
      operation: "learn", model: modelConfig.model,
      input_tokens: 0, output_tokens: 0,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      duration_ms: 0, success: false, error_kind: "unknown",
    });
    return NextResponse.json({ error: friendlyModelError(err) }, { status: 502 });
  }
}
