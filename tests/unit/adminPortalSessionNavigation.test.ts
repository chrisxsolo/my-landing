import { describe, expect, it } from "vitest";
import {
  buildAdminPortalSessionHref,
  filterAdminPortalSessions,
  resolveAdminPortalSessionFocus,
} from "@/lib/adminPortalSessionNavigation";
import type { AdminClientSessionDTO } from "@/lib/clientSessions";

const BASE_SESSION: AdminClientSessionDTO = {
  id: "session-1",
  clientEmail: "anna@example.com",
  clientName: "Anna",
  sessionType: "Graduation Portrait",
  sessionDate: "2026-06-20",
  location: "Stanford",
  meetingPoint: null,
  currentStatus: "booked",
  estimatedDeliveryDate: null,
  galleryUrl: null,
  invoiceStatus: "paid",
  contractStatus: "signed",
  backupStatus: null,
  clientNotes: null,
  clientUserId: null,
  internalNotes: null,
  createdAt: "2026-04-23T00:00:00.000Z",
  updatedAt: "2026-04-23T00:00:00.000Z",
  googleLinkedAt: null,
};

describe("admin portal session navigation", () => {
  it("builds a focused portal-session URL from an inquiry", () => {
    expect(buildAdminPortalSessionHref({
      clientEmail: "anna+grad@example.com",
      sessionType: "Graduation Portrait",
      sessionDate: "2026-06-20",
    })).toBe(
      "/admin/sessions?clientEmail=anna%2Bgrad%40example.com&sessionType=Graduation+Portrait&sessionDate=2026-06-20",
    );
  });

  it("resolves the exact portal session when an email has multiple sessions", () => {
    const sessions = [
      BASE_SESSION,
      {
        ...BASE_SESSION,
        id: "session-2",
        sessionType: "Couples Portrait",
        sessionDate: "2026-07-11",
      },
    ];
    const params = new URLSearchParams({
      clientEmail: "ANNA@example.com",
      sessionType: "Couples Portrait",
      sessionDate: "2026-07-11",
    });

    expect(resolveAdminPortalSessionFocus(sessions, params)).toEqual({
      clientQuery: "ANNA@example.com",
      sessionId: "session-2",
    });
  });

  it("falls back to filtering by email when no exact session exists", () => {
    const params = new URLSearchParams({
      clientEmail: "missing@example.com",
      sessionType: "Family Portrait",
      sessionDate: "2026-08-01",
    });

    expect(resolveAdminPortalSessionFocus([BASE_SESSION], params)).toEqual({
      clientQuery: "missing@example.com",
      sessionId: null,
    });
  });

  it("finds Anna by name after a focused thread filter is cleared", () => {
    const sessions = [
      {
        ...BASE_SESSION,
        id: "roman-session",
        clientName: "Roman Nayabkhil",
        clientEmail: "romannayabkhil@gmail.com",
      },
      {
        ...BASE_SESSION,
        id: "juliana-session",
        clientName: "Juliana",
        clientEmail: "juliannakwan@gmail.com",
      },
      {
        ...BASE_SESSION,
        id: "chris-session",
        clientName: "Chris Client",
        clientEmail: "chris@example.com",
      },
      {
        ...BASE_SESSION,
        id: "anna-session",
        clientName: "Anna Babchanik",
        clientEmail: "babchanik31@gmail.com",
      },
    ];

    expect(filterAdminPortalSessions(sessions, {
      query: "Anna",
      statusFilter: "all",
      focusedSessionId: null,
    })).toEqual([sessions[3]]);
  });

  it("shows only the exact session selected from a client thread", () => {
    const sessions = [
      BASE_SESSION,
      {
        ...BASE_SESSION,
        id: "session-2",
        sessionType: "Couples Portrait",
        sessionDate: "2026-07-11",
      },
    ];

    expect(filterAdminPortalSessions(sessions, {
      query: "anna@example.com",
      statusFilter: "all",
      focusedSessionId: "session-2",
    })).toEqual([sessions[1]]);
  });
});
