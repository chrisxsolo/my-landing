// Where the shoot is, for the invoice, and what travel there costs.
//
// Precedence: the latest shoot location the email thread confirmed, then the
// inquiry's stored location, then (graduation only) the client's school.
// Amounts come only from resolveTravel, so this surface charges exactly what
// the contract and the payment ledger charge.

import {
  namesAPlace, resolveTravel, schoolImpliesLocationFor, travelForLocation, type TravelResolution,
} from "../travelResolution";
import type { InvoiceTravel } from "./types";

export interface InvoiceLocation {
  location: string | null;
  locationSource: "email" | "inquiry" | "school" | "unknown";
  travel: InvoiceTravel;
}

interface LocationInput {
  school: string | null;
  location: string | null;
  message: string | null;
  emailLocation: string | null;
  serviceKey: string | null;
}

function toInvoiceTravel(resolution: TravelResolution): InvoiceTravel {
  switch (resolution.kind) {
    case "verified":
      return { kind: "verified", amountCents: Math.round(resolution.fee * 100), place: resolution.place };
    case "included":
      return { kind: "included", amountCents: 0, place: resolution.place };
    case "unknown":
      return { kind: "unknown", amountCents: null, place: resolution.place };
    default:
      return { kind: "none", amountCents: 0, place: null };
  }
}

/**
 * A location the thread confirmed is the shoot location, full stop. When the
 * resolver cannot place it, travel is unknown; it never falls back to the
 * school, because the client has already said they are shooting elsewhere.
 */
function fromEmail(place: string): InvoiceLocation {
  const resolution = travelForLocation(place) ?? { kind: "unknown" as const, place };
  return { location: place, locationSource: "email", travel: toInvoiceTravel(resolution) };
}

/** Longest a stored location can be and still be a place name rather than a note. */
const MAX_PLACE_NAME_CHARS = 60;
const MAX_PLACE_NAME_WORDS = 8;

/**
 * Whether the inquiry's location field holds a place name. One inquiry held
 * "Still thinking of a spot but don't want it to be basic SJSU campus…", which
 * names SJSU only to rule it out; a note like that is shown for review, never
 * priced.
 */
export function isPlaceName(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0
    && trimmed.length <= MAX_PLACE_NAME_CHARS
    && trimmed.split(/\s+/).length <= MAX_PLACE_NAME_WORDS
    && namesAPlace(trimmed);
}

export function resolveInvoiceLocation(input: LocationInput): InvoiceLocation {
  const emailPlace = (input.emailLocation ?? "").trim();
  if (emailPlace) return fromEmail(emailPlace);

  const graduation = schoolImpliesLocationFor(input.serviceKey);
  const school = (input.school ?? "").trim() || null;
  const storedText = (input.location ?? "").trim();
  // The stored field counts as a location only when it is a place name; a
  // free-text note is left to the reviewer (see isPlaceName).
  const stored = isPlaceName(storedText) ? storedText : "";
  const resolution = resolveTravel({
    school,
    location: stored,
    message: graduation ? input.message : null,
    schoolImpliesLocation: graduation,
  });
  const travel = toInvoiceTravel(resolution);

  if (stored) return { location: stored, locationSource: "inquiry", travel };
  if (graduation && school) return { location: school, locationSource: "school", travel };
  if (travel.kind === "unknown") return { location: travel.place, locationSource: "unknown", travel };
  return { location: null, locationSource: "unknown", travel };
}
