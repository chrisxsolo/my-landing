"use client";
// The one schedule picker: a date, a time to the minute, an IANA zone, and a
// live confirmation line ("Scheduled for November 12, 2026 at 9:00 AM —
// America/Los_Angeles"). Resolution runs the same pure code the server uses,
// so a nonexistent or repeated time is explained before the request is sent.
// Labelled controls, visible focus, text status (never colour alone). `theme`
// picks a palette: every admin surface is dark today (the Blog tab renders
// inside the Darkroom shell); "light" is kept for a future light surface.
import { useId, useMemo } from "react";
import { COMMON_SCHEDULE_TIME_ZONES, DEFAULT_SCHEDULE_TIME_ZONE } from "@/lib/contentPublishing/constants";
import {
  describeScheduledInstant, parseWallTime, resolveLocalTime, type Disambiguation,
} from "@/lib/contentPublishing/localTime";
import type { ScheduleWhen } from "./publishingApi";

export interface ScheduleDraft {
  date: string;      // YYYY-MM-DD
  time: string;      // HH:MM
  timeZone: string;
  disambiguation?: Disambiguation;
}

export function emptyScheduleDraft(now = new Date(), timeZone = DEFAULT_SCHEDULE_TIME_ZONE): ScheduleDraft {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60_000);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(tomorrow);
  return { date: parts, time: "09:00", timeZone };
}

export function toScheduleWhen(d: ScheduleDraft): ScheduleWhen {
  return { localWallTime: `${d.date}T${d.time}`, timeZone: d.timeZone, disambiguation: d.disambiguation };
}

/** The confirmation line and whether the choice can be submitted. Pure; exported for tests. */
export function describeScheduleDraft(d: ScheduleDraft, now = new Date()): { text: string; ok: boolean; ambiguous: boolean } {
  const wall = parseWallTime(`${d.date}T${d.time}`);
  if (!wall) return { text: "Choose a date and a time.", ok: false, ambiguous: false };
  const r = resolveLocalTime(wall, d.timeZone);
  if (r.kind === "invalid") return { text: r.reason, ok: false, ambiguous: false };
  if (r.kind === "nonexistent") {
    return { text: `That time does not exist in ${d.timeZone} (clocks skip forward that night). Pick another time.`, ok: false, ambiguous: false };
  }
  if (r.kind === "ambiguous" && !d.disambiguation) {
    return { text: `That time happens twice in ${d.timeZone} that night. Choose the earlier or the later one.`, ok: false, ambiguous: true };
  }
  const instant = r.kind === "ambiguous" ? r.candidates[d.disambiguation === "later" ? 1 : 0] : r.instant;
  if (instant.getTime() <= now.getTime()) return { text: "That time has already passed. Pick a future time, or use Publish now.", ok: false, ambiguous: r.kind === "ambiguous" };
  return { text: `Scheduled for ${describeScheduledInstant(instant, d.timeZone)}`, ok: true, ambiguous: r.kind === "ambiguous" };
}

interface Props {
  value: ScheduleDraft;
  onChange: (next: ScheduleDraft) => void;
  theme: "light" | "dark";
  /** Shown under the confirmation: the honest latency statement. */
  note?: string;
}

const PALETTE = {
  light: { ink: "#1e293b", soft: "#64748b", border: "#cbd5e1", bg: "#ffffff", focus: "#7c3aed", warn: "#b45309" },
  dark: { ink: "#f2efe9", soft: "#b8b2a8", border: "rgba(255,255,255,0.18)", bg: "rgba(255,255,255,0.05)", focus: "#e8a04c", warn: "#e8a04c" },
};

export default function ScheduleControl({ value, onChange, theme, note }: Props) {
  const id = useId();
  const p = PALETTE[theme];
  const summary = useMemo(() => describeScheduleDraft(value), [value]);
  const zones = useMemo(() => {
    const list = [...COMMON_SCHEDULE_TIME_ZONES] as string[];
    return list.includes(value.timeZone) ? list : [value.timeZone, ...list];
  }, [value.timeZone]);
  const field: React.CSSProperties = {
    border: `1px solid ${p.border}`, borderRadius: 10, padding: "8px 10px", fontSize: 14, color: p.ink,
    background: p.bg, minHeight: 44, outlineOffset: 2, colorScheme: theme,
  };
  const label: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: p.soft, marginBottom: 4 };

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <style>{`.sched-field:focus-visible { outline: 2px solid ${p.focus}; }`}</style>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <div>
          <label htmlFor={`${id}-date`} style={label}>Date</label>
          <input id={`${id}-date`} className="sched-field" type="date" style={{ ...field, width: "100%" }} value={value.date}
            onChange={(e) => onChange({ ...value, date: e.target.value, disambiguation: undefined })} />
        </div>
        <div>
          <label htmlFor={`${id}-time`} style={label}>Time</label>
          <input id={`${id}-time`} className="sched-field" type="time" step={60} style={{ ...field, width: "100%" }} value={value.time}
            onChange={(e) => onChange({ ...value, time: e.target.value.slice(0, 5), disambiguation: undefined })} />
        </div>
        <div>
          <label htmlFor={`${id}-zone`} style={label}>Time zone</label>
          <select id={`${id}-zone`} className="sched-field" style={{ ...field, width: "100%" }} value={value.timeZone}
            onChange={(e) => onChange({ ...value, timeZone: e.target.value, disambiguation: undefined })}>
            {zones.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </div>
      </div>
      {summary.ambiguous && (
        <fieldset style={{ border: `1px solid ${p.border}`, borderRadius: 10, padding: "8px 12px", margin: 0 }}>
          <legend style={{ fontSize: 12, color: p.soft, padding: "0 4px" }}>This time happens twice — which one?</legend>
          {(["earlier", "later"] as Disambiguation[]).map((opt) => (
            <label key={opt} style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 16, fontSize: 13, color: p.ink, minHeight: 32 }}>
              <input type="radio" name={`${id}-dst`} value={opt} checked={value.disambiguation === opt}
                onChange={() => onChange({ ...value, disambiguation: opt })} />
              {opt === "earlier" ? "The earlier one (daylight time)" : "The later one (standard time)"}
            </label>
          ))}
        </fieldset>
      )}
      <p role="status" aria-live="polite" style={{ margin: 0, fontSize: 13, color: summary.ok ? p.ink : p.warn, fontWeight: summary.ok ? 600 : 500 }}>
        {summary.text}
      </p>
      <p style={{ margin: 0, fontSize: 12, color: p.soft }}>
        {note ?? "Publishes automatically within about a minute of this time — no browser needs to stay open."}
      </p>
    </div>
  );
}
