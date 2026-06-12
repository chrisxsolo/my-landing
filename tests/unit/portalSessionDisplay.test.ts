import { describe, expect, it } from "vitest";
import {
  buildPortalStatusPhrase,
  getPortalFirstName,
  selectActivePortalSession,
} from "@/lib/portalSessionDisplay";
import type { ClientSessionDTO } from "@/lib/clientSessions";

const BASE: ClientSessionDTO = {
  id: "s1",
  clientEmail: "anna@example.com",
  clientName: "Anna Lee",
  sessionType: "Graduation",
  sessionDate: "2026-06-20",
  location: "Stanford",
  meetingPoint: null,
  currentStatus: "editing",
  estimatedDeliveryDate: null,
  galleryUrl: null,
  invoiceStatus: null,
  contractStatus: null,
  backupStatus: null,
  clientNotes: null,
};

describe("selectActivePortalSession", () => {
  it("returns null for an empty list", () => {
    expect(selectActivePortalSession([])).toBeNull();
  });

  it("prefers the first non-delivered session", () => {
    const delivered = { ...BASE, id: "d1", currentStatus: "delivered" as const };
    const active = { ...BASE, id: "a1" };
    const later = { ...BASE, id: "a2" };
    expect(selectActivePortalSession([delivered, active, later])?.id).toBe("a1");
  });

  it("falls back to the first session when all are delivered", () => {
    const d1 = { ...BASE, id: "d1", currentStatus: "delivered" as const };
    const d2 = { ...BASE, id: "d2", currentStatus: "delivered" as const };
    expect(selectActivePortalSession([d1, d2])?.id).toBe("d1");
  });
});

describe("getPortalFirstName", () => {
  it("returns the first word of the name", () => {
    expect(getPortalFirstName("Anna Lee")).toBe("Anna");
  });

  it("returns null for null or blank names", () => {
    expect(getPortalFirstName(null)).toBeNull();
    expect(getPortalFirstName("   ")).toBeNull();
  });
});

describe("buildPortalStatusPhrase", () => {
  it("describes an in-editing session", () => {
    expect(buildPortalStatusPhrase(BASE)).toBe("your photos are in editing.");
  });

  it("describes a delivered session", () => {
    expect(buildPortalStatusPhrase({ ...BASE, currentStatus: "delivered" })).toBe(
      "your gallery is ready.",
    );
  });

  it("covers every status", () => {
    expect(buildPortalStatusPhrase({ ...BASE, currentStatus: "inquiry_received" })).toBe(
      "we got your inquiry.",
    );
    expect(buildPortalStatusPhrase({ ...BASE, currentStatus: "booked" })).toBe(
      "your session is booked.",
    );
  });
});
