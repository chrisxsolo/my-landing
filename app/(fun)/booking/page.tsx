"use client";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import { C } from "@/lib/colors";
import Link from "next/link";

export const dynamic = "force-dynamic";

type AvailDate = { id: number; date: string; status: "available" | "booked" | "hold"; note: string | null; };

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const CLIENT_PORTAL_HREF = "/login";

function getDaysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function getFirstDay(y: number, m: number)    { return new Date(y, m, 1).getDay(); }
function toStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export default function BookingPage() {
  const today = new Date();
  const [month, setMonth]   = useState(today.getMonth());
  const [year,  setYear]    = useState(today.getFullYear());
  const [dates, setDates]   = useState<AvailDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AvailDate | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const { data } = await supabase.from("availability").select("*");
        if (data) setDates(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  // Inject a <link> tag so AI web-fetchers can discover the machine-readable endpoint
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "alternate";
    link.type = "application/json";
    link.href = "/api/availability";
    link.title = "Chris Solorzano shoot availability (JSON)";
    document.head.appendChild(link);
    return () => link.remove();
  }, []);

  const dateMap   = dates.reduce((acc, d) => { acc[d.date] = d; return acc; }, {} as Record<string, AvailDate>);
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
    <div className="min-h-screen font-sans pb-20" style={{ background: "#f8f7ff" }}>
      {/* AI / no-JS fallback */}
      <noscript>
        <p style={{ padding: "16px", fontFamily: "sans-serif", fontSize: "14px" }}>
          This calendar requires JavaScript to display dates.
          For machine-readable availability data, fetch{" "}
          <a href="/api/availability">https://soloxsnaps.com/api/availability</a>
          {" "}— it returns JSON with all open, hold, and booked dates plus a plain-English summary.
        </p>
      </noscript>
      <style>{`
        .bk-day { cursor: default; border-radius: 14px; display: flex; flex-direction: column; align-items: center; justify-content: center; aspect-ratio: 1; transition: transform 0.12s ease; position: relative; }
        .bk-avail { cursor: pointer; background: ${C.p1_15}; border: 1.5px solid ${C.p1_35}; }
        .bk-avail:hover { transform: scale(1.08); }
        .bk-booked { background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.07); }
        .bk-hold   { cursor: pointer; background: ${C.p3_15}; border: 1.5px solid ${C.p3_30}; }
        .bk-hold:hover { transform: scale(1.06); }
        .bk-none   { background: white; border: 1px solid rgba(0,0,0,0.07); }
        .bk-past   { opacity: 0.25; }
        .bk-today  { outline: 2px solid ${C.p1}; outline-offset: 1px; }
        .bk-sel    { background: ${C.p1} !important; border-color: ${C.p1} !important; }
      `}</style>

      {/* Header */}
      <div className="pt-8 pb-6 px-6 text-center">
        <p className="text-xs font-black uppercase tracking-[0.22em] mb-3" style={{ color: C.p1 }}>Availability</p>
        <h1 className="text-3xl font-black text-slate-900 mb-2">When I&apos;m open.</h1>
        <p className="text-sm font-medium text-slate-500 max-w-xs mx-auto leading-relaxed">
          Grad season books up fast. Check my open dates and reach out to lock one in.
        </p>
      </div>

      <div className="max-w-lg mx-auto px-4 space-y-4">

        {/* Calendar */}
        <div className="rounded-3xl overflow-hidden shadow-lg" style={{ border: `1px solid ${C.p1_15}` }}>
          {/* Month header */}
          <div className="relative p-5 text-white" style={{ background: C.grad12 }}>
            <div className="flex items-center justify-between">
              <button onClick={prevMonth} className="w-9 h-9 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center font-black text-xl">‹</button>
              <div className="text-center">
                <p className="font-black text-lg">{MONTHS[month]} {year}</p>
                {availCount > 0 && <p className="text-xs font-bold opacity-75 mt-0.5">{availCount} date{availCount !== 1 ? "s" : ""} open</p>}
              </div>
              <button onClick={nextMonth} className="w-9 h-9 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center font-black text-xl">›</button>
            </div>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 bg-white/50 border-b" style={{ borderColor: `${C.p1_08}` }}>
            {DAYS.map(d => (
              <div key={d} className="py-2.5 text-center text-[10px] font-black tracking-widest uppercase text-slate-400">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="p-3 bg-white">
            {loading ? (
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: 35 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: C.p1_08 }} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} className="aspect-square" />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = toStr(year, month, day);
                  const entry = dateMap[dateStr];
                  const isPast  = dateStr < todayStr;
                  const isToday = dateStr === todayStr;
                  const isSel   = selected?.date === dateStr;

                  let cls = "bk-day ";
                  if (isPast) cls += "bk-none bk-past ";
                  else if (isSel) cls += "bk-sel ";
                  else if (entry?.status === "available") cls += "bk-avail ";
                  else if (entry?.status === "booked")    cls += "bk-booked ";
                  else if (entry?.status === "hold")      cls += "bk-hold ";
                  else cls += "bk-none ";
                  if (isToday) cls += "bk-today ";

                  const textColor = isPast ? "#cbd5e1" : isSel ? "white" :
                    entry?.status === "available" ? C.p1 :
                    entry?.status === "booked"    ? "#94a3b8" :
                    entry?.status === "hold"      ? C.p3 : "#64748b";

                  return (
                    <button
                      key={day}
                      className={cls}
                      disabled={isPast}
                      onClick={() => { if (entry && !isPast) setSelected(isSel ? null : entry); }}
                      aria-label={`${MONTHS[month]} ${day}${entry ? ` — ${entry.status}` : ""}`}
                    >
                      <span className="text-xs font-black" style={{ color: textColor }}>{day}</span>
                      {!isPast && !isSel && entry?.status === "available" && (
                        <span className="w-1 h-1 rounded-full mt-0.5" style={{ background: C.p1 }} />
                      )}
                      {!isPast && !isSel && entry?.status === "hold" && (
                        <span className="w-1 h-1 rounded-full mt-0.5" style={{ background: C.p3 }} />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex gap-4 justify-center flex-wrap py-3 px-4 border-t" style={{ borderColor: C.p1_08, background: C.p1_04 }}>
            {[
              { label: "Available", bg: C.p1_15, border: C.p1_35, color: C.p1 },
              { label: "On hold",   bg: C.p3_15,  border: C.p3_30,  color: C.p3 },
              { label: "Booked",   bg: "rgba(0,0,0,0.04)", border: "rgba(0,0,0,0.07)", color: "#94a3b8" },
            ].map(({ label, bg, border, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-md flex-shrink-0" style={{ background: bg, border: `1.5px solid ${border}` }} />
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected date detail */}
        {selected ? (
          <div className="rounded-3xl p-5" style={{ background: "white", border: `1.5px solid ${selected.status === "available" ? C.p1_35 : C.p3_30}` }}>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-1" style={{ color: selected.status === "available" ? C.p1 : C.p3 }}>
              {selected.status === "available" ? "Open date" : "On hold"}
            </p>
            <p className="text-base font-black text-slate-900 mb-1">
              {new Date(selected.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            {selected.note && (
              <p className="text-sm font-medium text-slate-500 leading-relaxed">{selected.note}</p>
            )}
          </div>
        ) : (
          <div className="rounded-3xl p-5 text-center" style={{ background: "white", border: `1px solid ${C.p1_12}` }}>
            <p className="text-sm font-medium text-slate-400">Tap any date to see its status.</p>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-3xl p-5" style={{ background: "white", border: `1px solid ${C.p1_12}` }}>
          <p className="text-xs font-black uppercase tracking-[0.18em] mb-2" style={{ color: C.p1 }}>See a date that works?</p>
          <p className="text-sm font-medium text-slate-600 leading-relaxed mb-4">
            Reach out and we&apos;ll lock it in before someone else does. Bay Area — SF, Berkeley, SJSU, Stanford, South Bay.
          </p>
          <a
            href="https://www.soloxsnaps.com/contact/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-3 rounded-full text-sm font-black text-white"
            style={{ background: C.grad12 }}
          >
            Book your session →
          </a>
          <div
            className="mt-4 rounded-2xl border px-4 py-3"
            style={{ background: C.surfaceWarm, borderColor: C.borderSubtle }}
          >
            <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: C.p1 }}>
              Already booked?
            </p>
            <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
              Log in with Google to see your session progress, delivery estimate, and gallery link when it is ready.
            </p>
            <Link
              href={CLIENT_PORTAL_HREF}
              className="mt-3 inline-flex rounded-full px-5 py-2.5 text-sm font-black text-white"
              style={{ background: C.grad12, boxShadow: C.shadowWarmSm }}
            >
              Log in / create account
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
