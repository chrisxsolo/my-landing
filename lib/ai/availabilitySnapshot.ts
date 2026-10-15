// ─────────────────────────────────────────────────────────────────────────────
// Availability for the draft, read straight from Postgres.
//
// The previous implementation fetched its own /api/availability over HTTP from
// inside the route handler, using NEXT_PUBLIC_SITE_URL. That added a network
// round trip to every draft and failed open to the string "Availability data
// unavailable", which the model then had to interpret. Reading the table
// directly is one query and returns either real dates or an explicit null.
//
// The schema stores one status per DATE. There are no time windows, so nothing
// here can confirm that a date is open at sunset specifically — callers must
// keep treating times as proposals.
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { todayInClientSessionTimeZone } from "@/lib/clientSessions";
import type { AvailabilitySnapshot, AvailabilityEntry } from "./buildEmailContext";

type Row = { date: string; status: "available" | "booked" | "hold"; note: string | null };

/** How far ahead to offer. Beyond this Chris would rather be asked. */
const HORIZON_DAYS = 120;

function humanLabel(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short", month: "long", day: "numeric", year: "numeric",
  });
}

function toEntry(row: Row): AvailabilityEntry {
  return { date: row.date, label: humanLabel(row.date), note: row.note };
}

/**
 * Returns the snapshot, or null when availability genuinely could not be read.
 *
 * Null is meaningful: buildEmailContext turns it into a high-severity warning
 * and the prompt then forbids offering any date at all. Returning an empty
 * snapshot instead would read as "nothing is open", which is a different and
 * wrong claim.
 */
export async function fetchAvailabilitySnapshot(): Promise<AvailabilitySnapshot | null> {
  try {
    const supabase = createSupabaseServerClient();
    const today = todayInClientSessionTimeZone();
    const horizon = new Date(`${today}T12:00:00Z`);
    horizon.setUTCDate(horizon.getUTCDate() + HORIZON_DAYS);
    const horizonStr = horizon.toISOString().slice(0, 10);

    const { data, error } = await supabase
      .from("availability")
      .select("date, status, note")
      .gte("date", today)
      .lte("date", horizonStr)
      .order("date");
    if (error) throw error;

    const rows = (data ?? []) as Row[];
    return {
      asOf: today,
      available: rows.filter((r) => r.status === "available").map(toEntry),
      onHold: rows.filter((r) => r.status === "hold").map(toEntry),
      booked: rows.filter((r) => r.status === "booked").map(toEntry),
    };
  } catch (err) {
    console.error("[availabilitySnapshot] read failed:", err);
    return null;
  }
}
