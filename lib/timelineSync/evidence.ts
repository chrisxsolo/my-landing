// ─────────────────────────────────────────────────────────────────────────────
// Timeline evidence, kept per client address as dated observations.
//
// Every timestamp is the real time of the email that proved the milestone. A
// client who books twice has two inquiries under one address, so evidence is
// only ever read back through an inquiry's own time window — an invoice from
// last year's session must not stamp this year's inquiry.
// ─────────────────────────────────────────────────────────────────────────────

const MILESTONE_KINDS = [
  "reply", "invoiceSent", "contractSent", "depositPaid", "contractSigned", "galleryDelivered",
] as const;

export type MilestoneKind = (typeof MILESTONE_KINDS)[number];
export type EvidenceBook = Map<string, Record<MilestoneKind, string[]>>;
export type WindowEvidence = Record<MilestoneKind, string | null>;
/** `from` is inclusive, `to` exclusive; null means unbounded on that side. */
export type EvidenceWindow = { from: string | null; to: string | null };

export const OPEN_WINDOW: EvidenceWindow = { from: null, to: null };

export function createEvidenceBook(): EvidenceBook {
  return new Map();
}

const emptyEntry = () =>
  Object.fromEntries(MILESTONE_KINDS.map(kind => [kind, [] as string[]])) as Record<MilestoneKind, string[]>;

/** Records one observation. A missing or unparseable time is not evidence. */
export function addEvidence(book: EvidenceBook, email: string, kind: MilestoneKind, at: string | null): void {
  if (!at || Number.isNaN(Date.parse(at))) return;
  const key = email.trim().toLowerCase();
  if (!key.includes("@")) return;
  const entry = book.get(key) ?? emptyEntry();
  book.set(key, { ...entry, [kind]: [...entry[kind], at] });
}

/** Inquiries from one client closer together than this are the same booking. */
const SAME_BOOKING_GAP_MS = 60 * 24 * 60 * 60 * 1000;

/**
 * One window per inquiry of a single client. Inquiries submitted close
 * together (a form sent twice, a follow-up question) are one booking and share
 * a window; a new booking starts a new window, which owns the evidence from its
 * first inquiry until the next booking. The earliest booking also owns anything
 * before it (clients sometimes email before filling the form).
 */
export function inquiryWindows<T extends { id: number; created_at: string }>(inquiries: T[]): Map<number, EvidenceWindow> {
  const ordered = [...inquiries].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const bookings: T[][] = [];
  for (const inquiry of ordered) {
    const current = bookings[bookings.length - 1];
    const previous = current?.[current.length - 1];
    const sameBooking = previous &&
      Date.parse(inquiry.created_at) - Date.parse(previous.created_at) <= SAME_BOOKING_GAP_MS;
    if (sameBooking) current.push(inquiry);
    else bookings.push([inquiry]);
  }
  const windows = new Map<number, EvidenceWindow>();
  bookings.forEach((booking, index) => {
    const window = { from: index === 0 ? null : booking[0].created_at, to: bookings[index + 1]?.[0].created_at ?? null };
    for (const inquiry of booking) windows.set(inquiry.id, window);
  });
  return windows;
}

/** The earliest observation of each milestone inside the window. */
export function evidenceInWindow(book: EvidenceBook, email: string, window: EvidenceWindow): WindowEvidence {
  const entry = book.get(email.trim().toLowerCase());
  const fromMs = window.from ? Date.parse(window.from) : -Infinity;
  const toMs = window.to ? Date.parse(window.to) : Infinity;
  const earliest = (values: string[]) => {
    const inside = values.map(v => Date.parse(v)).filter(ms => ms >= fromMs && ms < toMs);
    return inside.length ? new Date(Math.min(...inside)).toISOString() : null;
  };
  return Object.fromEntries(
    MILESTONE_KINDS.map(kind => [kind, entry ? earliest(entry[kind]) : null]),
  ) as WindowEvidence;
}
