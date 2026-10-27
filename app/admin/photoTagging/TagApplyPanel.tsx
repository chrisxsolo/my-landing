"use client";
// What a tag write will change, before the admin confirms it — field counts,
// how many OTHER photos a session-wide value reaches, and the first few
// before → after changes — plus the result toast and Undo afterwards.
import { T } from "@/app/admin/adminTheme";
import { btn } from "@/app/admin/content-engine/[id]/ui";
import { categoryLabel, type TagField, type TaggingOptions } from "@/lib/photoTagging/types";
import type { TagOutcome } from "@/lib/photoTagging/plan";
import type { TagApply } from "./useTagApply";

const FIELD_LABEL: Record<TagField, string> = { category: "Category", school: "University", location: "Location", spot: "Campus spot" };
const SHOWN_CHANGES = 6;

/** A stored value as a person reads it ("usf" → "USF"). */
export function valueLabel(field: TagField, value: string | null, options: TaggingOptions): string {
  if (value === null) return "—";
  if (field === "school") return options.schools.find((s) => s.slug === value)?.label ?? value;
  if (field === "category") return categoryLabel(value);
  if (field === "spot") return Object.values(options.spots).flat().find((s) => s.key === value)?.name ?? value;
  return value;
}

function ChangeRow({ o, options, titleOf }: { o: TagOutcome; options: TaggingOptions; titleOf: (key: string) => string }) {
  return (
    <li style={{ fontSize: 12, color: T.inkSoft }}>
      {titleOf(o.key)} · {FIELD_LABEL[o.field]}: <span style={{ color: T.inkFaint }}>{valueLabel(o.field, o.previous, options)}</span>
      {" → "}<strong style={{ color: T.ink }}>{valueLabel(o.field, o.value, options)}</strong>
      {o.scope === "session" ? " (whole session)" : ""}
    </li>
  );
}

interface Props {
  apply: TagApply;
  options: TaggingOptions;
  titleOf: (key: string) => string;
}

function Preview({ apply, options, titleOf }: Props) {
  const p = apply.pending;
  if (!p) return null;
  const r = p.result;
  const changes = r.outcomes.filter((o) => o.result === "updated");
  const held = r.outcomes.filter((o) => o.result === "conflict");
  return (
    <div style={{ display: "grid", gap: 6, padding: 10, borderRadius: 10, background: T.inset, border: `1px solid ${T.amberBorder}` }}>
      <strong style={{ fontSize: 13, color: T.ink }}>
        Review before saving: {r.updated} field(s) change · {r.kept} kept · {r.skipped} skipped{r.conflicts ? ` · ${r.conflicts} held back` : ""}
      </strong>
      {r.sessionImpact.map((s) => (
        <p key={s.sessionId} style={{ margin: 0, fontSize: 12, color: T.amber }}>
          University on session “{s.sessionName ?? "untitled"}” → {valueLabel("school", s.value, options)}
          {s.otherPhotos > 0 ? ` also changes ${s.otherPhotos} other photo(s) in that session.` : " (no other photos affected)."}
        </p>
      ))}
      <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 2 }}>
        {changes.slice(0, SHOWN_CHANGES).map((o) => <ChangeRow key={`${o.key}:${o.field}`} o={o} options={options} titleOf={titleOf} />)}
        {changes.length > SHOWN_CHANGES && <li style={{ fontSize: 12, color: T.inkFaint }}>…and {changes.length - SHOWN_CHANGES} more</li>}
      </ul>
      {held.length > 0 && (
        <p style={{ margin: 0, fontSize: 12, color: T.amber }}>Held back (pick by hand): {held[0].reason}</p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" style={btn(true)} disabled={apply.busy} onClick={() => void apply.confirm()}>
          {apply.busy ? "Saving…" : `Confirm ${r.updated} change(s)`}
        </button>
        <button type="button" style={btn(false)} disabled={apply.busy} onClick={apply.cancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function TagApplyPanel(props: Props) {
  const { apply } = props;
  return (
    <>
      <Preview {...props} />
      {apply.toast && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }} role="status">
          <p style={{ margin: 0, fontSize: 13, color: apply.toast.ok ? T.green : T.red, flex: "1 1 240px" }}>{apply.toast.text}</p>
          {apply.canUndo && (
            <button type="button" style={{ ...btn(false), padding: "3px 10px", fontSize: 12 }} onClick={() => void apply.undo()}>Undo</button>
          )}
        </div>
      )}
    </>
  );
}
