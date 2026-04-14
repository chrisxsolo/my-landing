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

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDay(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function toStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

async function loadAvailabilityDates() {
  const professional = await supabase
    .from("professional_availability")
    .select("*")
    .order("date", { ascending: true });

  if (professional.error) {
    console.error("Failed to load professional availability:", professional.error);
  }

  if (professional.data && professional.data.length > 0) {
    return professional.data as AvailDate[];
  }

  const legacy = await supabase
    .from("availability")
    .select("*")
    .order("date", { ascending: true });

  if (legacy.error) {
    console.error("Failed to load availability fallback:", legacy.error);
  }

  return (legacy.data ?? []) as AvailDate[];
}

const CSS = `
  .availability-page {
    min-height: 100vh;
    padding-top: 98px;
    background: transparent;
    color: #101412;
  }
  .availability-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }
  .availability-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(280px, 0.95fr);
    gap: 24px;
    align-items: end;
    padding: 70px 0 34px;
  }
  .availability-kicker,
  .availability-chip,
  .availability-status,
  .availability-link,
  .availability-month-meta,
  .availability-day-label,
  .availability-date-button,
  .availability-mini-label {
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
  }
  .availability-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
  }
  .availability-title {
    max-width: 720px;
    margin: 0;
    color: #101412;
    font-size: 58px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }
  .availability-copy {
    max-width: 560px;
    margin: 22px 0 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.7;
    text-wrap: pretty;
  }
  .availability-hero-panel {
    display: grid;
    gap: 12px;
    padding: 16px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.76);
    box-shadow: 0 12px 28px rgba(18, 24, 22, 0.06);
  }
  .availability-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .availability-chip {
    min-height: 36px;
    display: inline-flex;
    align-items: center;
    padding: 0 12px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.72);
    color: #26312d;
    font-size: 13px;
    font-weight: 760;
  }
  .availability-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: 18px;
    align-items: start;
    padding: 24px 0 110px;
  }
  .availability-calendar,
  .availability-sidebar-panel {
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.78);
    box-shadow: 0 14px 34px rgba(18, 24, 22, 0.07);
  }
  .availability-calendar {
    overflow: hidden;
  }
  .availability-calendar-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 18px;
    border-bottom: 1px solid rgba(18, 24, 22, 0.1);
  }
  .availability-month {
    margin: 0;
    color: #101412;
    font-size: 28px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1;
    text-align: center;
  }
  .availability-month-meta {
    margin: 6px 0 0;
    color: #687571;
    font-size: 13px;
    font-weight: 720;
    text-align: center;
  }
  .availability-nav {
    width: 44px;
    height: 44px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: #ffffff;
    color: #101412;
    cursor: pointer;
    font-size: 20px;
    font-weight: 820;
    transition: transform 0.18s ease, background 0.18s ease;
  }
  .availability-nav:hover {
    transform: translateY(-1px);
    background: #eef8f5;
  }
  .availability-weekdays {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 1px;
    padding: 12px 14px 0;
  }
  .availability-day-label {
    min-height: 32px;
    display: grid;
    place-items: center;
    color: #687571;
    font-size: 12px;
    font-weight: 820;
  }
  .availability-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 7px;
    padding: 14px;
  }
  .availability-date-button {
    position: relative;
    aspect-ratio: 1;
    min-width: 0;
    display: grid;
    place-items: center;
    border: 1px solid rgba(18, 24, 22, 0.09);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.86);
    color: #31403a;
    cursor: default;
    font-size: 15px;
    font-weight: 760;
    transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
  }
  .availability-date-button[data-clickable="true"] {
    cursor: pointer;
  }
  .availability-date-button[data-clickable="true"]:hover {
    transform: translateY(-2px);
  }
  .availability-date-button[data-status="available"] {
    border-color: rgba(112, 139, 133, 0.3);
    background: rgba(112, 139, 133, 0.1);
    color: #58746f;
  }
  .availability-date-button[data-status="hold"] {
    border-color: rgba(189, 214, 75, 0.66);
    background: rgba(214, 243, 106, 0.42);
    color: #506000;
  }
  .availability-date-button[data-status="booked"],
  .availability-date-button[data-past="true"] {
    background: rgba(228, 234, 231, 0.78);
    color: #899591;
  }
  .availability-date-button[data-today="true"] {
    box-shadow: inset 0 0 0 2px rgba(112, 139, 133, 0.42);
  }
  .availability-date-button[data-selected="true"] {
    border-color: rgba(112, 139, 133, 0.38);
    background: rgba(112, 139, 133, 0.12);
    color: #4f6d67;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.76), 0 10px 22px rgba(112, 139, 133, 0.06);
  }
  .availability-dot {
    position: absolute;
    bottom: 9px;
    width: 7px;
    height: 7px;
    border-radius: 99px;
    background: currentColor;
  }
  .availability-blank {
    aspect-ratio: 1;
  }
  .availability-legend {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    padding: 0 16px 18px;
  }
  .availability-status {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 11px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    color: #4d5a55;
    font-size: 12px;
    font-weight: 760;
  }
  .availability-status span {
    width: 8px;
    height: 8px;
    border-radius: 99px;
  }
  .availability-sidebar {
    display: grid;
    gap: 14px;
  }
  .availability-sidebar-panel {
    padding: 18px;
  }
  .availability-mini-label {
    margin: 0 0 10px;
    color: #667f79;
    font-size: 12px;
    font-weight: 820;
  }
  .availability-sidebar-panel h2,
  .availability-sidebar-panel h3 {
    margin: 0 0 10px;
    color: #101412;
    font-size: 24px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1.08;
  }
  .availability-sidebar-panel p {
    margin: 0;
    color: #56635e;
    font-size: 15px;
    line-height: 1.65;
  }
  .availability-upcoming {
    display: grid;
    gap: 8px;
  }
  .availability-upcoming button {
    width: 100%;
    min-height: 46px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 0 12px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.86);
    color: #101412;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    font-weight: 760;
    letter-spacing: 0;
  }
  .availability-link {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    margin-top: 16px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    box-shadow: 0 10px 24px rgba(112, 139, 133, 0.05);
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease;
  }
  .availability-link:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
    box-shadow: 0 14px 28px rgba(112, 139, 133, 0.07);
  }
  .availability-loading {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 7px;
    padding: 14px;
  }
  .availability-loading span {
    aspect-ratio: 1;
    border-radius: 8px;
    background: rgba(228, 234, 231, 0.7);
  }
  @media (max-width: 920px) {
    .availability-hero,
    .availability-layout {
      grid-template-columns: 1fr;
    }
    .availability-hero {
      padding-top: 48px;
    }
  }
  @media (max-width: 760px) {
    .availability-page {
      padding-top: 78px;
    }
    .availability-shell {
      width: min(1180px, calc(100% - 36px));
    }
    .availability-title {
      font-size: 40px;
      line-height: 1;
    }
    .availability-copy {
      font-size: 16px;
    }
    .availability-layout {
      padding-bottom: 78px;
    }
    .availability-calendar-head {
      padding: 14px;
    }
    .availability-month {
      font-size: 22px;
    }
    .availability-nav {
      width: 40px;
      height: 40px;
    }
    .availability-grid {
      gap: 5px;
      padding: 10px;
    }
    .availability-date-button {
      border-radius: 6px;
      font-size: 13px;
    }
    .availability-dot {
      bottom: 6px;
      width: 5px;
      height: 5px;
    }
    .availability-weekdays {
      padding: 10px 10px 0;
    }
    .availability-day-label {
      min-height: 26px;
      font-size: 11px;
    }
  }
  @media (max-width: 420px) {
    .availability-title {
      font-size: 34px;
    }
    .availability-grid {
      gap: 3px;
      padding: 8px;
    }
    .availability-date-button {
      font-size: 12px;
    }
  }
`;

export default function AvailabilityPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [dates, setDates] = useState<AvailDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AvailDate | null>(null);

  useEffect(() => {
    async function fetchDates() {
      try {
        setDates(await loadAvailabilityDates());
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }

    fetchDates();
  }, []);

  const dateMap = dates.reduce((acc, date) => {
    acc[date.date] = date;
    return acc;
  }, {} as Record<string, AvailDate>);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDay(year, month);
  const todayStr = toStr(today.getFullYear(), today.getMonth(), today.getDate());
  const monthDates = dates.filter((date) => {
    const [entryYear, entryMonth] = date.date.split("-").map(Number);
    return entryYear === year && entryMonth === month + 1;
  });
  const availCount = monthDates.filter((date) => date.status === "available" && date.date >= todayStr).length;
  const upcomingDates = dates
    .filter((date) => date.date >= todayStr && (date.status === "available" || date.status === "hold"))
    .slice(0, 4);

  const selectedLabel = selected
    ? selected.status === "available"
      ? "Available"
      : selected.status === "hold"
        ? "On hold"
        : "Booked"
    : "Pick a date";

  const prevMonth = () => {
    setSelected(null);
    if (month === 0) {
      setMonth(11);
      setYear((value) => value - 1);
    } else {
      setMonth((value) => value - 1);
    }
  };

  const nextMonth = () => {
    setSelected(null);
    if (month === 11) {
      setMonth(0);
      setYear((value) => value + 1);
    } else {
      setMonth((value) => value + 1);
    }
  };

  return (
    <main className="availability-page">
      <style>{CSS}</style>

      <section className="availability-shell availability-hero">
        <div>
          <p className="availability-kicker">Live booking calendar</p>
          <h1 className="availability-title">Find the date before the season fills up.</h1>
          <p className="availability-copy">
            Availability changes during grad season. Pick an open date, send the inquiry, and I will confirm the exact timing and location plan.
          </p>
        </div>

        <div className="availability-hero-panel">
          <p className="availability-mini-label">Quick read</p>
          <div className="availability-chip-row">
            <span className="availability-chip">{availCount} open this month</span>
            <span className="availability-chip">Bay Area campuses</span>
            <span className="availability-chip">24 to 48 hour replies</span>
          </div>
        </div>
      </section>

      <section className="availability-shell availability-layout">
        <div className="availability-calendar">
          <div className="availability-calendar-head">
            <button className="availability-nav" onClick={prevMonth} aria-label="Previous month">
              {"<"}
            </button>
            <div>
              <h2 className="availability-month">{MONTHS[month]} {year}</h2>
              <p className="availability-month-meta">{availCount > 0 ? `${availCount} open dates` : "No marked openings yet"}</p>
            </div>
            <button className="availability-nav" onClick={nextMonth} aria-label="Next month">
              {">"}
            </button>
          </div>

          <div className="availability-weekdays">
            {DAYS.map((day) => (
              <div key={day} className="availability-day-label">
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="availability-loading" aria-label="Loading dates">
              {Array.from({ length: 35 }).map((_, index) => (
                <span key={index} />
              ))}
            </div>
          ) : (
            <div className="availability-grid">
              {Array.from({ length: firstDay }).map((_, index) => (
                <div key={`blank-${index}`} className="availability-blank" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, index) => {
                const day = index + 1;
                const dateStr = toStr(year, month, day);
                const entry = dateMap[dateStr];
                const isPast = dateStr < todayStr;
                const isToday = dateStr === todayStr;
                const isSelected = selected?.date === dateStr;
                const clickable = Boolean(entry && !isPast && entry.status !== "booked");

                return (
                  <button
                    key={dateStr}
                    className="availability-date-button"
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
                    {!isPast && entry && entry.status !== "booked" && !isSelected && <span className="availability-dot" />}
                  </button>
                );
              })}
            </div>
          )}

          <div className="availability-legend">
            {[
              ["Available", "#9ab9b2"],
              ["On hold", "#d6f36a"],
              ["Booked", "#c7d1cc"],
            ].map(([label, color]) => (
              <span key={label} className="availability-status">
                <span style={{ background: color }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <aside className="availability-sidebar" aria-label="Availability details">
          <div className="availability-sidebar-panel">
            <p className="availability-mini-label">{selectedLabel}</p>
            <h2>{selected ? formatDate(selected.date) : "Tap an open date"}</h2>
            <p>
              {selected
                ? selected.note || "This date has been marked for booking. Send the inquiry and I will confirm timing."
                : "Open and hold dates show up with color. If a date is not marked, mention it in your inquiry and I can double-check."}
            </p>
            <Link href="/contact" className="availability-link">
              Start inquiry
            </Link>
          </div>

          <div className="availability-sidebar-panel">
            <p className="availability-mini-label">Next windows</p>
            {upcomingDates.length > 0 ? (
              <div className="availability-upcoming">
                {upcomingDates.map((date) => (
                  <button
                    key={date.id}
                    type="button"
                    onClick={() => {
                      const [nextYear, nextMonth] = date.date.split("-").map(Number);
                      setYear(nextYear);
                      setMonth(nextMonth - 1);
                      setSelected(date);
                    }}
                  >
                    <span>{formatDate(date.date)}</span>
                    <span>{date.status === "available" ? "Open" : "Hold"}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p>New dates are added as the season moves. Send your preferred window and I will check it manually.</p>
            )}
          </div>

          <div className="availability-sidebar-panel">
            <p className="availability-mini-label">Locations</p>
            <h3>SF, Berkeley, Stanford, SJSU, Peninsula, South Bay.</h3>
            <p>Sunset and campus windows are planned around light, walking distance, and how busy the location gets.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
