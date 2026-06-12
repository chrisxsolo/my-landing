import {
  findMatchingClientSession,
  type AdminClientSessionDTO,
  type ClientSessionMatchInput,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

type SearchParamsReader = Pick<URLSearchParams, "get">;

const ADMIN_PORTAL_SESSIONS_PATH = "/admin/sessions";
const CLIENT_EMAIL_PARAM = "clientEmail";
const SESSION_TYPE_PARAM = "sessionType";
const SESSION_DATE_PARAM = "sessionDate";

function setOptionalParam(params: URLSearchParams, key: string, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) params.set(key, trimmed);
}

export function buildAdminPortalSessionHref(input: ClientSessionMatchInput) {
  const params = new URLSearchParams();
  setOptionalParam(params, CLIENT_EMAIL_PARAM, input.clientEmail);
  setOptionalParam(params, SESSION_TYPE_PARAM, input.sessionType);
  setOptionalParam(params, SESSION_DATE_PARAM, input.sessionDate);
  const query = params.toString();
  return query ? `${ADMIN_PORTAL_SESSIONS_PATH}?${query}` : ADMIN_PORTAL_SESSIONS_PATH;
}

export function resolveAdminPortalSessionFocus(
  sessions: AdminClientSessionDTO[],
  params: SearchParamsReader,
) {
  const clientQuery = params.get(CLIENT_EMAIL_PARAM)?.trim() ?? "";
  const matchedSession = findMatchingClientSession(sessions, {
    clientEmail: clientQuery,
    sessionType: params.get(SESSION_TYPE_PARAM),
    sessionDate: params.get(SESSION_DATE_PARAM),
  });

  return {
    clientQuery,
    sessionId: matchedSession?.id ?? null,
  };
}

type AdminPortalSessionFilterInput = {
  query: string;
  statusFilter: ClientSessionStatus | "all";
  focusedSessionId: string | null;
};

export function filterAdminPortalSessions(
  sessions: AdminClientSessionDTO[],
  filters: AdminPortalSessionFilterInput,
) {
  const query = filters.query.trim().toLowerCase();
  const candidates = sessions.filter((session) => {
    if (filters.focusedSessionId && session.id !== filters.focusedSessionId) return false;
    if (filters.statusFilter !== "all" && session.currentStatus !== filters.statusFilter) return false;
    return true;
  });
  if (!query) return candidates;

  const nameMatches = candidates.filter((session) =>
    session.clientName?.toLowerCase().includes(query),
  );
  if (nameMatches.length > 0) return nameMatches;

  return candidates.filter((session) => {
    const searchableText = [
      session.clientEmail,
      session.sessionType,
      session.location,
      session.meetingPoint,
      session.currentStatus,
      session.sessionDate,
    ].filter(Boolean).join(" ").toLowerCase();

    return searchableText.includes(query);
  });
}
