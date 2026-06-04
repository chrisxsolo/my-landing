// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY PAGE  →  soloxsnaps.com/availability
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Light hero — "Dates." heading on soft gray gradient + chip row
//   2. Calendar   — interactive month grid (dates from Supabase)
//   3. Sidebar    — selected date details, upcoming dates, locations list
//
// HOW DATES WORK:
//   Dates are managed in Supabase → Table: "availability"
//   Both the professional site (/availability) and the fun site (/booking)
//   read from this same table — they just display it differently.
//   Each row has: date (YYYY-MM-DD), status ("available"/"booked"/"hold"), note
//   To add/edit dates: use the admin panel at /admin/availability.
//
// DATE STATUS COLORS (change in .avail-date-btn[data-status=...] in AvailabilityCalendar.tsx):
//   available → green-tinted  (rgba 112, 139, 133)
//   hold      → yellow-green  (rgba 189, 214, 75)
//   booked    → muted gray    (rgba 228, 234, 231)
//
// QUICK EDITS:
//   → Hero title:       find the h1 in AvailabilityCalendar.tsx
//   → Hero chips:       find the avail-chip spans in AvailabilityCalendar.tsx
//   → Legend labels:    find the ["Available", "On hold", "Booked"] array
//   → Upcoming count:   change .slice(0, 4) in the upcomingDates filter
//   → Sidebar locations:find the "Locations" sidebar panel in AvailabilityCalendar.tsx
// ─────────────────────────────────────────────────────────────────────────────

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import AvailabilityCalendar, { type AvailDate } from "./AvailabilityCalendar";

export const revalidate = 300;

export default async function AvailabilityPage() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("availability")
    .select("date, status, note")
    .order("date", { ascending: true });

  if (error) console.error("Failed to load availability:", error);

  // Strip private admin notes from booked/hold dates before sending to the
  // browser. Only intentional public notes on available dates are kept.
  const dates = (data ?? []).map((d) => ({
    ...d,
    note: d.status === "available" ? d.note : null,
  })) as AvailDate[];

  return (
    <main className="avail-page">
      <AvailabilityCalendar initialDates={dates} />
    </main>
  );
}
