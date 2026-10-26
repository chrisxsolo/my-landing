// Typed fetch client for /api/admin/location-library. Throws with the
// server's message so the UI can show it as-is.
import type {
  DetailPhotoDto, DetailSessionDto, LocationSummaryDto, PlaceOptionDto, SyncSessionDto,
} from "@/lib/locationLibrary/adminView";
import type { LocationRow } from "@/lib/locationLibrary/load";
import type { RelatedLink } from "@/lib/locationLibrary/related";

export type { DetailPhotoDto, DetailSessionDto, LocationSummaryDto, PlaceOptionDto, SyncSessionDto, LocationRow, RelatedLink };

export interface Overview {
  locations: LocationSummaryDto[];
  sessions: SyncSessionDto[];
  places: PlaceOptionDto[];
  lastSyncedAt: string | null;
}

export interface Detail {
  location: LocationSummaryDto;
  row: LocationRow;
  place: { key: string; name: string; city: string; county: string } | null;
  hero: { url: string; thumbUrl: string; photoId: string | null; source: string } | null;
  sessions: DetailSessionDto[];
  related: RelatedLink[];
}

export interface SyncReport {
  claims?: { title: string; key: string }[];
  sessions: { sessionId: string; status: string; message: string; createdKeys: string[]; removedLinks: number }[];
  dryRun?: boolean;
}

const BASE = "/api/admin/location-library";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json", ...(init?.headers ?? {}) } });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : `request failed (${res.status})`);
  return body as T;
}

const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });

export const libraryApi = {
  overview: () => request<Overview>(BASE),
  create: (body: { placeKey: string } | { title: string; city: string; region: string }) =>
    request<{ id: number }>(BASE, post(body)),
  detail: (id: number) => request<Detail>(`${BASE}/${id}`),
  patch: (id: number, body: Record<string, unknown>) =>
    request<Detail>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  remove: (id: number) => request<{ ok: true }>(`${BASE}/${id}`, { method: "DELETE" }),
  action: (id: number, body: Record<string, unknown>) =>
    request<{ message: string | null; detail: Detail }>(`${BASE}/${id}/actions`, post(body)),
  sync: (body: { sessionId?: string; dryRun?: boolean } = {}) => request<SyncReport>(`${BASE}/sync`, post(body)),
};
