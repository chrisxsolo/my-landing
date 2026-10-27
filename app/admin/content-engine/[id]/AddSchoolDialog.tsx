"use client";
// "+ Add New School" form for the Session facts school picker. Checks the
// typed names against every saved school as you type (same matcher the server
// uses), and a 409 from the server lands on the same prompt. An exact match
// ("duplicate") blocks saving and offers the existing school; a look-alike
// ("similar", e.g. "Samuel Merritt" vs "Samuel Merritt University") is a
// suggestion the admin can dismiss as a different school.
import { useEffect, useId, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { EngineApiError, engineApi } from "@/app/admin/content-engine/engineApi";
import {
  matchSchoolCandidate, schoolLabel, suggestSchoolSlug, validateNewSchool,
  type SchoolMatch, type SchoolOption,
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
const field = { display: "block", marginBottom: 10 } as const;

function fullName(school: SchoolOption): string {
  return school.shortName && school.shortName !== school.name ? ` (${school.name})` : "";
}

/** The duplicate/similar prompt: use the saved school, or (similar only) keep going. */
function MatchNotice({ match, onUseExisting, onDifferent }: {
  match: SchoolMatch; onUseExisting: (school: SchoolOption) => void; onDifferent: () => void;
}) {
  const { school, kind } = match;
  return (
    <div role="status" style={{ border: `1px solid ${T.amberBorder}`, background: T.amberBg, borderRadius: 10, padding: 10, marginBottom: 10 }}>
      <p style={{ margin: "0 0 8px", fontSize: 13, color: T.ink }}>
        {kind === "duplicate" ? "This matches " : "This looks like "}
        <strong>{schoolLabel(school)}</strong>{fullName(school)}, which is already saved.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" style={btn(true)} onClick={() => onUseExisting(school)}>
          Use {schoolLabel(school)}
        </button>
        {kind === "similar" && (
          <button type="button" style={btn(false)} onClick={onDifferent}>It&apos;s a different school</button>
        )}
      </div>
    </div>
  );
}

export default function AddSchoolDialog({ schools, prefill, onCancel, onSaved, onUseExisting }: Props) {
  const titleId = useId();
  const [name, setName] = useState(prefill);
  const [shortName, setShortName] = useState("");
  const [aliasesText, setAliasesText] = useState("");
  const [slugDraft, setSlugDraft] = useState<string | null>(null); // null = follow the names
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<SchoolMatch | null>(null);
  const [differentFrom, setDifferentFrom] = useState<string | null>(null); // slug of a dismissed look-alike

  const slug = slugDraft ?? suggestSchoolSlug(name, shortName || null);
  const checked = validateNewSchool({ name, shortName, slug, aliases: aliasesText });
  const match = conflict ?? (checked.ok ? matchSchoolCandidate(checked.value, schools) : null);
  const dismissed = match?.kind === "similar" && match.school.slug === differentFrom;
  const shownMatch = match && !dismissed ? match : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !saving) onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel, saving]);

  // Any edit restarts the check: the typed school may now be someone else.
  const edit = (setter: (value: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(e.target.value);
    setConflict(null);
    setError(null);
    setDifferentFrom(null);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || shownMatch) return;
    if (!checked.ok) { setError(checked.error); return; }
    setSaving(true);
    setError(null);
    try {
      const { aliases } = checked.value;
      const { school } = await engineApi.createSchool({
        name, shortName, slug, aliases, confirmSimilar: differentFrom !== null,
      });
      onSaved(school);
    } catch (err) {
      const body = err instanceof EngineApiError ? err.body : {};
      if (body.existing && typeof body.existing === "object") {
        setConflict({ school: body.existing as SchoolOption, kind: body.match === "similar" ? "similar" : "duplicate" });
      } else {
        console.error("add school failed", err);
      }
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
        <label style={field}>
          <span style={label}>School name (required)</span>
          <input style={input} value={name} autoFocus maxLength={160}
            placeholder="University of California College of the Law, San Francisco" onChange={edit(setName)} />
        </label>
        <label style={field}>
          <span style={label}>Short name (optional)</span>
          <input style={input} value={shortName} maxLength={60} placeholder="UC Law SF" onChange={edit(setShortName)} />
          <p style={hint}>What copy and the dropdown call it. The AI uses this or the full name.</p>
        </label>
        <label style={field}>
          <span style={label}>Other names (optional)</span>
          <input style={input} value={aliasesText} maxLength={400} placeholder="UC Hastings, Hastings Law"
            onChange={edit(setAliasesText)} />
          <p style={hint}>Comma-separated. Old names and abbreviations people write in inquiries.</p>
        </label>
        <label style={field}>
          <span style={label}>Slug</span>
          <input style={{ ...input, fontFamily: T.mono }} value={slug} maxLength={80}
            onChange={edit((v) => setSlugDraft(v.toLowerCase()))} />
          <p style={hint}>Made from the short name (or full name). Edit only if you need to.</p>
        </label>

        {shownMatch && (
          <MatchNotice match={shownMatch} onUseExisting={onUseExisting}
            onDifferent={() => { setDifferentFrom(shownMatch.school.slug); setConflict(null); setError(null); }} />
        )}
        {error && !shownMatch && <p style={{ margin: "0 0 10px", fontSize: 13, color: T.red }}>{error}</p>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" style={btn(false)} onClick={onCancel} disabled={saving}>Cancel</button>
          <button type="submit" style={{ ...btn(true), opacity: saving || shownMatch ? 0.6 : 1 }}
            disabled={saving || Boolean(shownMatch)}>
            {saving ? "Saving…" : "Save school"}
          </button>
        </div>
      </form>
    </div>
  );
}
