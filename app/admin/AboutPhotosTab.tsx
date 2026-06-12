"use client";

// Admin → About Page. Manage fact text, display order, and optional photos.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ABOUT_FACTS,
  orderAboutFacts,
  validateAboutFactContent,
  type AboutFact,
  type AboutFactContent,
} from "@/lib/aboutFacts";
import {
  validateAdminPhotoFile,
  validatePhotoAltText,
} from "@/lib/photoAdminShared";
import AboutFactEditorCard, { type AboutPhotoRow } from "@/app/admin/AboutFactEditorCard";

type Props = { showToast: (message: string, ok?: boolean) => void };

const API = "/api/admin/about-photos";
const DEFAULT_CONTENT_DRAFTS = Object.fromEntries(
  ABOUT_FACTS.map((fact) => [fact.slug, { title: fact.title, body: fact.body }]),
) as Record<string, AboutFactContent>;

// iPhone photos arrive as HEIC, which browsers can't display and the API
// rejects. Detect by MIME or extension (Windows often reports an empty type).
const HEIC_PATTERN = /\.(heic|heif)$/i;
function isHeicFile(file: File) {
  return ["image/heic", "image/heif"].includes(file.type.toLowerCase()) || HEIC_PATTERN.test(file.name);
}

/** Convert a HEIC file to JPEG in the browser (heic-to is loaded on demand). */
async function heicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import("heic-to/next");
  const blob = await heicTo({ blob: file, type: "image/jpeg", quality: 0.9 });
  return new File([blob], file.name.replace(HEIC_PATTERN, "") + ".jpg", { type: "image/jpeg" });
}

export default function AboutPhotosTab({ showToast }: Props) {
  const [facts, setFacts] = useState<readonly AboutFact[]>(ABOUT_FACTS);
  const [contentDrafts, setContentDrafts] = useState<Record<string, AboutFactContent>>(DEFAULT_CONTENT_DRAFTS);
  // slug → AboutPhotoRow for facts that already have a photo
  const [photoMap, setPhotoMap] = useState<Record<string, AboutPhotoRow>>({});
  const [loading, setLoading] = useState(true);
  // per-fact controlled alt-text draft
  const [altDrafts, setAltDrafts] = useState<Record<string, string>>({});
  // per-fact file selection
  const [fileDrafts, setFileDrafts] = useState<Record<string, File | null>>({});
  // which fact slug is currently busy (upload / patch / delete)
  const [busySlug, setBusySlug] = useState<string | null>(null);
  // which fact card a file is being dragged over (drop-target highlight)
  const [dragSlug, setDragSlug] = useState<string | null>(null);
  // which fact card is converting a HEIC file to JPEG
  const [convertingSlug, setConvertingSlug] = useState<string | null>(null);
  // display order of the fact cards on /about (slugs, top = shown first)
  const [orderSlugs, setOrderSlugs] = useState<string[]>(ABOUT_FACTS.map((f) => f.slug));
  const [savingOrder, setSavingOrder] = useState(false);
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
      const rows: AboutPhotoRow[] = json.photos ?? [];
      const map: Record<string, AboutPhotoRow> = {};
      const drafts: Record<string, string> = {};
      for (const row of rows) {
        map[row.fact_slug] = row;
        drafts[row.fact_slug] = row.alt_text ?? "";
      }
      const loadedFacts: AboutFact[] = Array.isArray(json.facts) ? json.facts : [...ABOUT_FACTS];
      setPhotoMap(map);
      setFacts(loadedFacts);
      setOrderSlugs(orderAboutFacts(json.order, loadedFacts).map((f) => f.slug));
      setContentDrafts(Object.fromEntries(
        loadedFacts.map((fact) => [fact.slug, { title: fact.title, body: fact.body }]),
      ));
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
      const updated: AboutPhotoRow = json.photo;
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

  /** Move a fact up or down in the display order and persist immediately. */
  async function moveFact(slug: string, direction: -1 | 1) {
    const from = orderSlugs.indexOf(slug);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= orderSlugs.length) return;
    const next = [...orderSlugs];
    [next[from], next[to]] = [next[to], next[from]];
    const previous = orderSlugs;
    setOrderSlugs(next); // optimistic — revert on failure
    setSavingOrder(true);
    try {
      const res = await fetch(API, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reorder", orderedSlugs: next }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Reorder failed");
      showToast("Order saved!");
      revalidate();
    } catch (err) {
      setOrderSlugs(previous);
      showToast(err instanceof Error ? err.message : "Reorder failed", false);
    } finally {
      setSavingOrder(false);
    }
  }

  /** Stage a picked or dropped file: convert HEIC to JPEG, validate, hold for upload. */
  async function stageFile(slug: string, file: File | null) {
    if (!file) return;
    let staged = file;
    if (isHeicFile(file)) {
      setConvertingSlug(slug);
      try {
        staged = await heicToJpeg(file);
      } catch (err) {
        // Some converters reject with plain {code,message} objects that log as
        // "{}" — stringify so the console always shows the real reason.
        console.error("[AboutPhotosTab] HEIC conversion failed:", err instanceof Error ? err : JSON.stringify(err));
        showToast("Couldn't convert that HEIC file — try exporting it as JPEG first.", false);
        return;
      } finally {
        setConvertingSlug(null);
      }
    }
    const fileCheck = validateAdminPhotoFile(staged);
    if (!fileCheck.ok) { showToast(fileCheck.error, false); return; }
    setFileDrafts((prev) => ({ ...prev, [slug]: staged }));
  }

  function handleDrop(slug: string, e: React.DragEvent) {
    e.preventDefault();
    setDragSlug(null);
    if (busySlug || convertingSlug) return;
    stageFile(slug, e.dataTransfer.files?.[0] ?? null);
  }

  function handleDragLeave(e: React.DragEvent) {
    // Ignore dragleave events fired when moving over child elements.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragSlug(null);
  }

  async function handleSaveContent(slug: string) {
    const draft = contentDrafts[slug];
    const contentCheck = validateAboutFactContent(draft);
    if (!contentCheck.ok) { showToast(contentCheck.error, false); return; }

    setBusySlug(slug);
    try {
      const res = await fetch(API, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "content", fact_slug: slug, ...contentCheck.content }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      const updated: AboutFact = json.fact;
      setFacts((prev) => prev.map((fact) => fact.slug === slug ? updated : fact));
      setContentDrafts((prev) => ({ ...prev, [slug]: { title: updated.title, body: updated.body } }));
      showToast("Fact text saved!");
      revalidate();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed", false);
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
      const updated: AboutPhotoRow = json.photo;
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
      <div className="mb-5">
        <h2 className="text-xl font-bold text-slate-800">About page facts</h2>
        <p className="text-sm text-slate-500 mt-1">
          Edit each fact&apos;s headline and description, manage its photo, and use ↑↓ to choose the display order.
          The top card shows first on{" "}
          <a href="/about" target="_blank" rel="noopener noreferrer" className="underline text-emerald-700 hover:text-emerald-800">/about ↗</a>.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <ul className="space-y-4">
          {orderAboutFacts(orderSlugs, facts).map((fact, factIndex, orderedFacts) => {
            const photo = photoMap[fact.slug];
            const busy = busySlug === fact.slug;
            const contentDraft = contentDrafts[fact.slug] ?? { title: fact.title, body: fact.body };
            const fileValue = fileDrafts[fact.slug] ?? null;

            return (
              <AboutFactEditorCard
                key={fact.slug}
                fact={fact}
                factIndex={factIndex}
                factCount={orderedFacts.length}
                photo={photo}
                contentDraft={contentDraft}
                contentDirty={contentDraft.title !== fact.title || contentDraft.body !== fact.body}
                altValue={altDrafts[fact.slug] ?? ""}
                fileValue={fileValue}
                busy={busy}
                dragging={dragSlug === fact.slug}
                converting={convertingSlug === fact.slug}
                savingOrder={savingOrder}
                registerFileInput={(element) => { fileRefs.current[fact.slug] = element; }}
                onContentChange={(content) => setContentDrafts((prev) => ({ ...prev, [fact.slug]: content }))}
                onSaveContent={() => handleSaveContent(fact.slug)}
                onAltChange={(value) => setAltDrafts((prev) => ({ ...prev, [fact.slug]: value }))}
                onStageFile={(file) => stageFile(fact.slug, file)}
                onUpload={() => {
                  if (fileValue) handleUpload(fact.slug);
                  else fileRefs.current[fact.slug]?.click();
                }}
                onSaveAlt={() => handleSaveAlt(fact.slug)}
                onRemove={() => handleRemove(fact.slug)}
                onMove={(direction) => moveFact(fact.slug, direction)}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!busy) setDragSlug(fact.slug);
                }}
                onDragLeave={handleDragLeave}
                onDrop={(event) => handleDrop(fact.slug, event)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
