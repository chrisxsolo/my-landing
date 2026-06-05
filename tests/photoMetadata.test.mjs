import test from "node:test";
import assert from "node:assert/strict";

import {
  getPhotoAlt,
  getPhotoTitle,
  normalizePortfolioCategorySlug,
  selectDistinctImageUrl,
} from "../lib/photoMetadata.ts";

test("normalizePortfolioCategorySlug maps legacy portfolio slugs to public slugs", () => {
  assert.equal(normalizePortfolioCategorySlug("graduation"), "grads");
  assert.equal(normalizePortfolioCategorySlug("family"), "families");
  assert.equal(normalizePortfolioCategorySlug("portraits"), "families");
  assert.equal(normalizePortfolioCategorySlug("couples"), "couples");
});

test("getPhotoAlt replaces empty or filename-style alt text with descriptive public copy", () => {
  assert.equal(
    getPhotoAlt({ alt: "", title: "", categorySlug: "grads" }),
    "Bay Area graduation portrait by soloxsnaps",
  );
  assert.equal(
    getPhotoAlt({ alt: "DSC00176 8a5fd1a2 2500.jpg", title: "", categorySlug: "family" }),
    "Bay Area family portrait by soloxsnaps",
  );
  assert.equal(
    getPhotoAlt({ alt: "Golden Hour Palace of Fine Arts", title: "", categorySlug: "graduation" }),
    "Golden Hour Palace of Fine Arts",
  );
});

test("getPhotoTitle replaces empty or filename-style titles with portfolio labels", () => {
  assert.equal(getPhotoTitle({ title: "", categorySlug: "grads" }), "Graduation portrait");
  assert.equal(getPhotoTitle({ title: "DSC02417 b903ebf4 2500.jpg", categorySlug: "family" }), "Family portrait");
});

test("selectDistinctImageUrl avoids reusing an already selected image when alternatives exist", () => {
  const images = [
    { image_url: "a.jpg" },
    { image_url: "b.jpg" },
    { image_url: "c.jpg" },
  ];

  assert.equal(selectDistinctImageUrl(images, ["a.jpg"], "a.jpg"), "b.jpg");
  assert.equal(selectDistinctImageUrl(images, ["a.jpg", "b.jpg", "c.jpg"], "a.jpg"), "a.jpg");
});
