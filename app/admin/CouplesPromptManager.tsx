"use client";

import { useMemo, useState } from "react";
import { C } from "@/lib/colors";
import {
  COUPLES_PROMPT_CATEGORIES,
  type AdminCouplesPosingPrompt,
} from "@/lib/couplesPosingGuide";

type Props = {
  prompts: AdminCouplesPosingPrompt[];
  loading: boolean;
  onChanged: () => Promise<void>;
  showToast: (message: string, ok?: boolean) => void;
};

type Draft = {
  title: string;
  category: string;
  instructions: string;
  keywords: string;
  display_order: string;
  is_published: boolean;
};

const EMPTY_DRAFT: Draft = {
  title: "",
  category: "Walking and Movement",
  instructions: "",
  keywords: "",
  display_order: "0",
  is_published: true,
};

const fieldClass = "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 outline-none focus:border-emerald-700";

function promptDraft(prompt: AdminCouplesPosingPrompt): Draft {
  return {
    title: prompt.title,
    category: prompt.category,
    instructions: prompt.instructions,
    keywords: prompt.keywords.join(", "),
    display_order: String(prompt.display_order),
    is_published: prompt.is_published,
  };
}

export default function CouplesPromptManager({
  prompts,
  loading,
  onChanged,
  showToast,
}: Props) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editing, setEditing] = useState<AdminCouplesPosingPrompt | null>(null);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return prompts;
    return prompts.filter((prompt) => [
      prompt.title,
      prompt.instructions,
      prompt.category,
      ...prompt.keywords,
    ].some((value) => value.toLowerCase().includes(needle)));
  }, [prompts, search]);

  function startEditing(prompt: AdminCouplesPosingPrompt) {
    setEditing(prompt);
    setDraft(promptDraft(prompt));
    setDeleteArmed(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function reset() {
    setDraft(EMPTY_DRAFT);
    setEditing(null);
    setDeleteArmed(null);
  }

  function requestBody() {
    return {
      ...draft,
      keywords: draft.keywords.split(",").map((item) => item.trim()).filter(Boolean),
      display_order: Number(draft.display_order) || 0,
    };
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/couples-posing-prompts", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing
          ? { id: editing.id, updates: requestBody() }
          : requestBody()),
      });
      const json = await response.json();
      if (!response.ok) {
        showToast(json.error ?? "Could not save prompt", false);
        return;
      }
      showToast(editing ? "Prompt updated" : "Prompt added");
      reset();
      await onChanged();
    } catch (error) {
      console.error("[couples-prompts-admin] save failed", error);
      showToast("Could not save prompt", false);
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, updates: Record<string, unknown>) {
    const response = await fetch("/api/admin/couples-posing-prompts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, updates }),
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error ?? "Could not update prompt");
  }

  async function move(prompt: AdminCouplesPosingPrompt, direction: -1 | 1) {
    const ordered = [...prompts].sort((a, b) =>
      a.display_order - b.display_order || a.number - b.number
    );
    const index = ordered.findIndex((item) => item.id === prompt.id);
    const other = ordered[index + direction];
    if (!other) return;
    setSaving(true);
    try {
      await Promise.all([
        patch(prompt.id, { display_order: other.display_order }),
        patch(other.id, { display_order: prompt.display_order }),
      ]);
      showToast("Prompt order updated");
      await onChanged();
    } catch (error) {
      console.error("[couples-prompts-admin] reorder failed", error);
      showToast(error instanceof Error ? error.message : "Could not reorder prompts", false);
    } finally {
      setSaving(false);
    }
  }

  async function remove(prompt: AdminCouplesPosingPrompt) {
    if (deleteArmed !== prompt.id) {
      setDeleteArmed(prompt.id);
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/admin/couples-posing-prompts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prompt.id }),
      });
      const json = await response.json();
      if (!response.ok) {
        showToast(json.error ?? "Could not delete prompt", false);
        return;
      }
      showToast("Prompt deleted");
      reset();
      await onChanged();
    } catch (error) {
      console.error("[couples-prompts-admin] delete failed", error);
      showToast("Could not delete prompt", false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="h-1" style={{ background: C.proAccent }} />
        <div className="p-4 md:p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em]" style={{ color: C.proAccent }}>
                {editing ? `Editing prompt ${editing.number}` : "Prompt library"}
              </p>
              <h2 className="mt-1 text-xl font-black text-slate-950">
                {editing ? editing.title : "Add prompt"}
              </h2>
            </div>
            {editing && (
              <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-slate-100 px-4 text-sm font-bold text-slate-700">
                Cancel
              </button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-xs font-bold text-slate-500">
              Prompt title
              <input className={fieldClass} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Example: Forehead Touch" />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-500">
              Category
              <select className={fieldClass} value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
                {COUPLES_PROMPT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-500 md:col-span-2">
              Directing language
              <textarea className={fieldClass} rows={7} value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} placeholder="Write exactly what you want to say during the session" />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-500">
              Search keywords
              <input className={fieldClass} value={draft.keywords} onChange={(event) => setDraft({ ...draft, keywords: event.target.value })} placeholder="kiss, close, standing" />
            </label>
            <label className="grid gap-1.5 text-xs font-bold text-slate-500">
              Display order
              <input className={fieldClass} type="number" min="0" value={draft.display_order} onChange={(event) => setDraft({ ...draft, display_order: event.target.value })} />
            </label>
          </div>

          <label className="mt-4 flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-800">
            <input type="checkbox" checked={draft.is_published} onChange={(event) => setDraft({ ...draft, is_published: event.target.checked })} />
            Show this prompt in client and public views
          </label>
          <button type="button" disabled={saving || !draft.title.trim() || !draft.instructions.trim()} onClick={save} className="mt-4 min-h-12 w-full rounded-xl text-sm font-black text-white disabled:opacity-50" style={{ background: C.proAccent }}>
            {saving ? "Saving..." : editing ? "Save prompt changes" : "Add prompt"}
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Saved prompts</h2>
            <p className="text-sm text-slate-500">{prompts.length} total</p>
          </div>
          <input className={`${fieldClass} max-w-sm`} type="search" placeholder="Search prompts..." value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
      </section>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-slate-100" />)}</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((prompt) => (
            <article key={prompt.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-wider" style={{ color: C.proAccent }}>Prompt {prompt.number} · {prompt.category}</p>
                  <h3 className="mt-1 text-lg font-black text-slate-950">{prompt.title}</h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">{prompt.instructions}</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">{prompt.is_published ? "Published" : "Photographer only"} · Order {prompt.display_order}</p>
                </div>
                <button type="button" onClick={() => startEditing(prompt)} className="min-h-11 shrink-0 rounded-xl px-3 text-sm font-black" style={{ background: C.proAccentSoft, color: C.proAccent }}>Edit</button>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" disabled={saving} onClick={() => move(prompt, -1)} className="min-h-11 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">↑ Earlier</button>
                <button type="button" disabled={saving} onClick={() => move(prompt, 1)} className="min-h-11 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">↓ Later</button>
                <button type="button" disabled={saving} onClick={() => remove(prompt)} className="min-h-11 rounded-xl px-2 text-xs font-black text-white" style={{ background: C.danger }}>
                  {deleteArmed === prompt.id ? "Confirm delete" : "Delete"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
