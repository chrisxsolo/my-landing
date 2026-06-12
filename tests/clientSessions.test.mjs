import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClientSessionMatchKey,
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_SHORT_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  findMatchingClientSession,
  formatClientSessionDateTime,
  getClientSessionProgress,
  isClientSessionStatus,
  normalizeClientSessionStatus,
  toClientSessionDTO,
} from "../lib/clientSessions.ts";

test("client session statuses stay in tracker order with display labels", () => {
  assert.deepEqual(CLIENT_SESSION_STATUS_VALUES, [
    "inquiry_received",
    "booking_in_progress",
    "booked",
    "session_completed",
    "photos_backed_up",
    "culling",
    "editing",
    "final_review",
    "delivered",
  ]);

  assert.equal(CLIENT_SESSION_STATUS_LABELS.delivered, "Delivered");
  assert.equal(CLIENT_SESSION_STATUS_LABELS.inquiry_received, "Inquiry Received");
  assert.equal(CLIENT_SESSION_STATUS_SHORT_LABELS.final_review, "Review");
});

test("progress marks completed, current, and upcoming steps", () => {
  const progress = getClientSessionProgress("editing");

  assert.equal(progress[0].state, "completed");
  assert.equal(progress[5].state, "completed");
  assert.equal(progress[6].state, "current");
  assert.equal(progress[7].state, "upcoming");
});

test("status guard accepts only known status values", () => {
  assert.equal(isClientSessionStatus("inquiry_received"), true);
  assert.equal(isClientSessionStatus("booked"), true);
  assert.equal(isClientSessionStatus("almost_done"), false);
  assert.equal(isClientSessionStatus(null), false);
  assert.equal(normalizeClientSessionStatus("almost_done"), "inquiry_received");
});

test("match key normalizes email and session metadata", () => {
  assert.deepEqual(
    buildClientSessionMatchKey({
      clientEmail: "Chris@Example.com ",
      sessionType: "Graduation",
      sessionDate: "2026-06-01T18:00:00.000Z",
    }),
    {
      email: "chris@example.com",
      sessionType: "graduation",
      sessionDate: "2026-06-01",
    },
  );
});

test("session matching uses the Pacific calendar date", () => {
  assert.deepEqual(
    buildClientSessionMatchKey({
      clientEmail: "client@example.com",
      sessionType: "Graduation",
      sessionDate: "2026-06-21T02:00:00.000Z",
    }),
    {
      email: "client@example.com",
      sessionType: "graduation",
      sessionDate: "2026-06-20",
    },
  );
});

test("portal formatting keeps date-only and timed sessions on the correct Pacific day", () => {
  assert.equal(formatClientSessionDateTime("2026-06-20"), "Jun 20, 2026");
  assert.equal(
    formatClientSessionDateTime("2026-06-21T02:00:00.000Z"),
    "Jun 20, 2026, 7:00 PM",
  );
});

test("matching prefers exact session metadata before email-only fallback", () => {
  const rows = [
    {
      id: "a",
      client_email: "client@example.com",
      session_type: "Graduation",
      session_date: "2026-06-01T18:00:00.000Z",
    },
    {
      id: "b",
      client_email: "client@example.com",
      session_type: "Family",
      session_date: "2026-06-20T18:00:00.000Z",
    },
  ];

  assert.equal(
    findMatchingClientSession(rows, {
      clientEmail: "client@example.com",
      sessionType: "Family",
      sessionDate: "2026-06-20",
    })?.id,
    "b",
  );
});

test("client DTO removes admin-only fields", () => {
  const dto = toClientSessionDTO({
    id: "session-1",
    client_user_id: "user-1",
    client_email: "client@example.com",
    client_name: "Riley",
    session_type: "Graduation",
    session_date: "2026-06-01T18:00:00.000Z",
    location: "UC Berkeley",
    meeting_point: "Campanile",
    current_status: "delivered",
    estimated_delivery_date: "2026-06-14",
    gallery_url: "https://example.com/gallery",
    invoice_status: "paid",
    contract_status: "signed",
    backup_status: "complete",
    internal_notes: "Admin-only context",
    client_notes: "Your gallery is ready.",
    created_at: "2026-05-08T00:00:00.000Z",
    updated_at: "2026-05-08T00:00:00.000Z",
  });

  assert.equal(dto.clientName, "Riley");
  assert.equal(dto.currentStatus, "delivered");
  assert.equal(Object.hasOwn(dto, "internal_notes"), false);
  assert.equal(Object.hasOwn(dto, "internalNotes"), false);
});
