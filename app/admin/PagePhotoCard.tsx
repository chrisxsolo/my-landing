"use client";

// One photo in Admin → Page Photos: thumbnail, where it came from, and the
// per-page actions (hero, pin + order, hide). On a school page with a location
// guide it also sets the photo's campus spot. Saving is done by the parent.

import type { PageViewPhoto, SpotOption } from "@/lib/pagePhotos/adminView";
import type { CurationAction } from "@/lib/pagePhotos/curationStore";

type Props = {
  photo: PageViewPhoto;
  busy: boolean;
  onAction: (action: CurationAction) => void;
  spots: SpotOption[];
  onSpot: (spotKey: string | null, featured: boolean) => void;
};

const BTN = "rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40";
const THUMB_WIDTH = 360;

// A small transformed copy keeps the admin grid light.
export function thumbUrl(url: string) {
  return url.includes("/storage/v1/object/public/")
    ? `${url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/")}?width=${THUMB_WIDTH}&resize=contain`
    : url;
}

function Badge({ tone, children }: { tone: "green" | "amber" | "slate" | "violet"; children: React.ReactNode }) {
  const tones = {
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    slate: "bg-slate-100 text-slate-600",
    violet: "bg-violet-100 text-violet-700",
  };
  return <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${tones[tone]}`}>{children}</span>;
}

// Campus spot for the school's location guide. Only the photographer sets it;
// a text hint is offered as a one-click suggestion, never applied on its own.
function SpotPicker({ photo, busy, spots, onSpot }: Pick<Props, "photo" | "busy" | "spots" | "onSpot">) {
  if (spots.length === 0) return null;
  const hint = spots.find((s) => s.key === photo.spotHint);
  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <label className="block text-[11px] font-semibold text-slate-600">
        Guide spot
        <select
          className="mt-0.5 w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800"
          value={photo.spotKey ?? ""}
          disabled={busy}
          onChange={(e) => onSpot(e.target.value || null, false)}
        >
          <option value="">Not tagged (gallery only)</option>
          {spots.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
        </select>
      </label>
      {photo.spotKey && (
        <button type="button" className={`${BTN} mt-1`} disabled={busy} onClick={() => onSpot(photo.spotKey, !photo.spotFeatured)}>
          {photo.spotFeatured ? "★ Featured for spot" : "☆ Feature for spot"}
        </button>
      )}
      {hint && (
        <p className="mt-1 text-[11px] text-slate-500">
          {photo.spotHintSource === "place"
            ? `Shot at ${hint.name}: shown in its section until you tag photos for it.`
            : `Photo text mentions ${hint.name}.`}{" "}
          <button type="button" className="font-semibold text-emerald-700 hover:underline disabled:opacity-40" disabled={busy} onClick={() => onSpot(hint.key, false)}>
            Confirm
          </button>
        </p>
      )}
    </div>
  );
}

export default function PagePhotoCard({ photo, busy, onAction, spots, onSpot }: Props) {
  const pinned = photo.mode === "pin";
  const hidden = photo.mode === "hide";
  return (
    <li className={`rounded-xl border bg-white p-2 ${photo.isHero ? "border-emerald-400" : "border-slate-200"} ${busy ? "opacity-60" : ""}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={thumbUrl(photo.url)}
        alt={photo.alt}
        loading="lazy"
        className={`aspect-[4/5] w-full rounded-lg object-cover bg-slate-100 ${hidden ? "opacity-40" : ""}`}
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {photo.isHero && <Badge tone="green">HERO</Badge>}
        {pinned && !photo.isHero && <Badge tone="violet">Pinned</Badge>}
        {hidden && <Badge tone="amber">Hidden here</Badge>}
        <Badge tone="slate">{photo.origin === "own" ? "Placed here" : "Matched"}</Badge>
      </div>
      <p className="mt-1 text-[11px] leading-snug text-slate-500" title={photo.alt}>{photo.why}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {hidden ? (
          <button type="button" className={BTN} disabled={busy} onClick={() => onAction("unhide")}>Show here</button>
        ) : (
          <>
            <button type="button" className={BTN} disabled={busy || photo.isHero} onClick={() => onAction("hero")}>Hero</button>
            <button type="button" className={BTN} disabled={busy} onClick={() => onAction(pinned ? "unpin" : "pin")}>
              {pinned ? "Unpin" : "Pin"}
            </button>
            {pinned && !photo.isHero && (
              <>
                <button type="button" className={BTN} disabled={busy} onClick={() => onAction("up")} aria-label="Move earlier">↑</button>
                <button type="button" className={BTN} disabled={busy} onClick={() => onAction("down")} aria-label="Move later">↓</button>
              </>
            )}
            <button type="button" className="rounded border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40" disabled={busy} onClick={() => onAction("hide")}>
              Hide here
            </button>
          </>
        )}
      </div>
      <SpotPicker photo={photo} busy={busy} spots={spots} onSpot={onSpot} />
    </li>
  );
}
