// ─────────────────────────────────────────────────────────────────────────────
// The Gmail signature configured on the account.
//
// Gmail's web-UI signature is NOT appended by users.messages.send — a raw MIME
// message goes out exactly as built. Every email sent through this app has
// therefore been going out with no signature at all.
//
// Reading it needs no new OAuth scope: settings/sendAs is covered by the
// gmail.readonly scope the app already holds, so no re-consent is required.
//
// The signature is rich HTML (tables, inline styles), which is why the send
// path builds multipart/alternative rather than appending text.
// ─────────────────────────────────────────────────────────────────────────────

const SEND_AS_ENDPOINT = "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs";

/** Settings change rarely; an hour avoids an API call on every send. */
const CACHE_TTL_MS = 60 * 60_000;

export type GmailSignature = {
  /** Signature HTML exactly as Gmail stores it. */
  html: string;
  /** Tags stripped, for the text/plain alternative. */
  text: string;
};

let cached: { value: GmailSignature | null; fetchedAt: number } | null = null;

/**
 * Flattens signature HTML for the plain-text part.
 *
 * Lossy by nature — a styled table cannot survive — but it only reaches
 * clients that refuse HTML, and something readable beats a wall of markup.
 */
export function signatureHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

type SendAsResponse = {
  sendAs?: { sendAsEmail?: string; isDefault?: boolean; signature?: string }[];
};

/**
 * Fetches the default sendAs signature, or null when there isn't one.
 *
 * Never throws. A signature lookup failing must not stop an email Chris has
 * already decided to send; the message simply goes out as it does today.
 */
export async function fetchGmailSignature(
  accessToken: string,
  now: number = Date.now(),
): Promise<GmailSignature | null> {
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) return cached.value;

  try {
    const res = await fetch(SEND_AS_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error("[gmailSignature] sendAs lookup failed:", res.status);
      cached = { value: null, fetchedAt: now };
      return null;
    }

    const json = (await res.json()) as SendAsResponse;
    const entries = json.sendAs ?? [];
    const primary = entries.find((entry) => entry.isDefault) ?? entries[0];
    const html = primary?.signature?.trim() ?? "";

    const value = html ? { html, text: signatureHtmlToText(html) } : null;
    cached = { value, fetchedAt: now };
    return value;
  } catch (err) {
    console.error("[gmailSignature] sendAs lookup threw:", err);
    cached = { value: null, fetchedAt: now };
    return null;
  }
}

/** Clears the cache. Exported for tests and for a post-reconnect refresh. */
export function clearSignatureCache(): void {
  cached = null;
}
