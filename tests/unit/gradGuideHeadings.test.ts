// The outfit and preparation guides group their tips under category headings.
// Those groups are H2s, so the outline runs H1 → H2 → H3 instead of jumping
// from the page title straight to each tip's H3.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import WhatToWearContent from "@/app/(professional)/grad-guide/what-to-wear/WhatToWearContent";
import HowToPrepareContent from "@/app/(professional)/grad-guide/how-to-prepare/HowToPrepareContent";

const headingLevels = (html: string) => [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));

function expectNoSkippedLevels(levels: number[]) {
  expect(levels[0]).toBe(1);
  expect(levels.filter((level) => level === 1)).toHaveLength(1);
  for (let i = 1; i < levels.length; i++) {
    expect(levels[i], `heading ${i} jumps from h${levels[i - 1]} to h${levels[i]}`).toBeLessThanOrEqual(levels[i - 1] + 1);
  }
}

describe("grad guide heading outline", () => {
  it("what to wear groups tips under H2 categories", () => {
    const html = renderToStaticMarkup(createElement(WhatToWearContent, { outfits: [] }));
    const levels = headingLevels(html);
    expect(levels).toContain(2);
    expect(levels).toContain(3);
    expectNoSkippedLevels(levels);
    expect(html).toContain('<h2 class="gg-cat-label">General</h2>');
  });

  it("how to prepare groups tips under H2 categories", () => {
    const html = renderToStaticMarkup(createElement(HowToPrepareContent, { tips: [] }));
    const levels = headingLevels(html);
    expect(levels).toContain(2);
    expectNoSkippedLevels(levels);
  });
});
