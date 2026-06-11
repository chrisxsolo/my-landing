// Prefill helpers for creating a photography_session from a client session
// (spec §7.2). public_display_name defaults to FIRST NAME ONLY; the internal
// name stays internal. service_type mapping is taxonomy-safe (never invalid).
import type { ServiceType } from "@/lib/contentEngine/taxonomy";

const TYPE_PATTERNS: [RegExp, ServiceType][] = [
  [/grad/i, "grads"],
  [/couple|engagement/i, "couples"],
  [/family|families/i, "families"],
  [/maternity/i, "maternity"],
  [/portrait|senior/i, "portraits"],
  [/event/i, "events"],
];

export function sessionTypeToServiceType(sessionType: string | null | undefined): ServiceType {
  if (!sessionType) return "other";
  for (const [pattern, service] of TYPE_PATTERNS) {
    if (pattern.test(sessionType)) return service;
  }
  return "other";
}

export function firstNameOf(fullName: string | null | undefined): string | null {
  const first = fullName?.trim().split(/\s+/)[0] ?? "";
  if (!first) return null;
  return first[0].toUpperCase() + first.slice(1);
}
