"use client";
// Searchable school combobox for Session facts (2026-10-25). Lists the
// built-in schools plus custom ones saved from here, filters as you type, and
// opens AddSchoolDialog for a school that isn't saved yet. Only changes the
// form value — Save facts still commits it, like every other field.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { T } from "@/app/admin/adminTheme";
import { engineApi } from "@/app/admin/content-engine/engineApi";
import { filterSchools, schoolLabel, type SchoolOption } from "@/lib/contentEngine/schools";
import { input } from "./ui";
import AddSchoolDialog from "./AddSchoolDialog";

interface Props {
  value: string;
  onChange: (slug: string) => void;
  onSchoolAdded: (school: SchoolOption) => void;
}

type Entry =
  | { kind: "none" }
  | { kind: "school"; school: SchoolOption }
  | { kind: "add" };

const menu: React.CSSProperties = {
  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 20,
  background: T.panelSolid, border: `1px solid ${T.borderStrong}`, borderRadius: 10,
  boxShadow: T.shadow, maxHeight: 300, overflowY: "auto", margin: 0, padding: 4, listStyle: "none",
};
const row = (active: boolean): React.CSSProperties => ({
  padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontSize: 13, color: T.ink,
  background: active ? T.insetStrong : "transparent",
});
const faint: React.CSSProperties = { fontSize: 11, color: T.inkFaint };

function buildEntries(matches: SchoolOption[], query: string): Entry[] {
  const entries: Entry[] = query.trim() ? [] : [{ kind: "none" }];
  return [...entries, ...matches.map((school) => ({ kind: "school" as const, school })), { kind: "add" }];
}

function EntryLabel({ entry, query, empty }: { entry: Entry; query: string; empty: boolean }) {
  if (entry.kind === "none") return <span style={{ color: T.inkSoft }}>— none —</span>;
  if (entry.kind === "add") {
    return <span style={{ color: T.action, fontWeight: 700 }}>
      {empty && query.trim() ? `+ Add "${query.trim()}"` : "+ Add New School"}
    </span>;
  }
  const { school } = entry;
  const label = schoolLabel(school);
  return (
    <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
      <span>
        {label}
        {label !== school.name && <span style={{ ...faint, display: "block" }}>{school.name}</span>}
      </span>
      {!school.builtIn && <span style={{ ...faint, fontFamily: T.mono }}>custom</span>}
    </span>
  );
}

export default function SchoolPicker({ value, onChange, onSchoolAdded }: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [adding, setAdding] = useState<string | null>(null); // prefill while the dialog is open

  useEffect(() => {
    engineApi.listSchools()
      .then(({ schools: list }) => setSchools(list))
      .catch((err) => {
        console.error("school list failed", err);
        setLoadError("Couldn't load schools — reload to try again.");
      });
  }, []);

  // Close the menu on any click outside the combobox.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const matches = useMemo(() => filterSchools(schools, query), [schools, query]);
  const entries = useMemo(() => buildEntries(matches, query), [matches, query]);
  const selected = schools.find((s) => s.slug === value);
  const shown = selected ? schoolLabel(selected) : value;

  const choose = (entry: Entry) => {
    setOpen(false);
    if (entry.kind === "add") { setAdding(query.trim()); return; }
    onChange(entry.kind === "school" ? entry.school.slug : "");
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
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  // An existing match may come from another tab, so it joins the list too.
  const finish = (school: SchoolOption, added: boolean) => {
    setSchools((list) => (list.some((s) => s.slug === school.slug) ? list : [...list, school]));
    if (added) onSchoolAdded(school);
    onChange(school.slug);
    setAdding(null);
    setQuery("");
  };

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <input style={input} role="combobox" aria-expanded={open} aria-controls={listId}
        aria-autocomplete="list" aria-label="School"
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        placeholder="Search or select a school…"
        value={open ? query : shown}
        onFocus={() => { setOpen(true); setQuery(""); setActive(0); }}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onKeyDown={onKeyDown} />
      {loadError && <span style={{ fontSize: 12, color: T.red }}>{loadError}</span>}
      {open && (
        <ul id={listId} role="listbox" style={menu}>
          {entries.map((entry, i) => (
            <li key={entry.kind === "school" ? entry.school.slug : entry.kind}
              id={`${listId}-${i}`} role="option"
              aria-selected={entry.kind === "school" ? entry.school.slug === value : entry.kind === "none" && !value}
              style={{
                ...row(i === active),
                ...(entry.kind === "add" ? { borderTop: `1px solid ${T.border}`, marginTop: 4 } : {}),
              }}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); choose(entry); }}>
              {entry.kind === "add" && matches.length === 0 && query.trim() && (
                <span style={{ ...faint, display: "block", marginBottom: 4 }}>No matching schools found</span>
              )}
              <EntryLabel entry={entry} query={query} empty={matches.length === 0} />
            </li>
          ))}
        </ul>
      )}
      {adding !== null && createPortal(
        <AddSchoolDialog schools={schools} prefill={adding}
          onCancel={() => setAdding(null)}
          onSaved={(school) => finish(school, true)}
          onUseExisting={(school) => finish(school, false)} />,
        document.body,
      )}
    </div>
  );
}
