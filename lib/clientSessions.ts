export const CLIENT_SESSION_TABLE = "client_sessions";
export const ADMIN_USERS_TABLE = "admin_users";

export const CLIENT_SESSION_STATUS_VALUES = [
  "inquiry_received",
  "booking_in_progress",
  "booked",
  "session_completed",
  "photos_backed_up",
  "culling",
  "editing",
  "final_review",
  "delivered",
] as const;

export type ClientSessionStatus = (typeof CLIENT_SESSION_STATUS_VALUES)[number];

export const CLIENT_SESSION_STATUS_LABELS: Record<ClientSessionStatus, string> = {
  inquiry_received: "Inquiry Received",
  booking_in_progress: "Booking In Progress",
  booked: "Booked",
  session_completed: "Session Completed",
  photos_backed_up: "Photos Backed Up",
  culling: "Culling",
  editing: "Editing",
  final_review: "Final Review",
  delivered: "Delivered",
};

export const CLIENT_SESSION_STATUS_SHORT_LABELS: Record<ClientSessionStatus, string> = {
  inquiry_received: "Inquiry",
  booking_in_progress: "Booking",
  booked: "Booked",
  session_completed: "Completed",
  photos_backed_up: "Backed Up",
  culling: "Culling",
  editing: "Editing",
  final_review: "Review",
  delivered: "Delivered",
};

export type ClientSessionProgressState = "completed" | "current" | "upcoming";

export type ClientSessionProgressStep = {
  value: ClientSessionStatus;
  label: string;
  state: ClientSessionProgressState;
};

export type ClientSessionRow = {
  id: string;
  client_user_id: string | null;
  client_email: string;
  client_name: string | null;
  session_type: string | null;
  session_date: string | null;
  location: string | null;
  meeting_point: string | null;
  current_status: string;
  estimated_delivery_date: string | null;
  gallery_url: string | null;
  invoice_status: string | null;
  contract_status: string | null;
  backup_status: string | null;
  internal_notes: string | null;
  client_notes: string | null;
  created_at: string;
  updated_at: string;
  google_linked_at: string | null;
};

export type ClientSessionDTO = {
  id: string;
  clientEmail: string;
  clientName: string | null;
  sessionType: string | null;
  sessionDate: string | null;
  location: string | null;
  meetingPoint: string | null;
  currentStatus: ClientSessionStatus;
  estimatedDeliveryDate: string | null;
  galleryUrl: string | null;
  invoiceStatus: string | null;
  contractStatus: string | null;
  backupStatus: string | null;
  clientNotes: string | null;
};

export type AdminClientSessionDTO = ClientSessionDTO & {
  clientUserId: string | null;
  internalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  googleLinkedAt: string | null;
};

export type ClientSessionMatchInput = {
  clientEmail: string | null | undefined;
  sessionType?: string | null;
  sessionDate?: string | null;
};

const STATUS_SET = new Set<string>(CLIENT_SESSION_STATUS_VALUES);

export function isClientSessionStatus(value: unknown): value is ClientSessionStatus {
  return typeof value === "string" && STATUS_SET.has(value);
}

export function getClientSessionProgress(status: ClientSessionStatus): ClientSessionProgressStep[] {
  const currentIndex = CLIENT_SESSION_STATUS_VALUES.indexOf(status);

  return CLIENT_SESSION_STATUS_VALUES.map((value, index) => ({
    value,
    label: CLIENT_SESSION_STATUS_LABELS[value],
    state: index < currentIndex ? "completed" : index === currentIndex ? "current" : "upcoming",
  }));
}

export function normalizeClientSessionStatus(value: string): ClientSessionStatus {
  return isClientSessionStatus(value) ? value : "inquiry_received";
}

export function normalizeClientSessionEmail(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

function normalizeClientSessionText(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

export function normalizeClientSessionDate(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function buildClientSessionMatchKey(input: ClientSessionMatchInput) {
  return {
    email: normalizeClientSessionEmail(input.clientEmail),
    sessionType: normalizeClientSessionText(input.sessionType),
    sessionDate: normalizeClientSessionDate(input.sessionDate),
  };
}

type MatchableClientSession = {
  id: string;
  client_email?: string | null;
  clientEmail?: string | null;
  session_type?: string | null;
  sessionType?: string | null;
  session_date?: string | null;
  sessionDate?: string | null;
};

function getMatchableEmail(row: MatchableClientSession) {
  return row.client_email ?? row.clientEmail ?? null;
}

function getMatchableSessionType(row: MatchableClientSession) {
  return row.session_type ?? row.sessionType ?? null;
}

function getMatchableSessionDate(row: MatchableClientSession) {
  return row.session_date ?? row.sessionDate ?? null;
}

export function getClientSessionEmailMatches(
  rows: MatchableClientSession[],
  clientEmail: string | null | undefined,
) {
  const normalizedEmail = normalizeClientSessionEmail(clientEmail);
  if (!normalizedEmail) return [];
  return rows.filter((row) => normalizeClientSessionEmail(getMatchableEmail(row)) === normalizedEmail);
}

export function findMatchingClientSession<T extends MatchableClientSession>(
  rows: T[],
  input: ClientSessionMatchInput,
) {
  const target = buildClientSessionMatchKey(input);
  if (!target.email) return null;

  const emailMatches = getClientSessionEmailMatches(rows, target.email);
  if (emailMatches.length === 0) return null;
  if (emailMatches.length === 1) return emailMatches[0] ?? null;

  const exactMatch = emailMatches.find((row) => {
    const candidate = buildClientSessionMatchKey({
      clientEmail: getMatchableEmail(row),
      sessionType: getMatchableSessionType(row),
      sessionDate: getMatchableSessionDate(row),
    });

    return (
      candidate.sessionDate !== null &&
      candidate.sessionDate === target.sessionDate &&
      candidate.sessionType !== null &&
      candidate.sessionType === target.sessionType
    );
  });

  return exactMatch ?? null;
}

export function toClientSessionDTO(row: ClientSessionRow): ClientSessionDTO {
  return {
    id: row.id,
    clientEmail: row.client_email,
    clientName: row.client_name,
    sessionType: row.session_type,
    sessionDate: row.session_date,
    location: row.location,
    meetingPoint: row.meeting_point,
    currentStatus: normalizeClientSessionStatus(row.current_status),
    estimatedDeliveryDate: row.estimated_delivery_date,
    galleryUrl: row.gallery_url,
    invoiceStatus: row.invoice_status,
    contractStatus: row.contract_status,
    backupStatus: row.backup_status,
    clientNotes: row.client_notes,
  };
}

export function toAdminClientSessionDTO(row: ClientSessionRow): AdminClientSessionDTO {
  return {
    ...toClientSessionDTO(row),
    clientUserId: row.client_user_id,
    internalNotes: row.internal_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    googleLinkedAt: row.google_linked_at,
  };
}
