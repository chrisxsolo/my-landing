"use client";

// Admin → About Page — Fact Photos. Manage the optional photo for each fact
// card on /about. Fact text lives in lib/aboutFacts.ts (edit in code); photos
// and alt text are managed here. Cards without a photo render text-only.

import { useCallback, useEffect, useRef, useState } from "react";
import { ABOUT_FACTS } from "@/lib/aboutFacts";
import {
  ALLOWED_ADMIN_PHOTO_TYPES,
  validateAdminPhotoFile,
  validatePhotoAltText,
} from "@/lib/photoAdminShared";

type PhotoRow = {
  id: string;
  fact_slug: string;
  image_url: string;
  storage_path: string;
  alt_text: string | null;
};

type Props = { showToast: (message: string, ok?: boolean) => void };

const API = "/api/admin/about-photos";

export default function AboutPhotosTab({ showToast }: Props) {
  // slug → PhotoRow for facts that already have a photo
  const [photoMap, setPhotoMap] = useState<Record<string, PhotoRow>>({});
  const [loading, setLoading] = useState(true);
  // per-fact controlled alt-text draft
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  // per-fact file selection
  const [fileDrafts, setFileDrafts] = useState<Record<string, File | null>>({});
  // which fact slug is currently busy (upload / patch / delete)
  const [busySlug, setBusySlug] = useState<string | null>(null);
  // one ref per fact for resetting the file input
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  function revalidate() {
    fetch("/api/admin/revalidate", { method: "POST" }).catch(() => {});
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load photos");
      const rows: PhotoRow[] = json.photos ?? [];
      const map: Record<string, PhotoRow> = {};
      const drafts: Record<string, string> = {};
      for (const row of rows) {
        map[row.fact_slug] = row;
        drafts[row.fact_slug] = row.alt_text ?? "";
      }
      setPhotoMap(map);
      setAltDrafts((prev) => {
        // seed new slugs; preserve any draft the user has already typed
        const next = { ...prev };
        for (const [slug, val] of Object.entries(drafts)) {
          if (!(slug in next)) next[slug] = val;
        }
        return next;
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load photos", false);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  async function handleUpload(slug: string) {
    const file = fileDrafts[slug] ?? null;
    const alt = (altDrafts[slug] ?? "").trim();

    const fileCheck = validateAdminPhotoFile(file);
    if (!fileCheck.ok) { showToast(fileCheck.error, false); return; }
    const altCheck = validatePhotoAltText(alt);
    if (!altCheck.ok) { showToast(altCheck.error, false); return; }

    setBusySlug(slug);
    try {
      const fd = new FormData();
      fd.append("file", file!);
      fd.append("fact_slug", slug);
      fd.append("alt_text", alt);
      const res = await fetch(API, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      // update local state from response
      const updated: PhotoRow = json.photo;
      setPhotoMap((prev) => ({ ...prev, [slug]: updated }));
      setAltDrafts((prev) => ({ ...prev, [slug]: updated.alt_text ?? "" }));
      setFileDrafts((prev) => ({ ...prev, [slug]: null }));
      const ref = fileRefs.current[slug];
      if (ref) ref.value = "";
      showToast("Photo saved!");
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload failed", false);
    } finally {
      setBusySlug(null);
    }
  }

  async function handleSaveAlt(slug: string) {
    const alt = (altDrafts[slug] ?? "").trim();
    const altCheck = validatePhotoAltText(alt);
    if (!altCheck.ok) { showToast(altCheck.error, false); return; }

    setBusySlug(slug);
    try {
      const res = await fetch(API, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fact_slug: slug, alt_text: alt }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      const updated: PhotoRow = json.photo;
      setPhotoMap((prev) => ({ ...prev, [slug]: updated }));
      setAltDrafts((prev) => ({ ...prev, [slug]: updated.alt_text ?? "" }));
      showToast("Alt text saved!");
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", false);
    } finally {
      setBusySlug(null);
    }
  }

  async function handleRemove(slug: string) {
    if (!window.confirm("Remove this photo? The fact card goes back to text-only.")) return;
    setBusySlug(slug);
    try {
      const res = await fetch(API, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fact_slug: slug }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Remove failed");
      if (json.cleanup_warning) showToast(json.cleanup_warning, false);
      else showToast("Photo removed.");
      setPhotoMap((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      setAltDrafts((prev) => ({ ...prev, [slug]: "" }));
      setFileDrafts((prev) => ({ ...prev, [slug]: null }));
      const ref = fileRefs.current[slug];
      if (ref) ref.value = "";
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Remove failed", false);
    } finally {
      setBusySlug(null);
    }
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-800">About page — fact photos</h2>
        <p className="text-sm text-slate-500 mt-1">
          Fact text is edited in code (<code className="font-mono text-xs bg-slate-100 px-1 rounded">lib/aboutFacts.ts</code>).
          Manage photos and alt text here. Cards without a photo render text-only on{" "}
          <a href="/about" target="_blank" rel="noopener noreferrer" className="underline text-emerald-700 hover:text-emerald-800">/about ↗</a>.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-4">
          {ABOUT_FACTS.map((fact) => {
            const photo = photoMap[fact.slug];
            const hasPhoto = !!photo;
            const busy = busySlug === fact.slug;
            const altVal = altDrafts[fact.slug] ?? "";
            const fileVal = fileDrafts[fact.slug] ?? null;

            return (
              <li
                key={fact.slug}
                className={`rounded-xl border bg-white p-4 transition-opacity ${busy ? "opacity-60" : ""} ${hasPhoto ? "border-emerald-300" : "border-slate-200"}`}
              >
                {/* Fact header */}
                <div className="flex items-start gap-3 mb-3">
                  {/* Thumbnail or badge */}
                  {hasPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.image_url}
                      alt={photo.alt_text ?? ""}
                      className="h-20 w-28 flex-shrink-0 rounded-lg object-cover bg-slate-100"
                    />
                  ) : (
                    <div className="h-20 w-28 flex-shrink-0 rounded-lg bg-slate-100 flex items-center justify-center">
                      <span className="text-[11px] font-bold text-slate-400 text-center leading-tight px-2">No photo yet</span>
                    </div>
                  )}

                  {/* Fact meta */}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-800">{fact.title}</p>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">{fact.slug}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{fact.body}</p>
                  </div>
                </div>

                {/* Alt text input */}
                <input
                  type="text"
                  value={altVal}
                  onChange={(e) => setAltDrafts((prev) => ({ ...prev, [fact.slug]: e.target.value }))}
                  placeholder="Descriptive alt text (required)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm mb-3"
                  disabled={busy}
                />

                {/* File input */}
                <input
                  ref={(el) => { fileRefs.current[fact.slug] = el; }}
                  type="file"
                  accept={ALLOWED_ADMIN_PHOTO_TYPES.join(",")}
                  onChange={(e) => setFileDrafts((prev) => ({ ...prev, [fact.slug]: e.target.files?.[0] ?? null }))}
                  className="block text-sm text-slate-600 mb-3"
                  disabled={busy}
                />

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpload(fact.slug)}
                    disabled={busy || !fileVal}
                    className="inline-flex items-center rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {busy ? "Saving…" : hasPhoto ? "Replace photo" : "Upload photo"}
                  </button>

                  {hasPhoto && (
                    <button
                      type="button"
                      onClick={() => handleSaveAlt(fact.slug)}
                      disabled={busy}
                      className="inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Save alt text
                    </button>
                  )}

                  {hasPhoto && (
                    <button
                      type="button"
                      onClick={() => handleRemove(fact.slug)}
                      disabled={busy}
                      className="inline-flex items-center rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
