// Pure rules for which photos belong to a library location and which one is
// its hero. Nothing here is stored per photo: membership is derived from the
// linked sessions every time, so re-syncing can never duplicate a photo.
//
//   - a session photographed at ONE place contributes all its photos;
//   - a session at SEVERAL places contributes only photos whose GPS falls
//     inside this place's radius (no evidence → unassigned, never guessed);
//   - admin overrides win: 'include' assigns a photo, 'hide' removes it.
//
// A member photo is public only when it has its web copy, is not excluded in
// the engine, and its session has marketing permission with no revocation.
import { distanceMeters } from "@/lib/locations/match";
import type { KnownPlace } from "@/lib/locations/places";

const DEFAULT_RADIUS_METERS = 750;

export interface MemberSession {
  id: string;
  permissionOk: boolean;
  /** The session names (or GPS shows) more than one place. */
  multiLocation: boolean;
  sessionDate: string | null;
}

export interface MemberPhoto {
  id: string;
  sessionId: string;
  publicUrl: string | null;
  excluded: boolean;
  qualityScore: number | null;
  sortOrder: number;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  altText: string | null;
}

export type OverrideMode = "include" | "hide";

export type PhotoState = "public" | "not_public" | "hidden" | "unassigned" | "excluded";

export interface ClassifiedPhoto extends MemberPhoto {
  state: PhotoState;
}

function insidePlace(photo: MemberPhoto, place: KnownPlace | null): boolean {
  if (!place || typeof place.latitude !== "number" || typeof place.longitude !== "number") return false;
  if (typeof photo.gpsLatitude !== "number" || typeof photo.gpsLongitude !== "number") return false;
  const d = distanceMeters(
    { latitude: photo.gpsLatitude, longitude: photo.gpsLongitude },
    { latitude: place.latitude, longitude: place.longitude },
  );
  return d <= (place.radiusMeters ?? DEFAULT_RADIUS_METERS);
}

export function classifyPhoto(
  photo: MemberPhoto,
  session: MemberSession,
  place: KnownPlace | null,
  override: OverrideMode | undefined,
): PhotoState {
  if (override === "hide") return "hidden";
  if (photo.excluded) return "excluded";
  const assigned = override === "include" || !session.multiLocation || insidePlace(photo, place);
  if (!assigned) return "unassigned";
  return photo.publicUrl && session.permissionOk ? "public" : "not_public";
}

export function classifyPhotos(
  photos: readonly MemberPhoto[],
  sessions: ReadonlyMap<string, MemberSession>,
  place: KnownPlace | null,
  overrides: ReadonlyMap<string, OverrideMode>,
): ClassifiedPhoto[] {
  return photos.flatMap((photo) => {
    const session = sessions.get(photo.sessionId);
    if (!session) return [];
    return [{ ...photo, state: classifyPhoto(photo, session, place, overrides.get(photo.id)) }];
  });
}

function byQuality(sessions: ReadonlyMap<string, MemberSession>) {
  return (a: MemberPhoto, b: MemberPhoto) =>
    (b.qualityScore ?? 0) - (a.qualityScore ?? 0)
    || (sessions.get(b.sessionId)?.sessionDate ?? "").localeCompare(sessions.get(a.sessionId)?.sessionDate ?? "")
    || a.sortOrder - b.sortOrder
    || a.id.localeCompare(b.id);
}

/** Public photos, best first (quality, then newest session, then upload order). */
export function rankPublicPhotos(
  photos: readonly ClassifiedPhoto[], sessions: ReadonlyMap<string, MemberSession>,
): ClassifiedPhoto[] {
  return photos.filter((p) => p.state === "public").sort(byQuality(sessions));
}

export interface HeroChoice {
  url: string;
  alt: string | null;
  photoId: string | null;
  source: "featured_photo" | "manual_image" | "auto";
}

export interface HeroInput {
  featuredPhotoId: string | null;
  featuredSessionId: string | null;
  manualImageUrl: string | null;
}

/**
 * Hero order: the admin's featured photo (while it is still public) → the
 * hand-uploaded image → the best public photo of the featured session → the
 * best public photo overall. A new session can therefore never replace a
 * photo the admin chose.
 */
export function chooseHero(
  input: HeroInput, ranked: readonly ClassifiedPhoto[],
): HeroChoice | null {
  if (input.featuredPhotoId) {
    const pick = ranked.find((p) => p.id === input.featuredPhotoId);
    if (pick?.publicUrl) return { url: pick.publicUrl, alt: pick.altText, photoId: pick.id, source: "featured_photo" };
  }
  if (input.manualImageUrl) return { url: input.manualImageUrl, alt: null, photoId: null, source: "manual_image" };
  const pool = input.featuredSessionId
    ? ranked.filter((p) => p.sessionId === input.featuredSessionId)
    : [];
  const best = pool[0] ?? ranked[0];
  return best?.publicUrl ? { url: best.publicUrl, alt: best.altText, photoId: best.id, source: "auto" } : null;
}
