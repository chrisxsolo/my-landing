// Formatting + parsing helpers for the conversation workspace. No React —
// shared by the page and its panel components.

export type ReminderDraft = {
  id: string; label: string; emoji: string; subject: string; body: string; html?: string;
};

// Read a fetch Response defensively: parse JSON only when the server says
// it's JSON; otherwise surface the raw text as an error message so an HTML
// error page never explodes a .json() call.
export async function readJsonSafe(res: Response): Promise<Record<string, unknown>> {
  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    try { return await res.json(); } catch { return {}; }
  }
  try { return { error: (await res.text()).slice(0, 300) }; } catch { return {}; }
}

export function fmt12h(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return t;
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function fmtDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const isThisYear = d.getFullYear() === now.getFullYear();
  if (isToday) return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isThisYear) return d.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Strip Gmail quote blocks (lines starting with >) for cleaner display
export function stripQuotes(text: string): string {
  return text
    .split("\n")
    .filter(line => !line.trim().startsWith(">"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Detect school name from free-form text (message, session_type, etc.)
export function detectSchool(text: string): string | null {
  const t = text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/\bsjsu\b|san jose state/.test(t))               return "SJSU";
  if (/\buc berkeley\b|\bberkeley\b|cal bears/.test(t)) return "UC Berkeley";
  if (/\bsfsu\b|sf state|san francisco state/.test(t))  return "SF State";
  if (/\bcsueb\b|cal state east bay|eastbay/.test(t))   return "CSUEB";
  if (/\busf\b|university of san francisco/.test(t))    return "USF";
  if (/\bstanford\b/.test(t))                           return "Stanford";
  if (/\bsanta clara\b|\bscu\b/.test(t))                return "Santa Clara";
  if (/\bsacramento state\b|\bsac state\b|\bcsus\b/.test(t)) return "Sac State";
  if (/\bchico state\b|\bcsuchico\b/.test(t))           return "Chico State";
  if (/\bfresno state\b/.test(t))                       return "Fresno State";
  return null;
}

// Extract a human-readable school name from a .edu email domain
export function detectSchoolFromEmail(email: string): string | null {
  const match = email.match(/@([\w.-]+\.edu)/i);
  if (!match) return null;
  const domain = match[1].toLowerCase();
  const known: Record<string, string> = {
    "sjsu.edu": "SJSU", "berkeley.edu": "UC Berkeley", "sfsu.edu": "SF State",
    "csueastbay.edu": "CSUEB", "usfca.edu": "USF", "stanford.edu": "Stanford",
    "scu.edu": "Santa Clara", "csus.edu": "Sac State", "csuchico.edu": "Chico State",
    "csufresno.edu": "Fresno State",
  };
  if (known[domain]) return known[domain];
  // Fall back to a generic prettified name from the subdomain
  const base = domain.replace(/\.edu$/, "").split(".").at(-1) ?? domain;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

// Build a smart default subject for a new outreach
export function buildSubject(inquiry: { session_type: string | null; message: string; date_in_mind: string | null; email?: string }): string {
  const isGrad = (inquiry.session_type ?? "").toLowerCase().includes("grad");
  if (!isGrad) return `Re: Your ${inquiry.session_type ?? "photography"} inquiry`;
  const haystack = [inquiry.message, inquiry.session_type, inquiry.date_in_mind].filter(Boolean).join(" ");
  const school   = detectSchool(haystack)
    ?? (inquiry.email ? detectSchoolFromEmail(inquiry.email) : null);
  return school ? `${school} Graduation Inquiry` : "Graduation Inquiry";
}

// Try to parse a free-form date string (e.g. "June 20", "June 20th") into YYYY-MM-DD.
// Requires a recognizable month name — rejects vague strings like "Flexible".
export function tryParseDate(str: string): string | null {
  if (!str) return null;
  const year = new Date().getFullYear();

  // Try each comma/semicolon/or/and-separated segment — take the first that parses
  for (const seg of str.split(/[,;]|\bor\b|\band\b/i).map(s => s.trim()).filter(Boolean)) {
    // Numeric M/D/YY or M/D/YYYY (e.g. "6/19/26" or "6/19/2026")
    const num = seg.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (num) {
      const [, m, d, y] = num;
      const fullYear = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
      const date = new Date(fullYear, parseInt(m) - 1, parseInt(d));
      if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
    }

    // Month-name format (e.g. "June 19", "June 19th 2026", "June 13 afternoon/evening")
    const hasMonth = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(seg);
    if (hasMonth) {
      const cleaned = seg
        .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
        .replace(/\b(morning|afternoon|evening|night|am|pm|noon|midnight|early|late)\b/gi, "")
        .replace(/[/\\]/g, " ")
        .replace(/\s+/g, " ").trim();
      const alreadyHasYear = /\b(20\d{2})\b/.test(cleaned);
      const attempts = alreadyHasYear ? [cleaned] : [`${cleaned} ${year}`, `${cleaned} ${year + 1}`];
      for (const attempt of attempts) {
        const d = new Date(attempt);
        if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      }
    }
  }
  return null;
}

/** Whole days from today until a YYYY-MM-DD date. 0 = today, negative = past. */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + "T12:00:00");
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86_400_000);
}

/** Human countdown chip text for a session date. */
export function countdownLabel(dateStr: string): string {
  const d = daysUntil(dateStr);
  if (d === 0)  return "Today";
  if (d === 1)  return "Tomorrow";
  if (d > 1)    return `In ${d} days`;
  if (d === -1) return "Yesterday";
  return `${Math.abs(d)} days ago`;
}
