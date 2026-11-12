// Which graduation package was booked, and how we know. Absent evidence and
// conflicting evidence are different answers: only absence may fall back to
// the 60-minute Graduation Session. A dollar amount is never evidence here.

import { GRAD_PACKAGES, graduationDurationsNamed } from "../pricing";
import { NO_PACKAGE, type PackageEvidence } from "./types";

/** Lengths one graduate can book: the mini, the hour, and the hour plus extra half hours. */
export const SUPPORTED_SOLO_MINUTES: readonly number[] = [30, 60, 90, 120];

export type PackageChoice =
  | { status: "explicit"; minutes: number; source: "email" | "inquiry" }
  | { status: "default"; minutes: number; source: "default" }
  | { status: "conflicting"; source: "email" | "inquiry"; lengths: number[] }
  | { status: "unclear"; source: "email" | "inquiry" };

const ONE_LENGTH = String.raw`(?:(?:\d+(?:\.\d+)?|thirty|sixty|ninety|half|one|two|an?)[\s-]*(?:an?\s+)?(?:hours?|hrs?|minutes?|mins?)\b(?:\s+mini\b)?|mini\b)`;
/** A length, compound forms included, so "1 hour 30 minutes" is ruled out whole. */
const LENGTH = String.raw`${ONE_LENGTH}(?:\s*(?:and|plus|&)?\s*${ONE_LENGTH})*`;
const ARTICLES = String.raw`(?:(?:a|an|the|just|only|your|that)\s+)*`;
const REFUSAL = String.raw`(?:(?<!why\s)not|no|without|instead of|rather than|(?:don'?t|do not|won'?t|wouldn'?t)(?:\s+(?:want|need|think|do|book|like))?)`;
/** "not the mini", "don't want 30 minutes", "instead of the hour": a length named only to rule it out. */
const RULED_OUT = new RegExp(String.raw`\b${REFUSAL}\s+${ARTICLES}${LENGTH}`, "gi");
/** Words that can turn a named length into something other than a choice. */
const DOUBT = /\b(?:not|no|never|without|skip(?:ping)?|but|instead|rather|unsure|maybe)\b|n'?t\b/i;
const SENTENCES = /[!?;\n]+|\.(?!\d)/;

/** The lengths the inquiry form affirmatively names, with ruled-out ones removed. */
export function inquiryLengthsNamed(text: string | null | undefined): number[] {
  return graduationDurationsNamed((text ?? "").replace(RULED_OUT, " "), true);
}

/**
 * What the inquiry form says about the length. Every mention counts, so
 * "1 hour. Or maybe the mini." is a conflict. A sentence that both names a
 * length and hedges or refuses in words this parser cannot place ("not
 * interested in the mini", "anything but the mini") is unclear, for a person.
 */
function fromInquiry(text: string | null | undefined): PackageChoice | null {
  const all = graduationDurationsNamed(text, true);
  if (!all.length) return null;
  const kept = inquiryLengthsNamed(text);
  if (kept.length > 1) return { status: "conflicting", source: "inquiry", lengths: kept };
  const doubtful = (text ?? "").split(SENTENCES).some((sentence) => DOUBT.test(sentence) && graduationDurationsNamed(sentence, true).length > 0);
  const ruledOut = all.some((minutes) => !kept.includes(minutes));
  if (doubtful && !ruledOut) return { status: "unclear", source: "inquiry" };
  return kept.length === 1 ? { status: "explicit", minutes: kept[0], source: "inquiry" } : null;
}

/**
 * The booked length, by precedence: the thread's latest agreed choice, then a
 * clear choice on the inquiry form, then `fallbackMinutes`. A thread that is
 * still undecided is never overridden by the older form.
 */
export function choosePackage(
  inquiryText: string | null | undefined,
  fromEmail: PackageEvidence = NO_PACKAGE,
  fallbackMinutes: number = GRAD_PACKAGES.standard.durationMinutes,
): PackageChoice {
  if (fromEmail.status === "selected" && fromEmail.minutes !== null) {
    return { status: "explicit", minutes: fromEmail.minutes, source: "email" };
  }
  if (fromEmail.status === "conflicting") return { status: "conflicting", source: "email", lengths: [] };
  if (fromEmail.status !== "none") return { status: "unclear", source: "email" };
  return fromInquiry(inquiryText) ?? { status: "default", minutes: fallbackMinutes, source: "default" };
}
