import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadImage } from "@/lib/uploadImage";
import { GRAD_SCHOOLS } from "@/lib/portfolioCategoryContent";

// Admin CRUD for portfolio_case_studies — the per-session story blocks rendered
// on /portfolio. Writes via the browser (anon) client like the Portfolio tab;
// the table has permissive public RLS. Renders nothing on the public site until
// a study is active, so partial drafts are safe.

type Props = {
  showToast: (message: string, ok?: boolean) => void;
  categories: { slug: string; name: string }[];
};

type CaseStudy = {
  id: number;
  category_slug: string;
  school: string | null;
  title: string;
  client_name: string | null;
  location: string | null;
  time_of_day: string | null;
  client_goal: string | null;
  summary: string | null;
  testimonial_quote: string | null;
  testimonial_author: string | null;
  cover_image_url: string | null;
  preview_image_urls: string[];
  sort_order: number;
  active: boolean;
};

const EMPTY = {
  category_slug: "graduation",
  school: "",
  title: "",
  client_name: "",
  location: "",
  time_of_day: "",
  client_goal: "",
  summary: "",
  testimonial_quote: "",
  testimonial_author: "",
  cover_image_url: "",
  preview_image_urls: [] as string[],
  sort_order: "",
  active: true,
};

const inp =
  "w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors";
const ta = `${inp} resize-none`;
const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";
const lbl = "block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5";

function revalidatePublicSite() {
  fetch("/api/admin/revalidate", { method: "POST" }).catch(() => {});
}

export default function CaseStudiesTab({ showToast, categories }: Props) {
  const [rows, setRows] = useState<CaseStudy[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<CaseStudy | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function loadRows(): Promise<CaseStudy[] | null> {
    const { data, error } = await supabase
      .from("portfolio_case_studies")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true });
    if (error) {
      console.error(error);
      return null;
    }
    return (data as CaseStudy[]) ?? [];
  }

  async function fetchRows() {
    const data = await loadRows();
    if (data) setRows(data);
  }

  useEffect(() => {
    let active = true;
    loadRows().then((data) => {
      if (active && data) setRows(data);
    });
    return () => {
      active = false;
    };
  }, []);

  function startEdit(study: CaseStudy) {
    setEditing(study);
    setForm({
      category_slug: study.category_slug,
      school: study.school ?? "",
      title: study.title,
      client_name: study.client_name ?? "",
      location: study.location ?? "",
      time_of_day: study.time_of_day ?? "",
      client_goal: study.client_goal ?? "",
      summary: study.summary ?? "",
      testimonial_quote: study.testimonial_quote ?? "",
      testimonial_author: study.testimonial_author ?? "",
      cover_image_url: study.cover_image_url ?? "",
      preview_image_urls: study.preview_image_urls ?? [],
      sort_order: String(study.sort_order),
      active: study.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(EMPTY);
  }

  async function handleCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file, "case-studies", showToast);
    if (url) setForm((f) => ({ ...f, cover_image_url: url }));
    setUploading(false);
  }

  async function handlePreviews(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadImage(file, "case-studies", showToast);
      if (url) urls.push(url);
    }
    if (urls.length) setForm((f) => ({ ...f, preview_image_urls: [...f.preview_image_urls, ...urls] }));
    setUploading(false);
  }

  function removePreview(url: string) {
    setForm((f) => ({ ...f, preview_image_urls: f.preview_image_urls.filter((u) => u !== url) }));
  }

  async function save() {
    if (!form.title.trim()) {
      showToast("Case study title required", false);
      return;
    }
    setSaving(true);
    const payload = {
      category_slug: form.category_slug,
      school: form.school || null,
      title: form.title.trim(),
      client_name: form.client_name || null,
      location: form.location || null,
      time_of_day: form.time_of_day || null,
      client_goal: form.client_goal || null,
      summary: form.summary || null,
      testimonial_quote: form.testimonial_quote || null,
      testimonial_author: form.testimonial_author || null,
      cover_image_url: form.cover_image_url || null,
      preview_image_urls: form.preview_image_urls,
      sort_order: parseInt(form.sort_order) || 0,
      active: form.active,
    };
    const res = editing
      ? await fetch("/api/admin/case-studies", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id: editing.id, updates: payload }),
        })
      : await fetch("/api/admin/case-studies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      showToast("Save failed — " + (body?.error ?? res.statusText), false);
    } else {
      showToast(editing ? "Case study updated!" : "Case study added!");
      cancelEdit();
      fetchRows();
      revalidatePublicSite();
    }
    setSaving(false);
  }

  async function remove(study: CaseStudy) {
    if (!window.confirm(`Delete case study "${study.title}"?`)) return;
    const res = await fetch(`/api/admin/case-studies?id=${study.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      showToast("Delete failed — " + (body?.error ?? res.statusText), false);
      return;
    }
    showToast("Case study deleted");
    if (editing?.id === study.id) cancelEdit();
    fetchRows();
    revalidatePublicSite();
  }

  const categoryOptions = categories.length > 0 ? categories : [{ slug: "graduation", name: "Grads" }];

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="h-[3px]" style={{ background: "#111827" }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-black text-slate-900">
              {editing ? `Editing: ${editing.title}` : "New Case Study"}
            </h2>
            {editing && (
              <button onClick={cancelEdit} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">
                Cancel edit
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Category</label>
                <select className={inp} value={form.category_slug} onChange={(e) => setForm((f) => ({ ...f, category_slug: e.target.value }))}>
                  {categoryOptions.map((c) => (
                    <option key={c.slug} value={c.slug}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={lbl}>School <span className="text-slate-300 normal-case">(grads only)</span></label>
                <select className={inp} value={form.school} onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}>
                  <option value="">— None —</option>
                  {GRAD_SCHOOLS.map((s) => (
                    <option key={s.slug} value={s.slug}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div><label className={lbl}>Title</label><input className={inp} placeholder="e.g. Maya's SJSU grad session" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
            <div><label className={lbl}>Client name</label><input className={inp} placeholder="e.g. Maya" value={form.client_name} onChange={(e) => setForm((f) => ({ ...f, client_name: e.target.value }))} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Location</label><input className={inp} placeholder="e.g. SJSU campus" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} /></div>
              <div><label className={lbl}>Time of day</label><input className={inp} placeholder="e.g. Golden hour" value={form.time_of_day} onChange={(e) => setForm((f) => ({ ...f, time_of_day: e.target.value }))} /></div>
            </div>

            <div><label className={lbl}>What the client wanted</label><textarea className={ta} rows={2} placeholder="e.g. Relaxed photos that felt like her, not stiff poses." value={form.client_goal} onChange={(e) => setForm((f) => ({ ...f, client_goal: e.target.value }))} /></div>
            <div><label className={lbl}>Summary</label><textarea className={ta} rows={3} placeholder="Short story of the session..." value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} /></div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className={lbl}>Testimonial quote</label><textarea className={ta} rows={2} placeholder="“…”" value={form.testimonial_quote} onChange={(e) => setForm((f) => ({ ...f, testimonial_quote: e.target.value }))} /></div>
              <div><label className={lbl}>Testimonial author</label><input className={inp} placeholder="e.g. Maya R." value={form.testimonial_author} onChange={(e) => setForm((f) => ({ ...f, testimonial_author: e.target.value }))} /></div>
            </div>

            <div>
              <label className={lbl}>Cover image</label>
              <input type="file" accept="image/*" className={inp} onChange={(e) => handleCover(e.target.files?.[0])} />
              {form.cover_image_url && <img src={form.cover_image_url} alt="" className="mt-2 h-28 w-auto rounded-lg object-cover" />}
            </div>

            <div>
              <label className={lbl}>Gallery preview images</label>
              <input type="file" accept="image/*" multiple className={inp} onChange={(e) => handlePreviews(e.target.files)} />
              {form.preview_image_urls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {form.preview_image_urls.map((url) => (
                    <div key={url} className="relative">
                      <img src={url} alt="" className="h-20 w-16 rounded-lg object-cover" />
                      <button type="button" onClick={() => removePreview(url)} className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-slate-900 text-xs font-black text-white">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 items-end">
              <div><label className={lbl}>Order #</label><input className={inp} type="number" placeholder="e.g. 1" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} /></div>
              <label className="flex items-center gap-2 text-sm font-bold text-slate-700 pb-2.5"><input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} /> Active (show on site)</label>
            </div>

            <button onClick={save} disabled={saving || uploading} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{ background: "#111827", opacity: saving || uploading ? 0.7 : 1 }}>
              {uploading ? "Uploading…" : saving ? "Saving…" : editing ? "Update Case Study ✓" : "Save Case Study →"}
            </button>
          </div>
        </div>
      </div>

      <div className={card}>
        <div className="p-6">
          <h3 className="text-sm font-black text-slate-900 mb-4">Case Studies ({rows.length})</h3>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-400">No case studies yet. Add one above.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((study) => (
                <div key={study.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                  {study.cover_image_url && <img src={study.cover_image_url} alt="" className="h-14 w-14 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-bold text-slate-900">{study.title}</p>
                      {!study.active && <span className="rounded-md bg-slate-200 px-1.5 py-0.5 text-[10px] font-black text-slate-600">HIDDEN</span>}
                    </div>
                    <p className="text-xs text-slate-400">{study.category_slug}{study.school ? ` · ${study.school}` : ""}</p>
                  </div>
                  <button onClick={() => startEdit(study)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">Edit</button>
                  <button onClick={() => remove(study)} className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">Delete</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
