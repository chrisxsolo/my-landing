// The /links photo strip should mix session types, skip landscape frames and
// never repeat a photo.
import { describe, expect, it } from "vitest";
import { pickFilmstripImages, type FilmstripSource } from "@/app/links/filmstripPicker";

const photo = (id: number, category: string, extra: Partial<FilmstripSource> = {}): FilmstripSource => ({
  id,
  image_url: `https://example.test/${id}.jpg`,
  alt: `Photo ${id}`,
  category_slug: category,
  width: 800,
  height: 1200,
  ...extra,
});

describe("pickFilmstripImages", () => {
  it("deals photos round-robin across categories, keeping each category's order", () => {
    const picked = pickFilmstripImages(
      [photo(1, "grads"), photo(2, "grads"), photo(3, "grads"), photo(4, "couples"), photo(5, "families")],
      4,
    );
    expect(picked.map((image) => image.id)).toEqual([1, 4, 5, 2]);
  });

  it("skips landscape photos, repeats and rows without a URL", () => {
    const picked = pickFilmstripImages([
      photo(1, "grads", { width: 1600, height: 900 }),
      photo(2, "grads"),
      photo(3, "grads", { image_url: "https://example.test/2.jpg" }),
      photo(4, "grads", { image_url: "" }),
      photo(5, "grads", { width: null, height: null }),
    ]);
    expect(picked.map((image) => image.id)).toEqual([2, 5]);
  });

  it("returns an empty strip when there is nothing to show", () => {
    expect(pickFilmstripImages([])).toEqual([]);
  });
});
