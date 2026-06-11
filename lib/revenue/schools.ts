// Deterministic school/location normalization. Inquiry `school` is free text
// ("SJSU" vs "San Jose State University" vs "Stanford / Palo Alto"), so revenue
// grouping needs a stable key. First match wins; order = most specific first.

export type SchoolDef = { key: string; label: string; patterns: RegExp[] };

export const SCHOOL_DEFS: SchoolDef[] = [
  { key: "sjsu", label: "SJSU", patterns: [/san jose state|sjsu/i] },
  { key: "berkeley", label: "UC Berkeley", patterns: [/berkeley|\bcal\b/i] },
  { key: "stanford", label: "Stanford", patterns: [/stanford|palo alto/i] },
  { key: "sfsu", label: "SF State", patterns: [/sf state|sfsu|san francisco state/i] },
  { key: "usf", label: "USF", patterns: [/university of san francisco|\busf\b/i] },
  { key: "scu", label: "Santa Clara", patterns: [/santa clara|\bscu\b/i] },
  { key: "csueb", label: "CSU East Bay", patterns: [/east bay|csueb/i] },
  { key: "uop", label: "UOP Dugoni", patterns: [/dugoni|\buop\b|university of the pacific/i] },
  { key: "pau", label: "Palo Alto Univ.", patterns: [/\bpau\b/i] },
  { key: "kaiser", label: "Kaiser Allied Health", patterns: [/kaiser/i] },
  { key: "ccc", label: "Community College", patterns: [/de anza|sjcc|community college/i] },
];

export const SCHOOL_OTHER = { key: "other", label: "Other / unspecified" };
export const SCHOOL_UNLINKED = { key: "unlinked", label: "No linked inquiry" };

export type SchoolSource = {
  school?: string | null;
  location?: string | null;
  message?: string | null;
  email?: string | null;
};

export function detectSchoolKey(source: SchoolSource | null | undefined): string {
  if (!source) return SCHOOL_UNLINKED.key;
  // The explicit school field is most trustworthy; the message is a fallback.
  for (const haystack of [
    `${source.school ?? ""} ${source.location ?? ""}`,
    `${source.message ?? ""} ${source.email ?? ""}`,
  ]) {
    const text = haystack.trim();
    if (!text) continue;
    for (const def of SCHOOL_DEFS) {
      if (def.patterns.some(p => p.test(text))) return def.key;
    }
  }
  return SCHOOL_OTHER.key;
}

export function schoolLabel(key: string): string {
  if (key === SCHOOL_UNLINKED.key) return SCHOOL_UNLINKED.label;
  if (key === SCHOOL_OTHER.key) return SCHOOL_OTHER.label;
  return SCHOOL_DEFS.find(d => d.key === key)?.label ?? SCHOOL_OTHER.label;
}
