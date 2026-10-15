// ─────────────────────────────────────────────────────────────────────────────
// The two drafts Chris named as failures, re-drafted.
//
//   AI_LIVE_EVAL=1 npx tsx --env-file=.env.local tests/live/evalNamedFailures.ts
//
// Inquiry #131 (family session, Rockaway Beach) and inquiry #129 (graduation,
// Samuel Merritt in Oakland). Both are read live from the database, including
// the administrative columns, so the draft is produced against the same facts
// the admin dashboard has. The rejected draft is printed above each new one.
//
// The thread for #131 is supplied here because the app's Gmail refresh token
// is revoked, so the pipeline cannot load it. Point-in-time: only the messages
// that existed when Chris replied.
//
// Read-only. Nothing is sent, nothing is written.
// ─────────────────────────────────────────────────────────────────────────────

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolveEmailModelConfig, createEmailModelCaller } from "../../lib/ai/emailModel";
import { generateDraft } from "../../lib/ai/emailOperations";
import { estimateUsageCostUsd } from "../../lib/ai/modelPricing";
import { fetchAvailabilitySnapshot } from "../../lib/ai/availabilitySnapshot";
import type { ThreadMessage } from "../../lib/ai/threadDigest";
import type { InquiryAdminRow } from "../../lib/ai/adminStatus";

config({ path: ".env.local" });

type Case = {
  inquiryId: number;
  label: string;
  /** The draft Chris rejected, verbatim from his report. */
  rejected: string;
  messages: ThreadMessage[];
  latestClientMessage: string | null;
  /** What has to be true of a good reply here. */
  expectations: string[];
};

const CASES: Case[] = [
  {
    inquiryId: 131,
    label: "#131 family session, confirming 5:45 pm",
    rejected: `So glad 5:45 pm works! Friday, October 16th should be a beautiful evening for it, and the light at Rockaway Beach is going to be lovely

Go ahead and send over the pin for the public parking lot whenever you have it, and I'll meet your family there

I sent the invoice and contract to your email to secure your session

If you need to reach me, here's my number

Talk soon!`,
    messages: [
      {
        timestamp: "2026-10-15T03:26:33Z",
        fromMe: true,
        body: "Thank you so much for reaching out! I'm so sorry for your family's loss, and I'd love to help capture some family photos while everyone is together. I'm available this Friday, October 16th, at 5:45 pm. My 30-minute family session is $350",
      },
      {
        timestamp: "2026-10-15T06:24:05Z",
        fromMe: false,
        body: "Hi Chris, Awesome!! Thank you so very much for being able to photograph us on Friday!! Yes, 5:45 would be great! I will send you the location of the public parking lot at Rockaway Beach where we can meet",
      },
    ],
    latestClientMessage:
      "Hi Chris, Awesome!! Thank you so very much for being able to photograph us on Friday!! Yes, 5:45 would be great! I will send you the location of the public parking lot at Rockaway Beach where we can meet",
    expectations: [
      "No claim that the invoice or contract was sent (the record says neither was)",
      "No description of the light or the evening",
      "A phone number only if the digits are there",
      "Short: she is confirming, not asking",
    ],
  },
  {
    inquiryId: 129,
    label: "#129 graduation inquiry, lighting and champagne",
    rejected: `Thank you so much for reaching out! I'd love to shoot your graduation, and congratulations!

I can no longer do October 16th during sunset, but I can do it during sunrise. I'm also free October 19th to 21st for a sunset time, and starting around 5:30 pm would give you that soft golden light. It'll look great on the building and the stair steps

The champagne setup is a fun add-on, and it's $15. My graduation session is $350 per hour, and the travel fee for Oakland depends on the exact location, so I'll confirm that for you

Let me know which of those dates works for you!

Once we lock in the date, time, and location, I'll send over the invoice and contract to secure your session`,
    messages: [],
    latestClientMessage: null,
    expectations: [
      'Opening pairs the thanks and the congratulations, then "I\'d love to take your graduation pictures"',
      '"start at $350", never "$350 per hour"',
      "No sentence about how the building or stairs will look",
      "Travel mentioned as a clause at most, since Oakland is not in the rate card",
      "One closing, combining the ask and the booking step",
    ],
  },
];

async function main(): Promise<void> {
  if (process.env.AI_LIVE_EVAL !== "1") {
    console.log("Live evaluation is off. Re-run with AI_LIVE_EVAL=1 to make real, paid API calls.");
    return;
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) { console.error("ANTHROPIC_API_KEY is not set."); process.exit(1); }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const availability = await fetchAvailabilitySnapshot();
  const modelConfig = resolveEmailModelConfig();
  const call = createEmailModelCaller(apiKey, modelConfig);

  const usages = [];
  const records = [];

  for (const testCase of CASES) {
    const { data, error } = await supabase
      .from("inquiries")
      .select("id, name, email, session_type, message, school, people, date_in_mind, preferred_time, location, invoice_sent_at, contract_sent_at, deposit_paid_at, gallery_delivered_at, confirmation_sent_at, booking_confirmed, payment_status, session_date")
      .eq("id", testCase.inquiryId)
      .maybeSingle();
    if (error || !data) { console.error(`Could not load inquiry ${testCase.inquiryId}`); continue; }

    const row = data as unknown as InquiryAdminRow & Record<string, unknown> & { name: string; email: string };

    const result = await generateDraft({
      inquiry: {
        name: row.name,
        email: row.email,
        sessionType: (row.session_type as string | null) ?? null,
        message: (row.message as string | null) ?? "",
        dateInMind: (row.date_in_mind as string | null) ?? null,
        preferredTime: (row.preferred_time as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        school: (row.school as string | null) ?? null,
        people: (row.people as string | null) ?? null,
      },
      messages: testCase.messages,
      availability,
      threadLoaded: true,
      rules: [],
      threadText: testCase.messages.length
        ? testCase.messages.map((m) => `${m.fromMe ? "Chris" : "Client"}: ${m.body}`).join("\n\n")
        : null,
      latestClientMessage: testCase.latestClientMessage,
      adminRow: row,
    }, call);

    usages.push(result.usage);
    const words = result.draft.split(/\s+/).filter(Boolean).length;

    records.push({
      id: testCase.inquiryId,
      label: testCase.label,
      stage: result.context.conversation.stage,
      words,
      factsVerified: result.validation.factsVerified,
      issues: result.validation.issues,
      rejected: testCase.rejected,
      draft: result.draft,
      adminStatus: {
        invoiceSent: result.context.admin.invoiceSent,
        contractSent: result.context.admin.contractSent,
        depositPaid: result.context.admin.depositPaid,
        sessionDate: result.context.admin.sessionDate,
      },
    });

    console.log("═".repeat(74));
    console.log(testCase.label);
    console.log(`record: invoice ${result.context.admin.invoiceSent ? "SENT" : "not sent"} · contract ${result.context.admin.contractSent ? "SENT" : "not sent"} · deposit ${result.context.admin.depositPaid ? "PAID" : "unpaid"} · session date ${result.context.admin.sessionDate ?? "none"}`);
    console.log(`stage detected: ${result.context.conversation.stage}`);
    console.log("─".repeat(74));
    console.log("REJECTED DRAFT:");
    console.log(testCase.rejected);
    console.log("─".repeat(74));
    console.log("NEW DRAFT:");
    console.log(result.draft);
    console.log("─".repeat(74));
    console.log(`${words} words (rejected: ${testCase.rejected.split(/\s+/).length}) · facts ${result.validation.factsVerified ? "OK" : "FAIL"} · ${result.validation.styleIssues.length} style flags`);
    for (const issue of result.validation.issues) {
      console.log(`    [${issue.category}/${issue.severity}] ${issue.type}: ${issue.excerpt ?? issue.description}`);
    }
    console.log("\nWhat a good reply needs here:");
    for (const expectation of testCase.expectations) console.log(`  - ${expectation}`);
    console.log();
  }

  const { totalUsd } = estimateUsageCostUsd(usages);
  mkdirSync(".eval-out", { recursive: true });
  writeFileSync(".eval-out/live-named.json", JSON.stringify({ records }, null, 2));
  console.log("═".repeat(74));
  console.log(`${records.length} cases · measured cost $${totalUsd.toFixed(4)}`);
  console.log("Written to .eval-out/live-named.json");
}

main().catch((err) => { console.error(err); process.exit(1); });
