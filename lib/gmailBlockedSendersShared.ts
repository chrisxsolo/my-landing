export function normalizeBlockedSenderEmail(value: string | null | undefined) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length ? trimmed : null;
}

export function sanitizeBlockedSenders(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => normalizeBlockedSenderEmail(typeof item === "string" ? item : null))
        .filter((item): item is string => Boolean(item)),
    ),
  ).sort();
}
