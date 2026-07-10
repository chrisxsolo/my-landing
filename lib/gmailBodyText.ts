// Gmail MIME body extraction for server routes. Prefers text/plain, falls
// back to text/html, recurses through every nested part, and converts HTML
// to readable plain text. Pure functions — unit tested in
// tests/unit/gmailBodyText.test.ts.

export type GmailMimePart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMimePart[];
};

const DEFAULT_MAX_BODY_CHARS = 1500;

export function decodeGmailBase64Url(data: string): string {
  try {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf-8");
  } catch {
    return "";
  }
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…",
  rsquo: "’", lsquo: "‘", ldquo: "“", rdquo: "”",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, code: string) => {
      const point = Number(code);
      return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const point = parseInt(hex, 16);
      return point >= 0 && point <= 0x10ffff ? String.fromCodePoint(point) : " ";
    })
    .replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

export function htmlToPlainText(html: string): string {
  const withoutBlocks = html
    .replace(/<(script|style|head)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = withoutBlocks
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(withBreaks)
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Collect decoded text from every part in the tree. An empty or missing
// text/plain part never blocks a sibling or nested part from being used.
function collectParts(part: GmailMimePart, plain: string[], html: string[]): void {
  const mime = (part.mimeType ?? "").toLowerCase();
  const data = part.body?.data;
  if (data) {
    const decoded = decodeGmailBase64Url(data);
    if (decoded.trim()) {
      if (mime.startsWith("text/html")) html.push(decoded);
      else if (mime.startsWith("text/plain") || mime === "") plain.push(decoded);
    }
  }
  for (const child of part.parts ?? []) collectParts(child, plain, html);
}

export function extractEmailText(
  payload: GmailMimePart | undefined,
  maxLength = DEFAULT_MAX_BODY_CHARS
): string {
  if (!payload) return "";
  const plain: string[] = [];
  const html: string[] = [];
  collectParts(payload, plain, html);

  const text = plain.length
    ? plain.join("\n")
    : html.map(htmlToPlainText).join("\n");

  return text.replace(/\n{3,}/g, "\n\n").trim().slice(0, maxLength);
}
