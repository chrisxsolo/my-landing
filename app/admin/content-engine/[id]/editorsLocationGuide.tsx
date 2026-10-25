"use client";
// Editor for a proposed location guide (content_type location_guide) and the
// journal-side note for links that wait on such a guide. Approve/Reject live
// on the item card like every other draft; nothing here publishes.
import { T } from "@/app/admin/adminTheme";
import type { PendingGuideLink } from "@/lib/contentEngine/payloads";
import { applyGuideLink } from "@/lib/contentEngine/guideLinks";
import {
  GUIDE_SECTION_LABEL, guideLocationPath, isLocationGuideType,
} from "@/lib/locations/guideCoverage";
import { PhotoThumb, type EditorProps } from "./editorsSimple";
import { input, label } from "./ui";

type Data = Record<string, unknown>;
interface GuidePhoto { session_photo_id: string; alt_text: string; caption: string }

const str = (v: unknown) => (typeof v === "string" ? v : "");
const paras = (v: unknown) => (Array.isArray(v) ? (v as string[]).join("\n\n") : "");
const toParas = (text: string) => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
const lines = (v: unknown) => (Array.isArray(v) ? (v as string[]).join("\n") : "");
const toLines = (text: string) => text.split("\n").map((l) => l.trim()).filter(Boolean);

function TextField({ name, value, onChange, disabled, rows = 1 }: {
  name: string; value: string; onChange: (v: string) => void; disabled: boolean; rows?: number;
}) {
  return (
    <div>
      <span style={label}>{name}</span>
      {rows > 1 ? (
        <textarea style={{ ...input, minHeight: rows * 22 }} value={value} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input style={input} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

const SHORT_FIELDS: [string, string][] = [
  ["metaTitle", "Meta title"], ["metaDescription", "Meta description"], ["h1", "Page heading"],
  ["cardSummary", "Hub card summary"], ["bestFor", "Best for"], ["lightingChar", "Lighting"],
  ["accessNote", "Footing / access note"], ["heroAlt", "Hero alt text"],
];
const PARAGRAPH_FIELDS: [string, string][] = [
  ["heroTagline", "Intro"], ["whyItWorks", "Why it works"], ["photoVariety", "Photo opportunities"],
  ["bestTimeOfDay", "Best time of day"], ["bestSeasons", "Seasons & conditions"],
  ["whatToWear", "What to wear"], ["guideSection", ""], ["parkingArrival", "Parking & arrival"],
  ["ctaTitle", "Booking CTA title"], ["ctaBody", "Booking CTA text"],
];

function PhotoList({ payload, photos, onEdit, disabled }: EditorProps) {
  const list = (Array.isArray(payload.photos) ? payload.photos : []) as GuidePhoto[];
  const hero = str(payload.hero_photo_id);
  const setList = (next: GuidePhoto[]) => onEdit({
    ...payload, photos: next,
    hero_photo_id: next.some((p) => p.session_photo_id === hero) ? hero : (next[0]?.session_photo_id ?? ""),
  });
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <span style={label}>Guide photos ({list.length}) — published to the new page</span>
      {list.map((p, i) => (
        <div key={p.session_photo_id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
          <PhotoThumb photo={photos.find((ph) => ph.id === p.session_photo_id)} size={72} />
          <div style={{ flex: 1, display: "grid", gap: 4 }}>
            <input style={input} placeholder="Alt text" value={p.alt_text} disabled={disabled}
              onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, alt_text: e.target.value } : x)))} />
            <input style={input} placeholder="Caption" value={p.caption} disabled={disabled}
              onChange={(e) => setList(list.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))} />
          </div>
          <label style={{ fontSize: 12, whiteSpace: "nowrap" }}>
            <input type="radio" checked={hero === p.session_photo_id} disabled={disabled}
              onChange={() => onEdit({ ...payload, hero_photo_id: p.session_photo_id })} /> hero
          </label>
          <button style={{ border: "none", background: "none", color: T.inkSoft, cursor: "pointer" }}
            disabled={disabled || list.length <= 1} onClick={() => setList(list.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
    </div>
  );
}

export function LocationGuideEditor(props: EditorProps) {
  const { payload, onEdit, disabled } = props;
  const data = (payload.data ?? {}) as Data;
  const place = (payload.place ?? {}) as Data;
  const guide = isLocationGuideType(payload.guide) ? payload.guide : "couples";
  const url = guideLocationPath(guide, str(payload.slug));
  const flags = Array.isArray(payload.needs_verification) ? (payload.needs_verification as string[]) : [];
  const setData = (key: string, value: unknown) => onEdit({ ...payload, data: { ...data, [key]: value } });

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ background: T.blueBg, border: `1px solid ${T.blueBorder}`, borderRadius: 10, padding: 10, fontSize: 13 }}>
        <strong>New location guide detected:</strong> {str(place.name)}, {str(place.search_area)}{" "}
        <span style={{ color: T.inkSoft }}>({str(place.city)}, {str(place.county)})</span>
        <div style={{ color: T.inkSoft, marginTop: 4 }}>
          Publishes to <code>{url}</code>. Nothing goes live until you approve and publish.
        </div>
      </div>
      {flags.length > 0 && (
        <div style={{ background: T.amberBg, border: `1px solid ${T.amberBorder}`, borderRadius: 10, padding: 10, fontSize: 13 }}>
          <strong style={{ color: T.amber }}>Check before publishing</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>{flags.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
      <label style={{ fontSize: 13 }}>
        <input type="checkbox" checked={payload.indexable === true} disabled={disabled}
          onChange={(e) => onEdit({ ...payload, indexable: e.target.checked })} />{" "}
        Let search engines index this page (leave off until it has a credible set of photos)
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
        {SHORT_FIELDS.map(([key, name]) => (
          <TextField key={key} name={name} value={str(data[key])} disabled={disabled} onChange={(v) => setData(key, v)} />
        ))}
      </div>
      {PARAGRAPH_FIELDS.map(([key, name]) => {
        const isList = Array.isArray(data[key]);
        return (
          <TextField key={key} name={name || GUIDE_SECTION_LABEL[guide]} rows={isList ? 4 : 2} disabled={disabled}
            value={isList ? paras(data[key]) : str(data[key])}
            onChange={(v) => setData(key, isList ? toParas(v) : v)} />
        );
      })}
      <TextField name="Photo opportunities — bullets (one per line)" rows={3} disabled={disabled}
        value={lines(data.photoVarietyList)} onChange={(v) => setData("photoVarietyList", toLines(v))} />
      <PhotoList {...props} />
    </div>
  );
}

/** Journal-side: links waiting on a location guide proposal. */
export function PendingGuideLinksNote({ payload, onEdit, disabled }: EditorProps) {
  const pending = (Array.isArray(payload.pending_guide_links) ? payload.pending_guide_links : []) as PendingGuideLink[];
  if (pending.length === 0) return null;
  return (
    <div style={{ background: T.inset, border: `1px solid ${T.border}`, borderRadius: 10, padding: 10, fontSize: 13 }}>
      {pending.map((p) => (
        <div key={`${p.guide}-${p.location_key}`} style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
          <span>
            {p.status === "ready"
              ? <>The <strong>{p.label}</strong> is live now.</>
              : <>Waiting on the <strong>{p.label}</strong> proposal — no link is published until it goes live.</>}
          </span>
          {p.status === "ready" && (
            <button style={{ border: `1px solid ${T.border}`, borderRadius: 8, background: T.panel, color: T.ink, cursor: "pointer", padding: "4px 10px" }}
              disabled={disabled}
              onClick={() => onEdit(applyGuideLink(payload as { body: string }, p.guide, p.location_key, guideLocationPath(p.guide, p.slug)))}>
              Add link to this post
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
