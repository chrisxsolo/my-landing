import { type ReactNode } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Renders a journal/blog body string into semantic HTML for SEO.
//
// Bodies are authored as plain text with blank-line-separated blocks. This
// detects section headings and bullet lists (deterministically, no fragile
// guessing) and renders them as <h2> / <ul> so search engines see real
// structure instead of a wall of <p> tags.
//
// Heading rules (all deterministic):
//  1. A non-bullet line that sits directly above bullets in the same block.
//  2. A standalone short line whose *next* block is a bullet list.
//  3. A standalone line that begins with an emoji (e.g. "📸 Book Your Session").
// Everything else is a paragraph.
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

const UL = { ...PARA, paddingLeft: 22, listStyleType: "disc" } as const;
const LI = { marginBottom: 8 } as const;

const BULLET = /^[•*-]\s+/;
const stripLead = (line: string) => line.replace(/^\s+/, "");
const isBullet = (line: string) => BULLET.test(stripLead(line));
const isEmojiHeading = (line: string) => /^\p{Extended_Pictographic}/u.test(line);

function blockHasBullets(block: string | undefined): boolean {
  if (!block) return false;
  return block.split(/\n/).map((l) => l.trim()).filter(Boolean).some(isBullet);
}

export function renderPostBody(body: string): ReactNode[] {
  const blocks = body.split(/\n\n+/).map((b) => b.trim()).filter(Boolean);
  const nodes: ReactNode[] = [];

  blocks.forEach((block, i) => {
    const lines = block.split(/\n/).map((l) => l.trim()).filter(Boolean);
    const bulletLines = lines.filter(isBullet);

    if (bulletLines.length > 0) {
      const heading = lines.find((l) => !isBullet(l));
      if (heading) nodes.push(<h2 key={`h${i}`} style={H2}>{heading}</h2>);
      nodes.push(
        <ul key={`u${i}`} style={UL}>
          {bulletLines.map((b, j) => (
            <li key={j} style={LI}>{stripLead(b).replace(BULLET, "")}</li>
          ))}
        </ul>
      );
      return;
    }

    const single = lines.length === 1 ? lines[0] : null;
    const nextIsBullets = blockHasBullets(blocks[i + 1]);
    if (single && (isEmojiHeading(single) || (nextIsBullets && single.length <= 70))) {
      nodes.push(<h2 key={`h${i}`} style={H2}>{single}</h2>);
      return;
    }

    nodes.push(<p key={`p${i}`} style={PARA}>{lines.join(" ")}</p>);
  });

  return nodes;
}

// School internal-link detection now lives in lib/portfolioCategoryContent
// (detectSchoolLink), shared with the school landing pages. /blog/[slug] imports
// it directly.
