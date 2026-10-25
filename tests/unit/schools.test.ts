import { describe, it, expect } from "vitest";
import {
  BUILT_IN_SCHOOLS, BUILT_IN_SCHOOL_OPTIONS, filterSchools, findDuplicateSchool,
  schoolMatchKey, suggestSchoolSlug, validateNewSchool, type SchoolOption,
} from "@/lib/contentEngine/schools";
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
      ok: true, value: { name: UC_LAW.name, shortName: "UC Law SF", slug: "uc-law-san-francisco" },
    });
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

  it("lists custom schools in the extraction prompt only when they exist", () => {
    expect(buildSystemPrompt(ALL)).toContain("uc-law-san-francisco");
    expect(buildSystemPrompt()).not.toContain("uc-law-san-francisco");
  });
});
