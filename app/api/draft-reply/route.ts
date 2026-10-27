// ─────────────────────────────────────────────────────────────────────────────
// POST /api/draft-reply — the email assistant's single generation endpoint.
//
// Runs on Claude. Exactly one API call per draft, whichever mode is used.
//
// Modes, selected by `mode` (legacy payloads are mapped for compatibility):
//   generate   — fresh draft, or a regeneration
//   refine     — apply one instruction from Chris, change nothing else
//   polish     — turn dictation or bullets into a finished email
//   shorten    — cut length, keep every fact
//   naturalize — pull the wording back toward Chris's voice
//
// Response: { draft, validation, warnings, quote, pricing, usage, budget }
//
// Learning moved out to POST /api/ai/learn, which is deterministic and makes
// no API call. It used to run here as a second request whose only job was
// rewriting the rules note, which it truncated.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { resolveEmailModelConfig, createEmailModelCaller, friendlyModelError } from "@/lib/ai/emailModel";
import { fetchAvailabilitySnapshot } from "@/lib/ai/availabilitySnapshot";
import { fetchWritingRules, fetchExamplePool, recordUsage, fetchMonthToDateSpendUsd } from "@/lib/ai/aiEmailStore";
import { resolveBudgetConfig, evaluateBudget, type EmailOperation } from "@/lib/ai/aiUsage";
import { estimateRecordCostUsd } from "@/lib/ai/aiUsage";
import { dedupe, dedupKey } from "@/lib/ai/requestDedup";
import {
  generateDraft, refineDraft, polishDraft, shortenDraft, naturalizeDraft,
  type OperationResult,
} from "@/lib/ai/emailOperations";
import type { ThreadMessage } from "@/lib/ai/threadDigest";
import type { InquiryInput } from "@/lib/ai/buildEmailContext";
import { quoteInputOf } from "@/lib/ai/validateEmailDraft";
import { fetchInquiryAdminRow } from "@/lib/ai/aiEmailStore";

export const dynamic = "force-dynamic";

const MODES = ["generate", "refine", "polish", "shorten", "naturalize"] as const;
type Mode = (typeof MODES)[number];

type Body = {
  mode?: string;
  /**
   * The inquiry this draft is for. Used to read invoice, contract and deposit
   * state from the record. Administrative status is NEVER taken from the
   * request body: a browser must not be able to assert that an invoice went
   * out, and the draft is what claims it to the client.
   */
  inquiry_id?: number | string | null;
  name?: string;
  email?: string;
  phone?: string | null;
  session_type?: string | null;
  message?: string;
  date_in_mind?: string | null;
  preferred_time?: string | null;
  location?: string | null;
  school?: string | null;
  people?: string | number | null;
  instagram?: string | null;
  thread_messages?: { timestamp?: string | number; fromMe?: boolean; body?: string }[];
  thread_context?: string | null;
  thread_loaded?: boolean;
  latest_message_body?: string | null;
  latest_message_from?: string | null;
  current_draft?: string | null;
  feedback?: string | null;
  raw_draft?: string | null;
  is_regeneration?: boolean;
  /** Earlier quotes the admin confirmed as agreed for this client. */
  confirmed_prices?: unknown;
  // Legacy field names still sent by older clients.
  previous_draft?: string | null;
};

/** At most 10 positive dollar amounts; anything else is ignored. */
function confirmedPricesOf(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0 && v < 100_000).slice(0, 10);
}

/**
 * Maps a payload onto a mode.
 *
 * Explicit `mode` wins. Without one, the legacy shape is inferred the way the
 * previous route did it, so an un-updated client keeps working.
 */
function resolveMode(body: Body): Mode {
  const explicit = (body.mode ?? "").trim().toLowerCase();
  if ((MODES as readonly string[]).includes(explicit)) return explicit as Mode;
  if (body.raw_draft?.trim()) return "polish";
  if (body.feedback?.trim() && (body.current_draft ?? body.previous_draft)?.trim()) return "refine";
  return "generate";
}

function toThreadMessages(body: Body): ThreadMessage[] {
  return (body.thread_messages ?? [])
    .filter((message) => typeof message.body === "string" && message.body.trim())
    .map((message) => ({
      timestamp: message.timestamp ?? new Date().toISOString(),
      fromMe: Boolean(message.fromMe),
      body: String(message.body),
    }));
}

function toInquiry(body: Body): InquiryInput {
  return {
    name: String(body.name),
    email: String(body.email),
    phone: body.phone ?? null,
    sessionType: body.session_type ?? null,
    message: String(body.message ?? ""),
    dateInMind: body.date_in_mind ?? null,
    preferredTime: body.preferred_time ?? null,
    location: body.location ?? null,
    school: body.school ?? null,
    people: body.people ?? null,
    instagram: body.instagram ?? null,
  };
}

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured. Add it to your environment variables." },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.name || !body.email) {
    return NextResponse.json({ error: "name and email are required." }, { status: 400 });
  }

  const mode = resolveMode(body);
  const currentDraft = (body.current_draft ?? body.previous_draft ?? "").trim();

  if ((mode === "refine" || mode === "shorten" || mode === "naturalize") && !currentDraft) {
    return NextResponse.json({ error: `Mode "${mode}" needs an existing draft.` }, { status: 400 });
  }
  if (mode === "refine" && !body.feedback?.trim()) {
    return NextResponse.json({ error: "Mode \"refine\" needs feedback." }, { status: 400 });
  }
  if (mode === "polish" && !body.raw_draft?.trim()) {
    return NextResponse.json({ error: "Mode \"polish\" needs a rough draft." }, { status: 400 });
  }

  const modelConfig = resolveEmailModelConfig();
  const budgetConfig = resolveBudgetConfig();

  // Budget is checked before spending, and only blocks when the app-level limit
  // is explicitly enabled. It is a local estimate, not an Anthropic cap.
  const spentUsd = await fetchMonthToDateSpendUsd();
  const budget = evaluateBudget(spentUsd, budgetConfig);
  if (budget.blocked) {
    return NextResponse.json({ error: budget.message, budget }, { status: 429 });
  }

  const key = dedupKey([
    mode, body.email, body.message, currentDraft,
    body.feedback, body.raw_draft, body.latest_message_body,
    confirmedPricesOf(body.confirmed_prices).join(","),
  ]);

  try {
    const result = await dedupe(key, async (): Promise<OperationResult> => {
      const inquiryId = Number(body.inquiry_id);
      const [availability, rules, examplePool, adminRow] = await Promise.all([
        fetchAvailabilitySnapshot(),
        fetchWritingRules(),
        fetchExamplePool(),
        Number.isFinite(inquiryId) && inquiryId > 0
          ? fetchInquiryAdminRow(inquiryId)
          : Promise.resolve(null),
      ]);

      const shared = {
        inquiry: toInquiry(body),
        messages: toThreadMessages(body),
        availability,
        // Absent flag means an older client that cannot report it; a non-empty
        // thread is itself proof the thread loaded.
        threadLoaded: body.thread_loaded ?? (body.thread_messages?.length ?? 0) > 0,
        examplePool,
        rules,
        adminRow,
        // Every mode gets it, so stage detection is the same whether this is a
        // fresh draft or a refinement of one.
        latestClientMessage: body.latest_message_from === "me" ? null : (body.latest_message_body ?? null),
        confirmedPrices: confirmedPricesOf(body.confirmed_prices),
      };

      const call = createEmailModelCaller(apiKey, modelConfig);
      const threadText = body.thread_context ?? null;

      switch (mode) {
        case "refine":
          return refineDraft({ ...shared, currentDraft, threadText, feedback: String(body.feedback) }, call);
        case "polish":
          return polishDraft({ ...shared, currentDraft, threadText, rawDraft: String(body.raw_draft) }, call);
        case "shorten":
          return shortenDraft({ ...shared, currentDraft, threadText }, call);
        case "naturalize":
          return naturalizeDraft({ ...shared, currentDraft, threadText }, call);
        case "generate":
        default:
          return generateDraft({
            ...shared,
            threadText,
            chrisInstruction: body.feedback ?? null,
            isRegeneration: Boolean(body.is_regeneration),
            // The draft he rejected, so a second attempt can actually differ
            // from it. Empty on a first generation.
            previousDraft: currentDraft || null,
          }, call);
      }
    });

    const estimatedCostUsd = estimateRecordCostUsd(result.usage);
    // Awaited so a serverless function cannot be frozen mid-insert and lose the
    // row, which would quietly under-report spend.
    await recordUsage(result.usage);

    return NextResponse.json({
      draft: result.draft,
      mode,
      validation: result.validation,
      warnings: result.context.warnings,
      // The rate card's inputs for this inquiry, so the panel can re-check
      // prices live as the draft is edited (lib/ai/quotePricing).
      quote: { input: quoteInputOf(result.context), stalePrices: result.context.pricing.stalePrices },
      // Figures the rate card replaced before the draft came back, with the
      // text as the model wrote it, so the panel can show what changed.
      pricing: result.pricing,
      usage: {
        model: result.usage.model,
        input_tokens: result.usage.input_tokens,
        output_tokens: result.usage.output_tokens,
        cache_read_input_tokens: result.usage.cache_read_input_tokens,
        duration_ms: result.usage.duration_ms,
        estimated_cost_usd: estimatedCostUsd,
        unpriced_model: modelConfig.unpricedModel,
      },
      budget: evaluateBudget(spentUsd + estimatedCostUsd, budgetConfig),
    });
  } catch (err) {
    console.error(`[draft-reply] ${mode} failed:`, err);

    const message = err instanceof Error ? err.message : String(err);
    const errorKind = /timeout|aborted/i.test(message) ? "timeout"
      : /rate.?limit|429/i.test(message) ? "rate_limit"
      : /overloaded/i.test(message) ? "overloaded"
      : /401|authentication/i.test(message) ? "auth"
      : "unknown";

    await recordUsage({
      operation: mode as EmailOperation,
      model: modelConfig.model,
      input_tokens: 0, output_tokens: 0,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0,
      duration_ms: 0, success: false, error_kind: errorKind,
    });

    // No draft field in the response: the client keeps whatever it already has.
    return NextResponse.json({ error: friendlyModelError(err) }, { status: 502 });
  }
}
