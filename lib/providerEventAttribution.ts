// ─────────────────────────────────────────────────────────────────────────────
// Decides which client a Pixieset document notice belongs to.
//
// The notices are addressed to the photographer, so identity has to come from
// what the provider wrote. The rules are deliberately strict — a wrong stamp on
// someone else's booking is worse than a notice reported as "needs review":
//
//   • A full name (first + last) must equal exactly one known client's name.
//   • An invoice copy only greets by first name. It is attributed when the
//     provider itself ties that invoice number to a named client, or when
//     that first name belongs to exactly one known client AND that client's
//     own contract went out within the corroboration window. Two clients
//     sharing a first name are never told apart by timing.
//   • The photographer's own addresses are never a client.
//   • A payment-on-the-way notice is identity evidence only. It never becomes
//     a payment, a deposit, or any other milestone.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizePersonName } from "@/lib/gmailSyncHelpers";
import type { ProviderEvent } from "@/lib/providerDocumentEvents";

/** Invoice and contract normally go out together; allow a slow follow-up. */
const CORROBORATION_WINDOW_MS = 48 * 60 * 60 * 1000;

export type KnownClient = { email: string; name: string | null };

type AttributedEvent = {
  email: string;
  kind: "invoice_sent" | "contract_sent" | "contract_signed";
  at: string;
};

export type AttributionResult = {
  attributed: AttributedEvent[];
  /** Notices that could belong to more than one client, or to none provably. */
  ambiguous: number;
  /** Notices naming someone who is not a known client. */
  unmatched: number;
};

type NameLookup = { status: "matched"; email: string } | { status: "ambiguous" | "unmatched" };
type Anchor = { email: string; atMs: number; invoiceNumber: string | null; contractSent: boolean };

function buildNameIndex(clients: KnownClient[], ownerEmails: string[]) {
  const owners = new Set(ownerEmails.map(e => e.toLowerCase()));
  const byFullName = new Map<string, Set<string>>();
  // Every client counts here, single-name ones included: "Maria" on file makes
  // a "Hi Maria," greeting ambiguous even if only one Maria has a surname.
  const byFirstName = new Map<string, Set<string>>();
  for (const client of clients) {
    const email = client.email.toLowerCase();
    if (owners.has(email)) continue;
    const normalized = normalizePersonName(client.name);
    const tokens = normalized.split(" ").filter(Boolean);
    if (!tokens.length) continue;
    byFirstName.set(tokens[0], (byFirstName.get(tokens[0]) ?? new Set()).add(email));
    if (tokens.length >= 2) byFullName.set(normalized, (byFullName.get(normalized) ?? new Set()).add(email));
  }
  return { byFullName, byFirstName };
}

function lookupFullName(byFullName: Map<string, Set<string>>, name: string | null): NameLookup {
  const emails = byFullName.get(normalizePersonName(name));
  if (!emails) return { status: "unmatched" };
  return emails.size === 1 ? { status: "matched", email: [...emails][0] } : { status: "ambiguous" };
}

function invoiceOwner(
  event: Extract<ProviderEvent, { kind: "invoice_sent" }>,
  anchors: Anchor[],
  byFirstName: Map<string, Set<string>>,
): string | null {
  const byNumber = new Set(
    anchors.filter(a => a.invoiceNumber && a.invoiceNumber === event.invoiceNumber).map(a => a.email),
  );
  if (byNumber.size === 1) return [...byNumber][0];
  if (byNumber.size > 1) return null;

  const sameFirstName = byFirstName.get(normalizePersonName(event.firstName).split(" ")[0] ?? "");
  if (sameFirstName?.size !== 1) return null;
  const [email] = sameFirstName;
  const atMs = Date.parse(event.at);
  const contractNearby = anchors.some(a =>
    a.contractSent && a.email === email && Math.abs(a.atMs - atMs) <= CORROBORATION_WINDOW_MS);
  return contractNearby ? email : null;
}

/**
 * `reviewSince` (ISO) limits the ambiguous/unmatched counts to recent notices:
 * an old notice nobody can act on should not be reported on every run. It
 * never affects which notices are attributed.
 */
export function attributeProviderEvents(
  events: ProviderEvent[],
  clients: KnownClient[],
  ownerEmails: string[],
  options: { reviewSince?: string } = {},
): AttributionResult {
  const { byFullName, byFirstName } = buildNameIndex(clients, ownerEmails);
  const attributed: AttributedEvent[] = [];
  const anchors: Anchor[] = [];
  const reviewable = (event: ProviderEvent) => !options.reviewSince || event.at >= options.reviewSince;
  let ambiguous = 0;
  let unmatched = 0;

  // Pass 1 — notices that carry a full name.
  for (const event of events) {
    if (event.kind === "invoice_sent") continue;
    const lookup = lookupFullName(byFullName, event.fullName);
    if (lookup.status !== "matched") {
      if (reviewable(event) && lookup.status === "ambiguous") ambiguous++;
      if (reviewable(event) && lookup.status === "unmatched") unmatched++;
      continue;
    }
    anchors.push({
      email: lookup.email,
      atMs: Date.parse(event.at),
      invoiceNumber: event.kind === "payment_pending" ? event.invoiceNumber : null,
      contractSent: event.kind === "contract_sent",
    });
    if (event.kind !== "payment_pending") {
      attributed.push({ email: lookup.email, kind: event.kind, at: event.at });
    }
  }

  // Pass 2 — invoice copies, corroborated against pass 1.
  for (const event of events) {
    if (event.kind !== "invoice_sent") continue;
    const email = invoiceOwner(event, anchors, byFirstName);
    if (email) attributed.push({ email, kind: "invoice_sent", at: event.at });
    else if (reviewable(event)) ambiguous++;
  }

  return { attributed, ambiguous, unmatched };
}
