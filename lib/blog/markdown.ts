// Blog body parser (pure, no React). Turns a stored post body into a small
// block/inline tree that app/(professional)/blog/[slug]/postBody.tsx renders.
//
// Bodies come in two shapes and both must keep working:
//  - Content Engine posts are Markdown: [links](/path), ## headings, **bold**,
//    *italic*, - lists, > quotes.
//  - Older hand-written posts are plain text with blank-line-separated blocks,
//    where headings were inferred (emoji lines, short lines above bullets).
//    Those inference rules are kept exactly so old posts render as before.
//
// Safety: the tree only ever holds text and vetted link targets. Nothing is
// passed through as HTML, so raw <script> or javascript: links in a body come
// out as plain text.

export type Inline =
  | { type: "text"; value: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "link"; href: string; internal: boolean; children: Inline[] };

export type Block =
  | { type: "heading"; level: 2 | 3; children: Inline[] }
  | { type: "paragraph"; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "quote"; children: Inline[] };

const SITE_ORIGIN = /^https?:\/\/(?:www\.)?soloxsnaps\.com(?=\/|$)/i;
const SAFE_EXTERNAL = /^(?:https?:\/\/|mailto:|tel:)/i;

/** A link target that is safe to render, or null (the text is kept, the link dropped). */
export function safeHref(raw: string): { href: string; internal: boolean } | null {
  const url = raw.trim();
  if (url.startsWith("/") && !url.startsWith("//")) return { href: url, internal: true };
  if (SITE_ORIGIN.test(url)) return { href: url.replace(SITE_ORIGIN, "") || "/", internal: true };
  if (SAFE_EXTERNAL.test(url)) return { href: url, internal: false };
  return null;
}

// ── Inline ──────────────────────────────────────────────────────────────────

type Rule = { re: RegExp; build: (m: RegExpExecArray, inLink: boolean) => Inline | Inline[] };

const RULES: Rule[] = [
  {
    re: /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/,
    build: (m) => {
      const target = safeHref(m[2]);
      const children = parseInline(m[1], true);
      return target ? { type: "link", ...target, children } : children;
    },
  },
  { re: /\*\*(?=\S)([\s\S]*?\S)\*\*/, build: (m, l) => ({ type: "strong", children: parseInline(m[1], l) }) },
  { re: /(?<!\w)__(?=\S)([\s\S]*?\S)__(?!\w)/, build: (m, l) => ({ type: "strong", children: parseInline(m[1], l) }) },
  { re: /\*(?=[^\s*])([^*]*?[^\s*])\*/, build: (m, l) => ({ type: "em", children: parseInline(m[1], l) }) },
  { re: /(?<!\w)_(?=[^\s_])([^_]*?[^\s_])_(?!\w)/, build: (m, l) => ({ type: "em", children: parseInline(m[1], l) }) },
];

function earliestMatch(text: string, inLink: boolean) {
  let best: { m: RegExpExecArray; rule: Rule } | null = null;
  RULES.forEach((rule, i) => {
    if (inLink && i === 0) return; // no links inside link text
    const m = rule.re.exec(text);
    if (m && (!best || m.index < best.m.index)) best = { m, rule };
  });
  return best as { m: RegExpExecArray; rule: Rule } | null;
}

const unescape = (s: string) => s.replace(/\\([\\`*_[\]()#>-])/g, "$1");

export function parseInline(text: string, inLink = false): Inline[] {
  const out: Inline[] = [];
  let rest = text;
  while (rest) {
    const hit = earliestMatch(rest, inLink);
    if (!hit) {
      out.push({ type: "text", value: unescape(rest) });
      break;
    }
    if (hit.m.index > 0) out.push({ type: "text", value: unescape(rest.slice(0, hit.m.index)) });
    out.push(...[hit.rule.build(hit.m, inLink)].flat());
    rest = rest.slice(hit.m.index + hit.m[0].length);
  }
  return out;
}

/** Plain text of a body (for meta descriptions): Markdown syntax removed. */
export function toPlainText(body: string): string {
  const flatten = (nodes: Inline[]): string =>
    nodes.map((n) => (n.type === "text" ? n.value : flatten(n.children))).join("");
  return parseBody(body)
    .map((b) => (b.type === "list" ? b.items.map(flatten).join(" ") : flatten(b.children)))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Blocks ──────────────────────────────────────────────────────────────────

const BULLET = /^[•*-]\s+/;
const ORDERED = /^\d{1,3}[.)]\s+/;
const HEADING = /^(#{1,6})\s+(.+?)\s*#*$/;
const QUOTE = /^>\s?/;

type LineKind = "heading" | "bullet" | "ordered" | "quote" | "text";

function kindOf(line: string): LineKind {
  if (HEADING.test(line)) return "heading";
  if (BULLET.test(line)) return "bullet";
  if (ORDERED.test(line)) return "ordered";
  if (QUOTE.test(line)) return "quote";
  return "text";
}

const isEmojiHeading = (line: string) => /^\p{Extended_Pictographic}/u.test(line);
const linesOf = (block: string) => block.split(/\n/).map((l) => l.trim()).filter(Boolean);
const isListKind = (k: LineKind | undefined) => k === "bullet" || k === "ordered";

/** Consecutive lines of the same kind (each heading line is its own group). */
function groupLines(lines: string[]): { kind: LineKind; lines: string[] }[] {
  const groups: { kind: LineKind; lines: string[] }[] = [];
  for (const line of lines) {
    const kind = kindOf(line);
    const last = groups[groups.length - 1];
    if (last && last.kind === kind && kind !== "heading") last.lines.push(line);
    else groups.push({ kind, lines: [line] });
  }
  return groups;
}

function headingBlock(line: string): Block {
  const m = HEADING.exec(line);
  const hashes = m ? m[1].length : 2;
  return { type: "heading", level: hashes <= 2 ? 2 : 3, children: parseInline(m ? m[2] : line) };
}

function groupToBlock(kind: LineKind, lines: string[]): Block {
  if (kind === "heading") return headingBlock(lines[0]);
  if (isListKind(kind)) {
    const marker = kind === "bullet" ? BULLET : ORDERED;
    return { type: "list", ordered: kind === "ordered", items: lines.map((l) => parseInline(l.replace(marker, ""))) };
  }
  if (kind === "quote") return { type: "quote", children: parseInline(lines.map((l) => l.replace(QUOTE, "")).join(" ")) };
  return { type: "paragraph", children: parseInline(lines.join(" ")) };
}

// Legacy rules for plain-text posts: a single text line directly above a list
// in the same block is that list's heading; so is a standalone short line
// (<= 70 chars) whose next block is a list, and a standalone emoji line.
function parseBlock(block: string, nextBlock: string | undefined): Block[] {
  const groups = groupLines(linesOf(block));
  const nextIsList = isListKind(groupLines(linesOf(nextBlock ?? ""))[0]?.kind);
  if (groups.length === 1 && groups[0].kind === "text" && groups[0].lines.length === 1) {
    const line = groups[0].lines[0];
    if (isEmojiHeading(line) || (nextIsList && line.length <= 70)) return [headingBlock(line)];
  }
  return groups.map((g, i) => {
    const asListHeading = g.kind === "text" && g.lines.length === 1 && isListKind(groups[i + 1]?.kind);
    return asListHeading ? headingBlock(g.lines[0]) : groupToBlock(g.kind, g.lines);
  });
}

export function parseBody(body: string): Block[] {
  const blocks = body.replace(/\r\n?/g, "\n").split(/\n\s*\n+/).map((b) => b.trim()).filter(Boolean);
  return blocks.flatMap((block, i) => parseBlock(block, blocks[i + 1]));
}
