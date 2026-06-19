"use client";

// Admin → Family Guide. Upload and manage the photo gallery for each family
// location: choose the location, upload images with alt text + optional caption,
// mark featured/hero, publish or unpublish, reorder, replace, delete, and preview
// the live gallery. All writes go through /api/admin/family-photos (requireAdmin +
// service role); this component never touches Supabase directly.

import { useCallback, useEffect, useRef, useState } from "react";
import { FAMILY_PHOTO_LOCATION_OPTIONS, MAX_FAMILY_PHOTO_BYTES, ALLOWED_FAMILY_PHOTO_TYPES } from "@/lib/familyPhotosAdmin";
import { uploadToSignedTarget } from "@/lib/adminSignedUpload";

type Photo = {
  id: string;
  location_slug: string;
  image_url: string;
  alt_text: string | null;
  caption: string | null;
  featured: boolean;
  published: boolean;
  sort_order: number;
};

type Props = { showToast: (message: string, ok?: boolean) => void };

const API = "/api/admin/family-photos";

export default function FamilyGuideTab({ showToast }: Props) {
  const [slug, setSlug] = useState(FAMILY_PHOTO_LOCATION_OPTIONS[0]?.slug ?? "");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Upload form state
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (locationSlug: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}?location=${encodeURIComponent(locationSlug)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load photos");
      setPhotos(json.photos ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load photos", false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { if (slug) load(slug); }, [slug, load]);

  async function revalidate() {
    try { await fetch("/api/admin/revalidate", { method: "POST" }); } catch { /* non-fatal */ }
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { showToast("Choose an image first.", false); return; }
    if (!ALLOWED_FAMILY_PHOTO_TYPES.includes(file.type as typeof ALLOWED_FAMILY_PHOTO_TYPES[number])) {
      showToast("Image must be JPEG, PNG, WebP, or AVIF.", false); return;
    }
    if (file.size > MAX_FAMILY_PHOTO_BYTES) { showToast("Image must be 10 MB or smaller.", false); return; }
    if (!alt.trim()) { showToast("Descriptive alt text is required.", false); return; }

    setUploading(true);
    try {
      const { path } = await uploadToSignedTarget("family-photos", slug, file);
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location_slug: slug, storage_path: path, alt_text: alt.trim(), caption: caption.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setFile(null); setAlt(""); setCaption("");
      if (fileRef.current) fileRef.current.value = "";
      showToast("Photo uploaded (draft — publish it when ready).");
      await load(slug);
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed", false);
    } finally {
      setUploading(false);
    }
  }

  async function patch(body: Record<string, unknown>, okMsg: string) {
    const id = typeof body.id === "string" ? body.id : null;
    setBusyId(id);
    try {
      const res = await fetch(API, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Update failed");
      showToast(okMsg);
      await load(slug);
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Update failed", false);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(photo: Photo) {
    if (!confirm("Delete this photo? The image file is removed from storage too.")) return;
    setBusyId(photo.id);
    try {
      const res = await fetch(API, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: photo.id }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
      if (json.cleanup_warning) showToast(json.cleanup_warning, false);
      else showToast("Photo deleted.");
      await load(slug);
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Delete failed", false);
    } finally {
      setBusyId(null);
    }
  }

  async function replace(photo: Photo, newFile: File) {
    setBusyId(photo.id);
    try {
      const { path } = await uploadToSignedTarget("family-photos", slug, newFile);
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ location_slug: slug, storage_path: path, alt_text: photo.alt_text ?? "Family photo", caption: photo.caption ?? null, replaceId: photo.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Replace failed");
      showToast("Photo replaced.");
      await load(slug);
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Replace failed", false);
    } finally {
      setBusyId(null);
    }
  }

  async function move(index: number, dir: -1 | 1) {
    const next = [...photos];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPhotos(next); // optimistic
    await patch({ action: "reorder", location_slug: slug, orderedIds: next.map((p) => p.id) }, "Order updated.");
  }

  // The hero is the featured photo (falls back to the first published, then first).
  const heroId = (photos.find((p) => p.featured && p.published) ?? photos.find((p) => p.published) ?? photos[0])?.id;
  const publishedCount = photos.filter((p) => p.published).length;

  return (
    <div className="max-w-4xl">
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-800">Family Guide</h2>
        <p className="text-sm text-slate-500 mt-1">
          Upload and manage the gallery for each family location. Photos start as drafts — publish them when a location is ready.
        </p>
      </div>

      {/* Location selector */}
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <label className="text-sm font-semibold text-slate-700">
          Location
          <select
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="block mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal text-slate-800 bg-white"
          >
            {FAMILY_PHOTO_LOCATION_OPTIONS.map((o) => (
              <option key={o.slug} value={o.slug}>{o.label}{o.published ? "" : " (location draft)"}</option>
            ))}
          </select>
        </label>
        <a
          href={`/family-guide/locations/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-emerald-700 hover:text-emerald-800 underline pb-2"
        >
          Preview location page ↗
        </a>
        <span className="text-xs text-slate-500 pb-2">{publishedCount} published · {photos.length} total</span>
      </div>

      {/* Upload form */}
      <form onSubmit={handleUpload} className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-6">
        <p className="text-sm font-bold text-slate-700 mb-3">Upload a photo</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_FAMILY_PHOTO_TYPES.join(",")}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-700"
          />
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption (optional)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-800"
          />
        </div>
        <input
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="Descriptive alt text (required) — e.g. Family walking near the Palace of Fine Arts"
          className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white text-slate-800"
        />
        <button
          type="submit"
          disabled={uploading}
          className="mt-3 inline-flex items-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Upload photo"}
        </button>
      </form>

      {/* Photo list */}
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="text-sm text-slate-500">No photos yet for this location. Upload one above.</p>
      ) : (
        <ul className="space-y-3">
          {photos.map((p, i) => (
            <li key={p.id} className={`flex gap-4 rounded-xl border bg-white p-3 ${busyId === p.id ? "opacity-60" : ""} ${p.id === heroId ? "border-emerald-400" : "border-slate-200"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_url} alt={p.alt_text ?? ""} className="h-24 w-24 flex-shrink-0 rounded-lg object-cover bg-slate-100" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {p.id === heroId && <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">HERO</span>}
                  <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${p.published ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {p.published ? "Published" : "Draft"}
                  </span>
                  {p.featured && p.id !== heroId && <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">Featured</span>}
                </div>
                <input
                  type="text"
                  defaultValue={p.alt_text ?? ""}
                  onBlur={(e) => { if (e.target.value.trim() && e.target.value.trim() !== (p.alt_text ?? "")) patch({ id: p.id, alt_text: e.target.value }, "Alt text saved."); }}
                  placeholder="Alt text"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs mb-1 bg-white text-slate-800"
                />
                <input
                  type="text"
                  defaultValue={p.caption ?? ""}
                  onBlur={(e) => { if (e.target.value.trim() !== (p.caption ?? "")) patch({ id: p.id, caption: e.target.value }, "Caption saved."); }}
                  placeholder="Caption (optional)"
                  className="w-full rounded border border-slate-200 px-2 py-1 text-xs bg-white text-slate-800"
                />
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  <button onClick={() => patch({ id: p.id, published: !p.published }, p.published ? "Unpublished." : "Published.")} className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50">
                    {p.published ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => patch({ action: "setHero", id: p.id, location_slug: slug }, "Hero updated.")} disabled={p.id === heroId} className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                    Set as hero
                  </button>
                  <button onClick={() => move(i, -1)} disabled={i === 0} className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">↑</button>
                  <button onClick={() => move(i, 1)} disabled={i === photos.length - 1} className="rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">↓</button>
                  <label className="cursor-pointer rounded border border-slate-300 px-2 py-1 font-semibold text-slate-700 hover:bg-slate-50">
                    Replace
                    <input type="file" accept={ALLOWED_FAMILY_PHOTO_TYPES.join(",")} className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) replace(p, f); e.target.value = ""; }} />
                  </label>
                  <button onClick={() => remove(p)} className="rounded border border-red-200 px-2 py-1 font-semibold text-red-600 hover:bg-red-50">Delete</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
