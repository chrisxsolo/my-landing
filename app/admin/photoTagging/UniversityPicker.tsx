"use client";
// Searchable university picker for the tag editor and the bulk bar. Lists
// every registered school (built-in /grads schools plus custom ones from
// content_engine_schools), filters as you type, lets the photographer clear
// the photo's university, and opens AddSchoolDialog for one that is not saved
// yet — the same registry and duplicate check as Session facts, so a school
// added here is valid everywhere and never a second copy of an existing one.
//
// The value is a draft: "" = leave unchanged · CLEAR_SCHOOL = clear on save ·
// a slug = set to that school. The parent decides what "unchanged" means.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import AddSchoolDialog from "@/app/admin/content-engine/[id]/AddSchoolDialog";
import { input } from "@/app/admin/content-engine/[id]/ui";
import { BUILT_IN_SCHOOL_OPTIONS, filterSchools, schoolLabel, type SchoolOption } from "@/lib/contentEngine/schools";
import type { SchoolChoice } from "@/lib/photoTagging/types";

export const CLEAR_SCHOOL = "__clear__";

interface Props {
  value: string;
  onChange: (next: string) => void;
  /** The photo's current university, as a person reads it (null = none). */
  current: string | null;
  /** Schools the tagging audit already knows, shown until the live list loads. */
  known: readonly SchoolChoice[];
}

type Entry =
  | { kind: "unchanged" }
  | { kind: "clear" }
  | { kind: "school"; school: SchoolOption }
  | { kind: "add" };

const menu: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
  background: T.panelSolid, border: `1px solid ${T.borderStrong}`, borderRadius: 10,
  boxShadow: T.shadow, maxHeight: 280, overflowY: "auto", margin: 0, padding: 4, listStyle: "none",
};
const row = (active: boolean): React.CSSProperties => ({
  padding: "8px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: T.ink, minHeight: 36,
  background: active ? T.insetStrong : "transparent",
});
const faint: React.CSSProperties = { fontSize: 11, color: T.inkFaint };

/** The audit's choices as picker options (no aliases: search still matches name and slug). */
function fromKnown(known: readonly SchoolChoice[]): SchoolOption[] {
  return known.map((k) => BUILT_IN_SCHOOL_OPTIONS.find((b) => b.slug === k.slug)
    ?? { slug: k.slug, name: k.label, shortName: null, aliases: [], builtIn: false });
}

function buildEntries(matches: SchoolOption[], query: string, current: string | null): Entry[] {
  const head: Entry[] = query.trim() ? [] : [{ kind: "unchanged" }, ...(current ? [{ kind: "clear" } as const] : [])];
  return [...head, ...matches.map((school) => ({ kind: "school" as const, school })), { kind: "add" }];
}

function EntryLabel({ entry, query, current, empty }: { entry: Entry; query: string; current: string | null; empty: boolean }) {
  if (entry.kind === "unchanged") return <span style={{ color: T.inkSoft }}>{current ? `Keep ${current}` : "— leave unchanged —"}</span>;
  if (entry.kind === "clear") return <span style={{ color: T.amber }}>Clear university (no school)</span>;
  if (entry.kind === "add") {
    return <span style={{ color: T.action, fontWeight: 700 }}>{empty && query.trim() ? `+ Add "${query.trim()}"` : "+ Add a university"}</span>;
  }
  const { school } = entry;
  const label = schoolLabel(school);
  return (
    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span>{label}{label !== school.name && <span style={{ ...faint, display: "block" }}>{school.name}</span>}</span>
      {!school.builtIn && <span style={{ ...faint, fontFamily: T.mono }}>custom · no /grads page</span>}
    </span>
  );
}

function shownValue(value: string, current: string | null, schools: readonly SchoolOption[]): string {
  if (value === CLEAR_SCHOOL) return "No university — cleared on save";
  if (!value) return current ? `${current} (current)` : "";
  const school = schools.find((s) => s.slug === value);
  return school ? schoolLabel(school) : value;
}

export default function UniversityPicker({ value, onChange, current, known }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState<SchoolOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    engineApi.listSchools()
      .then(({ schools }) => setLoaded(schools))
      .catch((err) => {
        console.error("[photo-tagging] school list failed", err);
        setLoadError("Live school list unavailable — showing known schools.");
      });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!rootRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const schools = useMemo(() => loaded ?? fromKnown(known), [loaded, known]);
  const matches = useMemo(() => filterSchools(schools, query), [schools, query]);
  const entries = useMemo(() => buildEntries(matches, query, current), [matches, query, current]);

  const choose = (entry: Entry) => {
    setOpen(false);
    if (entry.kind === "add") { setAdding(query.trim()); return; }
    onChange(entry.kind === "school" ? entry.school.slug : entry.kind === "clear" ? CLEAR_SCHOOL : "");
    setQuery("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (i + step + entries.length) % entries.length);
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const entry = entries[Math.min(active, entries.length - 1)];
      if (entry) choose(entry);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  };

  /** A new school (or the existing one it matched) joins the list and becomes the draft. */
  const finish = (school: SchoolOption) => {
    setLoaded((list) => {
      const base = list ?? fromKnown(known);
      return base.some((s) => s.slug === school.slug) ? base : [...base, school];
    });
    onChange(school.slug);
    setAdding(null);
    setQuery("");
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input style={input} role="combobox" aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
        aria-label="University" aria-activedescendant={open ? `${listId}-${active}` : undefined}
        placeholder="Search or pick a university…"
        value={open ? query : shownValue(value, current, schools)}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown} />
      {loadError && <span style={{ fontSize: 11, color: T.amber }}>{loadError}</span>}
      {open && (
        <ul id={listId} role="listbox" style={menu}>
          {entries.map((entry, i) => (
            <li key={entry.kind === "school" ? entry.school.slug : entry.kind} id={`${listId}-${i}`} role="option"
              aria-selected={entry.kind === "school" ? entry.school.slug === value : entry.kind === "clear" ? value === CLEAR_SCHOOL : entry.kind === "unchanged" && !value}
              style={{ ...row(i === active), ...(entry.kind === "add" ? { borderTop: `1px solid ${T.border}`, marginTop: 4 } : {}) }}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(entry); }}>
              {entry.kind === "add" && matches.length === 0 && query.trim() && (
                <span style={{ ...faint, display: "block", marginBottom: 4 }}>No matching universities</span>
              )}
              <EntryLabel entry={entry} query={query} current={current} empty={matches.length === 0} />
            </li>
          ))}
        </ul>
      )}
      {adding !== null && createPortal(
        <AddSchoolDialog schools={schools} prefill={adding} onCancel={() => setAdding(null)}
          onSaved={finish} onUseExisting={finish} />,
        document.body,
      )}
    </div>
  );
}
