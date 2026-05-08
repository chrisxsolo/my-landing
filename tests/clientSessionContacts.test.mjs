import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClientSessionContactOptions,
} from "../lib/clientSessionContacts.ts";

test("contact options dedupe by email and keep the newest inquiry details", () => {
  const contacts = buildClientSessionContactOptions([
    {
      source: "inquiry",
      id: "1",
      name: "Old Name",
      email: "CLIENT@EXAMPLE.COM",
      session_type: "Family",
      session_date: null,
      date_in_mind: "May",
      location: null,
      school: null,
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      source: "inquiry",
      id: "2",
      name: "New Name",
      email: "client@example.com",
      session_type: "Graduation",
      session_date: "2026-06-01T18:00:00.000Z",
      date_in_mind: null,
      location: "Campanile",
      school: "UC Berkeley",
      created_at: "2026-05-01T00:00:00.000Z",
    },
  ]);

  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].email, "client@example.com");
  assert.equal(contacts[0].name, "New Name");
  assert.equal(contacts[0].sessionType, "Graduation");
  assert.equal(contacts[0].sessionDate, "2026-06-01T18:00:00.000Z");
  assert.equal(contacts[0].location, "Campanile");
});

test("contact options prefer explicit location but fall back to school", () => {
  const contacts = buildClientSessionContactOptions([
    {
      source: "inquiry",
      id: "1",
      name: "Riley",
      email: "riley@example.com",
      session_type: "Grad",
      session_date: null,
      date_in_mind: null,
      location: "",
      school: "SF State",
      created_at: "2026-05-01T00:00:00.000Z",
    },
  ]);

  assert.equal(contacts[0].location, "SF State");
});

test("contact options skip rows without usable emails", () => {
  const contacts = buildClientSessionContactOptions([
    {
      source: "inquiry",
      id: "1",
      name: "No Email",
      email: "",
      session_type: null,
      session_date: null,
      date_in_mind: null,
      location: null,
      school: null,
      created_at: "2026-05-01T00:00:00.000Z",
    },
  ]);

  assert.deepEqual(contacts, []);
});
