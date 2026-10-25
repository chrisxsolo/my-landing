"use client";
// "+ Add New School" form for the Session facts school picker. Checks the
// typed name against every saved school as you type (same matcher the server
// uses), and a 409 from the server lands on the same "use the existing one"
// prompt — so a different abbreviation can't create a second record.
import { useEffect, useId, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { EngineApiError, engineApi } from "@/app/admin/content-engine/engineApi";
import {
  findDuplicateSchool, schoolLabel, suggestSchoolSlug, validateNewSchool, type SchoolOption,
} from "@/lib/contentEngine/schools";
import { btn, card, input, label, overlay } from "./ui";

interface Props {
  schools: readonly SchoolOption[];
  prefill: string;
  onCancel: () => void;
  onSaved: (school: SchoolOption) => void;
  onUseExisting: (school: SchoolOption) => void;
}

const hint = { fontSize: 12, color: T.inkFaint, margin: "4px 0 0" } as const;

export default function AddSchoolDialog({ schools, prefill, onCancel, onSaved, onUseExisting }: Props) {
  const titleId = useId();
  const [name, setName] = useState(prefill);
  const [shortName, setShortName] = useState("");
  const [slugDraft, setSlugDraft] = useState<string | null>(null); // null = follow the names
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SchoolOption | null>(null);

  const slug = slugDraft ?? suggestSchoolSlug(name, shortName || null);
  const checked = validateNewSchool({ name, shortName, slug });
  const duplicate = conflict ?? (checked.ok ? findDuplicateSchool(checked.value, schools) : null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || duplicate) return;
    if (!checked.ok) { setError(checked.error); return; }
    setSaving(true);
    setError(null);
    try {
      const { school } = await engineApi.createSchool({ name, shortName, slug });
      onSaved(school);
    } catch (err) {
      const existing = err instanceof EngineApiError ? err.body.existing : null;
      if (existing && typeof existing === "object") setConflict(existing as SchoolOption);
      else console.error("add school failed", err);
      setError(err instanceof Error ? err.message : "could not save school");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={overlay} onMouseDown={() => { if (!saving) onCancel(); }}>
      <form role="dialog" aria-modal="true" aria-labelledby={titleId} onSubmit={(e) => void save(e)}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ ...card, background: T.panelSolid, maxWidth: 460, width: "100%", marginBottom: 0 }}>
        <h2 id={titleId} style={{ margin: "0 0 12px", fontSize: 16, color: T.ink, fontFamily: T.display }}>
          Add a school
        </h2>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={label}>School name (required)</span>
          <input style={input} value={name} autoFocus maxLength={160}
            placeholder="University of California College of the Law, San Francisco"
            onChange={(e) => { setName(e.target.value); setConflict(null); setError(null); }} />
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={label}>Short name (optional)</span>
          <input style={input} value={shortName} maxLength={60} placeholder="UC Law SF"
            onChange={(e) => { setShortName(e.target.value); setConflict(null); setError(null); }} />
          <p style={hint}>What copy and the dropdown call it. The AI uses this or the full name.</p>
        </label>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span style={label}>Slug</span>
          <input style={{ ...input, fontFamily: T.mono }} value={slug} maxLength={80}
            onChange={(e) => { setSlugDraft(e.target.value.toLowerCase()); setConflict(null); setError(null); }} />
          <p style={hint}>Made from the short name (or full name). Edit only if you need to.</p>
        </label>

        {duplicate && (
          <div style={{ border: `1px solid ${T.amberBorder}`, background: T.amberBg, borderRadius: 10, padding: 10, marginBottom: 10 }}>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: T.ink }}>
              This matches <strong>{schoolLabel(duplicate)}</strong>
              {duplicate.shortName && duplicate.shortName !== duplicate.name ? ` (${duplicate.name})` : ""}, which is already saved.
            </p>
            <button type="button" style={btn(true)} onClick={() => onUseExisting(duplicate)}>
              Use {schoolLabel(duplicate)}
            </button>
          </div>
        )}
        {error && !duplicate && <p style={{ margin: "0 0 10px", fontSize: 13, color: T.red }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" style={btn(false)} onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" style={{ ...btn(true), opacity: saving || duplicate ? 0.6 : 1 }}
            disabled={saving || Boolean(duplicate)}>
            {saving ? "Saving…" : "Save school"}
          </button>
        </div>
      </form>
    </div>
  );
}
