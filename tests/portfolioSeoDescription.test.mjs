import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPortfolioSeoDescription,
  normalizePortfolioSeoTags,
} from "../lib/portfolioSeoDescription.ts";

test("normalizePortfolioSeoTags keeps only supported quick-tag values", () => {
  assert.deepEqual(
    normalizePortfolioSeoTags({
      school: "UC Berkeley",
      location: "Legion of Honor",
      goldenHour: true,
    }),
    {
      school: "UC Berkeley",
      location: "Legion of Honor",
      session: null,
      degree: null,
      year: null,
      attire: null,
      goldenHour: true,
    },
  );

  assert.deepEqual(
    normalizePortfolioSeoTags({
      school: "Unknown School",
      location: "Somewhere",
      goldenHour: "yes",
    }),
    {
      school: null,
      location: null,
      session: null,
      degree: null,
      year: null,
      attire: null,
      goldenHour: false,
    },
  );
});

test("buildPortfolioSeoDescription creates concise SEO copy for a tagged grad photo", () => {
  const description = buildPortfolioSeoDescription({
    school: "USF",
    location: "Legion of Honor",
    goldenHour: true,
  });

  assert.equal(description.title, "USF grad portrait at Legion of Honor");
  assert.equal(
    description.alt,
    "Golden hour USF graduation portrait at Legion of Honor in the Bay Area",
  );
  assert.ok(description.alt.length <= 125);
});

test("buildPortfolioSeoDescription handles on-campus photos without awkward location wording", () => {
  const description = buildPortfolioSeoDescription({
    school: "SF State",
    location: "On campus",
    goldenHour: false,
  });

  assert.equal(description.title, "SF State grad portrait on campus");
  assert.equal(description.alt, "SF State graduation portrait on campus in the Bay Area");
});
