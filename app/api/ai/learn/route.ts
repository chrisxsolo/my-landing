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

/** The body after runtime validation; nothing here is trusted before parseBody. */
type Body = {
  aiDraft: string;
  sentDraft: string;
  mode: "auto" | "review";
  /** Present when this ran from a send, which is what makes it measurable. */
  inquiryId: number | null;
  wasRegenerated: boolean;
};

const MODES = new Set(["auto", "review"]);

/**
 * Checks every field's runtime type before any string method runs on it. A
 * number where a draft should be is a bad request, not a crash, and nothing
 * but a string is ever treated as email text.
 */
function parseBody(raw: unknown): Body | string {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return "The body must be a JSON object.";
  const body = raw as Record<string, unknown>;
  if (typeof body.ai_draft !== "string" || typeof body.actual_sent !== "string") {
    return "ai_draft and actual_sent must be strings.";
  }
  const aiDraft = body.ai_draft.trim();
  const sentDraft = body.actual_sent.trim();
  if (!aiDraft || !sentDraft) return "ai_draft and actual_sent are required.";

  const modeRaw = body.mode === undefined ? "auto" : body.mode;
  if (typeof modeRaw !== "string" || !MODES.has(modeRaw.toLowerCase())) return 'mode must be "auto" or "review".';

  const idRaw = body.inquiry_id;
  if (idRaw !== undefined && idRaw !== null && typeof idRaw !== "number" && typeof idRaw !== "string") {
    return "inquiry_id must be a number, a numeric string, or null.";
  }
  const inquiryId = idRaw === undefined || idRaw === null || idRaw === "" ? NaN : Number(idRaw);
  if (idRaw !== undefined && idRaw !== null && idRaw !== "" && !Number.isFinite(inquiryId)) {
    return "inquiry_id must be a number, a numeric string, or null.";
  }
  if (body.was_regenerated !== undefined && typeof body.was_regenerated !== "boolean") {
    return "was_regenerated must be a boolean.";
  }
  return {
    aiDraft, sentDraft,
    mode: modeRaw.toLowerCase() as Body["mode"],
    inquiryId: Number.isFinite(inquiryId) && inquiryId > 0 ? inquiryId : null,
    wasRegenerated: body.was_regenerated === true,
  };
}

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

/**
 * Telemetry is written after the result exists and must never replace it: a
 * metrics-table failure is logged by name only and the result goes out as
 * computed. Never logs the drafts, the edits or the rules.
 */
async function recordQuietly(label: "usage" | "draft outcome", write: () => Promise<void>): Promise<void> {
  try {
    await write();
  } catch (err) {
    console.error(`[ai/learn] ${label} metrics write failed; result returned anyway:`, err instanceof Error ? err.name : typeof err);
  }
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("Invalid JSON body.");
  }
  const body = parseBody(raw);
  if (typeof body === "string") return badRequest(body);
  const { aiDraft, sentDraft } = body;
  const wantsRules = body.mode === "review";

  try {
    // ── Deterministic path: free, and the default ──────────────────────────
    if (!wantsRules) {
      const result = analyzeEditsDeterministically({ aiDraft, sentDraft, existingRules: [] });

      // Keep the measurement. Metrics only, no email bodies, and still no
      // writing rule: measuring an edit and learning from it stay separate.
      await recordQuietly("draft outcome", () => recordDraftOutcome(buildDraftOutcome({
        inquiryId: body.inquiryId,
        aiDraft,
        sentDraft,
        wasRegenerated: body.wasRegenerated,
        edits: result.edits,
      })));

      return toResponse({ ...result, pending: [], apiCalls: 0 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const modelConfig = resolveEmailModelConfig();
    const result = await runLearnReview({ aiDraft, sentDraft }, {
      fetchRules: fetchWritingRules,
      insertRule: insertWritingRule,
      call: apiKey ? createEmailModelCaller(apiKey, modelConfig) : null,
    });

    await recordQuietly("usage", () => recordLearnUsage(result, modelConfig.model));
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
