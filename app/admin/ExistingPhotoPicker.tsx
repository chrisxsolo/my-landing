"use client";

// "Choose existing photo" — a reusable modal that browses photos the site
// already has (Content Engine, Portfolio, older journal posts) and puts one to
// work without a new upload.
//
//   mode "gallery"  (couples / family / portrait location galleries)
//     Set as hero image  → links the photo to the guide, publishes it, and makes
//                          it the hero in one step; the old hero stays in the gallery.
//     Add as draft       → links it as an unpublished gallery photo.
//     (Content Engine photos only: the guide RPC links by session photo id.)
//   mode "pick"     (grad campus spots, journal covers, placement replacements)
//     Use this photo     → returns the photo's public web URL to the caller.
//
// Targets rank the Content Engine library for one destination; the `library`
// target (no destination) suits a journal cover or a replacement and browses
// everything by default. Photos without a public web copy are "Not approved":
// the admin must tick the approval box first, which builds that one web copy
// (as the engine does on publish). All reads/writes go through
// /api/admin/guide-photo-library; every thumbnail is a resized render, never
// the original.

import { useCallback, useEffect, useState } from "react";
import ExistingPhotoTile, { tierLabel, usageLabel, type PickerPhoto } from "@/app/admin/ExistingPhotoTile";

const API = "/api/admin/guide-photo-library";

export type PickerTarget =
  | { guide: "couples" | "family" | "portrait"; slug: string; label: string }
  | { spotSchool: string; label: string }
  | { library: true; label: string };

export type PickerMode = "gallery" | "pick";

export interface PickerResult { url: string | null; alt: string | null }

type Props = {
  target: PickerTarget;
  mode: PickerMode;
  onClose: () => void;
  /** gallery: called after a successful attach. pick: called with the chosen web URL. */
  onDone: (result: PickerResult) => void;
  showToast: (message: string, ok?: boolean) => void;
  /** Preselects the school filter (a /grads slug). */
  school?: string;
};

type Library = {
  photos: PickerPhoto[];
  total: number;
  pageSize: number;
  locations: { key: string; label: string }[];
  categories: string[];
  schools: { slug: string; label: string }[];
};

const EMPTY: Library = { photos: [], total: 0, pageSize: 48, locations: [], categories: [], schools: [] };
const CONTROL = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800";

function targetQuery(target: PickerTarget): string {
  if ("library" in target) return "library=1";
  return "spotSchool" in target
    ? `spotSchool=${encodeURIComponent(target.spotSchool)}`
    : `guide=${target.guide}&slug=${encodeURIComponent(target.slug)}`;
}

async function postJson(body: Record<string, unknown>) {
  const res = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Request failed");
  return json as Record<string, unknown>;
}

export default function ExistingPhotoPicker({ target, mode, onClose, onDone, showToast, school: initialSchool = "" }: Props) {
  const [lib, setLib] = useState<Library>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");
  const [school, setSchool] = useState(initialSchool);
  const isLibrary = "library" in target;
  const [scope, setScope] = useState<"suggested" | "all">(isLibrary ? "all" : "suggested");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<PickerPhoto | null>(null);
  const isSpot = "spotSchool" in target;
  const tq = targetQuery(target); // stable string, so a new target object doesn't refetch

  // Debounce the search box.
  useEffect(() => {
    const t = setTimeout(() => { setQuery(q.trim()); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ scope, page: String(page) });
      if (query) params.set("q", query);
      if (location) params.set("location", location);
      if (category) params.set("category", category);
      if (school) params.set("school", school);
      const res = await fetch(`${API}?${tq}&${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load photos");
      setLib(json as Library);
    } catch (err) {
      console.error("[ExistingPhotoPicker] load failed", err);
      showToast(err instanceof Error ? err.message : "Failed to load photos", false);
    } finally {
      setLoading(false);
    }
  }, [tq, scope, page, query, location, category, school, showToast]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const pages = Math.max(1, Math.ceil(lib.total / lib.pageSize));
  const resetPage = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); setSelected(null); };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-5" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Choose an existing photo"
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Choose an existing photo</h3>
            <p className="text-sm text-slate-500">
              Photos already on the site, for <span className="font-semibold text-slate-700">{target.label}</span>. Nothing is re-uploaded.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="h-9 w-9 rounded-full bg-slate-100 text-lg font-bold text-slate-600 hover:bg-slate-200">×</button>
        </header>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search sessions, titles, posts…" aria-label="Search by session name" className={`${CONTROL} min-w-[12rem] flex-1`} />
          <select value={location} onChange={(e) => resetPage(setLocation)(e.target.value)} aria-label="Filter by location" className={CONTROL}>
            <option value="">All locations</option>
            {lib.locations.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
          <select value={category} onChange={(e) => resetPage(setCategory)(e.target.value)} aria-label="Filter by category" className={CONTROL}>
            <option value="">All categories</option>
            {lib.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={school} onChange={(e) => resetPage(setSchool)(e.target.value)} aria-label="Filter by school" className={CONTROL}>
            <option value="">All schools</option>
            {lib.schools.map((s) => <option key={s.slug} value={s.slug}>{s.label}</option>)}
          </select>
          <div className="flex rounded-lg border border-slate-300 p-0.5 text-xs font-semibold">
            {(["suggested", "all"] as const).map((s) => (
              <button key={s} type="button" onClick={() => resetPage(setScope)(s)} className={`rounded-md px-2.5 py-1.5 ${scope === s ? "bg-slate-800 text-white" : "text-slate-600"}`}>
                {s === "suggested" ? "Suggested" : "Whole library"}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[16rem] flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">Loading photos…</p>
          ) : lib.photos.length === 0 ? (
            <p className="text-sm text-slate-500">
              No photos match. {scope === "suggested" && <button type="button" className="font-semibold text-emerald-700 underline" onClick={() => resetPage(setScope)("all")}>Browse the whole library</button>}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {lib.photos.map((p) => (
                <ExistingPhotoTile key={p.id} photo={p} isSpot={isSpot} selected={selected?.id === p.id} onSelect={() => setSelected(p)} />
              ))}
            </div>
          )}
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm">
              <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded border border-slate-300 px-3 py-1 font-semibold text-slate-700 disabled:opacity-40">← Prev</button>
              <span className="text-slate-500">Page {page + 1} of {pages} · {lib.total} photos</span>
              <button type="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)} className="rounded border border-slate-300 px-3 py-1 font-semibold text-slate-700 disabled:opacity-40">Next →</button>
            </div>
          )}
        </div>

        {selected && (
          <SelectionBar key={selected.id} photo={selected} target={target} mode={mode} isSpot={isSpot} onDone={onDone} showToast={showToast} />
        )}
      </section>
    </div>
  );
}

type BarProps = {
  photo: PickerPhoto;
  target: PickerTarget;
  mode: PickerMode;
  isSpot: boolean;
  onDone: Props["onDone"];
  showToast: Props["showToast"];
};

function SelectionBar({ photo, target, mode, isSpot, onDone, showToast }: BarProps) {
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const needsApproval = photo.status === "needs_approval";
  const blocked = photo.status === "no_permission" || (needsApproval && !approved);
  const isHero = photo.inGuide?.hero && photo.inGuide.published;
  const engineOnly = mode === "gallery" && photo.source !== "engine";

  async function attach(hero: boolean) {
    if (!("guide" in target)) return;
    if (hero && !confirm(`Make this the hero image for ${target.label}? It will be published. The current hero stays in the gallery.`)) return;
    setBusy(true);
    try {
      const res = await postJson({ action: "attach", guide: target.guide, slug: target.slug, photoId: photo.id, hero, approve: needsApproval });
      showToast(hero ? "Hero image updated." : res.created ? "Added to the gallery as a draft." : "Already in this gallery.");
      onDone({ url: null, alt: photo.alt });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not update the guide", false);
    } finally {
      setBusy(false);
    }
  }

  async function pick() {
    setBusy(true);
    try {
      const url = needsApproval ? String((await postJson({ action: "approve", photoId: photo.id })).url) : photo.webUrl;
      onDone({ url, alt: photo.alt });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Could not approve the photo", false);
    } finally {
      setBusy(false);
    }
  }

  const btn = "rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40";
  return (
    <footer className="flex flex-wrap items-center gap-4 border-t border-slate-200 bg-slate-50 px-5 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {photo.thumbUrl && <img src={photo.thumbUrl} alt="" className="h-16 w-14 rounded-md object-cover" />}
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-semibold text-slate-800">{photo.sessionName}</p>
        <p className="text-xs text-slate-500">
          {[photo.originLabel, tierLabel(photo, isSpot), photo.locationLabel, photo.qualityScore ? `quality ${photo.qualityScore}/10` : null, usageLabel(photo)].filter(Boolean).join(" · ")}
        </p>
        {photo.status === "no_permission" && <p className="text-xs font-semibold text-red-700">This session has no marketing permission, so it can&apos;t be used publicly.</p>}
        {engineOnly && <p className="text-xs font-semibold text-amber-800">Only Content Engine photos can be linked to a guide gallery; this one is a {photo.source} image.</p>}
        {needsApproval && (
          <label className="mt-1 flex items-center gap-2 text-xs font-semibold text-amber-800">
            <input type="checkbox" checked={approved} onChange={(e) => setApproved(e.target.checked)} />
            Approve this photo for the public website (creates its web copy)
          </label>
        )}
      </div>
      {mode === "pick" ? (
        <button type="button" disabled={blocked || busy} onClick={pick} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}>
          {busy ? "Working…" : "Use this photo"}
        </button>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={blocked || busy || engineOnly || !!photo.inGuide} onClick={() => attach(false)} className={`${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-100`}>
            Add as draft
          </button>
          <button type="button" disabled={blocked || busy || engineOnly || !!isHero} onClick={() => attach(true)} className={`${btn} bg-emerald-700 text-white hover:bg-emerald-800`}>
            {busy ? "Working…" : isHero ? "Already the hero" : "Set as hero image"}
          </button>
        </div>
      )}
    </footer>
  );
}
