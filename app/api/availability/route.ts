// ─────────────────────────────────────────────────────────────────────────────
// GET /api/availability
//
// Public endpoint that returns Chris's shoot availability as structured JSON.
// Designed to be fetched by AI assistants to answer client scheduling questions.
//
// Response shape:
// {
//   "as_of": "2026-04-14",
//   "dates": {
//     "available": [{ "date": "2026-05-03", "label": "Sun, May 3, 2026", "note": null }],
//     "on_hold":   [...],
//     "booked":    [...]
//   },
//   "quick_read": "5 open dates in the next 90 days ..."   ← plain English for AI context
// }
//
// The /availability page displays these same dates.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

type Row = { date: string; status: "available" | "booked" | "hold"; note: string | null };
type Grouped = { available: DateEntry[]; on_hold: DateEntry[]; booked: DateEntry[] };
type DateEntry = { date: string; label: string; note: string | null };

function humanLabel(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });
}

// Generic public-facing notes. Raw admin notes are never exposed for booked or
// on-hold dates — they may contain private client/session details. Only the
// intentional scheduling notes on *available* dates (e.g. "Morning only") are
// surfaced publicly.
const PUBLIC_NOTE = { booked: "Booked", hold: "On hold" } as const;

function groupDates(rows: Row[], todayStr: string): Grouped {
  const future = rows
    .filter((r) => r.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));

  const out: Grouped = { available: [], on_hold: [], booked: [] };
  for (const r of future) {
    if (r.status === "available") {
      out.available.push({ date: r.date, label: humanLabel(r.date), note: r.note });
    } else if (r.status === "hold") {
      out.on_hold.push({ date: r.date, label: humanLabel(r.date), note: PUBLIC_NOTE.hold });
    } else if (r.status === "booked") {
      out.booked.push({ date: r.date, label: humanLabel(r.date), note: PUBLIC_NOTE.booked });
    }
  }
  return out;
}

function buildQuickRead(label: string, g: Grouped): string {
  const avail = g.available.length;
  const hold  = g.on_hold.length;

  if (avail === 0 && hold === 0) {
    return `${label}: No open dates currently marked. Client can request a date and Chris will check manually.`;
  }

  const parts: string[] = [];
  if (avail > 0) {
    const dates = g.available.map((d) => d.label + (d.note ? ` (${d.note})` : "")).join(", ");
    parts.push(`${avail} available: ${dates}`);
  }
  if (hold > 0) {
    const dates = g.on_hold.map((d) => d.label).join(", ");
    parts.push(`${hold} on hold: ${dates}`);
  }
  if (g.booked.length > 0) {
    parts.push(`${g.booked.length} already booked`);
  }
  return `${label}: ${parts.join(" · ")}`;
}

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const { data, error } = await supabase
      .from("availability")
      .select("date, status, note")
      .order("date");

    if (error) throw error;

    const rows  = (data ?? []) as Row[];
    const dates = groupDates(rows, todayStr);

    const quickRead = buildQuickRead(
      "Both sites (/availability and /booking)",
      dates,
    );

    return NextResponse.json(
      {
        as_of:      todayStr,
        dates,
        quick_read: quickRead,
      },
      {
        headers: {
          // Cache for 5 minutes — fresh enough for real-time use
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (err) {
    console.error("Availability API error:", err);
    return NextResponse.json({ error: "Failed to load availability." }, { status: 500 });
  }
}
