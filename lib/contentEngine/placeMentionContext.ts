// How a journal post uses a place name: as a claim that the session happened
// there, or as a reference to a guide/article about it. Pure text heuristics,
// deliberately narrow: anything that is not clearly a reference is treated by
// the caller as a mention and blocked, so a miss here errs on blocking.

export interface Span {
  start: number;
  end: number;
}

export interface ReferenceSpans {
  /** Markdown link targets — never scanned for place names. */
  urls: Span[];
  /** Markdown link texts (the "[…]" part, without brackets). */
  linkTexts: Span[];
  /** Text under a "Related posts" / "See also" style heading, up to the next heading. */
  sections: Span[];
}

const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)]*)\)/g;
const HEADING_LINE = /^(?:#{1,6}\s+.+|\*\*[^*]+\*\*:?|__[^_]+__:?|[^.!?]{1,60}:)$/;
const RELATED_HEADING = /^(?:related\b|see also|also see|keep exploring|explore more|more (?:sessions|stories|posts|guides|reading|location)|you (?:might|may) also|further reading|read next|(?:location |photo )?guides?\b)/i;

const PREP = String.raw`(?:at|in|around|through|across|inside|near|on|to|by)`;
const FILL = String.raw`(?:[\w'’-]+\s+){0,4}?`;
const THE_END = String.raw`\s+(?:the\s+)?$`;
const CLAIM_LEADS = [
  // "we shot portraits at the …", "finished at …", "spent golden hour at …"
  new RegExp(String.raw`\b(?:shot|shooting|photographed|photographing|captured|took place|started|began|finished|ended|wrapped(?:\s+up)?|met(?:\s+up)?|spent|walked|wandered|strolled|explored|headed|posed)\s+${FILL}${PREP}${THE_END}`, "i"),
  // "we explored the …", "I photographed …"
  new RegExp(String.raw`\b(?:we|i)\s+(?:[\w'’-]+\s+){0,2}?(?:explored|visited|toured|shot|photographed)${THE_END}`, "i"),
  // "our session at …", "her grad portraits in …"
  new RegExp(String.raw`\b(?:our|her|his|their|this)\s+(?:[\w'’-]+\s+){0,2}?(?:session|shoot|portraits|photos|pictures|elopement)\s+${FILL}${PREP}${THE_END}`, "i"),
];
// "… at [X](…)" reads as where the session was unless the clause points elsewhere.
const BARE_PREPOSITION = /\b(?:at|in)\s+(?:the\s+)?$/i;
const POINTER_WORDS = /\b(?:see|read|guides?|planning|plan|related|also|more|check)\b/i;

// "X guide", "X's guide", "X location guide"
const GUIDE_AFTER = /^(?:['’]s)?\s+(?:(?:location|photo|photography|portrait|spots?|session|planning)\s+){0,2}guides?\b/i;
// "guide to the X"
const GUIDE_BEFORE = /\bguides?\s+(?:to|for|on|about)\s+(?:the\s+)?$/i;
// a clause that starts "See also: …" / "Related: …"
const POINTER_START = /^\s*(?:[-*•]\s+)?(?:\*\*|__)?(?:see also|also see|related(?:\s+(?:posts?|reading|guides?))?|read more|further reading|more guides?)\b/i;
// "Planning a session at X? The [X guide](…) covers …" (see guideLinkSentence)
const INVITATION = /\bplanning\s+(?:a|an|your)\b/i;

function headingText(line: string): string {
  return line.trim().replace(/^#{1,6}\s+/, "").replace(/\*\*|__/g, "").replace(/:$/, "").trim();
}

function relatedSections(text: string): Span[] {
  const spans: Span[] = [];
  let open: number | null = null;
  let offset = 0;
  for (const line of text.split("\n")) {
    if (HEADING_LINE.test(line.trim())) {
      if (open !== null) spans.push({ start: open, end: offset });
      open = RELATED_HEADING.test(headingText(line)) ? offset + line.length : null;
    }
    offset += line.length + 1;
  }
  if (open !== null) spans.push({ start: open, end: text.length });
  return spans;
}

export function referenceSpans(text: string): ReferenceSpans {
  const urls: Span[] = [];
  const linkTexts: Span[] = [];
  for (const m of text.matchAll(MARKDOWN_LINK)) {
    const textStart = m.index + 1;
    const textEnd = textStart + m[1].length;
    linkTexts.push({ start: textStart, end: textEnd });
    urls.push({ start: textEnd + 2, end: m.index + m[0].length - 1 });
  }
  return { urls, linkTexts, sections: relatedSections(text) };
}

const inside = (at: Span, spans: readonly Span[]) => spans.find((s) => at.start >= s.start && at.end <= s.end);

/** The current sentence up to `index`. */
function clauseBefore(text: string, index: number): string {
  const head = text.slice(0, index);
  const boundary = Math.max(...[".", "!", "?", "\n"].map((c) => head.lastIndexOf(c)));
  return head.slice(boundary + 1);
}

function restOfParagraph(text: string, index: number): string {
  const end = text.indexOf("\n\n", index);
  return text.slice(index, end === -1 ? text.length : end);
}

/** Does the text say the session happened at the place named at `at`? */
export function isClaim(text: string, at: Span, spans: ReferenceSpans): boolean {
  const link = inside(at, spans.linkTexts);
  // For link text, the words before the "[" carry the meaning.
  const lead = clauseBefore(text, link ? link.start - 1 : at.start);
  if (CLAIM_LEADS.some((r) => r.test(lead))) return true;
  return link !== undefined && BARE_PREPOSITION.test(lead) && !POINTER_WORDS.test(lead);
}

/** Does the text point readers to a guide or article about the place (not a claim)? */
export function isReference(text: string, at: Span, spans: ReferenceSpans): boolean {
  if (inside(at, spans.linkTexts) || inside(at, spans.sections)) return true;
  const lead = clauseBefore(text, at.start);
  if (GUIDE_AFTER.test(text.slice(at.end, at.end + 60))) return true;
  if (GUIDE_BEFORE.test(lead) || POINTER_START.test(lead)) return true;
  return INVITATION.test(lead) && restOfParagraph(text, at.end).includes("](");
}
