"use client";
// Light tags + crowd note for one library location. Firsthand knowledge only:
// sync and AI never write these. The hint lists the lighting recorded on the
// sessions linked here, so tags can follow what the shoots actually had.
import { T } from "@/app/admin/adminTheme";
import { chip, input as inputStyle, label as labelStyle } from "@/app/admin/content-engine/[id]/ui";
import { CROWD_NOTE_MAX, LIGHT_TAGS } from "@/lib/photoConditions";
import type { DetailSessionDto } from "./locationLibraryApi";
import { Muted } from "./libraryUi";

/** "golden hour ×3 · overcast ×1" from the live linked sessions, most common first. */
export function lightingHint(sessions: readonly Pick<DetailSessionDto, "lighting" | "excluded">[]): string {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    if (s.excluded || !s.lighting) continue;
    counts.set(s.lighting, (counts.get(s.lighting) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, n]) => `${value.replace(/_/g, " ")} ×${n}`)
    .join(" · ");
}

export default function LocationConditionsFields({
  lightTags, crowdNote, sessions, onLightTags, onCrowdNote,
}: {
  lightTags: string[];
  crowdNote: string;
  sessions: DetailSessionDto[];
  onLightTags: (tags: string[]) => void;
  onCrowdNote: (note: string) => void;
}) {
  const hint = lightingHint(sessions);
  const toggle = (tag: string) =>
    onLightTags(lightTags.includes(tag) ? lightTags.filter((t) => t !== tag) : [...lightTags, tag]);
  return (
    <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
      <span style={labelStyle}>Light conditions (yours only — AI never sets these)</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {LIGHT_TAGS.map((t) => {
          const on = lightTags.includes(t.value);
          return (
            <button key={t.value} type="button" onClick={() => toggle(t.value)} aria-pressed={on}
              style={{ ...chip(on ? T.actionText : T.inkSoft, on ? T.action : T.inset), border: `1px solid ${on ? "transparent" : T.border}`, cursor: "pointer" }}>
              {t.label}
            </button>
          );
        })}
      </div>
      <Muted style={{ marginTop: 6 }}>
        {hint ? `Your sessions here were shot in: ${hint}.` : "No lighting recorded on the sessions linked here yet."}
        {" "}Tagged spots show up under the Light filter on the public page.
      </Muted>
      <label style={{ ...labelStyle, marginTop: 12, display: "block" }} htmlFor="loc-crowd-note">
        Gets busy? When, and how to avoid it
      </label>
      <input id="loc-crowd-note" value={crowdNote} maxLength={CROWD_NOTE_MAX} onChange={(e) => onCrowdNote(e.target.value)}
        placeholder="Empty — no “Gets busy” badge. e.g. Packed on weekends; go weekday mornings" style={inputStyle} />
    </div>
  );
}
