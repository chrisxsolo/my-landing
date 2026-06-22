// Guards the trust signal on school landing pages: a school page may only claim
// "<School> grads on working with me" when the testimonial it shows is actually
// from that campus. testimonialMatchesSchool() is the predicate behind that
// decision — if it ever loosened (e.g. matching an SJSU review on the Berkeley
// page), the page would put the wrong campus's review under a school heading.
import { describe, it, expect } from "vitest";
import { testimonialMatchesSchool, type FeaturedTestimonial } from "@/lib/testimonialsData";

function testimonial(overrides: Partial<FeaturedTestimonial>): FeaturedTestimonial {
  return {
    id: "t1",
    message: "Felt easy and natural the whole time.",
    display_name: "Jordan R.",
    session_type: null,
    school: null,
    location: null,
    year: null,
    client_image_url: null,
    gallery_url: null,
    google_review_url: null,
    tags: [],
    ...overrides,
  };
}

describe("testimonialMatchesSchool", () => {
  it("does NOT match another campus's review (the reported Berkeley↔SJSU bug)", () => {
    const sjsu = testimonial({ session_type: "SJSU Graduation Session" });
    expect(testimonialMatchesSchool(sjsu, "Berkeley")).toBe(false);
    expect(testimonialMatchesSchool(sjsu, "Stanford")).toBe(false);
  });

  it("matches the campus via free-text session_type (no structured column yet)", () => {
    const berkeley = testimonial({ session_type: "UC Berkeley Graduation Session" });
    expect(testimonialMatchesSchool(berkeley, "Berkeley")).toBe(true);
    expect(testimonialMatchesSchool(berkeley, "UC Berkeley")).toBe(true);
  });

  it("matches via the structured school column even when session_type is generic", () => {
    const tagged = testimonial({ session_type: "Graduation Session", school: "UC Berkeley" });
    expect(testimonialMatchesSchool(tagged, "Berkeley")).toBe(true);
  });

  it("is whitespace/case/punctuation insensitive", () => {
    const sjsu = testimonial({ school: "San Jose State University" });
    expect(testimonialMatchesSchool(sjsu, "sjsu")).toBe(false); // acronym ≠ full name
    expect(testimonialMatchesSchool(testimonial({ school: "SJSU" }), "  s j s u  ")).toBe(true);
  });

  it("returns false for null/blank/too-short needles", () => {
    const any = testimonial({ school: "UC Berkeley" });
    expect(testimonialMatchesSchool(any, null)).toBe(false);
    expect(testimonialMatchesSchool(any, "")).toBe(false);
    expect(testimonialMatchesSchool(any, "UC")).toBe(false); // < 3 normalized chars
  });
});
