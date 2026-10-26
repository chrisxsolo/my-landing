import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  LIGHT_TAGS, lightTagLabel, normalizeCrowdNote, parseLightTags, sortLightTags, CROWD_NOTE_MAX,
} from "@/lib/photoConditions";
import { applyFilters, facetOptions, activeFilterCount, EMPTY_FILTERS, type FilterableLocation } from "@/lib/locationLibrary/publicFilters";
import { parseLocationPatch } from "@/lib/locationLibrary/editRules";
import { lightingHint } from "@/app/admin/content-engine/locations/LocationConditionsFields";

describe("light tag vocabulary", () => {
  it("orders, dedupes and drops unknown tags", () => {
    expect(sortLightTags(["overcast", "golden-hour", "overcast", "moonlight"])).toEqual(["golden-hour", "overcast"]);
    expect(parseLightTags(["sunrise", "golden-hour"])).toEqual(["golden-hour", "sunrise"]);
    expect(parseLightTags(["moonlight"])).toBeUndefined();
    expect(parseLightTags("golden-hour")).toBeUndefined();
    expect(lightTagLabel("midday-shade")).toBe("Open shade at midday");
    expect(lightTagLabel("midday-shade", true)).toBe("Midday shade");
  });

  it("matches the database check constraints exactly", () => {
    const sql = readFileSync(path.resolve(__dirname, "../../supabase/migrations/20261026000006_photo_conditions.sql"), "utf8");
    const lists = [...sql.matchAll(/light_tags <@ array\[([^\]]+)\]/g)]
      .map((m) => m[1].split(",").map((v) => v.trim().replace(/'/g, "")).filter(Boolean));
    expect(lists).toHaveLength(2);
    for (const list of lists) expect(list).toEqual(LIGHT_TAGS.map((t) => t.value));
    expect(sql).toContain(`between 1 and ${CROWD_NOTE_MAX}`);
  });
});

describe("crowd notes", () => {
  it("stores one clean line, clears on empty and refuses bad input", () => {
    expect(normalizeCrowdNote("  Packed on\n weekends  ")).toBe("Packed on weekends");
    expect(normalizeCrowdNote("   ")).toBeNull();
    expect(normalizeCrowdNote(null)).toBeNull();
    expect(normalizeCrowdNote(42)).toBeUndefined();
    expect(normalizeCrowdNote("x".repeat(CROWD_NOTE_MAX + 1))).toBeUndefined();
  });
});

describe("light filter on the public library", () => {
  const loc = (over: Partial<FilterableLocation>): FilterableLocation => ({
    title: "X", city: "San Francisco", neighborhood: null, description: "", best_for: "", best_time: "", tip: "",
    region: "san-francisco", tags: [], environments: [], light_tags: [], kinds: [], order: 1, photoCount: 0,
    sessionCount: 0, createdAt: "2026-01-01", ...over,
  });
  const items = [
    loc({ title: "Baker", environments: ["beach"], light_tags: ["golden-hour", "overcast"], order: 1 }),
    loc({ title: "Palace", environments: ["architecture"], light_tags: ["midday-shade"], order: 2 }),
    loc({ title: "Gamble", region: "peninsula", environments: ["garden"], order: 3 }),
  ];

  it("filters by light and combines with the other facets", () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, light: "overcast" }, "featured").map((l) => l.title)).toEqual(["Baker"]);
    expect(applyFilters(items, { ...EMPTY_FILTERS, light: "golden-hour", environment: "architecture" }, "featured")).toEqual([]);
    expect(activeFilterCount({ ...EMPTY_FILTERS, light: "overcast" })).toBe(1);
  });

  it("finds tags by search and only offers light options a spot has", () => {
    expect(applyFilters(items, { ...EMPTY_FILTERS, query: "midday shade" }, "featured").map((l) => l.title)).toEqual(["Palace"]);
    expect(facetOptions(items).lights.map((o) => [o.value, o.count]))
      .toEqual([["golden-hour", 1], ["overcast", 1], ["midday-shade", 1]]);
    expect(facetOptions([items[2]]).lights).toEqual([]);
  });
});

describe("location edits", () => {
  it("accepts light tags and crowd notes without locking anything", () => {
    const patch = parseLocationPatch({ light_tags: ["overcast", "golden-hour"], crowd_note: " Weekends " });
    expect(patch).toEqual({ fields: { light_tags: ["golden-hour", "overcast"], crowd_note: "Weekends" }, lock: [], unlock: [] });
    expect(parseLocationPatch({ crowd_note: "" }).fields).toEqual({ crowd_note: null });
    expect(() => parseLocationPatch({ light_tags: ["moonlight"] })).toThrow("unknown light condition");
    expect(() => parseLocationPatch({ crowd_note: "x".repeat(CROWD_NOTE_MAX + 1) })).toThrow();
  });
});

describe("admin lighting hint", () => {
  it("counts recorded lighting on live sessions, most common first", () => {
    expect(lightingHint([
      { lighting: "overcast", excluded: false },
      { lighting: "golden_hour", excluded: false },
      { lighting: "golden_hour", excluded: false },
      { lighting: "harsh_light", excluded: true },
      { lighting: null, excluded: false },
    ])).toBe("golden hour ×2 · overcast ×1");
    expect(lightingHint([])).toBe("");
  });
});
