// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/batch-drafts
//
// Drafts a reply for every unanswered inquiry, using the same Claude pipeline
// as the single-draft endpoint so a batch draft is not a lower-quality draft.
//
// Previously this ran GPT-4.1 at temperature 0.9 against its own copy of the
// prompt, with three whole vault folders inlined and no validation, so batch
// drafts and single drafts disagreed about how to write.
//
// Still one API call per inquiry — that is inherent to drafting N emails — but
// the shared stable prompt prefix is cached after the first call, so the rest
// read it at a fraction of the input price.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { resolveEmailModelConfig, createEmailModelCaller } from "@/lib/ai/emailModel";
import { fetchAvailabilitySnapshot } from "@/lib/ai/availabilitySnapshot";
import { fetchWritingRules, fetchExamplePool, recordUsage } from "@/lib/ai/aiEmailStore";
import { resolveBudgetConfig, evaluateBudget } from "@/lib/ai/aiUsage";
import { fetchMonthToDateSpendUsd } from "@/lib/ai/aiEmailStore";
import { generateDraft } from "@/lib/ai/emailOperations";

export const dynamic = "force-dynamic";
// Drafts generate in parallel batches; this needs more than the default timeout.
export const maxDuration = 300;

/** Concurrency cap, so a hundred inquiries do not become a hundred open sockets. */
const BATCH_SIZE = 8;
const MAX_INQUIRIES = 200;

type InquiryRow = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  session_type: string | null;
  date_in_mind: string | null;
  message: string | null;
  school: string | null;
  people: string | null;
  preferred_time: string | null;
  location: string | null;
};

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY is not configured." }, { status: 503 });
  }

  const supabase = createSupabaseServerClient();
  const { data: inquiries, error } = await supabase
    .from("inquiries")
    .select("id, name, email, phone, session_type, date_in_mind, message, school, people, preferred_time, location")
    .is("reply_sent_at", null)
    .order("created_at", { ascending: false })
    .limit(MAX_INQUIRIES);

  if (error) {
    console.error("[batch-drafts] fetch inquiries error", error);
    return NextResponse.json({ error: "Failed to fetch inquiries" }, { status: 500 });
  }
  if (!inquiries?.length) {
    return NextResponse.json({ message: "No unanswered inquiries found" }, { status: 200 });
  }

  // A batch is the easiest way to burn through a month's budget by accident, so
  // it is checked up front and refused as a whole rather than part-way through.
  const budgetConfig = resolveBudgetConfig();
  const budget = evaluateBudget(await fetchMonthToDateSpendUsd(), budgetConfig);
  if (budget.blocked) {
    return NextResponse.json({ error: budget.message, budget }, { status: 429 });
  }

  const [availability, rules, examplePool] = await Promise.all([
    fetchAvailabilitySnapshot(),
    fetchWritingRules(),
    fetchExamplePool(),
  ]);

  const config = resolveEmailModelConfig();
  const call = createEmailModelCaller(apiKey, config);
  const rows = inquiries as InquiryRow[];

  const results: { inquiry_id: number; inquiry_name: string; draft: string; valid: boolean }[] = [];
  let failed = 0;

  for (let start = 0; start < rows.length; start += BATCH_SIZE) {
    const settled = await Promise.allSettled(
      rows.slice(start, start + BATCH_SIZE).map(async (inquiry) => {
        const result = await generateDraft({
          inquiry: {
            name: inquiry.name,
            email: inquiry.email,
            phone: inquiry.phone,
            sessionType: inquiry.session_type,
            message: inquiry.message ?? "",
            dateInMind: inquiry.date_in_mind,
            preferredTime: inquiry.preferred_time,
            location: inquiry.location,
            school: inquiry.school,
            people: inquiry.people,
          },
          // A batch runs off the inquiry form alone; no Gmail thread is loaded,
          // and saying so keeps the draft from implying prior correspondence.
          messages: [],
          availability,
          threadLoaded: true,
          examplePool,
          rules,
          latestClientMessage: null,
          threadText: null,
        }, call);

        await recordUsage(result.usage);
        return {
          inquiry_id: inquiry.id,
          inquiry_name: inquiry.name,
          draft: result.draft,
          valid: result.validation.valid,
        };
      }),
    );

    for (const outcome of settled) {
      if (outcome.status === "fulfilled") results.push(outcome.value);
      else failed += 1;
    }
  }

  if (failed > 0) console.error(`[batch-drafts] ${failed} draft(s) failed`);

  return NextResponse.json({
    results,
    request_count: rows.length,
    failed,
    // Drafts that failed deterministic validation are flagged, not hidden.
    needs_review: results.filter((row) => !row.valid).length,
  });
}
