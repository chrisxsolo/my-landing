"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from "react";

export const dynamic = 'force-dynamic'  // ← ADD THIS
type AvailDate = {
  id: number;
  date: string; // "YYYY-MM-DD"
  status: "available" | "booked" | "hold";
  note: string | null;
};

const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const MARQUEE = ["Available Now","Book Early","Bay Area","Grad Season","Limited Dates","Golden Hour","SJSU · Berkeley · SF State","Available Now","Book Early","Bay Area","Grad Season","Limited Dates","Golden Hour","SJSU · Berkeley · SF State"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

export default function AvailabilityPage() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear]   = useState(today.getFullYear());
  const [dates, setDates] = useState<AvailDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AvailDate | null>(null);

  useEffect(() => {
    async function fetchDates() {
      try {
        const { data, error } = await supabase
          .from('availability')
          .select('*')
        if (error) console.error(error)
        if (data) setDates(data)
      } catch(err) { console.error(err) }
      finally { setLoading(false) }
    }
    fetchDates()
  }, [])

  const dateMap = dates.reduce((acc, d) => {
    acc[d.date] = d
    return acc
  }, {} as Record<string, AvailDate>)

  const daysInMonth  = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
    setSelected(null);
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
    setSelected(null);
  }

  const availCount = dates.filter(d => {
    const [y,m] = d.date.split("-").map(Number)
    return d.status === "available" && y === year && m === month + 1
  }).length

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{GUIDE_STYLES}{`
        .day-btn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .day-btn:hover { transform: scale(1.08); }
        .day-available { background: linear-gradient(135deg,rgba(124,58,237,0.12),rgba(219,39,119,0.08)); border: 1.5px solid rgba(124,58,237,0.3); cursor: pointer; }
        .day-available:hover { box-shadow: 0 4px 16px rgba(124,58,237,0.2); }
        .day-booked { background: rgba(0,0,0,0.04); border: 1.5px solid rgba(0,0,0,0.08); cursor: default; }
        .day-hold { background: linear-gradient(135deg,rgba(245,158,11,0.1),rgba(219,39,119,0.06)); border: 1.5px solid rgba(245,158,11,0.3); cursor: pointer; }
        .day-empty { background: transparent; border: 1px solid rgba(0,0,0,0.05); cursor: default; }
        .day-today { box-shadow: 0 0 0 2px #7c3aed; }
        .day-selected { box-shadow: 0 0 0 3px #db2777 !important; transform: scale(1.1) !important; }
        .cal-nav { transition: background 0.15s ease; }
        .cal-nav:hover { background: rgba(124,58,237,0.08); }
      `}</style>

      {/* NAVBAR */}
      <nav className="af sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]" style={{background:"rgba(255,255,255,0.9)"}}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Chris.</Link>
          <Link href="/" className="text-sm font-bold text-slate-700 hover:text-slate-400 transition-colors">← Back to hub</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-16 pb-14 border-b border-black/[0.06]">
        <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(124,58,237,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(124,58,237,0.04) 1px,transparent 1px)`,backgroundSize:"40px 40px"}}/>
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at 50% 50%,transparent 30%,white 78%)"}}/>
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{borderTop:"2px solid rgba(124,58,237,0.3)",borderLeft:"2px solid rgba(124,58,237,0.3)"}}/>
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{borderTop:"2px solid rgba(219,39,119,0.3)",borderRight:"2px solid rgba(219,39,119,0.3)"}}/>
        <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{borderBottom:"2px solid rgba(219,39,119,0.3)",borderLeft:"2px solid rgba(219,39,119,0.3)"}}/>
        <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{borderBottom:"2px solid rgba(245,158,11,0.3)",borderRight:"2px solid rgba(245,158,11,0.3)"}}/>
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}/>
        <div className="pdot absolute bottom-8 left-8 w-1.5 h-1.5 rounded-full pointer-events-none" style={{background:"linear-gradient(135deg,#db2777,#f59e0b)",animationDelay:"1s"}}/>
        <div className="blob1 absolute rounded-full pointer-events-none" style={{width:500,height:500,top:-130,left:-110,background:"radial-gradient(circle,rgba(124,58,237,0.12),transparent 70%)"}}/>
        <div className="blob2 absolute rounded-full pointer-events-none" style={{width:380,height:380,top:-70,right:-90,background:"radial-gradient(circle,rgba(219,39,119,0.09),transparent 70%)"}}/>

        {/* Squiggle */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{opacity:0.4,animation:"fadeIn 1s 0.6s ease both"}}>
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <defs><linearGradient id="avsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#7c3aed"/><stop offset="50%" stopColor="#db2777"/><stop offset="100%" stopColor="#f59e0b"/></linearGradient></defs>
            <path className="sqp1" d="M50 6 C74 20,26 42,50 66 C74 90,26 112,50 136 C74 160,26 178,50 196" stroke="url(#avsg)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path className="sqp2" d="M30 20 C54 34,6 56,30 80 C54 104,6 126,30 150 C54 174,6 190,30 198" stroke="#db2777" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3"/>
            <circle cx="50" cy="6"   r="2.5" fill="#7c3aed" opacity="0.8"/>
            <circle cx="50" cy="66"  r="2.5" fill="#db2777" opacity="0.8"/>
            <circle cx="50" cy="136" r="2.5" fill="#f59e0b" opacity="0.8"/>
            <circle cx="50" cy="196" r="2.5" fill="#7c3aed" opacity="0.8"/>
          </svg>
        </div>
        <div className="spin absolute -bottom-10 -left-10 pointer-events-none hidden sm:block" style={{opacity:0.08}}>
          <svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="60" stroke="#7c3aed" strokeWidth="1" fill="none" strokeDasharray="8 6"/></svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.2)"}}>
            <div className="pdot w-1.5 h-1.5 rounded-full" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}/>
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-violet-700">Shoot Availability</p>
          </div>
          <h1 className="afu2 text-5xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 mb-2">
            When I'm
          </h1>
          <p className="afu3 text-5xl sm:text-6xl font-light italic tracking-tight text-slate-900 mb-6">
            <span style={{background:"linear-gradient(135deg,#7c3aed,#db2777,#f59e0b)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>available.</span>
            <span className="cblink inline-block w-[3px] h-[44px] sm:h-[52px] ml-1.5 rounded-sm align-middle" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}/>
          </p>
          <p className="afu4 text-lg text-slate-600 font-light leading-relaxed max-w-md mx-auto">
            Grad season books up fast. Check my open dates below and reach out to lock one in.
          </p>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-b border-black/[0.06] py-3">
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {MARQUEE.map((item,i) => (
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-300">
              {item}<span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}/>
            </span>
          ))}
        </div>
      </div>

      {/* CALENDAR */}
      <section className="px-6 py-14">
        <div className="max-w-2xl mx-auto">

          {/* Calendar card */}
          <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(124,58,237,0.15)",boxShadow:"0 20px 60px rgba(124,58,237,0.08)"}}>

            {/* Calendar header */}
            <div className="relative p-6 pb-5" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}>
              <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:"20px 20px"}}/>
              <div className="relative z-10 flex items-center justify-between">
                <button onClick={prevMonth} className="cal-nav w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-lg">‹</button>
                <div className="text-center">
                  <p className="text-white font-black text-xl tracking-tight">{MONTHS[month]}</p>
                  <p className="text-white/60 text-sm font-medium">{year}</p>
                </div>
                <button onClick={nextMonth} className="cal-nav w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-lg">›</button>
              </div>
              {/* Available count badge */}
              {availCount > 0 && (
                <div className="relative z-10 mt-3 text-center">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-white inline-block"/>
                    {availCount} date{availCount !== 1 ? "s" : ""} open this month
                  </span>
                </div>
              )}
            </div>

            {/* Day labels */}
            <div className="grid grid-cols-7 border-b border-black/[0.06]" style={{background:"rgba(124,58,237,0.03)"}}>
              {DAYS.map(d => (
                <div key={d} className="py-2.5 text-center text-[10px] font-black tracking-widest uppercase text-slate-400">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="p-4 bg-white">
              {loading ? (
                <div className="grid grid-cols-7 gap-1.5">
                  {[...Array(35)].map((_,i) => (
                    <div key={i} className="aspect-square rounded-xl animate-pulse" style={{background:"linear-gradient(135deg,#ede9fe,#fce7f3)"}}/>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1.5">
                  {/* Empty cells before month start */}
                  {[...Array(firstDayOfMonth)].map((_,i) => (
                    <div key={`e${i}`} className="aspect-square rounded-xl day-btn day-empty"/>
                  ))}

                  {/* Day cells */}
                  {[...Array(daysInMonth)].map((_,i) => {
                    const day    = i + 1;
                    const dateStr = toDateStr(year, month, day);
                    const entry  = dateMap[dateStr];
                    const isToday = dateStr === toDateStr(today.getFullYear(), today.getMonth(), today.getDate());
                    const isPast  = new Date(dateStr) < new Date(toDateStr(today.getFullYear(), today.getMonth(), today.getDate()));
                    const isSel   = selected?.date === dateStr;

                    let cls = "day-btn aspect-square rounded-xl flex flex-col items-center justify-center ";
                    if (isPast) {
                      cls += "day-empty opacity-30 ";
                    } else if (entry?.status === "available") {
                      cls += "day-available ";
                    } else if (entry?.status === "booked") {
                      cls += "day-booked ";
                    } else if (entry?.status === "hold") {
                      cls += "day-hold ";
                    } else {
                      cls += "day-empty ";
                    }
                    if (isToday) cls += "day-today ";
                    if (isSel) cls += "day-selected ";

                    return (
                      <button
                        key={day}
                        className={cls}
                        onClick={() => {
                          if (entry && !isPast) setSelected(isSel ? null : entry)
                        }}
                      >
                        <span className={`text-xs font-black leading-none ${
                          entry?.status === "available" ? "text-violet-700" :
                          entry?.status === "booked"    ? "text-slate-400"  :
                          entry?.status === "hold"      ? "text-amber-700"  :
                          isPast ? "text-slate-300" : "text-slate-500"
                        }`}>
                          {day}
                        </span>
                        {entry?.status === "available" && !isPast && (
                          <span className="w-1 h-1 rounded-full mt-0.5" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}/>
                        )}
                        {entry?.status === "hold" && !isPast && (
                          <span className="w-1 h-1 rounded-full mt-0.5 bg-amber-400"/>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="px-4 pb-4 flex flex-wrap gap-4 justify-center">
              {[
                {label:"Available",dot:"linear-gradient(135deg,#7c3aed,#db2777)"},
                {label:"On hold",dot:"#f59e0b"},
                {label:"Booked",dot:"#e2e8f0"},
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:l.dot}}/>
                  <span className="text-xs font-semibold text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected date detail */}
          {selected && (
            <div className="mt-4 rounded-2xl p-5 overflow-hidden relative" style={{border:"1.5px solid rgba(124,58,237,0.25)",background:"linear-gradient(135deg,rgba(124,58,237,0.05),rgba(219,39,119,0.03))"}}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}>
                  <span className="text-white text-sm font-black">{new Date(selected.date + "T12:00:00").getDate()}</span>
                </div>
                <div className="flex-1">
                  <p className="font-black text-slate-900 text-sm">
                    {new Date(selected.date + "T12:00:00").toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}
                  </p>
                  <p className="text-xs font-semibold mt-0.5" style={{color: selected.status === "available" ? "#7c3aed" : "#d97706"}}>
                    {selected.status === "available" ? "✓ Available" : "⏳ On hold — reach out to check"}
                  </p>
                  {selected.note && <p className="text-slate-600 text-xs mt-1 leading-relaxed">{selected.note}</p>}
                </div>
              </div>
            </div>
          )}

          {/* Book CTA */}
          <div className="mt-8 rounded-2xl p-8 text-white text-center relative overflow-hidden" style={{background:"linear-gradient(135deg,#7c3aed,#db2777,#f59e0b)"}}>
            <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:"24px 24px"}}/>
            <div className="absolute top-3 right-4 opacity-15 pointer-events-none">
              <svg width="40" height="64" viewBox="0 0 40 64" fill="none"><path d="M20 4 C30 14,10 24,20 36 C30 48,10 56,20 62" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
            </div>
            <h3 className="relative text-xl font-black mb-1">See a date that works?</h3>
            <p className="relative text-white/75 text-sm mb-5 font-light">Reach out and we'll lock it in before someone else does.</p>
            <a href="https://www.soloxsnaps.com/contact/" className="btn-lift relative inline-block px-7 py-3 rounded-full bg-white font-bold text-sm" style={{color:"#7c3aed"}}>
              Book your shoot →
            </a>
          </div>

        </div>
      </section>

      <footer className="border-t border-black/[0.06] bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}