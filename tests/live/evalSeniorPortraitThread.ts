// Live evaluation of the Pixieset autofill's fact extraction on a synthetic
// thread: senior portraits for a sports team. It makes real, paid calls to
// the extraction model (Haiku; a full run is a few cents) and puts each
// answer through exactly what production does next: the normalizer, the
// server-side checks and the invoice/contract draft.
//
//   AI_LIVE_EVAL=1 npx tsx --env-file=.env.local tests/live/evalSeniorPortraitThread.ts [runs]
//
// Every name, address, id and venue is invented. Nothing is read from Gmail
// or the database, and nothing is written anywhere.

import { contextFromMessages, type LabelledMessage, type MessageParty } from "@/lib/extension/emailThread";
import { factsFromThread, type FactsInquiry } from "@/lib/extension/sessionFacts";
import { buildInvoiceDraft } from "@/lib/invoiceDraft/build";
import type { InvoiceInquiry } from "@/lib/invoiceDraft/types";

if (process.env.AI_LIVE_EVAL !== "1") {
  console.log("Set AI_LIVE_EVAL=1 to run this paid evaluation.");
  process.exit(0);
}

const RUNS = Math.max(1, Number(process.argv[2] ?? 5) || 5);
const VENUE = "Harbor Practice Field";
const SIGNATURE = "\n\nStudio Example\nPortrait | Graduation\nSan Francisco, CA";

const inquiry: InvoiceInquiry & FactsInquiry = {
  id: 9101, name: "Jordan Example", email: "jordan@example.test", school: "SF State", location: null, people: "1",
  session_type: "Graduation Portrait", message: "Hi, looking to book portraits.", date_in_mind: null, created_at: "2026-11-02T16:55:00Z",
};

type Line = [party: MessageParty, date: string, body: string];

const BASE: Line[] = [
  ["client", "2026-11-02T17:00:00Z", "Hi! Do you take senior portraits for sports teams?"],
  ["client", "2026-11-02T17:20:00Z", "We are eight soccer players who want senior portraits out on a field."],
  ["photographer", "2026-11-03T18:00:00Z", `Happy to! I have Nov 21, Nov 22, Nov 29 and Dec 5 open, and around 4 PM usually works well for light.${SIGNATURE}`],
  ["client", "2026-11-04T17:00:00Z", `Could we shoot at ${VENUE}?`],
  ["photographer", "2026-11-04T19:00:00Z", `${VENUE} works great. Two options: a 30 minute session is $800 total ($100 per player), or a 60 minute session is $1,200 total ($150 per player).${SIGNATURE}`],
  ["client", "2026-11-05T17:00:00Z", "Can you confirm the one-hour total is $1,200?"],
  ["photographer", "2026-11-05T18:00:00Z", `Confirmed: $1,200 total for the one-hour session for all eight players. Each player gets five individual edited portraits (two headshots and three full-body), plus two group photos at ${VENUE}.${SIGNATURE}`],
  ["client", "2026-11-12T17:00:00Z", "Great, that pricing and package work for us. Could we do 29th Nov around 3pm?"],
];

interface Expectation { type: string; people: number; minutes: number | null; total: number | null; date: string | null; dateStatus: string | null; start: string | null; location: string | null }
interface Scenario { name: string; lines: Line[]; expect: Expectation }

const proposed: Expectation = { type: "senior-portraits", people: 8, minutes: 60, total: 120000, date: "2026-11-29", dateStatus: "proposed", start: "15:00", location: VENUE };

const SCENARIOS: Scenario[] = [
  { name: "date requested, not yet accepted", lines: BASE, expect: proposed },
  {
    name: "date explicitly accepted",
    lines: [...BASE, ["photographer", "2026-11-12T19:00:00Z", `Yes, November 29 at 3 PM is confirmed. See you then!${SIGNATURE}`]],
    expect: { ...proposed, dateStatus: "confirmed" },
  },
  {
    name: "terse acceptance that repeats nothing",
    lines: [...BASE, ["photographer", "2026-11-12T19:00:00Z", `Sounds good, see you then!${SIGNATURE}`]],
    expect: { ...proposed, dateStatus: "confirmed" },
  },
  {
    name: "date rescheduled after it was agreed",
    lines: [
      ...BASE,
      ["photographer", "2026-11-12T19:00:00Z", "Yes, November 29 at 3 PM is confirmed."],
      ["client", "2026-11-13T17:00:00Z", "So sorry, two players have a game on the 29th. Could we move to Dec 5, same time?"],
      ["photographer", "2026-11-13T18:00:00Z", "No problem, December 5 at 3 PM works. You're all set."],
    ],
    expect: { ...proposed, date: "2026-12-05", dateStatus: "confirmed" },
  },
  {
    name: "menu only: nothing chosen yet",
    lines: BASE.slice(0, 5),
    // The photographer's general "around 4 PM" is the only time on the table, and stays a proposal.
    expect: { type: "senior-portraits", people: 8, minutes: null, total: null, date: null, dateStatus: null, start: "16:00", location: VENUE },
  },
  {
    name: "a different booking in an older thread",
    lines: [
      ["client", "2026-05-02T17:00:00Z", "Hi, I'd like graduation photos at SF State on May 16 at 10 AM."],
      ["photographer", "2026-05-02T19:00:00Z", "Booked: May 16 at 10 AM at SF State, $425 total for the one-hour graduation session."],
      ...BASE,
    ],
    expect: proposed,
  },
];

function threadOf(lines: Line[]) {
  const older = lines.findIndex(([, date]) => date.startsWith("2026-11"));
  const labelled: LabelledMessage[] = lines.map(([direction, at, body], i) => ({
    id: `syn-${String(i + 1).padStart(2, "0")}`, threadId: i < older ? "thread-older" : "thread-senior", at: new Date(at).toISOString(), direction, body, truncated: false,
  }));
  return contextFromMessages(labelled);
}

const same = (actual: unknown, wanted: unknown) => (actual ?? null) === (wanted ?? null);

async function runOnce(scenario: Scenario) {
  const facts = await factsFromThread(inquiry, threadOf(scenario.lines));
  const draft = buildInvoiceDraft(inquiry, facts);
  const got: Expectation = {
    type: draft.session.serviceKey, people: draft.session.people, minutes: draft.session.durationMinutes, total: draft.pricing.totalCents,
    date: draft.session.date, dateStatus: draft.session.date ? draft.session.dateStatus : null, start: draft.session.timeDetail.start, location: draft.session.location,
  };
  const misses = (Object.keys(scenario.expect) as (keyof Expectation)[]).filter((key) => !same(got[key], scenario.expect[key]));
  return { got, misses, fingerprint: JSON.stringify(got) };
}

async function main() {
  let failures = 0;
  for (const scenario of SCENARIOS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await runOnce(scenario));
    const clean = runs.filter((run) => !run.misses.length).length;
    const distinct = new Set(runs.map((run) => run.fingerprint)).size;
    failures += RUNS - clean;
    console.log(`\n${clean === RUNS ? "PASS" : "FAIL"}  ${scenario.name}: ${clean}/${RUNS} correct, ${distinct} distinct result${distinct === 1 ? "" : "s"}`);
    for (const run of runs.filter((r) => r.misses.length)) {
      console.log(`      missed ${run.misses.map((key) => `${key}=${JSON.stringify(run.got[key])} (want ${JSON.stringify(scenario.expect[key])})`).join(", ")}`);
    }
  }
  console.log(`\nModel: claude-haiku-4-5, temperature 0. ${SCENARIOS.length} scenarios x ${RUNS} runs, ${failures} incorrect.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => { console.error(err instanceof Error ? err.message : err); process.exit(2); });
