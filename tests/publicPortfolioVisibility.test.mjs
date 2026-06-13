import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const professionalDataPath = new URL("../lib/professionalData.ts", import.meta.url);
const portfolioPagePath = new URL("../app/(professional)/portfolio/page.tsx", import.meta.url);
const homePagePath = new URL("../app/(professional)/page.tsx", import.meta.url);

test("couples portfolio stays out of every public gallery surface", async () => {
  const [dataSource, portfolioSource, homeSource] = await Promise.all([
    readFile(professionalDataPath, "utf8"),
    readFile(portfolioPagePath, "utf8"),
    readFile(homePagePath, "utf8"),
  ]);

  assert.match(dataSource, /VISIBLE_PORTFOLIO_SLUGS = \["grads", "families"\]/);
  assert.match(portfolioSource, /if \(requestedCategory && !selected\) redirect\("\/portfolio"\)/);
  // The home page is the public conversion surface (the former HomeConversionSections
  // component was folded into it). Couples must never be linked as a gallery here.
  assert.doesNotMatch(homeSource, /couplesGallery/);
  assert.doesNotMatch(homeSource, /portfolio\?category=couples/);
  assert.doesNotMatch(homeSource, /Couples photography gallery/);
});
