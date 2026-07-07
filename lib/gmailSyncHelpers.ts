// ─────────────────────────────────────────────────────────────────────────────
// Shared Gmail helpers for the timeline sync route: metadata-level message
// fetching plus subject-line heuristics for invoice / contract / payment /
// signing events.
// ─────────────────────────────────────────────────────────────────────────────

export type GmailHeader = { name: string; value: string };
export type GmailMessage = {
  id: string;
  internalDate?: string;
  payload?: { headers?: GmailHeader[] };
};

export function getHeader(headers: GmailHeader[], name: string): string {
  return headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

export function extractEmail(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  if (match) return match[1].toLowerCase().trim();
  return headerValue.toLowerCase().trim();
}

export function isInvoiceSubject(subject: string): boolean {
  return /invoice/i.test(subject) && /soloxsnaps/i.test(subject);
}

export function isContractSubject(subject: string): boolean {
  return /contract/i.test(subject) && /soloxsnaps/i.test(subject);
}

export function isPaymentReceivedSubject(subject: string, from: string): boolean {
  const sub = subject.toLowerCase();
  const frm = from.toLowerCase();
  if (frm.includes("venmo.com") && (sub.includes("paid you") || sub.includes("sent you"))) return true;
  if (frm.includes("paypal.com") && (sub.includes("payment received") || sub.includes("you received"))) return true;
  if (frm.includes("cash.app") && sub.includes("received")) return true;
  if (frm.includes("square.com") && sub.includes("payment")) return true;
  if (frm.includes("stripe.com") && sub.includes("payment")) return true;
  if (frm.includes("honeybook.com") && (sub.includes("paid") || sub.includes("payment"))) return true;
  if (sub.includes("deposit received") || sub.includes("deposit paid")) return true;
  return false;
}

export function isContractSignedSubject(subject: string, from: string): boolean {
  const sub = subject.toLowerCase();
  const frm = from.toLowerCase();
  if (frm.includes("docusign") && sub.includes("completed")) return true;
  if (frm.includes("pandadoc") && (sub.includes("signed") || sub.includes("completed"))) return true;
  if (frm.includes("honeybook.com") && (sub.includes("signed") || sub.includes("contract"))) return true;
  if (frm.includes("hellosign") && sub.includes("completed")) return true;
  if ((sub.includes("contract") || sub.includes("document")) && (sub.includes("signed") || sub.includes("completed"))) return true;
  return false;
}

export function msgDate(internalDate?: string): string {
  return internalDate
    ? new Date(parseInt(internalDate, 10)).toISOString()
    : new Date().toISOString();
}

export function extractClientEmailFromSubject(subject: string, clientEmails: Set<string>): string | null {
  const lower = subject.toLowerCase();
  for (const email of clientEmails) {
    if (lower.includes(email.toLowerCase())) return email;
  }
  return null;
}

export function matchClientNameInSubject(subject: string, clientNames: Map<string, string>): string | null {
  const lower = subject.toLowerCase();
  for (const [email, name] of clientNames) {
    if (!name) continue;
    const parts = name.toLowerCase().split(/\s+/);
    if (parts.some(p => p.length > 2 && lower.includes(p))) return email;
  }
  return null;
}

export async function fetchMessages(auth: string, query: string, maxResults = 50): Promise<GmailMessage[]> {
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
    { headers: { Authorization: auth } },
  );
  if (!searchRes.ok) return [];
  const data = await searchRes.json() as { messages?: { id: string }[] };
  const ids = (data.messages ?? []).map(m => m.id);
  if (!ids.length) return [];

  return Promise.all(
    ids.map(async id => {
      try {
        const r = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}` +
          `?format=metadata&metadataHeaders=To&metadataHeaders=From&metadataHeaders=Subject`,
          { headers: { Authorization: auth } },
        );
        if (!r.ok) return null;
        return await r.json() as GmailMessage;
      } catch { return null; }
    }),
  ).then(msgs => msgs.filter((m): m is GmailMessage => m !== null));
}
