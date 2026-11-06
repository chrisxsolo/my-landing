// ─────────────────────────────────────────────────────────────────────────────
// Draft-text checks for the sports-team portrait offer.
//
// Pure string checks over a draft, shared by the server validator
// (lib/ai/validateEmailDraft) and the live price check (lib/ai/quotePricing,
// rendered by PricingCheck.tsx), so neither grows its own regex. Every
// expected figure is read from lib/ai/sportsTeamPortraitPricing; nothing here
// knows a price of its own.
// ─────────────────────────────────────────────────────────────────────────────

import { sportsTeamDeliverables, sportsTeamOfferOptions } from "./sportsTeamPortraitPricing";

/** The per-person figure that belongs with a duration mention, or null. */
export function sportsTeamPerPersonForClause(clause: string): number | null {
  const text = clause.toLowerCase();
  const matches = sportsTeamOfferOptions().filter((option) => {
    const minutes = option.durationMinutes;
    const byMinutes = new RegExp(String.raw`\b${minutes}[- ]?(?:min|mins|minute|minutes)\b`).test(text);
    const byHour = minutes === 60 && /\b(?:one|1|an?)[- ]hour\b|\bthe hour\b|\bfull hour\b|\b60[- ]minute\b/.test(text);
    const byTotal = new RegExp(String.raw`\$\s?${option.total.toLocaleString("en-US")}\b`).test(clause) || new RegExp(String.raw`\$\s?${option.total}\b`).test(clause);
    return byMinutes || byHour || byTotal;
  });
  return matches.length === 1 ? matches[0].perPerson : null;
}

const money = (amount: number) => `$${amount.toLocaleString("en-US")}`;

const hasMoney = (draft: string, amount: number) =>
  new RegExp(String.raw`\$\s?(?:${amount.toLocaleString("en-US")}|${amount})(?![\d,])`).test(draft);

const PER_PERSON_WORDING = String.raw`(?:per|a|each|for each|apiece)\s*(?:person|player|athlete|senior|participant|head|student)?`;

function hasPerPerson(draft: string, amount: number): boolean {
  return new RegExp(String.raw`\$\s?${amount}\s*(?:${PER_PERSON_WORDING})\b`, "i").test(draft)
    || new RegExp(String.raw`\$\s?${amount}\s+each\b`, "i").test(draft);
}

const NUMBER_WORDS: Record<number, string> = { 2: "two", 3: "three", 5: "five", 40: "forty" };
const count = (n: number) => String.raw`\b(?:${n}|${NUMBER_WORDS[n] ?? n})\b`;

/**
 * Which approved facts the draft leaves out or contradicts, named for the
 * admin. Reports only; it never writes prose. Empty for a complete reply.
 */
export function sportsTeamCompletenessGaps(draft: string): string[] {
  const [thirty, sixty] = sportsTeamOfferOptions();
  const d = sportsTeamDeliverables();
  const gaps: string[] = [];
  const sentences = draft.split(/(?<=[.!?])\s+|\n+/);

  if (!hasMoney(draft, thirty.total)) gaps.push(`${thirty.durationMinutes}-minute option (${money(thirty.total)} total)`);
  if (!hasMoney(draft, sixty.total)) gaps.push(`${sixty.durationMinutes}-minute option (${money(sixty.total)} total)`);
  if (!hasPerPerson(draft, thirty.perPerson)) gaps.push(`${money(thirty.perPerson)} per person for ${thirty.durationMinutes} minutes`);
  if (!hasPerPerson(draft, sixty.perPerson)) gaps.push(`${money(sixty.perPerson)} per person for ${sixty.durationMinutes} minutes`);
  if (!new RegExp(String.raw`${count(d.perPerson)}[^.!?\n]{0,30}\b(?:edited\s+)?(?:images|photos|pictures|portraits)\b`, "i").test(draft)) gaps.push(`${d.perPerson} edited images per person`);
  if (!new RegExp(String.raw`${count(d.headshotsPerPerson)}\s+headshots?\b`, "i").test(draft)) gaps.push(`${d.headshotsPerPerson} headshots per person`);
  if (!new RegExp(String.raw`${count(d.fullBodyPerPerson)}\s+full[- ]body\b`, "i").test(draft)) gaps.push(`${d.fullBodyPerPerson} full-body portraits per person`);
  if (!new RegExp(String.raw`${count(d.total)}[^.!?\n]{0,40}\b(?:images|photos|pictures)\b|\b(?:images|photos|pictures)\b[^.!?\n]{0,20}${count(d.total)}`, "i").test(draft)) gaps.push(`${d.total} edited images total`);

  const recommends = sentences.some((s) =>
    /\b(?:recommend|suggest|go with|strongly|best (?:option|choice|bet)|my pick|i'?d (?:go|pick|choose|lean)|would be my)\b/i.test(s)
    && new RegExp(String.raw`\b(?:${sixty.durationMinutes}|sixty)[- ]?(?:min|mins|minute|minutes)\b|\b(?:one|1|an?|full)[- ]hour\b|\bthe hour\b`, "i").test(s));
  if (!recommends) gaps.push(`a clear ${sixty.durationMinutes}-minute recommendation`);

  const distinguishes = sentences.some((s) =>
    /\b(?:graduation|grad)\b[^.!?\n]{0,40}\b(?:pricing|rate|rates|package|packages)\b/i.test(s)
    && /\b(?:separate|different|distinct|apart|custom|rather than|instead of|not the same|its own|not my)\b/i.test(s));
  if (!distinguishes) gaps.push("the distinction from regular graduation group pricing");

  return gaps;
}
