// ─────────────────────────────────────────────────────────────────────────────
// AVAILABILITY PAGE  →  soloxsnaps.com/availability
// ─────────────────────────────────────────────────────────────────────────────
// WHAT'S ON THIS PAGE (top to bottom):
//   1. Light hero — "Dates." heading on soft gray gradient + chip row
//   2. Calendar   — interactive month grid (dates from Supabase)
//   3. Sidebar    — selected date details, upcoming dates, locations list
//
// HOW DATES WORK:
//   Dates are managed in Supabase → Table: "professional_availability"
//   Each row has: date (YYYY-MM-DD), status ("available"/"booked"/"hold"), note
//   To add available dates: insert rows in that table via Supabase dashboard.
//
// DATE STATUS COLORS (change in .avail-date-btn[data-status=...] below):
//   available → green-tinted  (rgba 112, 139, 133)
//   hold      → yellow-green  (rgba 189, 214, 75)
//   booked    → muted gray    (rgba 228, 234, 231)
//
// QUICK EDITS:
//   → Hero title:       find the h1 in the hero JSX
//   → Hero chips:       find the avail-chip spans in the footer row
//   → Legend labels:    find the ["Available", "On hold", "Booked"] array
//   → Upcoming count:   change .slice(0, 4) in the upcomingDates filter
//   → Sidebar locations:find the "Locations" sidebar panel near the bottom
// ─────────────────────────────────────────────────────────────────────────────

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type AvailDate = {
  id: number;
  date: string;
  status: "available" | "booked" | "hold";
  note: string | null;
};

const DAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDay(year: number, month: number)    { return new Date(year, month, 1).getDay(); }
function toStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric",
  });
}

async function loadAvailabilityDates() {
  const professional = await supabase
    .from("professional_availability")
    .select("*")
    .order("date", { ascending: true });
  if (professional.error) console.error("Failed to load professional availability:", professional.error);
  if (professional.data && professional.data.length > 0) return professional.data as AvailDate[];

  const legacy = await supabase
    .from("availability")
    .select("*")
    .order("date", { ascending: true });
  if (legacy.error) console.error("Failed to load availability fallback:", legacy.error);
  return (legacy.data ?? []) as AvailDate[];
}

const CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── PAGE ─────────────────────────────────────────────────────────────────── */
  .avail-page {
    background: #f5f6f4;
    color: #101412;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .avail-shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }

  /* ── HERO ─────────────────────────────────────────────────────────────────────
     Light gradient header. padding-top clears the fixed nav bar. */
  .avail-hero {
    padding: 120px 0 64px;
    background: linear-gradient(to bottom, #eaf0ec 0%, #f5f6f4 100%);
    border-bottom: 1px solid rgba(18, 24, 22, 0.07);
  }
  .avail-hero-kicker {
    margin: 0 0 16px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    animation: fadeUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .avail-hero-title {
    margin: 0;
    color: #101412;
    font-size: clamp(3.2rem, 8.5vw, 7.5rem);
    font-weight: 900;
    letter-spacing: -0.035em;
    line-height: 0.88;
    text-wrap: balance;
    animation: fadeUp 0.65s 0.08s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  .avail-hero-sub {
    margin: 20px 0 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.7;
    max-width: 480px;
    animation: fadeUp 0.65s 0.16s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  /* Chip row in the hero */
  .avail-hero-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 24px;
    animation: fadeUp 0.65s 0.24s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
  /* Frosted glass chips on light background */
  .avail-chip {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    padding: 0 12px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    color: #26312d;
    font-size: 13px;
    font-weight: 760;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }

  /* ── BODY (calendar + sidebar) ───────────────────────────────────────────── */
  .avail-body { background: #f5f6f4; padding: 28px 0 100px; }
  .avail-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: 16px;
    align-items: start;
  }

  /* ── CALENDAR CARD ─────────────────────────────────────────────────────────
     Frosted glass card. */
  .avail-calendar, .avail-sidebar-panel {
    border: 1px solid rgba(18, 24, 22, 0.09);
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.82);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: 0 8px 32px rgba(18, 24, 22, 0.06);
  }
  .avail-calendar { overflow: hidden; }

  .avail-cal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 18px;
    border-bottom: 1px solid rgba(18, 24, 22, 0.07);
  }
  .avail-month {
    margin: 0;
    color: #101412;
    font-size: 24px;
    font-weight: 860;
    letter-spacing: -0.02em;
    line-height: 1;
    text-align: center;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .avail-month-meta {
    margin: 5px 0 0;
    color: #687571;
    font-size: 13px;
    font-weight: 720;
    text-align: center;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .avail-nav {
    width: 44px; height: 44px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.92);
    color: #101412;
    cursor: pointer;
    font-size: 20px;
    font-weight: 820;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    transition: transform 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  }
  .avail-nav:hover { transform: translateY(-1px); background: #eef8f5; box-shadow: 0 6px 16px rgba(18,24,22,0.07); }

  .avail-weekdays {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 1px;
    padding: 12px 14px 0;
  }
  .avail-day-label {
    min-height: 32px;
    display: grid;
    place-items: center;
    color: #687571;
    font-size: 12px;
    font-weight: 820;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .avail-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; padding: 14px; }

  /* Date button */
  .avail-date-btn {
    position: relative;
    aspect-ratio: 1;
    min-width: 0;
    display: grid;
    place-items: center;
    border: 1px solid rgba(18, 24, 22, 0.08);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.86);
    color: #31403a;
    cursor: default;
    font-size: 15px;
    font-weight: 760;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  }
  .avail-date-btn[data-clickable="true"]       { cursor: pointer; }
  .avail-date-btn[data-clickable="true"]:hover { transform: translateY(-2px); }
  .avail-date-btn[data-status="available"]     { border-color: rgba(112,139,133,0.3); background: rgba(112,139,133,0.1); color: #58746f; }
  .avail-date-btn[data-status="hold"]          { border-color: rgba(189,214,75,0.66); background: rgba(214,243,106,0.42); color: #506000; }
  .avail-date-btn[data-status="booked"],
  .avail-date-btn[data-past="true"]            { background: rgba(228,234,231,0.78); color: #899591; }
  .avail-date-btn[data-today="true"]           { box-shadow: inset 0 0 0 2px rgba(112,139,133,0.42); }
  .avail-date-btn[data-selected="true"]        { border-color: rgba(112,139,133,0.38); background: rgba(112,139,133,0.12); color: #4f6d67; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.76), 0 10px 22px rgba(112,139,133,0.06); }

  .avail-dot { position: absolute; bottom: 9px; width: 7px; height: 7px; border-radius: 99px; background: currentColor; }
  .avail-blank { aspect-ratio: 1; }

  /* Legend */
  .avail-legend { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; padding: 0 16px 18px; }
  .avail-legend-item {
    min-height: 34px;
    display: inline-flex; align-items: center; gap: 8px; padding: 0 11px;
    border: 1px solid rgba(18, 24, 22, 0.1); border-radius: 8px;
    color: #4d5a55; font-size: 12px; font-weight: 760;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .avail-legend-item span { width: 8px; height: 8px; border-radius: 99px; }

  /* Loading skeleton */
  .avail-loading { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; padding: 14px; }
  .avail-loading span { aspect-ratio: 1; border-radius: 8px; background: rgba(228,234,231,0.7); }

  /* ── SIDEBAR ─────────────────────────────────────────────────────────────── */
  .avail-sidebar { display: grid; gap: 12px; }
  .avail-sidebar-panel { padding: 18px; }
  .avail-mini-label {
    margin: 0 0 10px;
    color: #667f79; font-size: 12px; font-weight: 820;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .avail-sidebar-panel h2, .avail-sidebar-panel h3 {
    margin: 0 0 10px;
    color: #101412; font-size: 20px; font-weight: 860;
    letter-spacing: -0.01em; line-height: 1.08;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .avail-sidebar-panel p {
    margin: 0;
    color: #56635e; font-size: 15px; line-height: 1.65;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
  }
  .avail-upcoming { display: grid; gap: 8px; }
  .avail-upcoming button {
    width: 100%; min-height: 44px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 12px;
    border: 1px solid rgba(18,24,22,0.09); border-radius: 8px;
    background: rgba(247,250,248,0.86); color: #101412;
    cursor: pointer; font: inherit; font-size: 14px; font-weight: 760; letter-spacing: 0;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    transition: background 0.15s ease;
  }
  .avail-upcoming button:hover { background: rgba(239,246,244,0.98); }

  /* Sidebar CTA link */
  .avail-link {
    min-height: 44px;
    display: inline-flex; align-items: center; justify-content: center;
    width: 100%; margin-top: 16px;
    border: 1px solid rgba(112,139,133,0.22); border-radius: 8px;
    background: rgba(246,250,248,0.94); color: #4f6d67;
    box-shadow: 0 8px 24px rgba(112,139,133,0.05);
    font-size: 14px; font-weight: 820;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    text-decoration: none;
    transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  }
  .avail-link:hover {
    transform: translateY(-1px);
    border-color: rgba(112,139,133,0.32);
    background: rgba(239,246,244,0.98);
    box-shadow: 0 12px 28px rgba(112,139,133,0.07);
  }

  /* ── RESPONSIVE ──────────────────────────────────────────────────────────── */
  @media (max-width: 920px) { .avail-layout { grid-template-columns: 1fr; } }
  @media (max-width: 760px) {
    .avail-shell { width: min(1180px, calc(100% - 36px)); }
    .avail-hero { padding: 100px 0 52px; }
    .avail-hero-title { font-size: clamp(2.6rem, 12vw, 4rem); }
    .avail-hero-sub { font-size: 15px; }
    .avail-body { padding-bottom: 78px; }
    .avail-month { font-size: 20px; }
    .avail-nav { width: 40px; height: 40px; }
    .avail-grid { gap: 5px; padding: 10px; }
    .avail-date-btn { border-radius: 6px; font-size: 13px; }
    .avail-dot { bottom: 6px; width: 5px; height: 5px; }
    .avail-weekdays { padding: 10px 10px 0; }
    .avail-day-label { min-height: 26px; font-size: 11px; }
  }
  @media (max-width: 420px) {
    .avail-hero-title { font-size: clamp(2.2rem, 11vw, 3.2rem); }
    .avail-grid { gap: 3px; padding: 8px; }
    .avail-date-btn { font-size: 12px; }
  }
`;

export default function AvailabilityPage() {
  const today = new Date();
  const [month, setMonth]     = useState(today.getMonth());
  const [year, setYear]       = useState(today.getFullYear());
  const [dates, setDates]     = useState<AvailDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AvailDate | null>(null);

  useEffect(() => {
    async function fetchDates() {
      try { setDates(await loadAvailabilityDates()); }
      catch (error) { console.error(error); }
      finally { setLoading(false); }
    }
    fetchDates();
  }, []);

  const dateMap     = dates.reduce((acc, d) => { acc[d.date] = d; return acc; }, {} as Record<string, AvailDate>);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDay(year, month);
  const todayStr    = toStr(today.getFullYear(), today.getMonth(), today.getDate());
  const monthDates  = dates.filter((d) => { const [y, m] = d.date.split("-").map(Number); return y === year && m === month + 1; });
  const availCount  = monthDates.filter((d) => d.status === "available" && d.date >= todayStr).length;
  const upcomingDates = dates
    .filter((d) => d.date >= todayStr && (d.status === "available" || d.status === "hold"))
    .slice(0, 4);

  const selectedLabel = selected
    ? selected.status === "available" ? "Available" : selected.status === "hold" ? "On hold" : "Booked"
    : "Pick a date";

  const prevMonth = () => { setSelected(null); if (month === 0) { setMonth(11); setYear((v) => v - 1); } else { setMonth((v) => v - 1); } };
  const nextMonth = () => { setSelected(null); if (month === 11) { setMonth(0); setYear((v) => v + 1); } else { setMonth((v) => v + 1); } };

  return (
    <main className="avail-page">
      <style>{CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────────
           Light gradient section. Edit h1 and p text directly below.
           Chips show live data (open count from Supabase). */}
      <section className="avail-hero">
        <div className="avail-shell">
          <p className="avail-hero-kicker">Live booking calendar</p>
          <h1 className="avail-hero-title">Dates.</h1>
          <p className="avail-hero-sub">
            Find an open window before the season fills. Pick a date, send the inquiry.
          </p>
          {/* ── Chips — edit labels here ── */}
          <div className="avail-hero-chips">
            <span className="avail-chip">{availCount} open this month</span>
            <span className="avail-chip">Bay Area campuses</span>
            <span className="avail-chip">24–48 hr replies</span>
          </div>
        </div>
      </section>

      {/* ── CALENDAR + SIDEBAR ─────────────────────────────────────────────────
           Calendar on left (interactive month grid).
           Sidebar on right (selected date, upcoming, locations). */}
      <div className="avail-body">
        <div className="avail-shell avail-layout">
          {/* ── CALENDAR ── */}
          <div className="avail-calendar">
            <div className="avail-cal-head">
              <button className="avail-nav" onClick={prevMonth} aria-label="Previous month">{"<"}</button>
              <div>
                <h2 className="avail-month">{MONTHS[month]} {year}</h2>
                <p className="avail-month-meta">{availCount > 0 ? `${availCount} open dates` : "No marked openings yet"}</p>
              </div>
              <button className="avail-nav" onClick={nextMonth} aria-label="Next month">{">"}</button>
            </div>

            <div className="avail-weekdays">
              {DAYS.map((d) => <div key={d} className="avail-day-label">{d}</div>)}
            </div>

            {loading ? (
              <div className="avail-loading" aria-label="Loading dates">
                {Array.from({ length: 35 }).map((_, i) => <span key={i} />)}
              </div>
            ) : (
              <div className="avail-grid">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`blank-${i}`} className="avail-blank" />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day        = i + 1;
                  const dateStr    = toStr(year, month, day);
                  const entry      = dateMap[dateStr];
                  const isPast     = dateStr < todayStr;
                  const isToday    = dateStr === todayStr;
                  const isSelected = selected?.date === dateStr;
                  const clickable  = Boolean(entry && !isPast && entry.status !== "booked");
                  return (
                    <button
                      key={dateStr}
                      className="avail-date-btn"
                      type="button"
                      data-status={entry?.status ?? "none"}
                      data-clickable={clickable}
                      data-past={isPast}
                      data-today={isToday}
                      data-selected={isSelected}
                      disabled={!clickable}
                      onClick={() => entry && setSelected(isSelected ? null : entry)}
                      aria-label={`${MONTHS[month]} ${day}${entry ? `, ${entry.status}` : ""}`}
                    >
                      {day}
                      {!isPast && entry && entry.status !== "booked" && !isSelected && <span className="avail-dot" />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── Legend — edit color values here ── */}
            <div className="avail-legend">
              {[["Available", "#9ab9b2"], ["On hold", "#d6f36a"], ["Booked", "#c7d1cc"]].map(([label, color]) => (
                <span key={label} className="avail-legend-item">
                  <span style={{ background: color }} />{label}
                </span>
              ))}
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="avail-sidebar" aria-label="Availability details">
            <div className="avail-sidebar-panel">
              <p className="avail-mini-label">{selectedLabel}</p>
              <h2>{selected ? formatDate(selected.date) : "Tap an open date"}</h2>
              <p>
                {selected
                  ? selected.note || "This date is marked for booking. Send the inquiry and I will confirm timing."
                  : "Open and hold dates show up with color. If a date is not marked, mention it in your inquiry and I can check."}
              </p>
              <Link href="/contact" className="avail-link">Start inquiry</Link>
            </div>

            <div className="avail-sidebar-panel">
              <p className="avail-mini-label">Next windows</p>
              {upcomingDates.length > 0 ? (
                <div className="avail-upcoming">
                  {upcomingDates.map((date) => (
                    <button key={date.id} type="button"
                      onClick={() => { const [ny, nm] = date.date.split("-").map(Number); setYear(ny); setMonth(nm - 1); setSelected(date); }}>
                      <span>{formatDate(date.date)}</span>
                      <span>{date.status === "available" ? "Open" : "Hold"}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p>New dates are added as the season moves. Send your window and I will check it manually.</p>
              )}
            </div>

            {/* ── Locations — edit the h3 text to change listed campuses ── */}
            <div className="avail-sidebar-panel">
              <p className="avail-mini-label">Locations</p>
              <h3>SF, Berkeley, Stanford, SJSU, Peninsula, South Bay.</h3>
              <p>Sunset and campus windows are planned around light, walking distance, and how busy the location gets.</p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
