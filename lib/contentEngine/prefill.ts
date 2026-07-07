// Prefill helpers for creating a photography_session from a client session
// (spec §7.2). public_display_name defaults to FIRST NAME ONLY; the internal
// name stays internal. service_type mapping is taxonomy-safe (never invalid):
// the tolerant pattern matching lives in taxonomy.normalizeServiceType so the
// prefill path and the generation-time checks can never disagree.
import { normalizeServiceType, type ServiceType } from "@/lib/contentEngine/taxonomy";

export function sessionTypeToServiceType(sessionType: string | null | undefined): ServiceType {
  return normalizeServiceType(sessionType) ?? "other";
}

export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0] ?? "";
  if (!first) return null;
  return first[0].toUpperCase() + first.slice(1);
}
