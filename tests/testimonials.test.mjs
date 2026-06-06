import test from "node:test";
import assert from "node:assert/strict";

import {
  buildTestimonialDisplayName,
  preparePublicTestimonialInsert,
  sanitizeTestimonialSearch,
  validateAdminTestimonialPatch,
  validatePublicTestimonial,
} from "../lib/testimonialValidation.ts";

const VALID_SUBMISSION = {
  first_name: "  Chris ",
  last_name: " Solorzano ",
  email: "",
  message: "  I felt comfortable throughout the entire photo session. ",
  consent_to_marketing: true,
  display_name_preference: "first_name_last_initial",
  source: "direct_link",
};

test("public validation requires both names", () => {
  assert.match(
    validatePublicTestimonial({ ...VALID_SUBMISSION, first_name: "" }).error ?? "",
    /first name/i,
  );
  assert.match(
    validatePublicTestimonial({ ...VALID_SUBMISSION, last_name: "" }).error ?? "",
    /last name/i,
  );
});

test("public validation accepts an empty optional email and normalizes a provided email", () => {
  const empty = validatePublicTestimonial(VALID_SUBMISSION);
  assert.equal(empty.ok, true);
  assert.equal(empty.data.email, null);

  const provided = validatePublicTestimonial({
    ...VALID_SUBMISSION,
    email: " CLIENT@EXAMPLE.COM ",
  });
  assert.equal(provided.ok, true);
  assert.equal(provided.data.email, "client@example.com");
});

test("public validation rejects invalid email, message limits, consent, and display preference", () => {
  assert.match(
    validatePublicTestimonial({ ...VALID_SUBMISSION, email: "not-an-email" }).error ?? "",
    /valid email/i,
  );
  assert.match(
    validatePublicTestimonial({ ...VALID_SUBMISSION, message: "Too short" }).error ?? "",
    /20 characters/i,
  );
  assert.match(
    validatePublicTestimonial({ ...VALID_SUBMISSION, message: "x".repeat(2001) }).error ?? "",
    /2,000 characters/i,
  );
  assert.match(
    validatePublicTestimonial({ ...VALID_SUBMISSION, consent_to_marketing: false }).error ?? "",
    /confirm/i,
  );
  assert.match(
    validatePublicTestimonial({ ...VALID_SUBMISSION, display_name_preference: "initials" }).error ?? "",
    /display preference/i,
  );
  assert.match(
    validatePublicTestimonial({ ...VALID_SUBMISSION, display_name_preference: "anonymous" }).error ?? "",
    /display preference/i,
  );
});

test("valid public submissions are trimmed and server controlled", () => {
  const result = preparePublicTestimonialInsert({
    ...VALID_SUBMISSION,
    status: "approved",
    admin_notes: "Client supplied note",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    first_name: "Chris",
    last_name: "Solorzano",
    email: null,
    message: "I felt comfortable throughout the entire photo session.",
    consent_to_marketing: true,
    consent_version: "2026-06-06",
    display_name_preference: "first_name_last_initial",
    source: "direct_link",
    gallery_id: null,
    session_type: null,
    status: "pending",
  });
});

test("honeypot submissions are rejected before insert preparation", () => {
  const result = preparePublicTestimonialInsert({
    ...VALID_SUBMISSION,
    website: "https://spam.example",
  });
  assert.equal(result.ok, false);
  assert.match(result.error, /unable to submit/i);
});

test("display name helper supports every public preference and malformed values", () => {
  assert.equal(buildTestimonialDisplayName(" Chris ", " solorzano ", "first_name_last_initial"), "Chris S.");
  assert.equal(buildTestimonialDisplayName("Chris", "Solorzano", "full_name"), "Chris Solorzano");
  assert.equal(buildTestimonialDisplayName("Chris", "Solorzano", "first_name_only"), "Chris");
  assert.equal(buildTestimonialDisplayName("Ana", "de-la-cruz", "first_name_last_initial"), "Ana D.");
  assert.equal(buildTestimonialDisplayName("", "", "full_name"), "soloxsnaps client");
});

test("admin patch only permits status and private notes", () => {
  const valid = validateAdminTestimonialPatch({
    id: "2c9bf5bf-99fb-4188-930f-8ba1b7ef34f6",
    updates: { status: "approved", admin_notes: "Strong homepage candidate." },
  });
  assert.equal(valid.ok, true);
  assert.deepEqual(valid.data.updates, {
    status: "approved",
    admin_notes: "Strong homepage candidate.",
  });

  assert.match(
    validateAdminTestimonialPatch({
      id: "2c9bf5bf-99fb-4188-930f-8ba1b7ef34f6",
      updates: { email: "changed@example.com" },
    }).error ?? "",
    /not allowed/i,
  );
});

test("admin search strips PostgREST filter syntax", () => {
  assert.equal(sanitizeTestimonialSearch(" Chris,(status.eq.approved)% "), "Chrisstatus.eq.approved");
});
