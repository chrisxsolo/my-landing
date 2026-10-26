"use client";

// One photo in Admin → Page Photos: thumbnail, where it came from, and the
// per-page actions (hero, pin + order, hide). Saving is done by the parent.

import type { PageViewPhoto } from "@/lib/pagePhotos/adminView";
import type { CurationAction } from "@/lib/pagePhotos/curationStore";

type Props = {
  photo: PageViewPhoto;
  busy: boolean;
  onAction: (action: CurationAction) => void;
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

export default function PagePhotoCard({ photo, busy, onAction }: Props) {
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
    </li>
  );
}
