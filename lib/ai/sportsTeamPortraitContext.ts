// ─────────────────────────────────────────────────────────────────────────────
// The sports-team offer as the context builder sees it.
//
// buildEmailContext hands over the stored inquiry and the Gmail thread; this
// module turns them into the pure resolver's input (inbound client messages
// only, a prior-quote reading of Chris's messages, the verified travel fee for
// the shoot location) and renders the admin-facing warnings each outcome
// deserves. No prices live here.
// ─────────────────────────────────────────────────────────────────────────────

import type { ContextWarning } from "./buildEmailContext";
import type { ThreadMessage } from "./threadDigest";
import type { TravelResolution } from "@/lib/travelResolution";
import {
  resolvePriorSessionQuote, resolveSportsTeamPortraitOffer, type SportsTeamPortraitResolution,
} from "./sportsTeamPortraitPricing";

export type ThreadResolverInput = {
  inquiry: { sessionType?: string | null; message: string; people?: string | number | null };
  messages: readonly ThreadMessage[];
  threadLoaded: boolean;
  latestClientMessage: string | null;
  confirmedPrices: readonly number[];
  /** Travel for the shoot location, resolved as for any non-graduation service. */
  travel: TravelResolution;
};

/**
 * Resolves the profile from the stored inquiry plus the inbound half of the
 * thread, oldest first. Chris's own messages are consulted only for a prior
 * session quote, never as evidence of what the client asked for.
 */
export function resolveSportsTeamPortraitFromThread(input: ThreadResolverInput): SportsTeamPortraitResolution {
  const inbound = [...input.messages]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .filter((m) => !m.fromMe)
    .map((m) => m.body);
  return resolveSportsTeamPortraitOffer({
    sessionType: input.inquiry.sessionType,
    inquiryMessage: input.inquiry.message,
    people: input.inquiry.people,
    latestClientMessage: input.latestClientMessage,
    recentInboundClientMessages: inbound,
    threadLoaded: input.threadLoaded,
    priorSessionQuote: resolvePriorSessionQuote(input.messages, input.confirmedPrices),
    verifiedTravelFee: input.travel.kind === "verified" ? input.travel.fee : null,
  });
}

const listMoney = (amounts: readonly number[]) => amounts.map((a) => `$${a.toLocaleString("en-US")}`).join(", ");

/**
 * What the admin needs to know about how the profile resolved. Silence is
 * only right when nothing about this inquiry suggested the offer at all.
 */
export function sportsTeamProfileWarnings(
  special: SportsTeamPortraitResolution,
  school: string | null | undefined,
  travel: TravelResolution,
): ContextWarning[] {
  switch (special.status) {
    case "ambiguous_prior_quote":
      return [{
        code: "prior_quote_ambiguous", severity: "high",
        message: `This looks like the eight-person sports-team portrait setup, but an earlier email from Chris named ${listMoney(special.amounts)} without saying what it covered. The standardized rate was not applied; confirm what was quoted and set the price yourself.`,
      }];
    case "superseded":
      return [{
        code: "prior_quote_kept", severity: "medium",
        message: `This looks like the eight-person sports-team portrait setup, but Chris already quoted ${listMoney(special.amounts)} for this client. The standardized rate was not applied; the earlier quote stands.`,
      }];
    case "resolved":
      // A school on file is not the shoot location for this rate, so no travel
      // fee is known and the totals go out without one. Said plainly, because
      // a campus team is the likeliest shape of this booking.
      if (travel.kind === "none" && school?.trim()) {
        return [{
          code: "travel_unverified", severity: "medium",
          message: `${school.trim()} is on file but no shoot location is, and a school does not stand in for the location on this rate. The draft quotes the session totals with no travel fee. If the shoot is on campus or anywhere outside San Francisco, set the location so the travel fee is added once to each option.`,
        }];
      }
      return [];
    default:
      return [];
  }
}
