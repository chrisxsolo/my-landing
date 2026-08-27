import { describe, it, expect } from "vitest";
import {
  buildInquiryReplySubject,
  detectSchoolFromInquiry,
  getComposeSubject,
  normalizeSchool,
  resolveInquirySchoolField,
  type InquirySchoolSource,
} from "@/lib/schoolDetection";

const inquiry = (over: Partial<InquirySchoolSource> = {}): InquirySchoolSource => ({
  school: null, location: null, message: "", session_type: "graduation",
  date_in_mind: null, email: null, ...over,
});

describe("normalizeSchool", () => {
  it("maps every supported school to its abbreviation", () => {
    expect(normalizeSchool("San Jose State University")?.abbreviation).toBe("SJSU");
    expect(normalizeSchool("San Francisco State University")?.abbreviation).toBe("SFSU");
    expect(normalizeSchool("University of San Francisco")?.abbreviation).toBe("USF");
    expect(normalizeSchool("University of California, Berkeley")?.abbreviation).toBe("UC Berkeley");
    expect(normalizeSchool("California State University, East Bay")?.abbreviation).toBe("CSU East Bay");
    expect(normalizeSchool("University of California, Santa Cruz")?.abbreviation).toBe("UC Santa Cruz");
  });

  it("is tolerant of case, accents, punctuation, and short aliases", () => {
    expect(normalizeSchool("sjsu")?.abbreviation).toBe("SJSU");
    expect(normalizeSchool("San José State")?.abbreviation).toBe("SJSU");
    expect(normalizeSchool("san jose state university")?.canonicalName).toBe("San Jose State University");
    expect(normalizeSchool("SF State")?.abbreviation).toBe("SFSU");
    expect(normalizeSchool("usfca")?.abbreviation).toBe("USF");
    expect(normalizeSchool("cal")?.abbreviation).toBe("UC Berkeley");
    expect(normalizeSchool("Cal State East Bay")?.abbreviation).toBe("CSU East Bay");
    expect(normalizeSchool("csueb")?.abbreviation).toBe("CSU East Bay");
    expect(normalizeSchool("ucsc")?.abbreviation).toBe("UC Santa Cruz");
  });

  it("does not confuse 'cal state east bay' with UC Berkeley", () => {
    expect(normalizeSchool("cal state east bay")?.abbreviation).toBe("CSU East Bay");
    expect(normalizeSchool("cal poly")).toBeNull();
  });

  it("does not map USF when context points at South Florida", () => {
    expect(normalizeSchool("USF (University of South Florida)")).toBeNull();
  });

  it("ignores state abbreviations as school names", () => {
    expect(normalizeSchool("CA")).toBeNull();
    expect(normalizeSchool("ca")).toBeNull();
    expect(normalizeSchool("NY")).toBeNull();
  });

  it("ignores generic non-school values", () => {
    expect(normalizeSchool("")).toBeNull();
    expect(normalizeSchool("California")).toBeNull();
    expect(normalizeSchool("Bay Area")).toBeNull();
    expect(normalizeSchool("campus")).toBeNull();
    expect(normalizeSchool("university")).toBeNull();
  });
});

describe("detectSchoolFromInquiry", () => {
  it("reports which field the match came from", () => {
    expect(detectSchoolFromInquiry(inquiry({ school: "CA", location: "San Jose state university" })))
      .toMatchObject({ abbreviation: "SJSU", matchedFrom: "location" });
    expect(detectSchoolFromInquiry(inquiry({ message: "Looking for grad photos at Berkeley" })))
      .toMatchObject({ abbreviation: "UC Berkeley", matchedFrom: "message" });
  });

  it("falls back to a known .edu email domain", () => {
    expect(detectSchoolFromInquiry(inquiry({ email: "student@sjsu.edu" })))
      .toMatchObject({ abbreviation: "SJSU", matchedFrom: "email" });
    expect(detectSchoolFromInquiry(inquiry({ email: "someone@gmail.com" }))).toBeNull();
    expect(detectSchoolFromInquiry(inquiry({ email: "student@unknown-college.edu" }))).toBeNull();
  });
});

describe("buildInquiryReplySubject", () => {
  it("uses SJSU from the location when the school field is invalid", () => {
    expect(buildInquiryReplySubject(inquiry({
      school: "CA", location: "San Jose state university", message: "",
    }))).toBe("SJSU Graduation Inquiry");
  });

  it("uses SJSU from the inquiry message", () => {
    expect(buildInquiryReplySubject(inquiry({
      message: "I am looking for an SJSU graduation shoot",
    }))).toBe("SJSU Graduation Inquiry");
  });

  it("prioritizes a valid explicit school field", () => {
    expect(buildInquiryReplySubject(inquiry({
      school: "UC Berkeley", location: "San Jose State University", message: "",
    }))).toBe("UC Berkeley Graduation Inquiry");
  });

  it("builds school-specific subjects for the other supported schools", () => {
    expect(buildInquiryReplySubject(inquiry({ school: "san francisco state" })))
      .toBe("SFSU Graduation Inquiry");
    expect(buildInquiryReplySubject(inquiry({ location: "university of san francisco" })))
      .toBe("USF Graduation Inquiry");
    expect(buildInquiryReplySubject(inquiry({ message: "Grad pics at cal state east bay please" })))
      .toBe("CSU East Bay Graduation Inquiry");
    expect(buildInquiryReplySubject(inquiry({ location: "UC Santa Cruz" })))
      .toBe("UC Santa Cruz Graduation Inquiry");
  });

  it("falls back when no school is identifiable", () => {
    expect(buildInquiryReplySubject(inquiry({
      location: "Bay Area", message: "I would like graduation photos",
    }))).toBe("Graduation Inquiry");
  });

  it("names the session type for non-graduation inquiries", () => {
    expect(buildInquiryReplySubject(inquiry({ session_type: "Family Session" })))
      .toBe("Family Session Inquiry");
    expect(buildInquiryReplySubject(inquiry({ session_type: "Couples Session" })))
      .toBe("Couples Session Inquiry");
    expect(buildInquiryReplySubject(inquiry({ session_type: "Individual Portrait" })))
      .toBe("Portrait Session Inquiry");
    expect(buildInquiryReplySubject(inquiry({ session_type: "Event Coverage" })))
      .toBe("Event Coverage Inquiry");
    expect(buildInquiryReplySubject(inquiry({ session_type: "Other", message: "" })))
      .toBe("Photography Inquiry");
    expect(buildInquiryReplySubject(inquiry({ session_type: null, message: "" })))
      .toBe("Photography Inquiry");
  });

  it("lets a more specific message refine a vague session type", () => {
    expect(buildInquiryReplySubject(inquiry({
      session_type: "Individual Portrait",
      message: "My boyfriend and I want photos for our anniversary",
    }))).toBe("Couples Session Inquiry");
    expect(buildInquiryReplySubject(inquiry({
      session_type: "Couples Session", message: "I am planning a proposal at Baker Beach",
    }))).toBe("Proposal Inquiry");
    expect(buildInquiryReplySubject(inquiry({
      session_type: "Other", message: "We just got engaged!",
    }))).toBe("Engagement Inquiry");
  });

  it("does not let a vague message downgrade a specific session type", () => {
    expect(buildInquiryReplySubject(inquiry({
      session_type: "Family Session", message: "We would love some portraits outdoors",
    }))).toBe("Family Session Inquiry");
  });
});

describe("getComposeSubject", () => {
  it("does not overwrite a manually edited subject", () => {
    expect(getComposeSubject(
      inquiry({ school: "San Jose State University" }),
      { subject: "Alejandro Graduation Photos", subjectSource: "manual" },
    )).toBe("Alejandro Graduation Photos");
  });

  it("regenerates when the subject was generated or empty", () => {
    expect(getComposeSubject(
      inquiry({ school: "San Jose State University" }),
      { subject: "Graduation Inquiry", subjectSource: "generated" },
    )).toBe("SJSU Graduation Inquiry");
    expect(getComposeSubject(
      inquiry({ school: "San Jose State University" }),
      { subject: "   ", subjectSource: "manual" },
    )).toBe("SJSU Graduation Inquiry");
  });
});

describe("resolveInquirySchoolField", () => {
  it("replaces a junk school value with the school detected elsewhere", () => {
    expect(resolveInquirySchoolField(inquiry({
      school: "CA", location: "San Jose state university",
    }))).toBe("San Jose State University");
  });

  it("canonicalizes a recognized school value", () => {
    expect(resolveInquirySchoolField(inquiry({ school: "sjsu" })))
      .toBe("San Jose State University");
  });

  it("keeps an unknown but plausible school as typed", () => {
    expect(resolveInquirySchoolField(inquiry({ school: "UCLA", location: "Los Angeles" })))
      .toBe("UCLA");
  });

  it("keeps junk when nothing better is detectable", () => {
    expect(resolveInquirySchoolField(inquiry({ school: "CA", location: "Bay Area" })))
      .toBe("CA");
  });

  it("does not fill a school from location text for non-graduation sessions", () => {
    expect(resolveInquirySchoolField(inquiry({
      session_type: "Family", school: null, location: "near UC Berkeley",
    }))).toBeNull();
  });
});
