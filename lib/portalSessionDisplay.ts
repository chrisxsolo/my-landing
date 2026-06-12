import type { ClientSessionDTO, ClientSessionStatus } from "@/lib/clientSessions";

// Plain-English phrases for the dashboard hero greeting ("Hi Anna — your
// photos are in editing."). One entry per pipeline status.
const STATUS_PHRASES: Record<ClientSessionStatus, string> = {
  inquiry_received: "we got your inquiry.",
  booking_in_progress: "your booking is in progress.",
  booked: "your session is booked.",
  session_completed: "your session is complete.",
  photos_backed_up: "your photos are safely backed up.",
  culling: "your photos are being selected.",
  editing: "your photos are in editing.",
  final_review: "your gallery is in final review.",
  delivered: "your gallery is ready.",
};

/** Active session = first non-delivered (API returns newest first), else the newest. */
export function selectActivePortalSession(
  sessions: ClientSessionDTO[],
): ClientSessionDTO | null {
  return sessions.find((s) => s.currentStatus !== "delivered") ?? sessions[0] ?? null;
}

export function getPortalFirstName(clientName: string | null): string | null {
  const first = clientName?.trim().split(/\s+/)[0] ?? "";
  return first.length ? first : null;
}

export function buildPortalStatusPhrase(session: ClientSessionDTO): string {
  return STATUS_PHRASES[session.currentStatus];
}
