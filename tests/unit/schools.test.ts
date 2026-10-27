import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BUILT_IN_SCHOOLS, BUILT_IN_SCHOOL_OPTIONS, CUSTOM_SCHOOLS_TABLE, filterSchools, findDuplicateSchool,
  findSimilarSchool, matchSchoolCandidate, schoolMatchKey, suggestSchoolSlug, validateNewSchool,
  type SchoolOption,
} from "@/lib/contentEngine/schools";
import { createCustomSchool } from "@/lib/contentEngine/schoolStore";
import { SCHOOL_SLUGS } from "@/lib/contentEngine/taxonomy";
import { normalizeSchool } from "@/lib/schoolDetection";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { buildPortfolioPickPrompt, buildJournalPrompt } from "@/lib/contentEngine/prompts";
import { generateMetaKeywords } from "@/lib/contentEngine/serviceKeywords";
import { coerceSchool } from "@/lib/contentEngine/emailFacts/fields";
import { buildSystemPrompt } from "@/lib/contentEngine/emailFacts/extract";

const UC_LAW: SchoolOption = {
  slug: "uc-law-san-francisco",
  name: "University of California College of the Law, San Francisco",
  shortName: "UC Law SF",
  aliases: [],
  builtIn: false,
};
const ALL = [...BUILT_IN_SCHOOL_OPTIONS, UC_LAW];
const custom = (slug: string, name: string, shortName: string | null = null): SchoolOption =>
  ({ slug, name, shortName, aliases: [], builtIn: false });
const SAMUEL_MERRITT = custom("samuel-merritt", "Samuel Merritt University");
const DOMINICAN = custom("dominican", "Dominican University of California", "Dominican");
const DUGONI = custom("uop-dugoni", "University of the Pacific, Arthur A. Dugoni School of Dentistry", "Pacific Dugoni");

describe("built-in school registry", () => {
  it("covers exactly the page-backed school slugs", () => {
    expect(Object.keys(BUILT_IN_SCHOOLS).sort()).toEqual([...SCHOOL_SLUGS].sort());
  });

  it("uses schoolDetection's canonical names (email auto-fill maps one to the other)", () => {
    for (const slug of SCHOOL_SLUGS) {
      const { name } = BUILT_IN_SCHOOLS[slug];
      expect(normalizeSchool(name)?.canonicalName).toBe(name);
    }
  });
});

describe("schoolMatchKey", () => {
  it("treats the three UC Law SF spellings as one school", () => {
    const key = schoolMatchKey("University of California College of the Law, San Francisco");
    expect(schoolMatchKey("UC Law SF")).toBe(key);
    expect(schoolMatchKey("UC Law San Francisco")).toBe(key);
  });

  it("keeps different schools apart", () => {
    expect(schoolMatchKey("University of San Francisco")).not.toBe(schoolMatchKey("San Francisco State University"));
    expect(schoolMatchKey("UC Law SF")).not.toBe(schoolMatchKey("University of San Francisco"));
  });

  it("has nothing left for purely generic names", () => {
    expect(schoolMatchKey("The University")).toBe("");
  });

  // Real inquiry spellings that used to come out as different keys.
  it("drops a trailing 'in <city>'", () => {
    expect(schoolMatchKey("Samuel Merritt University in Oakland")).toBe(schoolMatchKey("Samuel Merritt University"));
    expect(schoolMatchKey("Samuel Merritt University in Oakland")).toBe("merritt samuel");
  });

  it("spells out CA", () => {
    expect(schoolMatchKey("Dominican University of CA")).toBe(schoolMatchKey("Dominican University of California"));
  });

  it("maps the former UC Hastings name onto UC Law SF", () => {
    const current = schoolMatchKey("UC Law SF");
    expect(schoolMatchKey("UC Hastings")).toBe(current);
    expect(schoolMatchKey("Hastings College of the Law")).toBe(current);
    expect(schoolMatchKey(UC_LAW.name)).toBe(current);
  });

  it("does not drop a word that only happens to be preceded by 'in' mid-name", () => {
    expect(schoolMatchKey("Institute in Design and Arts Oakland Campus")).toBe("arts design institute oakland");
  });
});

describe("suggestSchoolSlug", () => {
  it("builds the slug from the short name and spells out SF", () => {
    expect(suggestSchoolSlug(UC_LAW.name, "UC Law SF")).toBe("uc-law-san-francisco");
  });

  it("falls back to the full name", () => {
    expect(suggestSchoolSlug("Foothill College", null)).toBe("foothill-college");
  });

  it("stays within the slug length limit", () => {
    expect(suggestSchoolSlug("word ".repeat(40), null).length).toBeLessThanOrEqual(80);
  });
});

describe("findDuplicateSchool", () => {
  it("matches an abbreviation of a saved custom school", () => {
    const candidate = { name: "UC Law San Francisco", shortName: null, slug: "uc-law-sf" };
    expect(findDuplicateSchool(candidate, ALL)?.slug).toBe("uc-law-san-francisco");
  });

  it("matches built-in schools by full name, short name and alias", () => {
    const dup = (name: string) => findDuplicateSchool({ name, shortName: null, slug: "x-new" }, ALL)?.slug;
    expect(dup("University of California, Berkeley")).toBe("uc-berkeley");
    expect(dup("SFSU")).toBe("sf-state");
    expect(dup("Cal State East Bay")).toBe("csueb");
  });

  it("matches on the slug alone", () => {
    expect(findDuplicateSchool({ name: "Something New", shortName: null, slug: "usf" }, ALL)?.slug).toBe("usf");
  });

  it("lets a genuinely new school through", () => {
    expect(findDuplicateSchool({ name: "UC Berkeley School of Law", shortName: "Berkeley Law", slug: "berkeley-law" }, ALL))
      .toBeNull();
    expect(findDuplicateSchool({ name: "Foothill College", shortName: null, slug: "foothill-college" }, ALL)).toBeNull();
  });

  it("matches a saved alias and a candidate's own aliases", () => {
    const withAlias: SchoolOption = { ...UC_LAW, aliases: ["Hastings"] };
    expect(findDuplicateSchool({ name: "Hastings", shortName: null, slug: "hastings" }, [withAlias])?.slug).toBe(UC_LAW.slug);
    const candidate = { name: "Some New School", shortName: null, slug: "some-new", aliases: ["UC Law SF"] };
    expect(findDuplicateSchool(candidate, ALL)?.slug).toBe(UC_LAW.slug);
  });

  it("treats the real inquiry spellings as the saved school", () => {
    const dup = (name: string, schools: SchoolOption[]) =>
      findDuplicateSchool({ name, shortName: null, slug: "x-new" }, schools)?.slug ?? null;
    expect(dup("UC Hastings", ALL)).toBe(UC_LAW.slug);
    expect(dup("Samuel Merritt University in Oakland", [SAMUEL_MERRITT])).toBe(SAMUEL_MERRITT.slug);
    expect(dup("Dominican University of CA", [DOMINICAN])).toBe(DOMINICAN.slug);
  });
});

describe("findSimilarSchool / matchSchoolCandidate", () => {
  const candidate = (name: string) => ({ name, shortName: null, slug: "x-new" });

  it("suggests the saved school whose name contains every word of the shorter one", () => {
    expect(findSimilarSchool(candidate("Samuel Merritt"), [SAMUEL_MERRITT])?.slug).toBe(SAMUEL_MERRITT.slug);
    expect(findSimilarSchool(candidate("Samuel Merritt University, Oakland"), [SAMUEL_MERRITT])?.slug)
      .toBe(SAMUEL_MERRITT.slug);
    expect(findSimilarSchool(candidate("uop dugoni"), [DUGONI])?.slug).toBe(DUGONI.slug);
  });

  it("never suggests from a single shared word or from place names alone", () => {
    expect(findSimilarSchool(candidate("California College of the Arts"), ALL)).toBeNull();
    expect(findSimilarSchool(candidate("Stanford Law"), ALL)).toBeNull();
    expect(findSimilarSchool(candidate("Foothill College"), ALL)).toBeNull();
    // "UC Law SF" shares "san francisco" with USF and "uc" with UC Berkeley — neither is it.
    expect(findSimilarSchool({ ...UC_LAW, slug: "x-new" }, BUILT_IN_SCHOOL_OPTIONS)).toBeNull();
    expect(findSimilarSchool(candidate("UC Berkeley School of Law"), ALL)).toBeNull();
  });

  it("reports an exact match as a duplicate and a look-alike as similar", () => {
    expect(matchSchoolCandidate(candidate("UC Law San Francisco"), ALL)).toEqual({ school: UC_LAW, kind: "duplicate" });
    expect(matchSchoolCandidate(candidate("Samuel Merritt University, Oakland"), [...ALL, SAMUEL_MERRITT]))
      .toEqual({ school: SAMUEL_MERRITT, kind: "similar" });
    expect(matchSchoolCandidate(candidate("Foothill College"), ALL)).toBeNull();
  });
});

describe("filterSchools", () => {
  it("returns everything for an empty query", () => {
    expect(filterSchools(ALL, "  ")).toHaveLength(ALL.length);
  });

  it("finds schools by any part of any name", () => {
    expect(filterSchools(ALL, "law").map((s) => s.slug)).toEqual(["uc-law-san-francisco"]);
    expect(filterSchools(ALL, "sfsu").map((s) => s.slug)).toEqual(["sf-state"]);
    expect(filterSchools(ALL, "jose").map((s) => s.slug)).toEqual(["sjsu"]);
  });

  it("finds a school by an equivalent spelling", () => {
    expect(filterSchools(ALL, "UC Law San Francisco").map((s) => s.slug)).toEqual(["uc-law-san-francisco"]);
  });

  it("returns nothing for an unknown school", () => {
    expect(filterSchools(ALL, "Foothill")).toEqual([]);
  });
});

describe("validateNewSchool", () => {
  it("accepts the UC Law SF example and tidies whitespace", () => {
    const result = validateNewSchool({ name: `  ${UC_LAW.name}  `, shortName: " UC  Law SF ", slug: "" });
    expect(result).toEqual({
      ok: true, value: { name: UC_LAW.name, shortName: "UC Law SF", slug: "uc-law-san-francisco", aliases: [] },
    });
  });

  it("keeps other names, tidied and de-duplicated, from an array or a comma list", () => {
    const fromList = validateNewSchool({ name: UC_LAW.name, aliases: " UC Hastings , Hastings Law,, UC Hastings" });
    expect(fromList.ok && fromList.value.aliases).toEqual(["UC Hastings", "Hastings Law"]);
    const fromArray = validateNewSchool({ name: UC_LAW.name, aliases: ["UC Hastings"] });
    expect(fromArray.ok && fromArray.value.aliases).toEqual(["UC Hastings"]);
  });

  it("rejects markup inside an alias", () => {
    expect(validateNewSchool({ name: UC_LAW.name, aliases: ["<b>Hastings</b>"] }).ok).toBe(false);
  });

  it("requires a name", () => {
    expect(validateNewSchool({ name: " " }).ok).toBe(false);
    expect(validateNewSchool({}).ok).toBe(false);
  });

  it("rejects markup and generic-only names", () => {
    expect(validateNewSchool({ name: "<script>alert(1)</script>" }).ok).toBe(false);
    expect(validateNewSchool({ name: "University" }).ok).toBe(false);
  });

  it("rejects a malformed slug", () => {
    expect(validateNewSchool({ name: "Foothill College", slug: "Foothill College!" }).ok).toBe(false);
    expect(validateNewSchool({ name: "Foothill College", slug: "-foothill" }).ok).toBe(false);
  });
});

describe("custom schools reach the AI", () => {
  const session = {
    service_type: "grads", school_slug: "uc-law-san-francisco", public_display_name: "Ana",
    primary_location: "Civic Center",
  };

  it("snapshot carries the resolved custom school name", () => {
    const facts = buildSessionFactsSnapshot(session, UC_LAW);
    expect(facts.school_name).toBe(UC_LAW.name);
    expect(facts.school_short_name).toBe("UC Law SF");
  });

  it("snapshot resolves built-in school names without a lookup", () => {
    const facts = buildSessionFactsSnapshot({ service_type: "grads", school_slug: "usf" });
    expect(facts.school_name).toBe("University of San Francisco");
    expect(facts.school_short_name).toBe("USF");
  });

  it("snapshot leaves names empty for an unresolved custom slug and for no school", () => {
    expect(buildSessionFactsSnapshot(session).school_name).toBeNull();
    expect(buildSessionFactsSnapshot({ service_type: "couples" }).school_name).toBeNull();
  });

  it("prompts name the school and forbid substituting another one", () => {
    const facts = buildSessionFactsSnapshot(session, UC_LAW);
    const portfolio = buildPortfolioPickPrompt(facts, []);
    const journal = buildJournalPrompt(facts, [], { links: [], testimonialQuote: null, locationBlock: "" });
    for (const prompt of [portfolio, journal]) {
      expect(prompt.userText).toContain(`The graduate's school is ${UC_LAW.name} (short name: UC Law SF)`);
      expect(prompt.userText).toContain("never name a different university");
    }
  });

  it("prompts add no school line when there is no school", () => {
    const facts = buildSessionFactsSnapshot({ service_type: "couples" });
    expect(buildPortfolioPickPrompt(facts, []).userText).not.toContain("graduate's school");
  });

  it("meta keywords use the custom school's short name", () => {
    expect(generateMetaKeywords(buildSessionFactsSnapshot(session, UC_LAW)))
      .toBe("UC Law SF, Civic Center, graduation photos, Bay Area");
  });

  it("meta keywords for built-in schools keep their exact old format", () => {
    const facts = buildSessionFactsSnapshot({ service_type: "grads", school_slug: "sf-state", primary_location: "Quad" });
    expect(generateMetaKeywords(facts)).toBe("sf state, Quad, graduation photos, Bay Area");
  });
});

describe("email auto-fill recognizes custom schools", () => {
  it("maps any spelling of a saved custom school to its slug", () => {
    expect(coerceSchool("UC Law SF", ALL)).toBe("uc-law-san-francisco");
    expect(coerceSchool("UC Law San Francisco", ALL)).toBe("uc-law-san-francisco");
    expect(coerceSchool("uc-law-san-francisco", ALL)).toBe("uc-law-san-francisco");
  });

  it("drops an unsaved school and keeps built-in behaviour", () => {
    expect(coerceSchool("UC Law SF")).toBeNull();
    expect(coerceSchool("SJSU", ALL)).toBe("sjsu");
    expect(coerceSchool("Cal Bears", ALL)).toBe("uc-berkeley");
  });

  it("prefers an exact custom match over a loose built-in alias", () => {
    const bcc: SchoolOption = { slug: "berkeley-city-college", name: "Berkeley City College", shortName: null, aliases: [], builtIn: false };
    expect(coerceSchool("Berkeley City College", [...ALL, bcc])).toBe("berkeley-city-college");
  });

  it("maps the real inquiry spellings onto saved custom schools", () => {
    const saved = [...ALL, SAMUEL_MERRITT, DOMINICAN, DUGONI];
    expect(coerceSchool("Samuel Merritt University in Oakland", saved)).toBe("samuel-merritt");
    expect(coerceSchool("Dominican University of CA", saved)).toBe("dominican");
    expect(coerceSchool("UC Hastings", saved)).toBe("uc-law-san-francisco");
    expect(coerceSchool("uop dugoni", saved)).toBe("uop-dugoni");
  });

  it("falls back to the one look-alike custom school, never to several or to a built-in", () => {
    const twin = custom("samuel-merritt-nursing", "Samuel Merritt School of Nursing");
    expect(coerceSchool("Samuel Merritt University, Oakland campus", [...ALL, SAMUEL_MERRITT, twin])).toBe("samuel-merritt");
    expect(coerceSchool("Samuel Merritt nursing program, Oakland", [...ALL, SAMUEL_MERRITT, twin])).toBeNull();
    expect(coerceSchool("UC Berkeley School of Law", ALL)).toBe("uc-berkeley"); // built-in detection, as before
  });
});

// A Supabase stand-in that records every table touched and answers the given
// saved rows / the inserted row, so the store can run without a database.
function recordingClient(tables: string[], saved: SchoolOption[] = []): SupabaseClient {
  const from = (table: string) => {
    tables.push(table);
    const rows = saved.map((s) => ({ slug: s.slug, name: s.name, short_name: s.shortName, aliases: s.aliases }));
    const result = { data: rows, error: null };
    const chain = {
      select: () => chain, order: () => Promise.resolve(result), eq: () => chain,
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: () => Promise.resolve({
            data: { slug: row.slug, name: row.name, short_name: row.short_name, aliases: row.aliases }, error: null,
          }),
        }),
      }),
    };
    return chain;
  };
  return { from } as unknown as SupabaseClient;
}

describe("createCustomSchool", () => {
  it("writes the aliases and touches only the schools table — nothing is published", async () => {
    const tables: string[] = [];
    const result = await createCustomSchool(recordingClient(tables), {
      name: UC_LAW.name, shortName: "UC Law SF", slug: UC_LAW.slug, aliases: ["UC Hastings"],
    });
    expect(result).toEqual({ created: true, school: { ...UC_LAW, aliases: ["UC Hastings"] } });
    expect(new Set(tables)).toEqual(new Set([CUSTOM_SCHOOLS_TABLE]));
  });

  it("refuses a look-alike until the admin confirms it is a different school", async () => {
    const candidate = { name: "Samuel Merritt University, Oakland", shortName: null, slug: "samuel-merritt-oakland" };
    const refused = await createCustomSchool(recordingClient([], [SAMUEL_MERRITT]), candidate);
    expect(refused).toMatchObject({ created: false, match: "similar", existing: { slug: "samuel-merritt" } });
    const confirmed = await createCustomSchool(recordingClient([], [SAMUEL_MERRITT]), candidate, { allowSimilar: true });
    expect(confirmed.created).toBe(true);
  });

  it("still blocks an exact duplicate even when similar ones are allowed", async () => {
    const candidate = { name: "San Francisco State University", shortName: null, slug: "sfsu-2" };
    const result = await createCustomSchool(recordingClient([]), candidate, { allowSimilar: true });
    expect(result).toMatchObject({ created: false, match: "duplicate", existing: { slug: "sf-state" } });
  });

  it("lists custom schools in the extraction prompt only when they exist", () => {
    expect(buildSystemPrompt(ALL)).toContain("uc-law-san-francisco");
    expect(buildSystemPrompt()).not.toContain("uc-law-san-francisco");
  });
});
