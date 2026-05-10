import test from "node:test";
import assert from "node:assert/strict";

import {
  IMAGE_LIBRARY_SOURCE_TYPES,
  buildJournalImageLibraryRows,
  buildPortfolioInsertFromAsset,
  filterMissingLibraryRows,
  getNextPortfolioSortOrder,
  imageLibraryKey,
} from "../lib/imageLibraryShared.ts";

test("buildJournalImageLibraryRows creates cover and gallery assets", () => {
  const rows = buildJournalImageLibraryRows({
    postId: 42,
    postSlug: "uc-berkeley-grads",
    postTitle: "UC Berkeley Grads",
    coverImageUrl: "https://cdn.example.com/blog/cover.jpg",
    extraImageUrls: [
      "https://cdn.example.com/blog/one.jpg",
      "https://cdn.example.com/blog/two.jpg",
    ],
  });

  assert.equal(rows.length, 3);
  assert.equal(rows[0].source_role, "cover");
  assert.equal(rows[1].source_role, "gallery");
  assert.equal(rows[0].source_type, IMAGE_LIBRARY_SOURCE_TYPES.journal);
});

test("imageLibraryKey deduplicates by post role and url", () => {
  assert.equal(
    imageLibraryKey({
      source_post_id: 7,
      source_role: "cover",
      image_url: "https://cdn.example.com/a.jpg",
    }),
    "7::cover::https://cdn.example.com/a.jpg",
  );
});

test("buildPortfolioInsertFromAsset maps library asset into portfolio row", () => {
  const payload = buildPortfolioInsertFromAsset({
    title: "Golden hour grad",
    alt: "Golden hour grad portrait",
    image_url: "https://cdn.example.com/golden.jpg",
    categorySlug: "grads",
    categoryId: 2,
    sortOrder: 14,
  });

  assert.deepEqual(payload, {
    title: "Golden hour grad",
    alt: "Golden hour grad portrait",
    image_url: "https://cdn.example.com/golden.jpg",
    category_id: 2,
    category_slug: "grads",
    featured: false,
    sort_order: 14,
  });
});

test("filterMissingLibraryRows excludes assets already present", () => {
  const candidates = [
    { source_post_id: 42, source_role: "cover", image_url: "a" },
    { source_post_id: 42, source_role: "gallery", image_url: "b" },
  ];
  const existing = [
    { source_post_id: 42, source_role: "cover", image_url: "a" },
  ];

  const rows = filterMissingLibraryRows(candidates, existing);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].image_url, "b");
});

test("filterMissingLibraryRows also removes duplicate candidates in the same batch", () => {
  const candidates = [
    { source_post_id: 42, source_role: "gallery", image_url: "b" },
    { source_post_id: 42, source_role: "gallery", image_url: "b" },
    { source_post_id: 42, source_role: "gallery", image_url: "c" },
  ];

  const rows = filterMissingLibraryRows(candidates, []);

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => row.image_url), ["b", "c"]);
});

test("getNextPortfolioSortOrder appends after the current highest order", () => {
  assert.equal(getNextPortfolioSortOrder([{ sort_order: 2 }, { sort_order: 6 }]), 7);
  assert.equal(getNextPortfolioSortOrder([]), 1);
});
