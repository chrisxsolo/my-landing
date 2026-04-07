"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from "react";

// ── Simple password gate — change this to whatever you want ──────────────────
const ADMIN_PASSWORD = "chris2026";

type AvailDate = {
  id?: number;
  date: string;
  status: "available" | "booked" | "hold";
  note: string | null;
};

const DAYS  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}
function toDateStr(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
}

const STATUS_CYCLE: Record<string, AvailDate["status"]> = {
  "none":      "available",
  "available": "booked",
  "booked":    "hold",
  "hold":      "none" as any,
};

export default function AdminAvailabilityPage() {
  const today = new Date();
  const [authed, setAuthed]   = useState(false);
  const [pw, setPw]           = useState("");
  const [pwErr, setPwErr]     = useState(false);
  const [month, setMonth]     = useState(today.getMonth());
  const [year, setYear]       = useState(today.getFullYear());
  const [dates, setDates]     = useState<AvailDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState<string | null>(null);
  const [toast, setToast]     = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function fetchDates() {
    setLoading(true);
    try {
      const { data } = await supabase.from('availability').select('*')
      if (data) setDates(data)
    } catch(err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    if (authed) fetchDates()
  }, [authed])

  const dateMap = dates.reduce((acc, d) => {
    acc[d.date] = d
    return acc
  }, {} as Record<string, AvailDate>)

  async function toggleDate(dateStr: string) {
    const existing = dateMap[dateStr];
    const currentStatus = existing?.status ?? "none";
    const nextStatus = STATUS_CYCLE[currentStatus];
    setSaving(dateStr);

    if (nextStatus === "none" as any) {
      // Delete the row
      if (existing?.id) {
        await supabase.from('availability').delete().eq('id', existing.id)
        setDates(prev => prev.filter(d => d.date !== dateStr))
        showToast("Date cleared")
      }
    } else if (existing?.id) {
      // Update
      await supabase.from('availability').update({ status: nextStatus }).eq('id', existing.id)
      setDates(prev => prev.map(d => d.date === dateStr ? {...d, status: nextStatus} : d))
      showToast(`Marked as ${nextStatus}`)
    } else {
      // Insert
      const { data } = await supabase.from('availability').insert({
        date: dateStr,
        status: nextStatus,
        note: null,
      }).select().single()
      if (data) setDates(prev => [...prev, data])
      showToast(`Marked as ${nextStatus}`)
    }
    setSaving(null);
  }

  async function updateNote(dateStr: string, note: string) {
    const existing = dateMap[dateStr];
    if (!existing?.id) return;
    await supabase.from('availability').update({ note }).eq('id', existing.id)
    setDates(prev => prev.map(d => d.date === dateStr ? {...d, note} : d))
    showToast("Note saved")
  }

  const daysInMonth     = getDaysInMonth(year, month);
  const firstDayOfMonth = getFirstDayOfMonth(year, month);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  // ── PASSWORD GATE ──────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="font-black text-2xl" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Chris.</span>
            <p className="text-slate-500 text-sm mt-2 font-medium">Availability Admin</p>
          </div>
          <div className="rounded-2xl p-8" style={{border:"1px solid rgba(124,58,237,0.15)",boxShadow:"0 20px 60px rgba(124,58,237,0.08)"}}>
            <div className="h-[3px] rounded-full mb-6" style={{background:"linear-gradient(90deg,#7c3aed,#db2777,#f59e0b)"}}/>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-500 mb-2">Password</label>
            <input
              type="password"
              value={pw}
              onChange={e => { setPw(e.target.value); setPwErr(false); }}
              onKeyDown={e => { if (e.key === "Enter") { if (pw === ADMIN_PASSWORD) setAuthed(true); else setPwErr(true); }}}
              placeholder="Enter password"
              className="w-full px-4 py-3 rounded-xl text-sm font-medium text-slate-900 outline-none mb-4"
              style={{border:`1.5px solid ${pwErr ? "#db2777" : "rgba(124,58,237,0.2)"}`,background:"rgba(124,58,237,0.03)"}}
            />
            {pwErr && <p className="text-xs font-semibold text-pink-600 mb-3">Incorrect password</p>}
            <button
              onClick={() => { if (pw === ADMIN_PASSWORD) setAuthed(true); else setPwErr(true); }}
              className="w-full py-3 rounded-xl font-bold text-sm text-white"
              style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}
            >
              Enter →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── ADMIN UI ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans px-6 py-10" style={{background:"#f8f7ff"}}>
      <style>{`
        .day-admin { transition: transform 0.12s ease, box-shadow 0.12s ease; cursor: pointer; }
        .day-admin:hover { transform: scale(1.06); }
        .d-avail { background: linear-gradient(135deg,rgba(124,58,237,0.15),rgba(219,39,119,0.1)); border: 1.5px solid rgba(124,58,237,0.35); }
        .d-booked { background: rgba(0,0,0,0.06); border: 1.5px solid rgba(0,0,0,0.12); }
        .d-hold { background: linear-gradient(135deg,rgba(245,158,11,0.15),rgba(219,39,119,0.08)); border: 1.5px solid rgba(245,158,11,0.4); }
        .d-none { background: white; border: 1px solid rgba(0,0,0,0.08); }
        .d-past { opacity: 0.3; cursor: not-allowed !important; }
      `}</style>

      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-xl" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}>
          {toast}
        </div>
      )}

      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <span className="font-black text-xl" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Chris.</span>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Availability Admin</p>
          </div>
          <a href="/availability" className="text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors">View public page →</a>
        </div>

        {/* Instructions */}
        <div className="rounded-2xl p-4 mb-6 flex flex-wrap gap-4" style={{background:"white",border:"1px solid rgba(124,58,237,0.12)"}}>
          <p className="text-xs font-bold text-slate-500 w-full mb-1">Click any date to cycle through:</p>
          {[
            {label:"Available",cls:"d-avail",color:"#7c3aed"},
            {label:"Booked",cls:"d-booked",color:"#94a3b8"},
            {label:"On Hold",cls:"d-hold",color:"#d97706"},
            {label:"Clear",cls:"d-none",color:"#94a3b8"},
          ].map(s => (
            <div key={s.label} className={`day-admin px-3 py-1.5 rounded-lg text-xs font-bold ${s.cls}`} style={{color:s.color}}>
              {s.label}
            </div>
          ))}
        </div>

        {/* Calendar */}
        <div className="rounded-2xl overflow-hidden" style={{border:"1px solid rgba(124,58,237,0.15)",boxShadow:"0 12px 40px rgba(124,58,237,0.08)"}}>
          {/* Header */}
          <div className="relative p-5 text-white" style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}>
            <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:"20px 20px"}}/>
            <div className="relative flex items-center justify-between">
              <button onClick={prevMonth} className="w-9 h-9 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center font-bold text-xl">‹</button>
              <p className="font-black text-lg">{MONTHS[month]} {year}</p>
              <button onClick={nextMonth} className="w-9 h-9 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center font-bold text-xl">›</button>
            </div>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7" style={{background:"rgba(124,58,237,0.04)",borderBottom:"1px solid rgba(124,58,237,0.08)"}}>
            {DAYS.map(d => (
              <div key={d} className="py-2 text-center text-[10px] font-black tracking-widest uppercase text-slate-400">{d}</div>
            ))}
          </div>

          {/* Grid */}
          <div className="p-3 bg-white">
            {loading ? (
              <div className="grid grid-cols-7 gap-1.5">
                {[...Array(35)].map((_,i) => <div key={i} className="aspect-square rounded-xl animate-pulse" style={{background:"#ede9fe"}}/>)}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {[...Array(firstDayOfMonth)].map((_,i) => <div key={`e${i}`} className="aspect-square"/>)}
                {[...Array(daysInMonth)].map((_,i) => {
                  const day = i + 1;
                  const dateStr = toDateStr(year, month, day);
                  const entry = dateMap[dateStr];
                  const isPast = new Date(dateStr) < new Date(toDateStr(today.getFullYear(), today.getMonth(), today.getDate()));
                  const isSaving = saving === dateStr;
                  const isToday = dateStr === toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

                  let cls = "day-admin aspect-square rounded-xl flex flex-col items-center justify-center relative ";
                  if (isPast) cls += "d-none d-past ";
                  else if (entry?.status === "available") cls += "d-avail ";
                  else if (entry?.status === "booked")    cls += "d-booked ";
                  else if (entry?.status === "hold")      cls += "d-hold ";
                  else cls += "d-none ";

                  const textColor =
                    isPast ? "#cbd5e1" :
                    entry?.status === "available" ? "#7c3aed" :
                    entry?.status === "booked"    ? "#94a3b8" :
                    entry?.status === "hold"      ? "#d97706" :
                    "#64748b";

                  return (
                    <button
                      key={day}
                      className={cls}
                      disabled={isPast || isSaving}
                      onClick={() => !isPast && toggleDate(dateStr)}
                      style={isToday ? {outline:"2px solid #7c3aed",outlineOffset:"1px"} : {}}
                    >
                      {isSaving ? (
                        <span className="text-[10px] animate-spin">◌</span>
                      ) : (
                        <>
                          <span className="text-xs font-black" style={{color:textColor}}>{day}</span>
                          {entry?.status === "available" && <span className="w-1 h-1 rounded-full mt-0.5" style={{background:"#7c3aed"}}/>}
                          {entry?.status === "hold" && <span className="w-1 h-1 rounded-full mt-0.5 bg-amber-400"/>}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Quick note editor for available dates */}
        {dates.filter(d => {
          const [y,m] = d.date.split("-").map(Number);
          return y === year && m === month + 1 && d.status === "available";
        }).length > 0 && (
          <div className="mt-6 rounded-2xl p-5" style={{background:"white",border:"1px solid rgba(124,58,237,0.12)"}}>
            <p className="text-xs font-black uppercase tracking-widest text-violet-600 mb-3">Add notes to available dates</p>
            <div className="space-y-2">
              {dates
                .filter(d => { const [y,m] = d.date.split("-").map(Number); return y === year && m === month + 1 && d.status === "available"; })
                .sort((a,b) => a.date.localeCompare(b.date))
                .map(d => (
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 w-20 flex-shrink-0">
                      {new Date(d.date + "T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                    </span>
                    <input
                      type="text"
                      defaultValue={d.note ?? ""}
                      placeholder="Optional note (e.g. 'Morning only')"
                      onBlur={e => updateNote(d.date, e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 outline-none"
                      style={{border:"1px solid rgba(124,58,237,0.2)",background:"rgba(124,58,237,0.03)"}}
                    />
                  </div>
                ))
              }
            </div>
          </div>
        )}

        <p className="text-center text-xs text-slate-400 mt-6 font-medium">Changes save instantly to Supabase.</p>
      </div>
    </div>
  );
}