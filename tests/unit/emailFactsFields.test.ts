import { describe, expect, it } from "vitest";
import {
  EMAIL_FACT_FIELDS, FIELD_SPECS, type EmailFactField,
} from "@/lib/contentEngine/emailFacts/fields";

const coerce = (field: EmailFactField, raw: string) => FIELD_SPECS[field].coerce(raw);

describe("public display name", () => {
  it("publishes a first name only, never the full name", () => {
    expect(coerce("public_display_name", "Khuong Nguyen")).toBe("Khuong");
  });
  it("capitalizes a lowercase first name", () => {
    expect(coerce("public_display_name", "dana")).toBe("Dana");
  });
});

describe("service type", () => {
  it("maps conversational wording onto the taxonomy", () => {
    expect(coerce("service_type", "couples session")).toBe("couples");
    expect(coerce("service_type", "Graduation")).toBe("grads");
    expect(coerce("service_type", "engagement")).toBe("couples");
  });
  it("refuses a service the taxonomy has no value for", () => {
    expect(coerce("service_type", "underwater drone shoot")).toBeNull();
  });
});

describe("locations", () => {
  it("accepts a real place", () => {
    expect(coerce("primary_location", "Palace of Fine Arts")).toBe("Palace of Fine Arts");
  });

  // The spec calls this confusion out by name.
  it("refuses a date offered as a location", () => {
    expect(coerce("primary_location", "September 28")).toBeNull();
    expect(coerce("primary_location", "Sept 28th")).toBeNull();
    expect(coerce("primary_location", "10/25")).toBeNull();
    expect(coerce("primary_location", "Saturday the 25th at 5:30pm")).toBeNull();
  });

  it("keeps a place whose name contains a number", () => {
    expect(coerce("primary_location", "Pier 39")).toBe("Pier 39");
  });
});

describe("dates and times", () => {
  it("accepts an ISO date", () => {
    expect(coerce("session_date", "2026-10-25")).toBe("2026-10-25");
  });
  it("refuses anything that is not a real ISO date", () => {
    expect(coerce("session_date", "October 25")).toBeNull();
    expect(coerce("session_date", "2026-02-31")).toBeNull();
    expect(coerce("session_date", "2026-13-01")).toBeNull();
  });
  it("accepts a 24-hour time only", () => {
    expect(coerce("start_time", "17:30")).toBe("17:30");
    expect(coerce("start_time", "5:30 pm")).toBeNull();
    expect(coerce("start_time", "24:00")).toBeNull();
  });
});

describe("closed value sets", () => {
  it("normalizes spacing and case into a taxonomy value", () => {
    expect(coerce("lighting_condition", "Golden Hour")).toBe("golden_hour");
    expect(coerce("vibe", "Romantic")).toBe("romantic");
    expect(coerce("relationship_type", "Engagement")).toBe("engagement");
  });
  it("refuses a value outside the set", () => {
    expect(coerce("lighting_condition", "dappled twilight")).toBeNull();
    expect(coerce("vibe", "chaotic")).toBeNull();
    expect(coerce("relationship_type", "situationship")).toBeNull();
  });
});

describe("school", () => {
  it("resolves a school name to its /grads slug", () => {
    expect(coerce("school_slug", "UC Berkeley")).toBe("uc-berkeley");
    expect(coerce("school_slug", "San Francisco State")).toBe("sf-state");
    expect(coerce("school_slug", "SJSU")).toBe("sjsu");
  });
  it("has no slug for a school with no page", () => {
    expect(coerce("school_slug", "UC Santa Cruz")).toBeNull();
    expect(coerce("school_slug", "Chico State")).toBeNull();
  });
});

describe("field registry", () => {
  it("describes every extractable field exactly once", () => {
    expect(Object.keys(FIELD_SPECS).sort()).toEqual([...EMAIL_FACT_FIELDS].sort());
  });
  it("marks the two private fields as internal", () => {
    const internal = EMAIL_FACT_FIELDS.filter((f) => FIELD_SPECS[f].internal);
    expect(internal).toEqual(["internal_client_name", "internal_notes"]);
  });
});
