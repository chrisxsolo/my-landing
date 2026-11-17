// Live evaluation of the Pixieset autofill's fact extraction on a synthetic
// thread: one graduate who picks a package by email, in a thread separate
// from the inquiry notification. It makes real, paid calls to the extraction
// model (Haiku; a full run is a few cents) and puts each answer through what
// production does next: the normalizer, the server-side checks and the draft.
//
//   AI_LIVE_EVAL=1 npx tsx --env-file=.env.local tests/live/evalEmailPackageSelection.ts [runs]
//
// Every name, address and id is invented. Nothing is read from Gmail or the
// database, and nothing is written anywhere.

import { contextFromMessages, type LabelledMessage, type MessageParty } from "@/lib/extension/emailThread";
import { factsFromThread, type FactsInquiry } from "@/lib/extension/sessionFacts";
import { buildInvoiceDraft } from "@/lib/invoiceDraft/build";
import type { InvoiceInquiry } from "@/lib/invoiceDraft/types";

if (process.env.AI_LIVE_EVAL !== "1") {
  console.log("Set AI_LIVE_EVAL=1 to run this paid evaluation.");
  process.exit(0);
}

const RUNS = Math.max(1, Number(process.argv[2] ?? 3) || 3);
const CAMPUS = "University of San Francisco";

const inquiry: InvoiceInquiry & FactsInquiry = {
  id: 9201, name: "Alex Example", email: "alex@example.test", school: "USF", location: null, people: "1",
  session_type: "Graduation Portrait", message: "Hi! I'm graduating and would love photos on campus. What packages do you offer?",
  date_in_mind: "December 19", created_at: "2026-11-16T18:00:00Z",
};

type Line = [party: MessageParty, date: string, body: string, thread?: string];

const NOTICE: Line = ["other", "2026-11-16T18:00:05Z", "New inquiry from Alex Example: graduation photos, December 19.", "notification"];
const QUOTE: Line = ["photographer", "2026-11-16T20:00:00Z", `December 19 at 2:00 PM is available at the ${CAMPUS}. The 30-minute mini is $325; the 60-minute session is $425. Which would you like?`];
const accept = (words: string): Line => ["client", "2026-11-17T02:00:00Z", `December 19 at 2:00 PM works perfectly. ${words}`];

/** `chosenByEmail` is the point of the menu cases: default or unresolved are both fine, a selection is not. */
interface Expectation { minutes: number | null; chosenByEmail: boolean; total: number | null; date: string | null; dateStatus: string | null; start: string | null; status: string }
interface Scenario { name: string; lines: Line[]; expect: Partial<Expectation> }

const hour: Expectation = { minutes: 60, chosenByEmail: true, total: 42500, date: "2026-12-19", dateStatus: "confirmed", start: "14:00", status: "ready" };

const SCENARIOS: Scenario[] = [
  { name: "books the 60-minute session", lines: [NOTICE, QUOTE, accept("I would like to book the 60-minute session.")], expect: hour },
  { name: "books the one-hour session", lines: [NOTICE, QUOTE, accept("Let's do the one-hour session.")], expect: hour },
  { name: "books the full hour", lines: [NOTICE, QUOTE, accept("We'll take the full hour.")], expect: hour },
  {
    name: "a later mini replaces the hour",
    lines: [NOTICE, QUOTE, accept("I would like to book the 60-minute session."), ["client", "2026-11-17T05:00:00Z", "Actually, could we switch to the 30-minute mini instead? Same day and time."]],
    expect: { minutes: 30, chosenByEmail: true, date: "2026-12-19", start: "14:00" },
  },
  {
    name: "a negotiated total for the hour",
    lines: [NOTICE, QUOTE, accept("I would like to book the 60-minute session. Is there any student discount?"), ["photographer", "2026-11-17T17:00:00Z", "I can do the 60-minute session for $410 total. You're booked for December 19 at 2:00 PM!"]],
    expect: { ...hour, total: 41000 },
  },
  { name: "menu only: nothing chosen", lines: [NOTICE, QUOTE], expect: { chosenByEmail: false, dateStatus: "proposed" } },
  {
    name: "declines the mini without choosing",
    lines: [NOTICE, QUOTE, ["client", "2026-11-17T02:00:00Z", "Thanks! Not sure the mini is enough time. Let me think about it and get back to you."]],
    expect: { chosenByEmail: false },
  },
];

function threadOf(lines: Line[]) {
  const labelled: LabelledMessage[] = lines.map(([direction, at, body, thread], i) => ({
    id: `syn-${String(i + 1).padStart(2, "0")}`, threadId: thread ?? "booking", at: new Date(at).toISOString(), direction, body, truncated: false,
  }));
  return contextFromMessages(labelled);
}

const same = (actual: unknown, wanted: unknown) => (actual ?? null) === (wanted ?? null);

async function runOnce(scenario: Scenario) {
  const facts = await factsFromThread(inquiry, threadOf(scenario.lines));
  const draft = buildInvoiceDraft(inquiry, facts);
  const got: Expectation = {
    minutes: draft.session.durationMinutes, chosenByEmail: draft.session.packageSource === "email", total: draft.pricing.totalCents,
    date: draft.session.date, dateStatus: draft.session.date ? draft.session.dateStatus : null, start: draft.session.timeDetail.start, status: draft.status,
  };
  const misses = (Object.keys(scenario.expect) as (keyof Expectation)[]).filter((key) => !same(got[key], scenario.expect[key]));
  return { got, misses };
}

async function main() {
  let failures = 0;
  for (const scenario of SCENARIOS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await runOnce(scenario));
    const clean = runs.filter((run) => !run.misses.length).length;
    failures += RUNS - clean;
    console.log(`\n${clean === RUNS ? "PASS" : "FAIL"}  ${scenario.name}: ${clean}/${RUNS} correct`);
    for (const run of runs.filter((r) => r.misses.length)) {
      console.log(`      missed ${run.misses.map((key) => `${key}=${JSON.stringify(run.got[key])} (want ${JSON.stringify(scenario.expect[key])})`).join(", ")}`);
    }
  }
  console.log(`\nModel: claude-haiku-4-5, temperature 0. ${SCENARIOS.length} scenarios x ${RUNS} runs, ${failures} incorrect.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(2); });
