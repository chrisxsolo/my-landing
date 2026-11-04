// ─────────────────────────────────────────────────────────────────────────────
// POST /api/ai/learn — learn a writing preference from an edit.
//
// Body: { ai_draft, actual_sent, mode?: "auto" | "review", inquiry_id?, was_regenerated? }
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
// Response (200): { outcome, edits, candidates, pending, message, api_calls,
//                   error_code?, retryable? }
//   `outcome` is a LearnOutcome code (lib/ai/learnFromEdit.ts). A model or
//   store failure after the diff succeeded is still a 200 with the edits and
//   outcome "phrasing_failed" / "persist_failed": the comparison is the result
//   Chris asked for, and the panel needs it to say what it found.
// Response (4xx/5xx): { error, code } for a bad request, missing auth, or a bug.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { resolveEmailModelConfig, createEmailModelCaller } from "@/lib/ai/emailModel";
import { fetchWritingRules, insertWritingRule, recordUsage, recordDraftOutcome } from "@/lib/ai/aiEmailStore";
import { analyzeEditsDeterministically } from "@/lib/ai/learnFromEdit";
import { runLearnReview, describeForLog, type LearnReviewResult } from "@/lib/ai/learnService";
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

const RETRYABLE = new Set(["phrasing_failed", "persist_failed"]);

function badRequest(error: string) {
  return NextResponse.json({ error, code: "invalid_request" }, { status: 400 });
}

function toResponse(result: LearnReviewResult) {
  return NextResponse.json({
    outcome: result.outcome,
    edits: result.edits,
    candidates: result.candidates,
    pending: result.pending,
    message: result.message,
    api_calls: result.apiCalls,
    ...(result.failure ? { error_code: result.failure.code, retryable: RETRYABLE.has(result.outcome) } : {}),
  });
}

async function recordLearnUsage(result: LearnReviewResult, fallbackModel: string): Promise<void> {
  if (result.usage) {
    await recordUsage({
      operation: "learn", model: result.usage.model,
      input_tokens: result.usage.input_tokens, output_tokens: result.usage.output_tokens,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      duration_ms: result.usage.duration_ms, success: true,
    });
    return;
  }
  // The call was made and failed: no token counts exist, so none are invented.
  if (result.apiCalls > 0 && result.failure) {
    await recordUsage({
      operation: "learn", model: fallbackModel,
      input_tokens: 0, output_tokens: 0, cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      duration_ms: 0, success: false, error_kind: result.failure.code,
    });
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const aiDraft = (body.ai_draft ?? "").trim();
  const sentDraft = (body.actual_sent ?? "").trim();
  if (!aiDraft || !sentDraft) return badRequest("ai_draft and actual_sent are required.");

  const wantsRules = (body.mode ?? "auto").toLowerCase() === "review";

  try {
    // ── Deterministic path: free, and the default ──────────────────────────
    if (!wantsRules) {
      const result = analyzeEditsDeterministically({ aiDraft, sentDraft, existingRules: [] });

      // Keep the measurement. Metrics only, no email bodies, and still no
      // writing rule: measuring an edit and learning from it stay separate.
      const inquiryId = Number(body.inquiry_id);
      await recordDraftOutcome(buildDraftOutcome({
        inquiryId: Number.isFinite(inquiryId) && inquiryId > 0 ? inquiryId : null,
        aiDraft,
        sentDraft,
        wasRegenerated: Boolean(body.was_regenerated),
        edits: result.edits,
      }));

      return toResponse({ ...result, pending: [], apiCalls: 0 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const modelConfig = resolveEmailModelConfig();
    const result = await runLearnReview({ aiDraft, sentDraft }, {
      fetchRules: fetchWritingRules,
      insertRule: insertWritingRule,
      call: apiKey ? createEmailModelCaller(apiKey, modelConfig) : null,
    });

    await recordLearnUsage(result, modelConfig.model);
    if (result.failure) {
      // Metadata only: outcome, code, counts and kinds. Never the drafts.
      console.error("[ai/learn] review did not complete:", describeForLog(result, { aiDraft, sentDraft }));
    }
    return toResponse(result);
  } catch (err) {
    console.error("[ai/learn] unexpected failure:", err instanceof Error ? err.name : typeof err, { mode: wantsRules ? "review" : "auto" });
    return NextResponse.json(
      { error: "Learning failed before the comparison could finish. Your edits are still here; try again.", code: "internal" },
      { status: 500 },
    );
  }
}
