// Whether a booking that is already agreed, and is now being invoiced, is the
// shape the eight-person sports senior offer covers. It applies the offer's
// own checks from sportsTeamPortraitPricing.ts (sports context tied to the
// portraits, exactly eight participants, no graduation or headshot-event
// veto, no deliverables the profile does not give, no different price Chris
// already quoted) without the resolver's pricing question, which a booked
// client no longer asks. It never widens the offer to another headcount.

import {
  SPORTS_CONTEXT, VETO, contradictsDeliverables, exactEight, matchesOffer, resolvePriorSessionQuote,
} from "./sportsTeamPortraitPricing";

export type SportsTeamScopeInput = {
  /**
   * The client's own words: the inquiry message, never the form's dropdown
   * (its only portrait option is "Graduation Portrait", which is not the
   * client saying they are graduating).
   */
  inquiryMessage?: string | null;
  /** The form's headcount field, as stored. Never a model's count. */
  people?: string | number | null;
  /** The client's own messages for this booking, oldest first. */
  clientMessages?: readonly string[];
  /** Chris's messages for this booking: read only for a price he already quoted. */
  photographerMessages?: readonly string[];
};

export function sportsTeamScopeMatches(input: SportsTeamScopeInput): boolean {
  const evidence = [input.inquiryMessage ?? "", ...(input.clientMessages ?? [])].filter((text) => text.trim());
  const joined = evidence.join("\n");
  if (VETO.some((pattern) => pattern.test(joined))) return false;
  if (!SPORTS_CONTEXT.some((pattern) => pattern.test(joined))) return false;
  if (!exactEight(input.people, evidence) || contradictsDeliverables(joined)) return false;
  const outbound = (input.photographerMessages ?? []).map((body) => ({ timestamp: 0, fromMe: true, body }));
  const prior = resolvePriorSessionQuote(outbound, []);
  return prior.kind === "none" || (prior.kind === "authoritative" && matchesOffer(prior.amounts, null));
}
