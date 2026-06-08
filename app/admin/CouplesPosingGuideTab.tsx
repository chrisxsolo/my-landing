"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { C } from "@/lib/colors";
import {
  COUPLES_INSPIRATION_CATEGORIES,
  type AdminCouplesPosingPrompt,
} from "@/lib/couplesPosingGuide";
import CouplesInspirationEditor, {
  type AdminInspirationImage,
} from "@/app/admin/CouplesInspirationEditor";
import CouplesPromptManager from "@/app/admin/CouplesPromptManager";

type Props = {
  showToast: (message: string, ok?: boolean) => void;
};

const visibilityLabel = {
  private: "Private",
  client_shareable: "Client Shareable",
  public: "Public",
};

export default function CouplesPosingGuideTab({ showToast }: Props) {
  const [view, setView] = useState<"prompts" | "photos">("prompts");
  const [prompts, setPrompts] = useState<AdminCouplesPosingPrompt[]>([]);
  const [images, setImages] = useState<AdminInspirationImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [visibility, setVisibility] = useState("All");
  const [published, setPublished] = useState("All");
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState<AdminInspirationImage | null>(null);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [bulkCategory, setBulkCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const showToastRef = useRef(showToast);

  useEffect(() => {
    showToastRef.current = showToast;
  }, [showToast]);

  const loadImages = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/couples-posing-guide");
      const json = await response.json();
      if (!response.ok) {
        showToastRef.current(json.error ?? "Could not load couples inspiration", false);
        return;
      }
      setImages(json.images ?? []);
      setSelected([]);
    } catch (error) {
      console.error("[couples-guide-admin] load failed", error);
      showToastRef.current("Could not load couples inspiration", false);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const response = await fetch("/api/admin/couples-posing-prompts");
      const json = await response.json();
      if (!response.ok) {
        showToastRef.current(json.error ?? "Could not load couples prompts", false);
        return;
      }
      setPrompts(json.prompts ?? []);
    } catch (error) {
      console.error("[couples-guide-admin] prompt load failed", error);
      showToastRef.current("Could not load couples prompts", false);
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadImages();
    void loadPrompts();
  }, [loadImages, loadPrompts]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return images.filter((image) => {
      if (category !== "All" && !image.categories.includes(category)) return false;
      if (visibility !== "All" && image.visibility !== visibility) return false;
      if (published === "Published" && !image.is_published) return false;
      if (published === "Unpublished" && image.is_published) return false;
      if (!needle) return true;
      return [
        image.title,
        image.internal_notes ?? "",
        image.client_notes ?? "",
        image.creator_name ?? "",
        ...image.tags,
        ...image.categories,
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [category, images, published, search, visibility]);

  function toggleSelected(id: string) {
    setDeleteArmed(false);
    setSelected((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  async function patchSelected(updates: Record<string, unknown>, ids = selected) {
    if (ids.length === 0) {
      showToast("Select at least one image", false);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/couples-posing-guide", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, updates }),
      });
      const json = await response.json();
      if (!response.ok) {
        showToast(json.error ?? "Update failed", false);
        return;
      }
      showToast(`${json.updated} image${json.updated === 1 ? "" : "s"} updated`);
      await loadImages();
    } catch (error) {
      console.error("[couples-guide-admin] update failed", error);
      showToast("Update failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function sendPatch(ids: string[], updates: Record<string, unknown>) {
    const response = await fetch("/api/admin/couples-posing-guide", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids, updates }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Update failed");
  }

  async function deleteSelected(ids = selected) {
    if (ids.length === 0) {
      showToast("Select at least one image", false);
      return;
    }
    if (!deleteArmed) {
      setSelected(ids);
      setDeleteArmed(true);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/couples-posing-guide", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const json = await response.json();
      if (!response.ok) {
        showToast(json.error ?? "Delete failed", false);
        return;
      }
      showToast(json.cleanup_warning ?? `${json.deleted} image${json.deleted === 1 ? "" : "s"} deleted`, !json.cleanup_warning);
      setDeleteArmed(false);
      await loadImages();
    } catch (error) {
      console.error("[couples-guide-admin] delete failed", error);
      showToast("Delete failed", false);
    } finally {
      setBusy(false);
    }
  }

  async function move(image: AdminInspirationImage, direction: -1 | 1) {
    const ordered = [...images].sort((a, b) =>
      a.display_order - b.display_order || a.created_at.localeCompare(b.created_at)
    );
    const index = ordered.findIndex((item) => item.id === image.id);
    const other = ordered[index + direction];
    if (!other) return;
    setBusy(true);
    try {
      const imageOrder = image.display_order || index + 1;
      const otherOrder = other.display_order || index + direction + 1;
      await Promise.all([
        sendPatch([image.id], { display_order: otherOrder }),
        sendPatch([other.id], { display_order: imageOrder }),
      ]);
      showToast("Display order updated");
      await loadImages();
    } catch (error) {
      console.error("[couples-guide-admin] reorder failed", error);
      showToast(error instanceof Error ? error.message : "Reorder failed", false);
    } finally {
      setBusy(false);
    }
  }

  const fieldClass = "min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: C.proAccent }}>Website tools</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-950">Couples Posing Guide</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">Add and edit posing prompts or upload visual references directly from your phone.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/couples-posing-guide?preview=client" target="_blank" className="inline-flex min-h-11 items-center rounded-xl border px-3 text-sm font-bold" style={{ borderColor: C.proAccentBorder, color: C.proAccent }}>Preview client view</Link>
          <button type="button" onClick={() => navigator.clipboard.writeText(`${window.location.origin}/couples-posing-guide`).then(() => showToast("Public link copied"))} className="min-h-11 rounded-xl px-3 text-sm font-black text-white" style={{ background: C.proAccent }}>Copy public link</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        <button type="button" onClick={() => setView("prompts")} className="min-h-12 rounded-xl text-sm font-black" style={view === "prompts" ? { background: C.proAccent, color: C.white } : { color: C.inkSoft }}>Prompts</button>
        <button type="button" onClick={() => setView("photos")} className="min-h-12 rounded-xl text-sm font-black" style={view === "photos" ? { background: C.proAccent, color: C.white } : { color: C.inkSoft }}>Photos</button>
      </div>

      {view === "prompts" ? (
        <CouplesPromptManager
          prompts={prompts}
          loading={promptsLoading}
          onChanged={loadPrompts}
          showToast={showToast}
        />
      ) : (
        <>
          <CouplesInspirationEditor
            editing={editing}
            prompts={prompts}
            onSaved={() => { setEditing(null); void loadImages(); }}
            onCancel={() => setEditing(null)}
            showToast={showToast}
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-4">
          <input className={fieldClass} type="search" placeholder="Search images..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)}><option>All</option>{COUPLES_INSPIRATION_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
          <select className={fieldClass} value={visibility} onChange={(event) => setVisibility(event.target.value)}><option>All</option><option value="private">Private</option><option value="client_shareable">Client Shareable</option><option value="public">Public</option></select>
          <select className={fieldClass} value={published} onChange={(event) => setPublished(event.target.value)}><option>All</option><option>Published</option><option>Unpublished</option></select>
        </div>

        {selected.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl p-3" style={{ background: C.proAccentSoft }}>
            <strong className="mr-auto text-sm" style={{ color: C.proAccentDark }}>{selected.length} selected</strong>
            <select className={fieldClass} value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value)}><option value="">Change category...</option>{COUPLES_INSPIRATION_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select>
            <button type="button" disabled={!bulkCategory || busy} onClick={() => patchSelected({ categories: [bulkCategory] })} className="min-h-11 rounded-xl bg-white px-3 text-sm font-bold text-slate-700">Apply category</button>
            <button type="button" disabled={busy} onClick={() => patchSelected({ visibility: "private" })} className="min-h-11 rounded-xl bg-white px-3 text-sm font-bold text-slate-700">Make private</button>
            <button type="button" disabled={busy} onClick={() => patchSelected({ visibility: "client_shareable" })} className="min-h-11 rounded-xl bg-white px-3 text-sm font-bold text-slate-700">Client shareable</button>
            <button type="button" disabled={busy} onClick={() => patchSelected({ is_published: true })} className="min-h-11 rounded-xl bg-white px-3 text-sm font-bold text-slate-700">Publish</button>
            <button type="button" disabled={busy} onClick={() => patchSelected({ is_published: false })} className="min-h-11 rounded-xl bg-white px-3 text-sm font-bold text-slate-700">Unpublish</button>
            <button type="button" disabled={busy} onClick={() => deleteSelected()} className="min-h-11 rounded-xl px-3 text-sm font-black text-white" style={{ background: C.danger }}>{deleteArmed ? "Confirm delete" : "Delete"}</button>
          </div>
        )}
          </section>

          {loading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="aspect-[4/5] animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: C.proAccentBorder, background: C.proAccentSoft }}>
          <p className="font-black text-slate-800">{images.length === 0 ? "No inspiration images have been added yet" : "No images match these filters"}</p>
          {images.length === 0 && <p className="mt-1 text-sm text-slate-500">Upload references from the admin dashboard to begin building the visual guide</p>}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {filtered.map((image) => (
            <article key={image.id} className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: selected.includes(image.id) ? C.proAccent : C.proBorder }}>
              <button type="button" className="relative block aspect-[4/5] w-full bg-slate-100" onClick={() => toggleSelected(image.id)}>
                {image.image_url ? (
                  // Admin results can include arbitrary private external references.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image.image_url} alt={image.alt_text || image.title} className="h-full w-full object-cover" />
                ) : <span className="grid h-full place-items-center text-sm font-bold text-slate-400">Image unavailable</span>}
                <span className="absolute left-2 top-2 rounded-full px-2 py-1 text-[10px] font-black text-white" style={{ background: image.visibility === "public" ? C.success : image.visibility === "client_shareable" ? C.proAccent : C.ink }}>{visibilityLabel[image.visibility]}</span>
                <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border-2 border-white text-xs font-black" style={{ background: selected.includes(image.id) ? C.proAccent : C.white, color: selected.includes(image.id) ? C.white : C.muted }}>{selected.includes(image.id) ? "✓" : ""}</span>
              </button>
              <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-black text-slate-900">{image.title}</h3>
                    <p className="mt-1 text-[11px] font-bold text-slate-400">{image.is_published ? "Published" : "Unpublished"} · Order {image.display_order}</p>
                  </div>
                  <button type="button" onClick={() => setEditing(image)} className="min-h-9 rounded-lg px-2 text-xs font-black" style={{ background: C.proAccentSoft, color: C.proAccent }}>Edit</button>
                </div>
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => move(image, -1)} className="min-h-9 flex-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-600" aria-label={`Move ${image.title} earlier`}>↑ Earlier</button>
                  <button type="button" disabled={busy} onClick={() => move(image, 1)} className="min-h-9 flex-1 rounded-lg bg-slate-100 text-xs font-bold text-slate-600" aria-label={`Move ${image.title} later`}>↓ Later</button>
                </div>
              </div>
            </article>
          ))}
        </div>
          )}
        </>
      )}
    </div>
  );
}
