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
