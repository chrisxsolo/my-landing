"use client";
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";

type Session = {
  id: number;
  name: string;
  session_type: string | null;
  session_date: string;
  payment_status: string | null;
  booking_confirmed: boolean | null;
  deposit2Received?: boolean;
};

type Props = {
  sessions: Session[];
  onClientClick: (id: number) => void;
  onReschedule?: (id: number, newDate: string) => Promise<void>;
  onRemindersClick?: (id: number) => void;
  onThankYouClick?: (id: number) => void;
  remindersLoading?: Record<number, boolean>;
  remindersOpen?: Record<number, boolean>;
  onAddEvent?: (date?: string) => void;
  onFinalPayment?: (id: number, amount: string, method: string) => Promise<void>;
  deposit1Amounts?: Map<number, string>;
};

// Session color families on the darkroom palette: grads glow green, today is
// the amber safelight, everything else rotates through the cool accents.
type DayColor = { solid: string; text: string; bg: string };
const GRAD_COLOR: DayColor  = { solid: T.green,  text: T.green,  bg: T.greenBg };
const TODAY_COLOR: DayColor = { solid: T.amber,  text: T.amber,  bg: T.amberBg };
const OTHER_COLORS: DayColor[] = [
  { solid: T.blue,   text: T.blue,   bg: T.blueBg },
  { solid: T.violet, text: T.violet, bg: T.violetBg },
  { solid: T.red,    text: T.red,    bg: T.redBg },
];

function isGrad(session_type: string | null): boolean {
  if (!session_type) return false;
  const t = session_type.toLowerCase();
  return t.includes("grad") || t.includes("graduation") || t.includes("senior");
}

function colorFor(s: Session): DayColor {
  if (isGrad(s.session_type)) return GRAD_COLOR;
  return OTHER_COLORS[s.id % OTHER_COLORS.length];
}

export default function SessionCalendar({
  sessions, onClientClick, onReschedule,
  onRemindersClick, onThankYouClick,
  remindersLoading = {}, remindersOpen = {},
  onAddEvent, onFinalPayment, deposit1Amounts = new Map(),
}: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [viewYear, setViewYear]   = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected, setSelected]   = useState<string | null>(null);
  const [reschedulingId, setReschedulingId] = useState<number | null>(null);
  const [rescheduleValue, setRescheduleValue] = useState("");
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [finalPaymentId, setFinalPaymentId] = useState<number | null>(null);
  const [finalPaymentAmount, setFinalPaymentAmount] = useState("");
  const [finalPaymentMethod, setFinalPaymentMethod] = useState("Venmo");
  const [finalPaymentSaving, setFinalPaymentSaving] = useState(false);

  const monthStart  = new Date(viewYear, viewMonth, 1);
  const monthEnd    = new Date(viewYear, viewMonth + 1, 0);
  const startPad    = monthStart.getDay();
  const totalCells  = Math.ceil((startPad + monthEnd.getDate()) / 7) * 7;

  const byDate = new Map<string, Session[]>();
  for (const s of sessions) {
    if (!byDate.has(s.session_date)) byDate.set(s.session_date, []);
    byDate.get(s.session_date)!.push(s);
  }

  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth()+1).padStart(2,"0")}-${String(tomorrow.getDate()).padStart(2,"0")}`;

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

  const thisMonthSessions = sessions.filter(s => {
    const d = new Date(s.session_date + "T12:00:00");
    return d.getMonth() === viewMonth && d.getFullYear() === viewYear;
  });

  const inputStyle = { background: T.panelSolid, border: `1px solid ${T.borderStrong}`, color: T.ink, colorScheme: "dark" } as const;

  return (
    <div
      className="rounded-3xl overflow-hidden"
      style={{ background: T.panel, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: T.inkSoft, fontFamily: T.mono }}>
              📸 Session Calendar
            </p>
            <p className="text-xl font-semibold leading-none" style={{ color: T.ink, fontFamily: T.display }}>{monthName}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold mr-1 tabular-nums" style={{ color: T.inkFaint, fontFamily: T.mono }}>{thisMonthSessions.length} session{thisMonthSessions.length !== 1 ? "s" : ""}</span>
            {onAddEvent && (
              <button
                onClick={() => onAddEvent()}
                className="text-[10px] font-black px-2.5 py-1.5 rounded-lg transition-all hover:opacity-90"
                style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}
                title="Add event">
                + Add
              </button>
            )}
            {/* Month nav — segmented control */}
            <div className="flex items-center rounded-xl overflow-hidden" style={{ border: `1px solid ${T.border}`, background: T.inset }}>
              <button onClick={prevMonth} className="w-8 h-7 flex items-center justify-center font-bold transition-colors hover:opacity-70" style={{ color: T.inkSoft }}>‹</button>
              <button
                onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); setSelected(null); }}
                className="text-[10px] font-black px-2.5 h-7 transition-colors hover:opacity-70"
                style={{ color: T.amber, borderLeft: `1px solid ${T.rowBorder}`, borderRight: `1px solid ${T.rowBorder}` }}>
                Today
              </button>
              <button onClick={nextMonth} className="w-8 h-7 flex items-center justify-center font-bold transition-colors hover:opacity-70" style={{ color: T.inkSoft }}>›</button>
            </div>
          </div>
        </div>

        {/* Day-of-week header */}
        <div className="grid grid-cols-7 mb-2">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="text-center text-[10px] font-bold uppercase tracking-widest py-1" style={{ color: T.inkFaint, fontFamily: T.mono }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: totalCells }).map((_, i) => {
            const dayNum = i - startPad + 1;
            if (dayNum < 1 || dayNum > monthEnd.getDate()) return <div key={i} className="aspect-square" />;

            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
            const daySessions = byDate.get(dateStr) ?? [];
            const isToday    = dateStr === todayStr;
            const isSelected = dateStr === selected;
            const hasSessions = daySessions.length > 0;
            const isPast     = dateStr < todayStr;
            const firstColor = hasSessions ? colorFor(daySessions[0]) : null;

            const canAdd = onAddEvent && !isPast && !hasSessions;
            return (
              <button
                key={i}
                onClick={() => {
                  if (hasSessions) setSelected(isSelected ? null : dateStr);
                  else if (canAdd) onAddEvent(dateStr);
                }}
                className="aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all group"
                style={{
                  background: isSelected
                    ? (isToday ? TODAY_COLOR.solid : firstColor?.solid ?? TODAY_COLOR.solid)
                    : isToday ? TODAY_COLOR.bg : hasSessions ? firstColor!.bg : "transparent",
                  border: isToday && !isSelected ? `2px solid ${TODAY_COLOR.text}` : "1.5px solid transparent",
                  cursor: hasSessions || canAdd ? "pointer" : "default",
                  boxShadow: isSelected ? T.glow : isToday ? `0 0 0 3px ${T.amberBg}` : "none",
                }}>
                <span
                  className="text-xs leading-none tabular-nums"
                  style={{
                    color: isSelected ? "#15110d" : isToday ? TODAY_COLOR.text : hasSessions ? firstColor!.text : isPast ? T.inkFaint : T.inkSoft,
                    fontWeight: isToday || hasSessions ? 800 : 500,
                    fontFamily: T.mono,
                  }}>
                  {dayNum}
                </span>
                {hasSessions && !isSelected && (
                  <div className="flex gap-0.5 mt-0.5">
                    {daySessions.slice(0, 3).map((s, di) => (
                      <div key={di} className="w-1 h-1 rounded-full" style={{ background: colorFor(s).text, boxShadow: `0 0 4px ${colorFor(s).text}` }} />
                    ))}
                  </div>
                )}
                {canAdd && (
                  <span className="text-[8px] font-black opacity-0 group-hover:opacity-60 transition-opacity leading-none mt-0.5" style={{ color: T.amber }}>+</span>
                )}
                {isSelected && daySessions.length > 1 && (
                  <span className="text-[8px] font-black leading-none mt-0.5" style={{ color: "rgba(21,17,13,0.7)" }}>×{daySessions.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected day detail */}
        {selected && selectedSessions.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: T.inkFaint, fontFamily: T.mono }}>
              {new Date(selected + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            {selectedSessions.map(s => {
              const col = colorFor(s);
              const isPaid = s.payment_status === "paid";
              const isRescheduling = reschedulingId === s.id;
              const isPast = selected < todayStr;

              function startReschedule() {
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

              const isRecordingFinalPayment = finalPaymentId === s.id;
              const showFinalPaymentBtn = isPast && s.booking_confirmed && !s.deposit2Received && onFinalPayment && !isRecordingFinalPayment;

              async function confirmFinalPayment() {
                if (!onFinalPayment || !finalPaymentAmount) return;
                setFinalPaymentSaving(true);
                await onFinalPayment(s.id, finalPaymentAmount, finalPaymentMethod);
                setFinalPaymentSaving(false);
                setFinalPaymentId(null);
                setFinalPaymentAmount("");
                setFinalPaymentMethod("Venmo");
              }

              return (
                <div key={s.id} className="rounded-2xl overflow-hidden"
                  style={{ background: T.panelSolid, border: `1px solid ${T.border}`, boxShadow: T.shadow }}>
                  <div className="flex items-start gap-3 p-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 mt-0.5" style={{ background: col.bg, border: `1px solid ${col.text}33` }}>
                      📸
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black truncate" style={{ color: T.ink }}>{s.name}</p>
                      <p className="text-xs truncate" style={{ color: T.inkFaint }}>{s.session_type || "Session"}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {isPaid && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ background: T.greenBg, color: T.green }}>
                            Deposit ✓
                          </span>
                        )}
                        {s.deposit2Received && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ background: T.greenBg, color: T.green, border: `1px solid ${T.greenBorder}` }}>
                            Final Paid ✓
                          </span>
                        )}
                        {showFinalPaymentBtn && (
                          <button
                            onClick={() => { setFinalPaymentId(s.id); setFinalPaymentAmount(deposit1Amounts.get(s.id)??""); setFinalPaymentMethod("Venmo"); }}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: T.greenBg, color: T.green }}>
                            💳 Final Payment
                          </button>
                        )}
                        {isPast && onThankYouClick && (
                          <button
                            onClick={() => onThankYouClick(s.id)}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                            style={{ background: T.violetBg, color: T.violet }}>
                            🙏 Thank You
                          </button>
                        )}
                        {onReschedule && !isRescheduling && (
                          <button onClick={startReschedule} className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: T.inset, color: T.inkSoft }}>
                            Reschedule
                          </button>
                        )}
                        <button
                          onClick={() => onClientClick(s.id)}
                          className="text-[11px] font-bold px-2.5 py-1 rounded-lg"
                          style={{ background: T.action, color: T.actionText }}>
                          View →
                        </button>
                      </div>
                    </div>
                  </div>

                  {isRescheduling && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="rounded-xl p-3" style={{ background: T.inset, border: `1px solid ${T.border}` }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: T.amber, fontFamily: T.mono }}>New date &amp; time</p>
                        <input
                          type="datetime-local"
                          value={rescheduleValue}
                          onChange={e => setRescheduleValue(e.target.value)}
                          className="w-full rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none mb-2"
                          style={inputStyle}
                        />
                        <div className="flex gap-2">
                          <button onClick={confirmReschedule} disabled={!rescheduleValue || rescheduleLoading}
                            className="flex-1 rounded-lg py-1.5 text-xs font-black disabled:opacity-50"
                            style={{ background: T.action, color: T.actionText }}>
                            {rescheduleLoading ? "Saving…" : "Save date"}
                          </button>
                          <button onClick={() => setReschedulingId(null)}
                            className="px-3 rounded-lg py-1.5 text-xs font-bold"
                            style={{ background: T.neutralBg, color: T.inkSoft }}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {isRecordingFinalPayment && (
                    <div className="px-3 pb-3 pt-0">
                      <div className="rounded-xl p-3" style={{ background: T.greenBg, border: `1px solid ${T.greenBorder}` }}>
                        <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: T.green, fontFamily: T.mono }}>Record Final Payment</p>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            placeholder="Amount (e.g. 150)"
                            value={finalPaymentAmount}
                            onChange={e => setFinalPaymentAmount(e.target.value)}
                            className="flex-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none"
                            style={inputStyle}
                          />
                          <select
                            value={finalPaymentMethod}
                            onChange={e => setFinalPaymentMethod(e.target.value)}
                            className="rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                            style={inputStyle}>
                            <option>Venmo</option>
                            <option>Zelle</option>
                            <option>PayPal</option>
                            <option>Cash App</option>
                            <option>Cash</option>
                            <option>Other</option>
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={confirmFinalPayment} disabled={!finalPaymentAmount || finalPaymentSaving}
                            className="flex-1 rounded-lg py-1.5 text-xs font-black disabled:opacity-50"
                            style={{ background: T.green, color: "#0d1f15" }}>
                            {finalPaymentSaving ? "Saving…" : "Record Payment ✓"}
                          </button>
                          <button onClick={() => { setFinalPaymentId(null); setFinalPaymentAmount(""); }}
                            className="px-3 rounded-lg py-1.5 text-xs font-bold"
                            style={{ background: T.neutralBg, color: T.inkSoft }}>
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
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: T.inkFaint, fontFamily: T.mono }}>Next Up</p>
              {next3.map(s => {
                const col = colorFor(s);
                const dt  = new Date(s.session_date + "T12:00:00");
                const label = s.session_date === todayStr ? "TODAY" : s.session_date === tomorrowStr ? "TOMORROW" : dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }).toUpperCase();
                const isRescheduling = reschedulingId === s.id;
                return (
                  <div key={s.id} className="rounded-xl overflow-hidden" style={{ background: col.bg, border: `1px solid ${col.text}26` }}>
                    <div className="flex items-start gap-3 px-3 py-2">
                      <div className="w-1.5 h-8 rounded-full flex-shrink-0 mt-0.5" style={{ background: col.solid, boxShadow: `0 0 6px ${col.solid}` }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="min-w-0">
                            <p className="text-xs font-black truncate" style={{ color: T.ink }}>{s.name}</p>
                            <p className="text-[11px] truncate" style={{ color: T.inkFaint }}>{s.session_type || "Session"}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] font-black" style={{ color: col.text, fontFamily: T.mono }}>{label}</span>
                            {onReschedule && (
                              <button
                                onClick={() => {
                                  if (isRescheduling) { setReschedulingId(null); setRescheduleValue(""); }
                                  else { setReschedulingId(s.id); setRescheduleValue(s.session_date); }
                                }}
                                className="text-[11px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                                style={{ background: isRescheduling ? T.insetStrong : T.inset, color: T.inkSoft }}>
                                {isRescheduling ? "✕" : "📅"}
                              </button>
                            )}
                            {onRemindersClick && (
                              <button
                                onClick={() => onRemindersClick(s.id)}
                                className="text-[11px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                                style={{ background: remindersOpen[s.id] ? T.amberBg : T.inset, color: T.amber }}>
                                {remindersLoading[s.id] ? "…" : "🔔"}
                              </button>
                            )}
                            <button
                              onClick={() => onClientClick(s.id)}
                              className="text-[11px] font-bold px-2 py-1 rounded-lg transition-all hover:opacity-80"
                              style={{ background: T.action, color: T.actionText }}>
                              →
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                    {isRescheduling && onReschedule && (
                      <div className="flex items-center gap-2 px-3 pb-2.5">
                        <input
                          type="date"
                          value={rescheduleValue}
                          onChange={e => setRescheduleValue(e.target.value)}
                          className="flex-1 text-xs rounded-lg px-2 py-1.5 outline-none"
                          style={inputStyle}
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
                          className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                          style={{ background: T.action, color: T.actionText }}>
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
