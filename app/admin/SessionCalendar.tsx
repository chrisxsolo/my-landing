"use client";
import { useState } from "react";
import { C } from "@/lib/colors";

type Session = {
  id: number;
  name: string;
  session_type: string | null;
  session_date: string;
  payment_status: string | null;
  booking_confirmed: boolean | null;
};

type Props = { sessions: Session[]; onClientClick: () => void; onReschedule?: (id: number, newDate: string) => Promise<void>; onRemindersClick?: (id: number) => void; remindersLoading?: Record<number,boolean>; remindersOpen?: Record<number,boolean> };

const GRAD_COLOR  = { grad: "linear-gradient(135deg,#34d399,#059669)", text: "#059669", bg: "rgba(52,211,153,0.13)" };
const TODAY_COLOR = { grad: "linear-gradient(135deg,#a78bfa,#7c3aed)", text: "#7c3aed", bg: "rgba(167,139,250,0.13)" };
const OTHER_COLORS = [
  { grad: "linear-gradient(135deg,#60a5fa,#2563eb)", text: "#2563eb", bg: "rgba(96,165,250,0.13)" },
  { grad: "linear-gradient(135deg,#f472b6,#db2777)", text: "#db2777", bg: "rgba(244,114,182,0.13)" },
  { grad: "linear-gradient(135deg,#fb923c,#ea580c)", text: "#ea580c", bg: "rgba(251,146,60,0.13)" },
  { grad: "linear-gradient(135deg,#38bdf8,#0284c7)", text: "#0284c7", bg: "rgba(56,189,248,0.13)" },
];

function isGrad(session_type: string | null): boolean {
  if (!session_type) return false;
  const t = session_type.toLowerCase();
  return t.includes("grad") || t.includes("graduation") || t.includes("senior");
}

function colorFor(s: Session): typeof GRAD_COLOR {
  if (isGrad(s.session_type)) return GRAD_COLOR;
  return OTHER_COLORS[s.id % OTHER_COLORS.length];
}

export default function SessionCalendar({ sessions, onClientClick, onReschedule, onRemindersClick, remindersLoading = {}, remindersOpen = {} }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected]   = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<number | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);

  const monthStart  = new Date(viewYear, viewMonth, 1);
  const monthEnd    = new Date(viewYear, viewMonth + 1, 0);
  const startPad    = monthStart.getDay(); // 0=Sun
  const totalCells  = Math.ceil((startPad + monthEnd.getDate()) / 7) * 7;

  // Map session_date → sessions
  const byDate = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!byDate.has(s.session_date)) byDate.set(s.session_date, []);
    byDate.get(s.session_date)!.push(s);
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelected(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelected(null);
  };

  const selectedSessions = selected ? (byDate.get(selected) ?? []) : [];
  const monthName = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Sessions this month for the mini legend
  const thisMonthSessions = sessions.filter(s => {
    const d = new Date(s.session_date + "T12:00:00");
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{
        background: "linear-gradient(145deg,rgba(255,255,255,0.85),rgba(248,247,255,0.95))",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(167,139,250,0.2)",
        boxShadow: "0 8px 32px rgba(124,58,237,0.08), 0 1px 0 rgba(255,255,255,0.8) inset",
      }}>

      {/* Top gradient bar */}
      <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#a78bfa,#7c3aed,#6366f1)" }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-xs font-black uppercase tracking-widest mb-0.5" style={{ color: "#7c3aed" }}>
              📸 Session Calendar
            </p>
            <p className="text-lg font-black text-slate-900">{monthName}</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs font-bold text-slate-400 mr-1">{thisMonthSessions.length} session{thisMonthSessions.length !== 1 ? "s" : ""}</span>
            <button onClick={prevMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-violet-50 transition-colors font-bold">
              ‹
            </button>
            <button
              onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelected(null); }}
              className="text-[10px] font-black px-2.5 py-1 rounded-lg transition-colors"
              style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed" }}>
              Today
            </button>
            <button onClick={nextMonth}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-500 hover:bg-violet-50 transition-colors font-bold">
              ›
            </button>
          </div>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: totalCells }).map((_, i) => {
            const dayNum = i - startPad + 1;
            if (dayNum < 1 || dayNum > monthEnd.getDate()) {
              return <div key={i} className="aspect-square" />;
            }

            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const daySessions = byDate.get(dateStr) ?? [];
            const isToday    = dateStr === todayStr;
            const isSelected = dateStr === selected;
            const hasSessions = daySessions.length > 0;
            const isPast     = dateStr < todayStr;
            const firstColor = hasSessions ? colorFor(daySessions[0]) : null;

            return (
              <button
                key={i}
                onClick={() => setSelected(isSelected ? null : hasSessions ? dateStr : null)}
                className="aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all"
                style={{
                  background: isSelected
                    ? (isToday ? TODAY_COLOR.grad : firstColor?.grad ?? TODAY_COLOR.grad)
                    : isToday
                      ? TODAY_COLOR.bg
                      : hasSessions
                        ? firstColor!.bg
                        : "transparent",
                  border: isToday && !isSelected
                    ? `2px solid ${TODAY_COLOR.text}`
                    : "1.5px solid transparent",
                  cursor: hasSessions ? "pointer" : "default",
                  boxShadow: isSelected ? "0 4px 12px rgba(124,58,237,0.25)" : isToday ? "0 0 0 3px rgba(124,58,237,0.12)" : "none",
                }}
              >
                <span
                  className="text-xs font-bold leading-none"
                  style={{
                    color: isSelected
                      ? "#fff"
                      : isToday
                        ? TODAY_COLOR.text
                        : hasSessions
                          ? firstColor!.text
                          : isPast
                            ? "#cbd5e1"
                            : "#475569",
                    fontWeight: isToday || hasSessions ? 900 : 600,
                  }}>
                  {dayNum}
                </span>

                {/* Session dots */}
                {hasSessions && !isSelected && (
                  <div className="flex gap-0.5 mt-0.5">
                    {daySessions.slice(0, 3).map((s, di) => (
                      <div
                        key={di}
                        className="w-1 h-1 rounded-full"
                        style={{ background: colorFor(s).text }}
                      />
                    ))}
                  </div>
                )}

                {/* Multiple sessions badge */}
                {isSelected && daySessions.length > 1 && (
                  <span className="text-[8px] font-black text-white/80 leading-none mt-0.5">
                    ×{daySessions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selected && selectedSessions.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">
              {new Date(selected + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            {selectedSessions.map(s => {
              const col = colorFor(s);
              const isPaid = s.payment_status === "paid";
              const isRescheduling = reschedulingId === s.id;

              function startReschedule() {
                // Pre-fill with the existing date+time (datetime-local format)
                const existing = s.session_date ? (() => {
                  const d = new Date(s.session_date + "T12:00:00");
                  const pad = (n: number) => String(n).padStart(2, "0");
                  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T12:00`;
                })() : "";
                setRescheduleValue(existing);
                setReschedulingId(s.id);
              }

              async function confirmReschedule() {
                if (!rescheduleValue || !onReschedule) return;
                setRescheduleLoading(true);
                await onReschedule(s.id, rescheduleValue);
                setRescheduleLoading(false);
                setReschedulingId(null);
              }

              return (
                <div
                  key={s.id}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: "rgba(255,255,255,0.9)",
                    border: "1px solid rgba(167,139,250,0.15)",
                    boxShadow: "0 2px 8px rgba(124,58,237,0.06)",
                  }}>
                  <div className="flex items-center gap-3 p-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0"
                      style={{ background: col.grad }}>
                      📸
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{s.name}</p>
                      <p className="text-xs text-slate-400 truncate">{s.session_type || "Session"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isPaid && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                          style={{ background: "rgba(16,185,129,0.1)", color: "#059669" }}>
                          Paid ✓
                        </span>
                      )}
                      {onReschedule && !isRescheduling && (
                        <button
                          onClick={startReschedule}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                          style={{ background: "rgba(124,58,237,0.08)", color: "#7c3aed" }}>
                          Reschedule
                        </button>
                      )}
                      <button
                        onClick={onClientClick}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg text-white"
                        style={{ background: col.grad }}>
                        View →
                      </button>
                    </div>
                  </div>

                  {isRescheduling && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="rounded-xl p-3" style={{ background: "rgba(124,58,237,0.06)", border: "1px solid rgba(124,58,237,0.15)" }}>
                        <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{ color: "#7c3aed" }}>
                          New date &amp; time
                        </p>
                        <input
                          type="datetime-local"
                          value={rescheduleValue}
                          onChange={e => setRescheduleValue(e.target.value)}
                          className="w-full rounded-lg border px-2.5 py-1.5 text-sm font-semibold outline-none mb-2"
                          style={{ borderColor: "rgba(124,58,237,0.25)", background: "white", color: "#1e293b" }}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={confirmReschedule}
                            disabled={!rescheduleValue || rescheduleLoading}
                            className="flex-1 rounded-lg py-1.5 text-xs font-black text-white disabled:opacity-50"
                            style={{ background: "linear-gradient(135deg,#a78bfa,#7c3aed)" }}>
                            {rescheduleLoading ? "Saving…" : "Save date"}
                          </button>
                          <button
                            onClick={() => setReschedulingId(null)}
                            className="px-3 rounded-lg py-1.5 text-xs font-bold"
                            style={{ background: "rgba(0,0,0,0.05)", color: "#64748b" }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Upcoming sessions strip — next 3 */}
        {!selected && (() => {
          const next3 = sessions
            .filter(s => s.session_date >= todayStr)
            .sort((a, b) => a.session_date.localeCompare(b.session_date))
            .slice(0, 3);
          if (!next3.length) return null;
          return (
            <div className="mt-4 space-y-1.5">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Next Up</p>
              {next3.map(s => {
                const col = colorFor(s);
                const dt  = new Date(s.session_date + "T12:00:00");
                const tomorrowStr = (() => {
                  const d = new Date(today); d.setDate(d.getDate() + 1);
                  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
                })();
                const label = s.session_date === todayStr ? "TODAY" : s.session_date === tomorrowStr ? "TOMORROW" : dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
                const isRescheduling = reschedulingId === s.id;
                return (
                  <div key={s.id} className="rounded-xl overflow-hidden"
                    style={{ background: col.bg, border: `1px solid ${col.bg}` }}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ background: col.grad }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">{s.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">{s.session_type || "Session"}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-black" style={{ color: col.text }}>{label}</span>
                        {onReschedule && (
                          <button
                            onClick={() => {
                              if (isRescheduling) { setReschedulingId(null); setRescheduleValue(""); }
                              else { setReschedulingId(s.id); setRescheduleValue(s.session_date); }
                            }}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                            style={{ background: isRescheduling ? "rgba(99,102,241,0.25)" : "rgba(99,102,241,0.15)", color: "#6366f1" }}>
                            {isRescheduling ? "✕" : "📅"}
                          </button>
                        )}
                        {onRemindersClick && (
                          <button
                            onClick={() => onRemindersClick(s.id)}
                            className="text-[11px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                            style={{ background: remindersOpen[s.id] ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.15)", color: "#d97706" }}>
                            {remindersLoading[s.id] ? "…" : "🔔"}
                          </button>
                        )}
                      </div>
                    </div>
                    {isRescheduling && onReschedule && (
                      <div className="flex items-center gap-2 px-3 pb-2.5">
                        <input
                          type="date"
                          value={rescheduleValue}
                          onChange={e => setRescheduleValue(e.target.value)}
                          className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
                        />
                        <button
                          onClick={async () => {
                            if (!rescheduleValue) return;
                            setRescheduleLoading(true);
                            await onReschedule(s.id, rescheduleValue + "T12:00");
                            setRescheduleLoading(false);
                            setReschedulingId(null);
                            setRescheduleValue("");
                          }}
                          disabled={!rescheduleValue || rescheduleLoading}
                          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-500 text-white disabled:opacity-40 hover:bg-indigo-600 transition-colors">
                          {rescheduleLoading ? "…" : "Save"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
