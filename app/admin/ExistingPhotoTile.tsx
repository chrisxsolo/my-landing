"use client";

// One thumbnail in the "Choose existing photo" picker grid, with its priority,
// approval, source and "used on N pages" badges. Presentational only.

export type PickerPhotoSource = "engine" | "portfolio" | "journal";

export type PickerPhoto = {
  id: string;
  /** engine = Content Engine photo (uuid id, can be attached to a guide); portfolio / journal = URL only. */
  source: PickerPhotoSource;
  sessionId: string;
  sessionName: string;
  serviceType: string;
  schoolSlug: string | null;
  locationLabel: string | null;
  thumbUrl: string | null;
  webUrl: string | null;
  alt: string | null;
  status: "approved" | "needs_approval" | "no_permission";
  tier: number;
  excluded: boolean;
  qualityScore: number | null;
  inGuide: { rowId: string; published: boolean; hero: boolean } | null;
  originLabel: string | null;
  /** Public pages showing the photo now; null when not counted. */
  usedOnPages: number | null;
};

const STATUS_BADGE: Record<PickerPhoto["status"], { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "bg-emerald-100 text-emerald-700" },
  needs_approval: { label: "Not approved", cls: "bg-amber-100 text-amber-800" },
  no_permission: { label: "No permission", cls: "bg-red-100 text-red-700" },
};

const SOURCE_LABEL: Record<PickerPhotoSource, string | null> = { engine: null, portfolio: "Portfolio", journal: "Journal" };

export function tierLabel(photo: PickerPhoto, isSpot: boolean): string | null {
  if (photo.inGuide) return photo.inGuide.hero ? "Current hero" : photo.inGuide.published ? "In gallery" : "In gallery (draft)";
  if (photo.tier === 1) return isSpot ? "This school" : "This location";
  if (photo.tier === 2) return "Same category";
  return null;
}

export function usageLabel(photo: Pick<PickerPhoto, "usedOnPages">): string | null {
  if (photo.usedOnPages === null) return null;
  if (photo.usedOnPages === 0) return "Not used yet";
  return `Used on ${photo.usedOnPages} page${photo.usedOnPages === 1 ? "" : "s"}`;
}

type Props = {
  photo: PickerPhoto;
  selected: boolean;
  isSpot: boolean;
  onSelect: () => void;
};

export default function ExistingPhotoTile({ photo, selected, isSpot, onSelect }: Props) {
  const badge = STATUS_BADGE[photo.status];
  const tier = tierLabel(photo, isSpot);
  const source = SOURCE_LABEL[photo.source];
  const usage = usageLabel(photo);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`group flex flex-col overflow-hidden rounded-xl border bg-white text-left transition ${selected ? "border-emerald-600 ring-2 ring-emerald-600" : "border-slate-200 hover:border-slate-400"}`}
    >
      <div className="relative aspect-[4/5] w-full bg-slate-100">
        {photo.thumbUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.thumbUrl} alt={photo.alt ?? ""} loading="lazy" className={`h-full w-full object-cover ${photo.status === "approved" ? "" : "opacity-80"}`} />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">No preview</div>
        )}
        <div className="absolute left-1.5 right-1.5 top-1.5 flex flex-wrap gap-1">
          {tier && <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">{tier}</span>}
          {source && <span className="rounded bg-slate-100/95 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{source}</span>}
          {photo.excluded && <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-bold text-white">Curated out</span>}
        </div>
        <div className="absolute bottom-1.5 left-1.5 right-1.5 flex flex-wrap items-end justify-between gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${badge.cls}`}>{badge.label}</span>
          {usage && <span className="rounded bg-white/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{usage}</span>}
        </div>
      </div>
      <div className="px-2 py-1.5">
        <p className="truncate text-[11px] font-semibold text-slate-800">{photo.sessionName}</p>
        <p className="truncate text-[10px] text-slate-500">{photo.originLabel ?? photo.locationLabel ?? photo.serviceType}</p>
      </div>
    </button>
  );
}
