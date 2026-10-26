"use client";
// Editorial fields + categories. Saving a changed field locks it (sync and AI
// leave it alone); "Auto" hands one field back to automatic management.
// Light tags and the crowd note are photographer-only, so they have no lock.
import { useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { btn, card, chip, input as inputStyle, label as labelStyle, sectionTitle } from "@/app/admin/content-engine/[id]/ui";
import { ENVIRONMENTS, LIBRARY_REGIONS, type LockableField } from "@/lib/locationLibrary/taxonomy";
import type { DetailSessionDto, LocationRow } from "./locationLibraryApi";
import LocationConditionsFields from "./LocationConditionsFields";
import { Muted, selectStyle } from "./libraryUi";

type Draft = Record<Exclude<LockableField, "environments">, string> & {
  environments: string[];
  light_tags: string[];
  crowd_note: string;
};

const TEXT_FIELDS: { field: Exclude<LockableField, "environments" | "region">; label: string; rows?: number }[] = [
  { field: "title", label: "Location name" },
  { field: "city", label: "City" },
  { field: "neighborhood", label: "Neighborhood" },
  { field: "description", label: "Description", rows: 4 },
  { field: "best_time", label: "Best light", rows: 2 },
  { field: "best_for", label: "Best for", rows: 2 },
  { field: "tip", label: "Pro tip", rows: 3 },
];

function draftOf(row: LocationRow): Draft {
  return {
    title: row.title.trim(), city: row.city.trim(), neighborhood: row.neighborhood ?? "", region: row.region,
    description: row.description, best_time: row.best_time, best_for: row.best_for, tip: row.tip,
    environments: row.environments, light_tags: row.light_tags ?? [], crowd_note: row.crowd_note ?? "",
  };
}

function changedFields(row: LocationRow, draft: Draft): Record<string, unknown> {
  const base = draftOf(row);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(draft) as (keyof Draft)[]) {
    if (JSON.stringify(base[key]) !== JSON.stringify(draft[key])) out[key] = draft[key];
  }
  return out;
}

function LockBadge({ locked, busy, onUnlock }: { locked: boolean; busy: boolean; onUnlock: () => void }) {
  if (!locked) return <span style={{ ...chip(T.inkFaint, T.neutralBg), fontSize: 10 }}>Auto</span>;
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
      <span style={{ ...chip(T.violet, T.violetBg), fontSize: 10 }}>Edited by you</span>
      <button type="button" disabled={busy} onClick={onUnlock}
        style={{ border: "none", background: "none", color: T.action, fontSize: 11, fontWeight: 700, cursor: "pointer", padding: 0 }}>
        Return to auto
      </button>
    </span>
  );
}

function FieldHead({ text, field, row, busy, onUnlock }: {
  text: string; field: LockableField; row: LocationRow; busy: boolean; onUnlock: (f: LockableField) => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 3 }}>
      <span style={{ ...labelStyle, marginBottom: 0 }}>{text}</span>
      <LockBadge locked={row.locked_fields.includes(field)} busy={busy} onUnlock={() => onUnlock(field)} />
    </div>
  );
}

export default function LocationFieldsEditor({
  row, sessions, busy, onSave,
}: {
  row: LocationRow;
  sessions: DetailSessionDto[];
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  // The parent keys this editor by the row's saved version, so a save or an
  // AI run remounts it with fresh values instead of syncing state in an effect.
  const [draft, setDraft] = useState<Draft>(() => draftOf(row));
  const changes = changedFields(row, draft);
  const dirty = Object.keys(changes).length > 0;
  const unlock = (f: LockableField) => void onSave({ unlock: [f] });
  const set = (key: keyof Draft, value: string | string[]) => setDraft((d) => ({ ...d, [key]: value }));
  const toggleEnv = (env: string) =>
    set("environments", draft.environments.includes(env) ? draft.environments.filter((e) => e !== env) : [...draft.environments, env]);

  return (
    <section style={card}>
      <h2 style={sectionTitle}>Location guide content</h2>
      <Muted style={{ marginBottom: 12 }}>
        Fields marked Auto are filled by the Content Engine (geography from the verified place, the rest by AI from your sessions).
        Anything you save here is yours — sync and AI never overwrite it.
      </Muted>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {TEXT_FIELDS.slice(0, 3).map(({ field, label }) => (
          <div key={field}>
            <FieldHead text={label} field={field} row={row} busy={busy} onUnlock={unlock} />
            <input value={draft[field]} onChange={(e) => set(field, e.target.value)} style={inputStyle} />
          </div>
        ))}
        <div>
          <FieldHead text="Region" field="region" row={row} busy={busy} onUnlock={unlock} />
          <select value={draft.region} onChange={(e) => set("region", e.target.value)} style={{ ...selectStyle, width: "100%" }}>
            {LIBRARY_REGIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        {TEXT_FIELDS.slice(3).map(({ field, label, rows }) => (
          <div key={field}>
            <FieldHead text={label} field={field} row={row} busy={busy} onUnlock={unlock} />
            <textarea value={draft[field]} rows={rows} onChange={(e) => set(field, e.target.value)}
              placeholder="Empty — waiting for review" style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
          </div>
        ))}
        <div>
          <FieldHead text="Environment categories" field="environments" row={row} busy={busy} onUnlock={unlock} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {ENVIRONMENTS.map((e) => {
              const on = draft.environments.includes(e.value);
              return (
                <button key={e.value} type="button" onClick={() => toggleEnv(e.value)} aria-pressed={on}
                  style={{ ...chip(on ? T.actionText : T.inkSoft, on ? T.action : T.inset), border: `1px solid ${on ? "transparent" : T.border}`, cursor: "pointer" }}>
                  {e.label}
                </button>
              );
            })}
          </div>
        </div>
        <LocationConditionsFields lightTags={draft.light_tags} crowdNote={draft.crowd_note} sessions={sessions}
          onLightTags={(tags) => set("light_tags", tags)} onCrowdNote={(note) => set("crowd_note", note)} />
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14, alignItems: "center" }}>
        <button type="button" style={{ ...btn(true), opacity: dirty ? 1 : 0.45, cursor: dirty ? "pointer" : "default" }}
          disabled={!dirty || busy} onClick={() => void onSave(changes)}>
          {busy ? "Saving…" : "Save changes"}
        </button>
        {dirty ? (
          <button type="button" style={btn()} disabled={busy} onClick={() => setDraft(draftOf(row))}>Discard</button>
        ) : null}
      </div>
    </section>
  );
}
