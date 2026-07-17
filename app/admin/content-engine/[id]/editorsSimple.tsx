"use client";
// Per-type editors for the non-journal types (spec §7.4 Section 4).
// Destination dropdowns use the canonical taxonomy so invalid slugs are
// unrepresentable. Each editor renders controlled fields over the payload and
// calls onEdit with the FULL next payload (autosave owns persistence).
import { useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import { supabase } from "@/lib/supabase";
import { PORTFOLIO_CATEGORIES, SCHOOL_SLUGS, GUIDE_TYPES, guideLocationKeys } from "@/lib/contentEngine/taxonomy";
import type { EnginePhoto } from "@/app/admin/content-engine/engineTypes";
import { input, label } from "./ui";

export interface EditorProps {
  payload: Record<string, unknown>;
  photos: EnginePhoto[];
  onEdit: (next: Record<string, unknown>) => void;
  disabled: boolean;
  // Session service type — service-aware editor copy (placeholders, link
  // candidates); optional so grad-era call sites keep working unchanged.
  serviceType?: string;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

function Field({ name, value, onChange, disabled, multiline = false }: {
  name: string; value: string; onChange: (v: string) => void; disabled: boolean; multiline?: boolean;
}) {
  return (
    <div>
      <span style={label}>{name}</span>
      {multiline ? (
        <textarea style={{ ...input, minHeight: 56 }} value={value} disabled={disabled}
          onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input style={input} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

// Thumbnail for the photo a payload references — thumbnailUrl is a short-lived
// signed URL (photos GET route), same pattern as PhotosSection.
export function PhotoThumb({ photo, size = 88 }: { photo: EnginePhoto | undefined; size?: number }) {
  const box = { width: size, height: size, borderRadius: 8, flexShrink: 0 } as const;
  if (!photo?.thumbnailUrl) return <div style={{ ...box, background: T.inset }} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, next/image can't optimize it
    <img src={photo.thumbnailUrl} alt={photo.alt_text ?? photo.original_filename ?? "session photo"}
      style={{ ...box, objectFit: "cover", display: "block", border: `1px solid ${T.border}` }} />
  );
}

function PhotoSelect({ payload, photos, onEdit, disabled }: EditorProps) {
  const selected = photos.find((p) => p.id === str(payload.session_photo_id));
  return (
    <div>
      <span style={label}>Photo</span>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <PhotoThumb photo={selected} />
        <select style={input} disabled={disabled} value={str(payload.session_photo_id)}
          onChange={(e) => onEdit({ ...payload, session_photo_id: e.target.value })}>
          {photos.filter((p) => !p.excluded).map((p) => (
            <option key={p.id} value={p.id}>
              {p.original_filename ?? p.id.slice(0, 8)}{p.quality_score ? ` (q${p.quality_score})` : ""}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function PortfolioEditor(props: EditorProps) {
  const { payload, onEdit, disabled } = props;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
      <PhotoSelect {...props} />
      <div>
        <span style={label}>Category</span>
        <select style={input} disabled={disabled} value={str(payload.category)}
          onChange={(e) => onEdit({ ...payload, category: e.target.value })}>
          {PORTFOLIO_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <Field name="Title" value={str(payload.title)} disabled={disabled}
        onChange={(v) => onEdit({ ...payload, title: v })} />
      <Field name="Alt text" value={str(payload.alt_text)} disabled={disabled}
        onChange={(v) => onEdit({ ...payload, alt_text: v })} />
      <label style={{ fontSize: 13, alignSelf: "end" }}>
        <input type="checkbox" disabled={disabled} checked={payload.featured === true}
          onChange={(e) => onEdit({ ...payload, featured: e.target.checked })} /> featured (homepage)
      </label>
    </div>
  );
}

export function SchoolEditor(props: EditorProps) {
  const { payload, onEdit, disabled } = props;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
      <PhotoSelect {...props} />
      <div>
        <span style={label}>School</span>
        <select style={input} disabled={disabled} value={str(payload.school_slug)}
          onChange={(e) => onEdit({ ...payload, school_slug: e.target.value })}>
          {SCHOOL_SLUGS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <Field name="Caption" value={str(payload.caption)} disabled={disabled}
        onChange={(v) => onEdit({ ...payload, caption: v })} />
      <Field name="Alt override" value={str(payload.alt_override)} disabled={disabled}
        onChange={(v) => onEdit({ ...payload, alt_override: v })} />
    </div>
  );
}

interface SpotOption { id: number; school_short: string; name: string }

export function GuideEditor(props: EditorProps) {
  const { payload, onEdit, disabled } = props;
  const guide = (str(payload.guide) || "family") as (typeof GUIDE_TYPES)[number];
  // grad location keys are location_spots row ids — loaded once so the
  // dropdown shows spot names instead of raw ids (same table the public
  // campus-spots page reads).
  const [spots, setSpots] = useState<SpotOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    supabase.from("location_spots").select("id,school_short,name")
      .order("school_id").order("order", { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error("could not load campus spots for guide editor", error);
        if (!cancelled && data) setSpots(data as SpotOption[]);
      });
    return () => { cancelled = true; };
  }, []);

  const locationKey = str(payload.location_key);
  const firstKeyFor = (g: (typeof GUIDE_TYPES)[number]) =>
    g === "grad" ? (spots[0] ? String(spots[0].id) : "") : guideLocationKeys(g)[0];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8 }}>
      <PhotoSelect {...props} />
      <div>
        <span style={label}>Guide</span>
        <select style={input} disabled={disabled} value={guide}
          onChange={(e) => {
            const next = e.target.value as (typeof GUIDE_TYPES)[number];
            onEdit({ ...payload, guide: next, location_key: firstKeyFor(next) });
          }}>
          {GUIDE_TYPES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>
      <div>
        <span style={label}>{guide === "grad" ? "Campus spot" : "Location"}</span>
        <select style={input} disabled={disabled} value={locationKey}
          onChange={(e) => onEdit({ ...payload, location_key: e.target.value })}>
          {guide === "grad" ? (
            <>
              {locationKey && !spots.some((s) => String(s.id) === locationKey) && (
                <option value={locationKey}>spot #{locationKey}</option>
              )}
              {spots.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.school_short} — {s.name}</option>
              ))}
            </>
          ) : (
            guideLocationKeys(guide).map((k) => <option key={k} value={k}>{k}</option>)
          )}
        </select>
      </div>
      {guide === "grad" ? (
        <p style={{ fontSize: 12, color: T.inkSoft, alignSelf: "end", margin: 0 }}>
          Publishing replaces this spot&rsquo;s current photo on the campus spots guide
          (takedown restores it).
        </p>
      ) : (
        <>
          <Field name="Alt text" value={str(payload.alt_text)} disabled={disabled}
            onChange={(v) => onEdit({ ...payload, alt_text: v })} />
          <Field name="Caption (shown on the guide page)" value={str(payload.caption)} disabled={disabled}
            onChange={(v) => onEdit({ ...payload, caption: v })} />
        </>
      )}
    </div>
  );
}

export function TestimonialEditor({ payload, onEdit, disabled }: EditorProps) {
  return (
    <Field name="Quote excerpt" multiline value={str(payload.quote_excerpt)} disabled={disabled}
      onChange={(v) => onEdit({ ...payload, quote_excerpt: v })} />
  );
}

export function LinksEditor({ payload, onEdit, disabled }: EditorProps) {
  const links = Array.isArray(payload.links)
    ? (payload.links as { url: string; label: string; reason?: string }[]) : [];
  return (
    <div style={{ display: "grid", gap: 6 }}>
      {links.map((link, i) => (
        <div key={`${link.url}-${i}`} style={{ display: "flex", gap: 6, fontSize: 13, alignItems: "center" }}>
          <code style={{ whiteSpace: "nowrap" }}>{link.url}</code>
          <input style={input} value={link.label} disabled={disabled}
            onChange={(e) => {
              const next = links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l));
              onEdit({ ...payload, links: next });
            }} />
          <button style={{ border: "none", background: "none", cursor: "pointer", color: "inherit" }}
            disabled={disabled}
            onClick={() => onEdit({ ...payload, links: links.filter((_, j) => j !== i) })}>
            ✕
          </button>
        </div>
      ))}
      {links.length === 0 && <span style={{ fontSize: 13, opacity: 0.7 }}>No links suggested.</span>}
    </div>
  );
}
