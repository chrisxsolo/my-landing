"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/uploadImage";
import { C } from "@/lib/colors";
import {
  BAY_AREA_REGION_OPTIONS,
  BAY_AREA_TAG_SUGGESTIONS,
  EMPTY_BAY_AREA_LOCATION_FORM,
  formatLocationTags,
  getLocationChipLabel,
  parseLocationTags,
  slugifyLocation,
  type BayAreaLocationEntry,
} from "@/lib/bayAreaLocations";

type BayAreaLocationForm = typeof EMPTY_BAY_AREA_LOCATION_FORM;

function getRegionLabel(region: string) {
  return BAY_AREA_REGION_OPTIONS.find((option) => option.value === region)?.label ?? region;
}

export default function BayAreaLocationsManager() {
  const [locations, setLocations] = useState<BayAreaLocationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingLocation, setEditingLocation] = useState<BayAreaLocationEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [form, setForm] = useState<BayAreaLocationForm>(EMPTY_BAY_AREA_LOCATION_FORM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const inp =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition-colors focus:border-violet-300";
  const ta = `${inp} resize-none`;
  const card = "overflow-hidden rounded-2xl border border-slate-100 bg-white";

  function showNotice(msg: string, ok = true) {
    setNotice({ msg, ok });
    window.setTimeout(() => setNotice(null), 3000);
  }

  function fetchLocations() {
    supabase
      .from("bay_area_locations")
      .select("*")
      .order("region", { ascending: true })
      .order("order", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          showNotice(`Failed to load locations: ${error.message}`, false);
          setLoading(false);
          return;
        }
        setLocations((data ?? []) as BayAreaLocationEntry[]);
        setLoading(false);
      });
  }

  useEffect(() => {
    fetchLocations();
  }, []);

  function startEdit(location: BayAreaLocationEntry) {
    setEditingLocation(location);
    setForm({
      title: location.title,
      slug: location.slug,
      region: location.region,
      city: location.city,
      neighborhood: location.neighborhood ?? "",
      description: location.description,
      best_for: location.best_for,
      best_time: location.best_time,
      tip: location.tip,
      tags: formatLocationTags(location.tags),
      order: String(location.order),
      active: location.active,
    });
    setImageFile(null);
    setImagePreview(location.image_url ?? null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingLocation(null);
    setForm(EMPTY_BAY_AREA_LOCATION_FORM);
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function appendTag(tag: string) {
    const next = Array.from(new Set([...parseLocationTags(form.tags), tag]));
    setForm((current) => ({ ...current, tags: next.join(", ") }));
  }

  async function saveLocation() {
    if (
      !form.title ||
      !form.city ||
      !form.description ||
      !form.best_for ||
      !form.best_time ||
      !form.tip
    ) {
      showNotice("Title, city, description, best for, best time, and tip are required.", false);
      return;
    }

    setSaving(true);
    let imageUrl = editingLocation?.image_url ?? null;

    if (imageFile) {
      const uploadedUrl = await uploadImage(imageFile, "bay-area-locations", showNotice);
      if (!uploadedUrl) {
        setSaving(false);
        return;
      }
      imageUrl = uploadedUrl;
    }

    const payload = {
      title: form.title,
      slug: form.slug || slugifyLocation(form.title),
      region: form.region,
      city: form.city,
      neighborhood: form.neighborhood || null,
      description: form.description,
      best_for: form.best_for,
      best_time: form.best_time,
      tip: form.tip,
      tags: parseLocationTags(form.tags),
      image_url: imageUrl,
      order: Number.parseInt(form.order, 10) || (editingLocation?.order ?? locations.length + 1),
      active: form.active,
    };

    if (editingLocation) {
      const res = await fetch("/api/admin/bay-area-locations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ id: editingLocation.id, updates: payload }),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Update failed." }));
        showNotice(`Update failed: ${error}`, false);
      } else {
        showNotice("Bay Area location updated.");
        cancelEdit();
        fetchLocations();
      }
    } else {
      const res = await fetch("/api/admin/bay-area-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: "Save failed." }));
        showNotice(`Save failed: ${error}`, false);
      } else {
        showNotice("Bay Area location saved.");
        cancelEdit();
        fetchLocations();
      }
    }

    setSaving(false);
  }

  async function deleteLocation(id: number) {
    const res = await fetch(`/api/admin/bay-area-locations?id=${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Delete failed." }));
      showNotice(`Delete failed: ${error}`, false);
      return;
    }

    setLocations((current) => current.filter((location) => location.id !== id));
    setDeleteConfirm(null);
    if (editingLocation?.id === id) cancelEdit();
    showNotice("Location deleted.");
  }

  return (
    <div className="space-y-6">
      {notice ? (
        <div
          className="rounded-2xl px-4 py-3 text-sm font-bold"
          style={{
            background: notice.ok ? C.p1_08 : "rgba(190,24,93,0.08)",
            color: notice.ok ? C.p1 : "#be123c",
            border: `1px solid ${notice.ok ? C.p1_20 : "rgba(190,24,93,0.18)"}`,
          }}
        >
          {notice.msg}
        </div>
      ) : null}

      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad23 }} />
        <div className="p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-slate-900">
                {editingLocation ? `Editing: ${editingLocation.title}` : "Add Bay Area Location"}
              </h2>
              <p className="mt-1 text-xs font-medium text-slate-400">
                This feeds the new public guide at <code>/bay-area-locations</code>.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/bay-area-locations"
                target="_blank"
                className="rounded-lg px-3 py-1.5 text-xs font-bold"
                style={{ background: C.p1_08, color: C.p1 }}
              >
                Open guide
              </a>
              {editingLocation ? (
                <button
                  onClick={cancelEdit}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-400"
                >
                  Cancel edit
                </button>
              ) : null}
            </div>
          </div>

          {editingLocation ? (
            <div
              className="mb-4 rounded-xl px-3 py-2 text-xs font-bold"
              style={{ background: C.p2_08, color: C.p2, border: `1px solid ${C.p2_18}` }}
            >
              Editing an existing location. Saving will overwrite the live entry.
            </div>
          ) : null}

          <div className="mb-4">
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-slate-400">
              Photo
            </label>
            {imagePreview ? (
              <div className="relative mb-2 h-52 w-full overflow-hidden rounded-xl">
                <img src={imagePreview} className="h-full w-full object-cover" />
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(editingLocation?.image_url ?? null);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                  className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm font-bold text-white"
                >
                  X
                </button>
                <button
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-2 right-2 rounded-full px-3 py-1.5 text-xs font-bold text-white"
                  style={{ background: C.p2_20 }}
                >
                  Change photo
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed"
                style={{ borderColor: C.p2_18, background: C.p2_06 }}
              >
                <span className="text-3xl">🗺️</span>
                <span className="text-xs font-bold" style={{ color: C.p2 }}>
                  Tap to upload a location image
                </span>
                <span className="text-xs text-slate-400">JPG, PNG, HEIC - stored in your existing grad-photos bucket</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageChange} />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Title
              </label>
              <input
                className={inp}
                placeholder="e.g. Baker Beach"
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                    slug: slugifyLocation(event.target.value),
                  }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Slug
              </label>
              <input
                className={inp}
                placeholder="baker-beach"
                value={form.slug}
                onChange={(event) =>
                  setForm((current) => ({ ...current, slug: slugifyLocation(event.target.value) }))
                }
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Region
              </label>
              <select
                className={inp}
                value={form.region}
                onChange={(event) => setForm((current) => ({ ...current, region: event.target.value }))}
              >
                {BAY_AREA_REGION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                City
              </label>
              <input
                className={inp}
                placeholder="San Francisco"
                value={form.city}
                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Neighborhood
              </label>
              <input
                className={inp}
                placeholder="Optional"
                value={form.neighborhood}
                onChange={(event) => setForm((current) => ({ ...current, neighborhood: event.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Order
              </label>
              <input
                className={inp}
                type="number"
                placeholder="e.g. 3"
                value={form.order}
                onChange={(event) => setForm((current) => ({ ...current, order: event.target.value }))}
              />
            </div>
          </div>

          <div className="mt-3 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Description
              </label>
              <textarea
                className={ta}
                rows={4}
                placeholder="What makes this location photograph well?"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                  Best For
                </label>
                <textarea
                  className={ta}
                  rows={3}
                  placeholder="Golden hour portraits, editorial couples photos..."
                  value={form.best_for}
                  onChange={(event) => setForm((current) => ({ ...current, best_for: event.target.value }))}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                  Best Time
                </label>
                <textarea
                  className={ta}
                  rows={3}
                  placeholder="About an hour before sunset..."
                  value={form.best_time}
                  onChange={(event) => setForm((current) => ({ ...current, best_time: event.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Pro Tip
              </label>
              <textarea
                className={ta}
                rows={3}
                placeholder="Parking tip, crowd timing, styling note..."
                value={form.tip}
                onChange={(event) => setForm((current) => ({ ...current, tip: event.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-400">
                Tags
              </label>
              <input
                className={inp}
                placeholder="south-bay, beaches, sunset"
                value={form.tags}
                onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {BAY_AREA_TAG_SUGGESTIONS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => appendTag(tag)}
                    className="rounded-full px-3 py-1 text-xs font-bold"
                    style={{ background: C.surfaceWarmAlt, border: `1px solid ${C.borderSubtle}`, color: C.p1 }}
                  >
                    + {getLocationChipLabel(tag)}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-400">
                Comma-separated tags power the public filter chips and search.
              </p>
            </div>

            <label className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-slate-700" style={{ background: C.surfaceWarm }}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
              />
              Show this location publicly
            </label>

            <button
              onClick={saveLocation}
              disabled={saving}
              className="mt-2 w-full rounded-xl py-3 text-sm font-bold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: C.grad23, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : editingLocation ? "Update Location ✓" : "Save Location ->"}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        [...Array(3)].map((_, index) => (
          <div
            key={index}
            className="h-20 animate-pulse rounded-2xl"
            style={{ background: `linear-gradient(135deg, ${C.p2_08}, ${C.p3_08})` }}
          />
        ))
      ) : (
        BAY_AREA_REGION_OPTIONS.map((region) => {
          const regionLocations = locations.filter((location) => location.region === region.value);
          if (regionLocations.length === 0) return null;

          return (
            <div key={region.value}>
              <div className="mb-3 flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.p2 }}>
                  {region.label}
                </p>
                <span className="text-xs font-bold text-slate-400">({regionLocations.length} spots)</span>
              </div>

              <div className="space-y-3">
                {regionLocations.map((location) => (
                  <div
                    key={location.id}
                    className={card}
                    style={editingLocation?.id === location.id ? { outline: `2px solid ${C.p2}` } : undefined}
                  >
                    <div className="flex">
                      {location.image_url ? (
                        <div className="h-24 w-24 flex-shrink-0 overflow-hidden">
                          <img src={location.image_url} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center text-3xl" style={{ background: C.p2_06 }}>
                          📍
                        </div>
                      )}

                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-black text-slate-900">{location.title}</p>
                              <span
                                className="rounded-md px-1.5 py-0.5 text-[10px] font-black"
                                style={{ background: C.p1_08, color: C.p1 }}
                              >
                                {getRegionLabel(location.region)}
                              </span>
                              {!location.active ? (
                                <span
                                  className="rounded-md px-1.5 py-0.5 text-[10px] font-black"
                                  style={{ background: "rgba(148,163,184,0.12)", color: "#64748b" }}
                                >
                                  Hidden
                                </span>
                              ) : null}
                            </div>
                            <p className="text-xs font-medium text-slate-400">
                              {location.city}
                              {location.neighborhood ? ` · ${location.neighborhood}` : ""} · #{location.order}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">
                              {location.best_for}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {location.tags.slice(0, 4).map((tag) => (
                                <span
                                  key={tag}
                                  className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                                  style={{ background: C.surfaceWarmAlt, color: "#64748b" }}
                                >
                                  {getLocationChipLabel(tag)}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-shrink-0 gap-2">
                            {editingLocation?.id !== location.id ? (
                              <button
                                onClick={() => startEdit(location)}
                                className="rounded-lg px-3 py-1.5 text-xs font-bold"
                                style={{ background: C.p2_08, color: C.p2 }}
                              >
                                Edit
                              </button>
                            ) : null}

                            {deleteConfirm === location.id ? (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => deleteLocation(location.id)}
                                  className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                                  style={{ background: "#be123c" }}
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-bold text-slate-500"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(location.id)}
                                className="px-1 text-xs font-bold text-slate-300 transition-colors hover:text-red-400"
                              >
                                🗑
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
