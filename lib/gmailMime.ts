// ─────────────────────────────────────────────────────────────────────────────
// Building the raw MIME message Gmail sends.
//
// Was a single text/plain part. It is now multipart/alternative so the
// account's real HTML signature can be included: a 3KB styled signature
// appended to a plain-text body would arrive as visible markup.
//
// Pure functions, unit tested in tests/unit/gmailMime.test.ts.
// ─────────────────────────────────────────────────────────────────────────────

/** Strips CR/LF to prevent header injection (e.g. an injected Bcc line). */
export function sanitizeHeader(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Renders the plain-text body as HTML.
 *
 * Blank-line-separated blocks become paragraphs and single newlines become
 * breaks, which is how the draft is laid out in the compose box. The body is
 * escaped first: it is Chris's own text, but a client who writes "<3" should
 * see "<3", not a broken tag.
 */
export function bodyToHtml(body: string): string {
  return body
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p style="margin:0 0 1em 0">${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export type BuildMessageInput = {
  from: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  /** Account signature. Omitted or null sends the body alone. */
  signature?: { html: string; text: string } | null;
};

/** A boundary that cannot collide with content. */
function makeBoundary(): string {
  return `soloxsnaps_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Builds the raw message, base64url-encoded for users.messages.send.
 *
 * With no signature it stays a single text/plain part — byte-identical in
 * shape to the previous behaviour, so nothing changes for a send that has no
 * signature to add.
 */
export function buildRawMessage(input: BuildMessageInput, boundary = makeBoundary()): string {
  const from = sanitizeHeader(input.from);
  const to = sanitizeHeader(input.to);
  const subject = sanitizeHeader(input.subject);
  // threadId comes from Gmail's own API responses; sanitized defensively anyway.
  const thread = input.threadId ? sanitizeHeader(input.threadId) : undefined;
  const body = input.body.trimEnd();

  const headers = [
    `From: Chris Solorzano <${from}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    ...(thread ? [`References: ${thread}`, `In-Reply-To: ${thread}`] : []),
  ];

  const signature = input.signature;
  const lines = signature
    ? [
        ...headers,
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        ``,
        `--${boundary}`,
        `Content-Type: text/plain; charset=UTF-8`,
        ``,
        `${body}\r\n\r\n${signature.text}`,
        `--${boundary}`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        `${bodyToHtml(body)}\n<br>\n${signature.html}`,
        `--${boundary}--`,
      ]
    : [
        ...headers,
        `Content-Type: text/plain; charset=UTF-8`,
        ``,
        body,
      ];

  return base64UrlEncode(lines.join("\r\n"));
}

/** UTF-8 safe base64url, as the Gmail API requires. */
export function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
