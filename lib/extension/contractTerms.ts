// Booking-specific terms for the contract's Description of Services: an
// image count the photographer promised and the 72-hour full gallery
// delivery. The model only points at them; a count is written into a
// contract only when the photographer's own message carries it, and the
// delivery follows the same selected / removed / unclear rules as the Rush
// preview add-on.

import {
  NO_CONTRACT_TERMS, RUSH_PREVIEW_SELECTIONS, type ContractTermsEvidence, type ImageCommitment, type RushPreviewSelection,
} from "../invoiceDraft/types";
import { inquiryAddOnsLine } from "./rushPreview";

const MAX_IMAGE_COUNT = 500;
const EXPEDITED_WORDS = /\b72[\s-]*(?:hours?|hrs?)\b/i;

/** Appended to the extraction prompt's numbered list. */
export const CONTRACT_TERMS_PROMPT = `13. image_commitment: the number of edited images the PHOTOGRAPHER promised for the option the client chose, from the EMAILS ONLY ("you'll receive a minimum of 60 edited images" is 60). count: that whole number. per_person: true only when the photographer promised it per person. A number the client asked for and the photographer did not agree to, a price list covering several packages, and the Rush preview's few early images are not a commitment. null when the photographer never promised a count.
14. expedited_gallery: the client's standing choice about faster delivery of the FULL gallery within 72 hours, from the EMAILS ONLY, judged like rush_preview: "selected" when the client clearly asked to add it and never cancelled, "removed" when they selected it and later cancelled, "unclear" when the messages conflict, "none" when the client never asked for it (the photographer offering it, or the client only asking about it, is "none"). This is not the Rush preview.`;

/** The keys the prompt's JSON example gains. */
export const CONTRACT_TERMS_JSON = `"image_commitment":{"count":60,"per_person":false},"expedited_gallery":{"status":"selected|removed|unclear|none"}`;

const isSelection = (value: unknown): value is RushPreviewSelection =>
  typeof value === "string" && (RUSH_PREVIEW_SELECTIONS as readonly string[]).includes(value);

function normalizeImages(raw: unknown): ImageCommitment | null {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const count = r.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1 || count > MAX_IMAGE_COUNT) return null;
  return { count, per_person: r.per_person === true, verified: false };
}

/** Whether the estimator's "Add-ons:" line selects the 72-hour gallery. Prose elsewhere never counts. */
export function inquirySelectsExpedited(message: string | null | undefined): boolean {
  const line = inquiryAddOnsLine(message);
  return line !== null && EXPEDITED_WORDS.test(line);
}

/** The form's own terms: only its add-on line can select anything. */
export function contractTermsFromInquiry(message: string | null | undefined): ContractTermsEvidence {
  if (!inquirySelectsExpedited(message)) return NO_CONTRACT_TERMS;
  return { ...NO_CONTRACT_TERMS, expedited_gallery: { selection: "selected", source: "inquiry" } };
}

/**
 * The model's answer, checked and merged with the form. An explicit choice
 * in email (a selection, a cancellation, a conflict) wins over the form; a
 * form selection stands through email silence.
 */
export function normalizeContractTerms(rawImages: unknown, rawExpedited: unknown, inquiryMessage: string | null | undefined): ContractTermsEvidence {
  const status = (rawExpedited && typeof rawExpedited === "object" ? (rawExpedited as Record<string, unknown>).status : null);
  const fromEmail = isSelection(status) ? status : "none";
  const expedited_gallery = fromEmail === "none"
    ? contractTermsFromInquiry(inquiryMessage).expedited_gallery
    : { selection: fromEmail, source: "email" as const };
  return { images: normalizeImages(rawImages), expedited_gallery };
}

const IMAGE_WORDS = String.raw`(?:images?|photos?|photographs?|pictures?|portraits?|edits)`;
/** The only words allowed between the number and the image word: "60 minute photo session" is a length, not a count. */
const IMAGE_QUALIFIERS = String.raw`(?:fully|professionally|hand|final|finished|edited|retouched|digital|high-res|high-resolution)`;
/** The Rush preview's few early images are an add-on's terms, never the gallery's count. */
const RUSH_BEFORE = /rush\s+preview[^.!?\n]{0,40}$/i;
const RUSH_AFTER = /^[^.!?\n]{0,20}\b48[\s-]*(?:hours?|hrs?)\b/i;

/**
 * Whether the photographer wrote this count as a number of images
 * ("minimum of 60 edited images", "60+ professionally edited photos"). A
 * count only the client wrote is a request, not a commitment.
 */
export function imageCommitmentOnRecord(count: number, messages: readonly { direction: string; body: string }[]): boolean {
  const written = new RegExp(String.raw`(?<![\d$.,])${count}\+?(?![\d.,]\d)\s+(?:${IMAGE_QUALIFIERS}[\s-]+){0,3}${IMAGE_WORDS}\b`, "gi");
  return messages.some((message) => message.direction === "photographer" && [...message.body.matchAll(written)].some((match) => {
    const before = message.body.slice(0, match.index), after = message.body.slice(match.index + match[0].length);
    return !RUSH_BEFORE.test(before) && !RUSH_AFTER.test(after);
  }));
}

/** The terms with the image count checked against the transcript. */
export function verifyContractTerms(terms: ContractTermsEvidence, messages: readonly { direction: string; body: string }[]): ContractTermsEvidence {
  if (!terms.images) return terms;
  return { ...terms, images: { ...terms.images, verified: imageCommitmentOnRecord(terms.images.count, messages) } };
}
