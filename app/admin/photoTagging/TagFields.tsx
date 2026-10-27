"use client";
// The tag inputs shared by the single-photo editor and the bulk bar. An empty
// input means "leave unchanged" — only fields the photographer fills are sent.
// The university field can also be cleared (CLEAR_SCHOOL → school: null).
import { useId } from "react";
import { T } from "@/app/admin/adminTheme";
import { input, label } from "@/app/admin/content-engine/[id]/ui";
import type { TagChanges, TaggingOptions } from "@/lib/photoTagging/types";
import UniversityPicker, { CLEAR_SCHOOL } from "./UniversityPicker";

export { CLEAR_SCHOOL };

export interface TagDraft { category: string; school: string; location: string; spot: string }

export const EMPTY_DRAFT: TagDraft = { category: "", school: "", location: "", spot: "" };

export function draftToChanges(draft: TagDraft): TagChanges {
  const changes: TagChanges = {};
  if (draft.category) changes.category = draft.category;
  if (draft.school === CLEAR_SCHOOL) changes.school = null;
  else if (draft.school) changes.school = draft.school;
  if (draft.location.trim()) changes.location = draft.location.trim();
  if (draft.spot) changes.spot = draft.spot;
  return changes;
}

/** The school whose campus spots a draft can pick from: the drafted one, else the photo's, none once cleared. */
export function draftSchool(draft: TagDraft, currentSchool: string | null): string | null {
  if (draft.school === CLEAR_SCHOOL) return null;
  return draft.school || currentSchool;
}

interface Props {
  draft: TagDraft;
  setDraft: (next: TagDraft) => void;
  options: TaggingOptions;
  /** Portfolio photos can change category; Content Engine photos take it from the session. */
  allowCategory: boolean;
  /** The school whose spots to offer when the draft does not pick one. */
  currentSchool: string | null;
  /** Current values, shown as placeholders. */
  current?: Partial<TagDraft>;
  showSchool: boolean;
}

const UNCHANGED = "— leave unchanged —";

export default function TagFields({ draft, setDraft, options, allowCategory, currentSchool, current = {}, showSchool }: Props) {
  const listId = useId();
  const spotSchool = draftSchool(draft, currentSchool);
  const spots = spotSchool ? options.spots[spotSchool] ?? [] : [];
  const field = { display: "grid", gap: 3, minWidth: 150, flex: "1 1 160px" } as const;
  const set = (patch: Partial<TagDraft>) => setDraft({ ...draft, ...patch });
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
      {allowCategory && (
        <label style={field}>
          <span style={label}>Category</span>
          <select style={input} value={draft.category} onChange={(e) => set({ category: e.target.value })}>
            <option value="">{current.category ? `${current.category} (current)` : UNCHANGED}</option>
            {options.categories.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </label>
      )}
      {showSchool && (
        <div style={{ ...field, flex: "1 1 220px" }}>
          <span style={label}>University</span>
          <UniversityPicker value={draft.school} onChange={(school) => set({ school, spot: "" })}
            current={current.school || null} known={options.schools} />
        </div>
      )}
      <label style={field}>
        <span style={label}>Location</span>
        <input style={input} list={listId} value={draft.location} placeholder={current.location || "e.g. Doe Library"}
          onChange={(e) => set({ location: e.target.value })} />
        <datalist id={listId}>{options.places.map((p) => <option key={p} value={p} />)}</datalist>
      </label>
      {showSchool && (
        <label style={field}>
          <span style={label}>Campus spot</span>
          {spots.length > 0 ? (
            <select style={input} value={draft.spot} onChange={(e) => set({ spot: e.target.value })}>
              <option value="">{current.spot ? `${current.spot} (current)` : UNCHANGED}</option>
              {spots.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: 12, color: T.inkFaint, padding: "7px 0" }}>
              {spotSchool ? "This school has no campus-spot guide" : "Pick a university first"}
            </span>
          )}
        </label>
      )}
    </div>
  );
}
