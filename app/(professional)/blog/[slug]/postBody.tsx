import { type ReactNode } from "react";
import Link from "next/link";
import { C } from "@/lib/colors";
import { parseBody, type Block, type Inline } from "@/lib/blog/markdown";

// ─────────────────────────────────────────────────────────────────────────────
// Renders a journal/blog body into semantic HTML (<h2>/<h3>, <p>, <ul>/<ol>,
// <blockquote>, <a>, <strong>, <em>). Parsing lives in lib/blog/markdown.ts:
// Content Engine bodies are Markdown, older posts are plain text, and both
// render through the same tree. Everything is emitted as React elements —
// never as raw HTML — so a body can't inject markup or script links.
// ─────────────────────────────────────────────────────────────────────────────

const PARA = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.05rem",
  lineHeight: 1.9,
  color: "#555",
  marginBottom: 24,
} as const;

const H2 = {
  fontFamily: "Georgia, 'Times New Roman', serif",
  fontSize: "1.6rem",
  fontWeight: 400,
  letterSpacing: "0.01em",
  color: "#222",
  lineHeight: 1.3,
  margin: "44px 0 18px",
} as const;

const H3 = { ...H2, fontSize: "1.25rem", margin: "34px 0 14px" } as const;
const UL = { ...PARA, paddingLeft: 22, listStyleType: "disc" } as const;
const OL = { ...PARA, paddingLeft: 22, listStyleType: "decimal" } as const;
const LI = { marginBottom: 8 } as const;
const QUOTE = {
  ...PARA,
  fontStyle: "italic",
  borderLeft: `2px solid ${C.proAccentBorder}`,
  margin: "0 0 24px",
  padding: "2px 0 2px 20px",
} as const;
const LINK = {
  color: C.proAccent,
  textDecoration: "underline",
  textDecorationColor: C.proAccentBorder,
  textUnderlineOffset: "3px",
} as const;

function renderInline(nodes: Inline[]): ReactNode[] {
  return nodes.map((n, i) => {
    if (n.type === "text") return n.value;
    if (n.type === "strong") return <strong key={i}>{renderInline(n.children)}</strong>;
    if (n.type === "em") return <em key={i}>{renderInline(n.children)}</em>;
    if (n.internal) return <Link key={i} href={n.href} style={LINK}>{renderInline(n.children)}</Link>;
    return (
      <a key={i} href={n.href} style={LINK} target="_blank" rel="noopener noreferrer">
        {renderInline(n.children)}
      </a>
    );
  });
}

function renderBlock(block: Block, key: number): ReactNode {
  switch (block.type) {
    case "heading":
      return block.level === 2
        ? <h2 key={key} style={H2}>{renderInline(block.children)}</h2>
        : <h3 key={key} style={H3}>{renderInline(block.children)}</h3>;
    case "list": {
      const items = block.items.map((item, j) => <li key={j} style={LI}>{renderInline(item)}</li>);
      return block.ordered ? <ol key={key} style={OL}>{items}</ol> : <ul key={key} style={UL}>{items}</ul>;
    }
    case "quote":
      return <blockquote key={key} style={QUOTE}>{renderInline(block.children)}</blockquote>;
    case "paragraph":
      return <p key={key} style={PARA}>{renderInline(block.children)}</p>;
  }
}

export function renderPostBody(body: string): ReactNode[] {
  return parseBody(body).map(renderBlock);
}

// School internal-link detection now lives in lib/portfolioCategoryContent
// (detectSchoolLink), shared with the school landing pages. /blog/[slug] imports
// it directly.
