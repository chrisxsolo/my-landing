"use client";

// One photo in Admin → Couples Portfolio: thumbnail, status badges, inline
// title/alt/session editing, and the publish / hero / featured / order / remove
// actions. All saving is done by the parent tab through the callbacks.

import type { CouplesPortfolioAdminRow, CouplesPortfolioUpdates } from "@/lib/couplesPortfolioAdmin";

type Props = {
  photo: CouplesPortfolioAdminRow;
  busy: boolean;
  isFirst: boolean;
  isLast: boolean;
  onUpdate: (updates: CouplesPortfolioUpdates, message: string) => void;
  onHero: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

const BTN = "rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40";

function saveOnBlur(
  value: string,
  current: string | null,
  key: "title" | "alt" | "session_label",
  onUpdate: Props["onUpdate"],
) {
  const next = value.trim();
  if (next === (current ?? "")) return;
  if (!next && key !== "session_label") return;
  onUpdate({ [key]: next || null }, "Saved.");
}

export default function CouplesPortfolioPhotoCard({ photo, busy, isFirst, isLast, onUpdate, onHero, onMove, onRemove }: Props) {
  return (
    <li
      className={`flex gap-3 rounded-xl border bg-white p-3 ${busy ? "opacity-60" : ""} ${
        photo.category_hero ? "border-emerald-400" : "border-slate-200"
      } ${photo.published ? "" : "bg-slate-50"}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.image_url}
        alt={photo.alt}
        loading="lazy"
        className={`h-28 w-24 flex-shrink-0 rounded-lg object-cover bg-slate-100 ${photo.published ? "" : "opacity-50"}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          {photo.category_hero && <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">HERO</span>}
          <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${photo.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
            {photo.published ? "Published" : "Hidden"}
          </span>
          {photo.featured && <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Featured</span>}
          {!photo.width && <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">measuring size…</span>}
        </div>
        <input
          type="text"
          defaultValue={photo.title}
          onBlur={(e) => saveOnBlur(e.target.value, photo.title, "title", onUpdate)}
          aria-label="Photo title"
          className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold mb-1 bg-white text-slate-800"
        />
        <input
          type="text"
          defaultValue={photo.alt}
          onBlur={(e) => saveOnBlur(e.target.value, photo.alt, "alt", onUpdate)}
          aria-label="Alt text"
          placeholder="Alt text"
          className="w-full rounded border border-slate-200 px-2 py-1 text-xs mb-1 bg-white text-slate-800"
        />
        <input
          type="text"
          list="couples-session-labels"
          defaultValue={photo.session_label ?? ""}
          onBlur={(e) => saveOnBlur(e.target.value, photo.session_label, "session_label", onUpdate)}
          aria-label="Session"
          placeholder="Session"
          className="w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white text-slate-800"
        />
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <button
            type="button"
            onClick={() => onUpdate({ published: !photo.published }, photo.published ? "Hidden from the site." : "Published.")}
            disabled={photo.category_hero && photo.published}
            title={photo.category_hero && photo.published ? "Pick a different hero before hiding this photo" : undefined}
            className={BTN}
          >
            {photo.published ? "Hide" : "Publish"}
          </button>
          <button type="button" onClick={onHero} disabled={photo.category_hero} className={BTN}>Set as hero</button>
          <button type="button" onClick={() => onUpdate({ featured: !photo.featured }, photo.featured ? "Unfeatured." : "Featured.")} className={BTN}>
            {photo.featured ? "Unfeature" : "Feature"}
          </button>
          <button type="button" onClick={() => onMove(-1)} disabled={isFirst} className={BTN} aria-label="Move earlier">↑</button>
          <button type="button" onClick={() => onMove(1)} disabled={isLast} className={BTN} aria-label="Move later">↓</button>
          <button type="button" onClick={onRemove} className="rounded border border-red-200 px-2 py-1 font-semibold text-red-600 hover:bg-red-50">
            Remove
          </button>
        </div>
      </div>
    </li>
  );
}
