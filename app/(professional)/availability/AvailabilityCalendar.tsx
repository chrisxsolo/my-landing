"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type AvailDate = {
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

const CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(20px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes pulse {
    0%,100% { opacity: 1; transform: scale(1); }
    50%      { opacity: 0.45; transform: scale(0.75); }
  }

  /* ── PAGE ─────────────────────────────────────────────────────────────────── */
  .avail-page {
    background: #f6f1e9;
    color: #1c1710;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, sans-serif;
    min-height: 100vh;
  }
  .avail-shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }

  /* ── HERO ──────────────────────────────────────────────────────────────────── */
  .avail-hero {
    padding: 128px 0 72px;
    position: relative;
    overflow: hidden;
    border-bottom: 1px solid rgba(160,130,90,0.1);
    background:
      radial-gradient(ellipse 65% 70% at 5% 10%,  rgba(195,175,135,0.22) 0%, transparent 60%),
      radial-gradient(ellipse 50% 55% at 95% 90%,  rgba(140,185,165,0.16) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 60% 20%,  rgba(220,195,155,0.1)  0%, transparent 50%),
      #f6f1e9;
  }
  .avail-hero-kicker {
    margin: 0 0 18px;
    display: inline-flex; align-items: center; gap: 8px;
    color: rgba(88,138,118,0.85);
    font-size: 12px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
    animation: fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }
  .avail-hero-kicker::before {
    content: '';
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: rgba(88,148,122,0.75);
    box-shadow: 0 0 7px rgba(88,148,122,0.45);
    animation: pulse 2.4s ease-in-out infinite;
  }
  .avail-hero-title {
    margin: 0;
    font-size: clamp(3.4rem, 9vw, 8rem);
    font-weight: 900;
    letter-spacing: -0.04em;
    line-height: 0.88;
    text-wrap: balance;
    background: linear-gradient(135deg, #2a1f14 0%, #4a3828 45%, rgba(88,138,110,0.95) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: fadeUp 0.65s 0.08s cubic-bezier(0.22,1,0.36,1) both;
  }
  .avail-hero-sub {
    margin: 22px 0 0;
    color: rgba(80,60,38,0.52);
    font-size: 17px; line-height: 1.7; max-width: 460px;
    animation: fadeUp 0.65s 0.16s cubic-bezier(0.22,1,0.36,1) both;
  }
  .avail-hero-chips {
    display: flex; flex-wrap: wrap; gap: 8px;
    margin-top: 28px;
    animation: fadeUp 0.65s 0.24s cubic-bezier(0.22,1,0.36,1) both;
  }
  .avail-chip {
    min-height: 32px;
    display: inline-flex; align-items: center; padding: 0 13px;
    border: 1px solid rgba(160,130,90,0.18);
    border-radius: 99px;
    background: rgba(255,255,255,0.78);
    color: rgba(70,52,32,0.68);
    font-size: 12px; font-weight: 700; letter-spacing: 0.01em;
  }

  /* ── BODY ────────────────────────────────────────────────────────────────── */
  .avail-body { padding: 32px 0 110px; }
  .avail-layout {
    display: grid;
    grid-template-columns: minmax(0,1fr) 320px;
    gap: 14px;
    align-items: start;
  }

  /* ── GLASS CARD BASE ─────────────────────────────────────────────────────── */
  .avail-calendar, .avail-sidebar-panel {
    border: 1px solid rgba(255,255,255,0.88);
    border-radius: 20px;
    background: rgba(255,255,255,0.92);
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.95),
      0 2px 0 rgba(160,130,90,0.06),
      0 20px 56px rgba(130,95,55,0.09),
      0 4px 12px rgba(130,95,55,0.05);
  }
  .avail-calendar { overflow: hidden; }

  /* ── CALENDAR HEADER ─────────────────────────────────────────────────────── */
  .avail-cal-head {
    display: flex; justify-content: space-between; align-items: center; gap: 16px;
    padding: 20px 20px 18px;
    border-bottom: 1px solid rgba(160,130,90,0.08);
  }
  .avail-month {
    margin: 0;
    color: #1c1710;
    font-size: 22px; font-weight: 860; letter-spacing: -0.025em; line-height: 1;
    text-align: center;
  }
  .avail-month-meta {
    margin: 5px 0 0;
    color: rgba(88,138,118,0.6);
    font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-align: center; text-transform: uppercase;
  }
  .avail-nav {
    width: 40px; height: 40px; flex-shrink: 0;
    border: 1px solid rgba(160,130,90,0.14);
    border-radius: 10px;
    background: rgba(255,255,255,0.75);
    color: rgba(60,44,26,0.65);
    cursor: pointer;
    font-size: 16px; font-weight: 700;
    transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
  }
  .avail-nav:hover {
    background: rgba(255,255,255,0.96);
    border-color: rgba(88,148,122,0.28);
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(130,95,55,0.1);
  }

  /* ── WEEKDAY LABELS ──────────────────────────────────────────────────────── */
  .avail-weekdays {
    display: grid; grid-template-columns: repeat(7, minmax(0,1fr));
    gap: 1px; padding: 14px 16px 4px;
  }
  .avail-day-label {
    min-height: 30px; display: grid; place-items: center;
    color: rgba(100,78,48,0.32);
    font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  }

  /* ── DATE GRID ───────────────────────────────────────────────────────────── */
  .avail-grid {
    display: grid; grid-template-columns: repeat(7, minmax(0,1fr));
    gap: 6px; padding: 12px 16px 16px;
  }
  .avail-blank { aspect-ratio: 1; }

  /* Base date button */
  .avail-date-btn {
    position: relative;
    aspect-ratio: 1; min-width: 0;
    display: grid; place-items: center;
    border: 1px solid rgba(160,130,90,0.09);
    border-radius: 10px;
    background: rgba(255,255,255,0.42);
    color: rgba(100,78,48,0.28);
    cursor: default;
    font-size: 14px; font-weight: 700;
    transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease, box-shadow 0.16s ease;
  }
  /* Clickable */
  .avail-date-btn[data-clickable="true"] { cursor: pointer; }
  .avail-date-btn[data-clickable="true"]:hover {
    transform: translateY(-2px) scale(1.04);
    box-shadow: 0 8px 22px rgba(130,95,55,0.12);
    border-color: rgba(88,148,122,0.28);
    background: rgba(255,255,255,0.9);
  }
  /* Available — soft sage */
  .avail-date-btn[data-status="available"] {
    border-color: rgba(88,148,122,0.28);
    background: rgba(88,148,122,0.1);
    color: rgba(42,100,76,0.88);
  }
  /* Hold — warm amber */
  .avail-date-btn[data-status="hold"] {
    border-color: rgba(195,135,55,0.28);
    background: rgba(195,135,55,0.1);
    color: rgba(150,95,20,0.82);
  }
  /* Booked / past — ghosted */
  .avail-date-btn[data-status="booked"],
  .avail-date-btn[data-past="true"] {
    background: rgba(255,255,255,0.22);
    color: rgba(100,78,48,0.18);
    border-color: transparent;
  }
  /* Today ring */
  .avail-date-btn[data-today="true"] {
    box-shadow: inset 0 0 0 1.5px rgba(88,148,122,0.38);
    color: rgba(42,100,76,0.88);
  }
  /* Selected */
  .avail-date-btn[data-selected="true"] {
    background: rgba(88,148,122,0.16);
    border-color: rgba(88,148,122,0.42);
    color: #2a6448;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.8),
      0 0 22px rgba(88,148,122,0.18),
      0 8px 22px rgba(130,95,55,0.08);
    transform: scale(1.06);
  }
  /* Dot indicator */
  .avail-dot {
    position: absolute; bottom: 7px;
    width: 4px; height: 4px; border-radius: 99px;
    background: currentColor; opacity: 0.5;
  }

  /* ── LEGEND ──────────────────────────────────────────────────────────────── */
  .avail-legend {
    display: flex; flex-wrap: wrap; justify-content: center; gap: 8px;
    padding: 4px 16px 20px;
  }
  .avail-legend-item {
    min-height: 30px;
    display: inline-flex; align-items: center; gap: 7px; padding: 0 11px;
    border: 1px solid rgba(160,130,90,0.1); border-radius: 99px;
    background: rgba(255,255,255,0.6);
    color: rgba(80,60,36,0.48); font-size: 11px; font-weight: 700; letter-spacing: 0.03em;
  }
  .avail-legend-item span { width: 7px; height: 7px; border-radius: 99px; opacity: 0.8; }

  /* ── SIDEBAR ─────────────────────────────────────────────────────────────── */
  .avail-sidebar { display: grid; gap: 12px; }
  .avail-sidebar-panel { padding: 20px; }
  .avail-mini-label {
    margin: 0 0 10px;
    color: rgba(88,138,118,0.6);
    font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase;
  }
  .avail-sidebar-panel h2, .avail-sidebar-panel h3 {
    margin: 0 0 10px;
    color: #1c1710;
    font-size: 19px; font-weight: 860; letter-spacing: -0.015em; line-height: 1.1;
  }
  .avail-sidebar-panel p {
    margin: 0;
    color: rgba(80,60,36,0.5); font-size: 14px; line-height: 1.7;
  }

  /* Upcoming windows */
  .avail-upcoming { display: grid; gap: 7px; }
  .avail-upcoming button {
    width: 100%; min-height: 44px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 0 13px;
    border: 1px solid rgba(160,130,90,0.1); border-radius: 11px;
    background: rgba(255,255,255,0.55);
    color: rgba(55,40,22,0.78);
    cursor: pointer; font: inherit; font-size: 13px; font-weight: 700; letter-spacing: 0;
    transition: background 0.16s ease, border-color 0.16s ease, transform 0.16s ease;
  }
  .avail-upcoming button:hover {
    background: rgba(88,148,122,0.1);
    border-color: rgba(88,148,122,0.24);
    transform: translateX(2px);
  }
  .avail-upcoming button span:last-child {
    font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    color: rgba(88,148,122,0.68);
  }

  /* CTA link */
  .avail-link {
    min-height: 46px;
    display: inline-flex; align-items: center; justify-content: center;
    width: 100%; margin-top: 18px;
    border: 1px solid rgba(88,148,122,0.28);
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(88,148,122,0.14) 0%, rgba(60,120,96,0.07) 100%);
    color: #2a6448;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.85), 0 4px 18px rgba(130,95,55,0.08);
    font-size: 14px; font-weight: 820; letter-spacing: 0.01em;
    text-decoration: none;
    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }
  .avail-link:hover {
    transform: translateY(-2px);
    border-color: rgba(88,148,122,0.42);
    background: linear-gradient(135deg, rgba(88,148,122,0.2) 0%, rgba(60,120,96,0.12) 100%);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.9), 0 8px 28px rgba(130,95,55,0.1), 0 0 18px rgba(88,148,122,0.1);
  }

  /* ── RESPONSIVE ──────────────────────────────────────────────────────────── */
  @media (max-width: 920px) { .avail-layout { grid-template-columns: 1fr; } }
  @media (max-width: 760px) {
    .avail-shell  { width: min(1180px, calc(100% - 32px)); }
    .avail-hero   { padding: 104px 0 56px; }
    .avail-hero-title { font-size: clamp(2.8rem, 13vw, 4.2rem); }
    .avail-hero-sub   { font-size: 15px; }
    .avail-body   { padding-bottom: 80px; }
    .avail-month  { font-size: 19px; }
    .avail-nav    { width: 36px; height: 36px; font-size: 14px; }
    .avail-grid   { gap: 4px; padding: 8px 10px 12px; }
    .avail-date-btn { border-radius: 8px; font-size: 13px; }
    .avail-dot    { bottom: 5px; width: 3px; height: 3px; }
    .avail-weekdays  { padding: 10px 10px 2px; }
    .avail-day-label { min-height: 26px; font-size: 10px; }
    .avail-sidebar-panel { padding: 16px; }
    .avail-sidebar-panel h2, .avail-sidebar-panel h3 { font-size: 17px; }
  }
  @media (max-width: 420px) {
    .avail-hero-title { font-size: clamp(2.4rem, 12vw, 3.4rem); }
    .avail-grid  { gap: 3px; padding: 6px 8px 10px; }
    .avail-date-btn { font-size: 12px; border-radius: 7px; }
  }
`;

export default function AvailabilityCalendar({ initialDates }: { initialDates: AvailDate[] }) {
  const today = new Date();
  const [month, setMonth]       = useState(today.getMonth());
  const [year, setYear]         = useState(today.getFullYear());
  const [dates]                 = useState<AvailDate[]>(initialDates);
  const [selected, setSelected] = useState<AvailDate | null>(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.type = "application/json";
    link.href = "/api/availability";
    link.title = "Chris Solorzano shoot availability (JSON)";
    document.head.appendChild(link);
    return () => link.remove();
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
    <>
      <style>{CSS}</style>
      {/* AI / no-JS fallback */}
      <noscript>
        <p style={{ padding: "16px", fontFamily: "sans-serif", fontSize: "14px" }}>
          This calendar requires JavaScript to display dates.
          For machine-readable availability data, fetch{" "}
          <a href="/api/availability">https://soloxsnaps.com/api/availability</a>
          {" "}— it returns JSON with all open, hold, and booked dates plus a plain-English summary.
        </p>
      </noscript>

      {/* ── HERO ── */}
      <section className="avail-hero">
        <div className="avail-shell">
          <p className="avail-hero-kicker">Live booking calendar</p>
          <h1 className="avail-hero-title">Dates.</h1>
          <p className="avail-hero-sub">
            Find an open window before the season fills. Pick a date, send the inquiry.
          </p>
          <div className="avail-hero-chips">
            <span className="avail-chip">{availCount} open this month</span>
            <span className="avail-chip">Bay Area campuses</span>
            <span className="avail-chip">24–48 hr replies</span>
          </div>
        </div>
      </section>

      {/* ── CALENDAR + SIDEBAR ── */}
      <div className="avail-body">
        <div className="avail-shell avail-layout">
          {/* ── CALENDAR ── */}
          <div className="avail-calendar" data-reveal>
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

            {/* ── Legend ── */}
            <div className="avail-legend">
              {[["Available", "#7aad94"], ["On hold", "#c9933a"], ["Booked", "#c4b49e"]].map(([label, color]) => (
                <span key={label} className="avail-legend-item">
                  <span style={{ background: color }} />{label}
                </span>
              ))}
            </div>
          </div>

          {/* ── SIDEBAR ── */}
          <aside className="avail-sidebar" aria-label="Availability details">
            <div className="avail-sidebar-panel" data-reveal data-delay="2">
              <p className="avail-mini-label">{selectedLabel}</p>
              <h2>{selected ? formatDate(selected.date) : "Tap an open date"}</h2>
              <p>
                {selected
                  ? selected.note || "This date is marked for booking. Send the inquiry and I will confirm timing."
                  : "Open and hold dates show up with color. If a date is not marked, mention it in your inquiry and I can check."}
              </p>
              <Link
                href={
                  selected
                    ? `/contact?date=${encodeURIComponent(
                        new Date(selected.date + "T12:00:00")
                          .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      )}`
                    : "/contact"
                }
                className="avail-link"
              >
                {selected ? "Book this date →" : "Start inquiry"}
              </Link>
            </div>

            <div className="avail-sidebar-panel" data-reveal data-delay="3">
              <p className="avail-mini-label">Next windows</p>
              {upcomingDates.length > 0 ? (
                <div className="avail-upcoming">
                  {upcomingDates.map((date) => (
                    <button key={date.date} type="button"
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

            {/* ── Locations ── */}
            <div className="avail-sidebar-panel" data-reveal data-delay="4">
              <p className="avail-mini-label">Locations</p>
              <h3>SF, Berkeley, Stanford, SJSU, Peninsula, South Bay.</h3>
              <p>Sunset and campus windows are planned around light, walking distance, and how busy the location gets.</p>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
