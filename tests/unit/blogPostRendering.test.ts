// Renders the real public post page (app/(professional)/blog/[slug]/page.tsx)
// with only the database read mocked, and checks what a reader actually gets:
// Markdown becomes semantic HTML, links are real anchors to real routes,
// untrusted Markdown can't inject markup, and older plain-text posts still
// render the way they always did.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { renderPostBody } from "@/app/(professional)/blog/[slug]/postBody";
import { parseBody, toPlainText } from "@/lib/blog/markdown";
import { CANONICAL_INTERNAL_LINKS } from "@/lib/contentEngine/taxonomy";
import { ALWAYS_ALLOWED_PATHS } from "@/lib/contentEngine/guideLinks";
import { getAllCouplesLocations } from "@/lib/couplesGuide/locations";

const post = vi.hoisted(() => ({ current: null as Record<string, unknown> | null }));
vi.mock("@/lib/professionalData", () => ({ getBlogPostBySlug: async () => post.current }));
// Content Engine service per post id; empty = a legacy post with no session.
const engineServices = vi.hoisted(() => ({ current: {} as Record<string, string> }));
vi.mock("@/lib/blog/journalServices", () => ({ getJournalServicesByPostId: async () => engineServices.current }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/app/components/ContentEventBeacon", () => ({ default: () => null }));

// The Shark Fin Cove post as it is published after the repair (abridged).
const SHARK_FIN_COVE = [
  "couples photoshoot at shark fin cove! we hit the beach right at golden hour.",
  "if you're thinking about a romantic bay area photoshoot along the coast, shark fin cove is worth the drive. " +
    "for more ideas on where to shoot up and down the bay area coastline, the " +
    "[Bay Area Couples Photography Location Guide](/couples-guide) is a good place to start.",
  "so glad we got this one. what an evening.",
  "→ curious about booking your own session? check out [Couples Photography Pricing](/pricing/couples) to see what's included.",
].join("\n\n");

function makePost(overrides: Record<string, unknown>) {
  return {
    id: 20, slug: "golden-hour-couples-session-shark-fin-cove",
    title: "Golden Hour Couples Session at Shark Fin Cove", body: SHARK_FIN_COVE,
    published_at: "2026-10-25T15:33:56Z", cover_image_url: null, cover_image_alt: null,
    extra_image_urls: [], extra_image_alts: [], og_image_url: null,
    meta_description: "", meta_keywords: null, ...overrides,
  };
}

async function renderPage(overrides: Record<string, unknown> = {}): Promise<string> {
  post.current = makePost(overrides);
  const { default: Page } = await import("@/app/(professional)/blog/[slug]/page");
  const element = await Page({ params: Promise.resolve({ slug: String(post.current.slug) }) });
  return renderToStaticMarkup(element);
}

const renderBody = (body: string) => renderToStaticMarkup(createElement(Fragment, null, ...renderPostBody(body)));
const visibleText = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const hrefs = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"/g)].map((m) => m[1]);
// The article column, and everything the page renders below it.
const afterArticleStart = (html: string) => html.split('class="slug-body-grid"')[1];
const articleOf = (html: string) => afterArticleStart(html).split("<section")[0];
const belowArticle = (html: string) => afterArticleStart(html).slice(afterArticleStart(html).indexOf("<section"));

beforeEach(() => { post.current = null; });

describe("public blog page — Markdown renders as HTML", () => {
  it("turns Markdown links into clickable anchors inside the paragraph", async () => {
    const article = articleOf(await renderPage());
    expect(article).toMatch(/<p [^>]*>[^<]*the <a [^>]*href="\/couples-guide"[^>]*>Bay Area Couples Photography Location Guide<\/a> is a good place to start\.<\/p>/);
    expect(hrefs(article)).toEqual(["/couples-guide", "/pricing/couples"]);
  });

  it("never shows Markdown syntax as text", async () => {
    const text = visibleText(articleOf(await renderPage({
      body: `${SHARK_FIN_COVE}\n\n## Planning your own\n\nPick **golden hour** and *bring layers*.`,
    })));
    expect(text).not.toMatch(/\]\(|\[[^\]]+\]|##|\*\*/);
    expect(text).toContain("Planning your own");
  });

  it("no longer carries a generated Keep exploring list in the article", async () => {
    const article = articleOf(await renderPage());
    expect(article).not.toContain("Keep exploring");
    expect(article).not.toMatch(/<ul/);
  });

  it("uses the meta description, or a plain-text excerpt without Markdown", async () => {
    const { generateMetadata } = await import("@/app/(professional)/blog/[slug]/page");
    post.current = makePost({ body: "See the [couples guide](/couples-guide) for **more**." });
    const meta = await generateMetadata({ params: Promise.resolve({ slug: "x" }) });
    expect(meta.description).toBe("See the couples guide for more.");
  });
});

describe("public blog page — links below the article match the post", () => {
  it("a couples post links couples pages, never graduation ones", async () => {
    const links = hrefs(belowArticle(await renderPage()));
    expect(links).toEqual(expect.arrayContaining(["/couples-guide", "/pricing/couples", "/contact"]));
    expect(links.some((h) => h.startsWith("/grad") || h === "/pricing/grads")).toBe(false);
  });

  it("a grad post still gets its school page and graduation links", async () => {
    const html = await renderPage({
      slug: "kim-sather-gate-uc-berkeley-class-of-2026", title: "Kim at Sather Gate", body: "A grad session.",
    });
    expect(hrefs(html)).toEqual(expect.arrayContaining(["/grads/uc-berkeley", "/pricing/grads", "/grad-guide"]));
  });

  it("trusts the Content Engine session over a title that says 'couple'", async () => {
    engineServices.current = { "31": "grads" };
    try {
      const html = await renderPage({
        id: 31, slug: "a-couple-of-grads-at-sather-gate", title: "A Couple of Grads at Sather Gate", body: "Grads.",
      });
      expect(hrefs(html)).toEqual(expect.arrayContaining(["/pricing/grads", "/grad-guide"]));
      expect(hrefs(html)).not.toContain("/pricing/couples");
      expect(hrefs(html).some((h) => h.startsWith("/contact?") && h.includes("sessionType=Graduation+Portrait"))).toBe(true);
    } finally {
      engineServices.current = {};
    }
  });
});

describe("Markdown renderer — semantic elements", () => {
  it("renders headings, emphasis, lists and quotes", () => {
    const html = renderBody([
      "## Section", "### Subsection", "Some **bold**, __also bold__, *italic* and _italic_ text.",
      "- one\n- two", "1. first\n2. second", "> client words",
    ].join("\n\n"));
    expect(html).toMatch(/<h2 [^>]*>Section<\/h2>/);
    expect(html).toMatch(/<h3 [^>]*>Subsection<\/h3>/);
    expect(html).toContain("<strong>bold</strong>, <strong>also bold</strong>, <em>italic</em> and <em>italic</em>");
    expect(html).toMatch(/<ul [^>]*><li [^>]*>one<\/li><li [^>]*>two<\/li><\/ul>/);
    expect(html).toMatch(/<ol [^>]*><li [^>]*>first<\/li><li [^>]*>second<\/li><\/ol>/);
    expect(html).toMatch(/<blockquote [^>]*>client words<\/blockquote>/);
  });

  it("keeps paragraphs separate and joins wrapped lines", () => {
    expect(parseBody("line one\nline two\n\nnext para").map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
    expect(renderBody("line one\nline two")).toMatch(/<p [^>]*>line one line two<\/p>/);
  });

  it("links inside lists and emphasis inside links both work", () => {
    const html = renderBody("- [**Lovers' Lane** guide](/couples-guide/locations/lovers-lane)");
    expect(html).toContain('href="/couples-guide/locations/lovers-lane"');
    expect(html).toContain("<strong>Lovers&#x27; Lane</strong> guide</a>");
  });

  it("does not italicize snake_case words or stray asterisks", () => {
    const html = renderBody("file_name_here and 5 * 3 * 2");
    expect(html).not.toContain("<em>");
  });
});

describe("Markdown renderer — untrusted content is safe", () => {
  it("escapes raw HTML instead of rendering it", () => {
    const html = renderBody('<script>alert(1)</script> <img src=x onerror="alert(1)">');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops dangerous link targets but keeps the words", () => {
    for (const url of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,x", "vbscript:x", "//evil.example"]) {
      const html = renderBody(`[click me](${url})`);
      expect(html, url).not.toContain("<a");
      expect(html, url).toContain("click me");
    }
  });

  it("opens external links safely and keeps our own domain internal", () => {
    expect(renderBody("[ig](https://instagram.com/soloxsnaps)")).toContain('target="_blank" rel="noopener noreferrer"');
    expect(hrefs(renderBody("[guide](https://www.soloxsnaps.com/couples-guide)"))).toEqual(["/couples-guide"]);
  });
});

describe("older plain-text posts render as before", () => {
  it("keeps the inferred headings and bullets", () => {
    const html = renderBody([
      "Intro paragraph.", "📸 Book Your Session", "What we covered", "- Sather Gate\n- Doe Library",
      "Things to bring\n• Cap\n• Gown",
    ].join("\n\n"));
    expect(html.match(/<h2/g)).toHaveLength(3);
    expect(html).toMatch(/<h2 [^>]*>📸 Book Your Session<\/h2>/);
    expect(html).toMatch(/<h2 [^>]*>What we covered<\/h2><ul/);
    expect(html).toMatch(/<h2 [^>]*>Things to bring<\/h2><ul [^>]*><li [^>]*>Cap<\/li>/);
  });

  it("plain text comes out unchanged", () => {
    expect(toPlainText("Just words, with an apostrophe’s curl.")).toBe("Just words, with an apostrophe’s curl.");
  });
});

// Every page a post may link must be a real route in the app.
function routeExists(urlPath: string): boolean {
  const segments = urlPath.split("/").filter(Boolean);
  const roots = [path.resolve("app"), path.resolve("app/(professional)")];
  return roots.some((root) => {
    let dir = root;
    for (const seg of segments) {
      if (existsSync(path.join(dir, seg))) { dir = path.join(dir, seg); continue; }
      const dynamic = readdirSync(dir).find((d) => /^\[[^.]+\]$/.test(d));
      if (!dynamic) return false;
      dir = path.join(dir, dynamic);
    }
    return existsSync(path.join(dir, "page.tsx"));
  });
}

describe("internal links point to real routes", () => {
  it("every linkable page exists", () => {
    const missing = [...CANONICAL_INTERNAL_LINKS, ...ALWAYS_ALLOWED_PATHS].filter((p) => !routeExists(p));
    expect(missing).toEqual([]);
  });

  it("the repaired posts only link known pages", () => {
    const known = new Set([...CANONICAL_INTERNAL_LINKS, ...ALWAYS_ALLOWED_PATHS]);
    const loversLane = "[Lovers’ Lane in the Presidio](/couples-guide/locations/lovers-lane) and [San Francisco photo spots](/couples-guide)";
    for (const href of [...hrefs(renderBody(SHARK_FIN_COVE)), ...hrefs(renderBody(loversLane))]) {
      expect(known.has(href), href).toBe(true);
    }
    expect(getAllCouplesLocations().some((l) => l.slug === "lovers-lane")).toBe(true);
  });
});
