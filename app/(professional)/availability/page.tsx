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

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function toStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const CSS = `
  .av-day {
    cursor: default;
    border: 1px solid rgba(0,0,0,0.06);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    aspect-ratio: 1;
    transition: transform 0.15s ease;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 0.85rem;
    color: #bbb;
    position: relative;
  }
  .av-day-available {
    cursor: pointer;
    border-color: rgba(0,0,0,0.12);
    color: #1a1a1a;
  }
  .av-day-available:hover { transform: scale(1.06); border-color: #1a1a1a; }
  .av-day-booked { background: rgba(0,0,0,0.02); color: #ddd; }
  .av-day-hold   { cursor: pointer; border-color: rgba(0,0,0,0.1); color: #888; }
  .av-day-hold:hover { transform: scale(1.04); }
  .av-day-today  { border-color: #1a1a1a !important; }
  .av-day-selected { background: #1a1a1a !important; color: #fff !important; }
  .av-nav {
    border: none; background: none; cursor: pointer;
    font-family: Georgia, 'Times New Roman', serif;
    font-size: 1.2rem; color: #bbb; padding: 4px 10px;
    transition: color 0.2s ease;
  }
  .av-nav:hover { color: #111; }
  .av-dot {
    width: 4px; height: 4px; border-radius: 50%;
    position: absolute; bottom: 5px;
  }
`;

export default function AvailabilityPage() {
  const today = new Date();
  const [month, setMonth]     = useState(today.getMonth());
  const [year,  setYear]      = useState(today.getFullYear());
  const [dates, setDates]     = useState<AvailDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AvailDate | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        const { data } = await supabase.from("availability").select("*");
        if (data) setDates(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    fetch();
  }, []);

  const dateMap = dates.reduce((acc, d) => { acc[d.date] = d; return acc; }, {} as Record<string, AvailDate>);
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDay(year, month);
  const todayStr    = toStr(today.getFullYear(), today.getMonth(), today.getDate());
  const availCount  = dates.filter(d => {
    const [y, m] = d.date.split("-").map(Number);
    return d.status === "available" && y === year && m === month + 1;
  }).length;

  const prevMonth = () => { setSelected(null); if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => { setSelected(null); if (month === 11) { setMonth(0);  setYear(y => y + 1); } else setMonth(m => m + 1); };

  return (
    <main style={{ background: "#fff", color: "#1a1a1a", paddingTop: 80 }}>
      <style>{CSS}</style>

      {/* ── HEADER ── */}
      <section style={{ padding: "80px 60px 80px", textAlign: "center" }}>
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "0.7rem", letterSpacing: "0.28em",
          textTransform: "uppercase", color: "#bbb", marginBottom: 20,
        }}>
          Availability
        </p>
        <h1 style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: "clamp(2rem, 5.5vw, 5rem)", fontWeight: 300,
          letterSpacing: "0.06em", color: "#111",
          lineHeight: 1.1, margin: "0 auto 28px", maxWidth: 640,
        }}>
          When I&rsquo;m open.
        </h1>
        <div style={{ width: 36, height: 1, background: "rgba(0,0,0,0.12)", margin: "0 auto 28px" }} />
        <p style={{
          fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic",
          fontSize: "1rem", color: "#aaa", maxWidth: 440, margin: "0 auto", lineHeight: 1.7,
        }}>
          Grad season books up fast. Check my open dates and reach out to lock one in.
        </p>
      </section>

      {/* ── CALENDAR + INFO ── */}
      <section style={{ padding: "0 60px 120px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "60px", alignItems: "start" }}>

          {/* Calendar */}
          <div style={{ border: "1px solid rgba(0,0,0,0.08)" }}>
            {/* Calendar header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "20px 24px",
              borderBottom: "1px solid rgba(0,0,0,0.07)",
            }}>
              <button className="av-nav" onClick={prevMonth} aria-label="Previous month">‹</button>
              <div style={{ textAlign: "center" }}>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "1.1rem", fontWeight: 400, letterSpacing: "0.08em",
                  textTransform: "uppercase", color: "#111", margin: "0 0 2px",
                }}>
                  {MONTHS[month]}
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "0.72rem", letterSpacing: "0.16em",
                  textTransform: "uppercase", color: "#bbb", margin: 0,
                }}>
                  {year} {availCount > 0 && `· ${availCount} open`}
                </p>
              </div>
              <button className="av-nav" onClick={nextMonth} aria-label="Next month">›</button>
            </div>

            {/* Day labels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid rgba(0,0,0,0.06)", background: "#fafaf8" }}>
              {DAYS.map(d => (
                <div key={d} style={{
                  padding: "10px 0", textAlign: "center",
                  fontFamily: "var(--font-dm-sans), sans-serif",
                  fontSize: "0.6rem", letterSpacing: "0.18em",
                  textTransform: "uppercase", color: "#ccc",
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day grid */}
            <div style={{ padding: 12 }}>
              {loading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                  {Array.from({ length: 35 }).map((_, i) => (
                    <div key={i} style={{ aspectRatio: "1", background: "#f5f5f5" }} />
                  ))}
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`e${i}`} className="av-day" style={{ opacity: 0, border: "none" }} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = toStr(year, month, day);
                    const entry = dateMap[dateStr];
                    const isPast = dateStr < todayStr;
                    const isToday = dateStr === todayStr;
                    const isSel = selected?.date === dateStr;

                    let cls = "av-day ";
                    if (isPast) cls += "av-day-booked ";
                    else if (entry?.status === "available") cls += "av-day-available ";
                    else if (entry?.status === "booked")    cls += "av-day-booked ";
                    else if (entry?.status === "hold")      cls += "av-day-hold ";
                    if (isToday) cls += "av-day-today ";
                    if (isSel)   cls += "av-day-selected ";

                    return (
                      <div
                        key={day}
                        className={cls}
                        role={entry && !isPast ? "button" : undefined}
                        tabIndex={entry && !isPast ? 0 : undefined}
                        onClick={() => { if (entry && !isPast) setSelected(isSel ? null : entry); }}
                        onKeyDown={(e) => { if (e.key === "Enter" && entry && !isPast) setSelected(isSel ? null : entry); }}
                        aria-label={`${MONTHS[month]} ${day}${entry ? ` — ${entry.status}` : ""}`}
                      >
                        <span style={{ fontSize: "0.8rem" }}>{day}</span>
                        {!isPast && entry?.status === "available" && !isSel && (
                          <span className="av-dot" style={{ background: "#1a1a1a" }} />
                        )}
                        {!isPast && entry?.status === "hold" && !isSel && (
                          <span className="av-dot" style={{ background: "#bbb" }} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legend */}
            <div style={{
              borderTop: "1px solid rgba(0,0,0,0.07)",
              padding: "14px 24px",
              display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap",
            }}>
              {[
                { label: "Available", dot: "#1a1a1a" },
                { label: "On hold",   dot: "#bbb" },
                { label: "Booked",    dot: "rgba(0,0,0,0.08)" },
              ].map(({ label, dot }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: dot, flexShrink: 0, border: "1px solid rgba(0,0,0,0.1)" }} />
                  <span style={{
                    fontFamily: "var(--font-dm-sans), sans-serif",
                    fontSize: "0.65rem", letterSpacing: "0.16em",
                    textTransform: "uppercase", color: "#bbb",
                  }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ paddingTop: 8 }}>
            {/* Selected date */}
            {selected ? (
              <div style={{ border: "1px solid rgba(0,0,0,0.08)", padding: "28px 24px", marginBottom: 32 }}>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "0.65rem", letterSpacing: "0.22em",
                  textTransform: "uppercase", color: "#ccc", marginBottom: 12,
                }}>
                  {selected.status === "available" ? "Open" : "On hold"}
                </p>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "1.1rem", fontWeight: 400, color: "#111", marginBottom: 8,
                }}>
                  {new Date(selected.date + "T12:00:00").toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                </p>
                {selected.note && (
                  <p style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontStyle: "italic", fontSize: "0.88rem",
                    color: "#aaa", lineHeight: 1.6, marginBottom: 0,
                  }}>
                    {selected.note}
                  </p>
                )}
              </div>
            ) : (
              <div style={{ border: "1px solid rgba(0,0,0,0.07)", padding: "28px 24px", marginBottom: 32 }}>
                <p style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontStyle: "italic", fontSize: "0.9rem",
                  color: "#ccc", lineHeight: 1.7,
                }}>
                  Tap any date on the calendar to see its status.
                </p>
              </div>
            )}

            <div style={{ marginBottom: 36 }}>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.65rem", letterSpacing: "0.22em",
                textTransform: "uppercase", color: "#ccc", marginBottom: 14,
              }}>
                Locations
              </p>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic", fontSize: "0.95rem",
                color: "#888", lineHeight: 1.75,
              }}>
                SF · Berkeley · Stanford · SJSU · Peninsula · South Bay · Beaches
              </p>
            </div>

            <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 32 }}>
              <p style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic", fontSize: "0.95rem",
                color: "#888", lineHeight: 1.75, marginBottom: 24,
              }}>
                See a date that works? Reach out and we&rsquo;ll lock it in before someone else does.
              </p>
              <Link href="/contact" style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "0.72rem", letterSpacing: "0.18em",
                textTransform: "uppercase", color: "#fff",
                background: "#1a1a1a", padding: "13px 28px",
                textDecoration: "none", display: "inline-block",
              }}>
                Book your session →
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
