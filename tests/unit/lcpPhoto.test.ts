// The first-paint photo ships a lighter encode to phones and the full-quality
// one to larger screens, each preloaded only where it will be shown.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LcpPhoto, { PHONE_HERO_QUALITY } from "@/app/components/LcpPhoto";

const SRC = "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/portfolio/hero.jpg";

describe("LcpPhoto", () => {
  const html = renderToStaticMarkup(createElement(LcpPhoto, {
    src: SRC, alt: "Graduate at Sather Gate", sizes: "(max-width: 900px) 92vw, 470px", phoneSizes: "92vw", quality: 85,
  }));

  it("serves quality 75 to phones and the page's own quality elsewhere", () => {
    const source = html.match(/<source[^>]*>/)?.[0] ?? "";
    const img = html.match(/<img[^>]*>/)?.[0] ?? "";
    expect(source).toContain('media="(max-width: 760px)"');
    expect(source).toContain(`quality=${PHONE_HERO_QUALITY}`);
    expect(source).not.toContain("quality=85");
    expect(img).toContain("quality=85");
    expect(img).not.toContain("quality=75");
    expect(img).toContain('fetchPriority="high"');
    expect(img).toContain('alt="Graduate at Sather Gate"');
    expect(img).not.toContain('loading="lazy"');
  });

  it("preloads one variant per viewport class", () => {
    const preloads = html.match(/<link rel="preload"[^>]*>/g) ?? [];
    expect(preloads).toHaveLength(2);
    expect(preloads[0]).toContain('media="(max-width: 760px)"');
    expect(preloads[0]).toContain("quality=75");
    expect(preloads[1]).toContain('media="(min-width: 761px)"');
    expect(preloads[1]).toContain("quality=85");
    expect(preloads.every((tag) => tag.includes('fetchPriority="high"'))).toBe(true);
  });

  it("keeps the fill layout and focal point", () => {
    expect(html).toContain("position:absolute");
    expect(html).toContain("object-fit:cover");
    const positioned = renderToStaticMarkup(createElement(LcpPhoto, { src: SRC, alt: "", sizes: "100vw", objectPosition: "50% 35%" }));
    expect(positioned).toContain("object-position:50% 35%");
  });
});
