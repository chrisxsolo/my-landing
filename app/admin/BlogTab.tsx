"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/colors";
import { uploadImage } from "@/lib/uploadImage";
import { buildJournalImageLibraryRows } from "@/lib/imageLibraryShared";

type BlogCategory = "journal" | "professional";
type BlogPost = { id: number; title: string; body: string; published_at: string; slug: string; cover_image_url: string | null; extra_image_urls: string[]; category?: BlogCategory | string | null; sites?: string[] | null };
type Props = { showToast: (msg: string, ok?: boolean) => void };

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";
const inp = "w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors";
const ta = `${inp} resize-none`;

function slugify(s: string) { return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

function parseJournalEntry(raw: string) {
  const lines = raw.split("\n");
  const title = lines.find(l => l.trim())?.trim() ?? "";

  const dateRe = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{2,4}/i;
  const numericDateRe = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/;
  const timeRe = /\b(\d{1,2}:\d{2}\s*(?:am|pm)?)/i;

  let dateStr = "", timeStr = "", dateLine = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const dMatch = line.match(dateRe) || line.match(numericDateRe);
    if (dMatch) {
      dateStr = dMatch[0];
      const tMatch = line.match(timeRe);
      if (tMatch) timeStr = tMatch[1];
      dateLine = i;
      break;
    }
  }

  let published_at = new Date().toISOString().slice(0, 16);
  if (dateStr) {
    try {
      const d = new Date(`${dateStr}${timeStr ? " " + timeStr : ""}`);
      if (!isNaN(d.getTime())) published_at = d.toISOString().slice(0, 16);
    } catch { /* ignore parse failures */ }
  }

  const skipLines = new Set([0]);
  if (dateLine >= 0) skipLines.add(dateLine);
  const body = lines.filter((_, i) => !skipLines.has(i)).join("\n").replace(/^\n+/, "").trim();
  return { title, slug: slugify(title), published_at, body };
}

async function compressForAI(file: File, maxPx = 900, quality = 0.75): Promise<Blob> {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round(height * (maxPx / width)); width = maxPx; }
        else { width = Math.round(width * (maxPx / height)); height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => resolve(blob ?? file), "image/jpeg", quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function BlogTab({ showToast }: Props) {
  const EMPTY_POST = { title: "", body: "", slug: "", category: "professional" as BlogCategory, sites: ["professional"] as string[], published_at: new Date().toISOString().slice(0, 16) };

  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postForm, setPostForm] = useState(EMPTY_POST);
  const [coverImg, setCoverImg] = useState<File | null>(null);
  const [coverImgPreview, setCoverImgPreview] = useState<string | null>(null);
  const [extraImgs, setExtraImgs] = useState<File[]>([]);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [postSaving, setPostSaving] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [postDeleteConfirm, setPostDeleteConfirm] = useState<number | null>(null);
  const [journalDraft, setJournalDraft] = useState("");
  const [aiDropFiles, setAiDropFiles] = useState<File[]>([]);
  const [aiDropPreviews, setAiDropPreviews] = useState<string[]>([]);
  const [aiDropDragging, setAiDropDragging] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [coverDragging, setCoverDragging] = useState(false);
  const [extraDragging, setExtraDragging] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);
  const aiDropRef = useRef<HTMLInputElement>(null);

  useEffect(() => { fetchPosts(); }, []);

  async function fetchPosts() {
    setPostsLoading(true);
    let { data, error } = await supabase.from("blog_posts").select("*").contains("sites", ["professional"]).order("published_at", { ascending: false });
    if (error) {
      const fallback = await supabase.from("blog_posts").select("*").eq("category", "professional").order("published_at", { ascending: false });
      data = fallback.data; error = fallback.error;
    }
    if (data) setPosts(data);
    setPostsLoading(false);
  }

  function startEditPost(post: BlogPost) {
    setEditingPost(post);
    setPostForm({ title: post.title, body: post.body, slug: post.slug, category: "professional", sites: ["professional"], published_at: post.published_at.slice(0, 16) });
    setCoverImg(null); setCoverImgPreview(post.cover_image_url || null);
    setExtraImgs([]); setExtraPreviews(post.extra_image_urls ?? []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditPost() {
    setEditingPost(null);
    setPostForm({ ...EMPTY_POST });
    setCoverImg(null); setCoverImgPreview(null);
    setExtraImgs([]); setExtraPreviews([]);
    setJournalDraft(""); setAiDropFiles([]); setAiDropPreviews([]);
    if (coverFileRef.current) coverFileRef.current.value = "";
    if (extraFileRef.current) extraFileRef.current.value = "";
  }

  function onJournalDraftChange(raw: string) {
    setJournalDraft(raw);
    if (!raw.trim()) return;
    const parsed = parseJournalEntry(raw);
    setPostForm(f => ({ ...f, ...parsed }));
  }

  function onAiDropFiles(incoming: File[]) {
    const valid = incoming.filter(f => f.type.startsWith("image/"));
    if (!valid.length) return;
    setAiDropFiles(prev => [...prev, ...valid].slice(0, 30));
    setAiDropPreviews(prev => [...prev, ...valid.map(f => URL.createObjectURL(f))].slice(0, 30));
  }
  function removeAiDropFile(i: number) { setAiDropFiles(p => p.filter((_, j) => j !== i)); setAiDropPreviews(p => p.filter((_, j) => j !== i)); }

  function onCoverImg(e: React.ChangeEvent<HTMLInputElement>) { const f = e.target.files?.[0]; if (!f) return; setCoverImg(f); setCoverImgPreview(URL.createObjectURL(f)); }
  function onExtraImgs(e: React.ChangeEvent<HTMLInputElement>) { const files = Array.from(e.target.files ?? []); if (!files.length) return; setExtraImgs(prev => [...prev, ...files]); setExtraPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]); }
  function removeExtraPreview(i: number) {
    const url = extraPreviews[i];
    setExtraPreviews(p => p.filter((_, j) => j !== i));
    if (url.startsWith("blob:")) setExtraImgs(p => p.filter((_, j) => j !== i));
  }
  function onCoverDrop(e: React.DragEvent) { e.preventDefault(); setCoverDragging(false); const f = Array.from(e.dataTransfer.files).find(f => f.type.startsWith("image/")); if (!f) return; setCoverImg(f); setCoverImgPreview(URL.createObjectURL(f)); }
  function onExtraDrop(e: React.DragEvent) { e.preventDefault(); setExtraDragging(false); const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/")); if (!files.length) return; setExtraImgs(prev => [...prev, ...files]); setExtraPreviews(prev => [...prev, ...files.map(f => URL.createObjectURL(f))]); }

  async function syncImagesToLibrary(postId: number, postSlug: string, postTitle: string, cover_image_url: string | null, extra_image_urls: string[]) {
    const rows = buildJournalImageLibraryRows({ postId, postSlug, postTitle, coverImageUrl: cover_image_url, extraImageUrls: extra_image_urls });
    if (!rows.length) return;
    await supabase.from("image_library").upsert(rows, { onConflict: "source_post_id,source_role,image_url", ignoreDuplicates: true });
  }

  async function generateBlogFromPhotos() {
    if (aiDropFiles.length < 1) { showToast("Drop at least 1 photo", false); return; }
    setAiGenerating(true);
    try {
      const ts = Date.now();
      const [compressedForAi, compressedForStorage] = await Promise.all([
        Promise.all(aiDropFiles.map(f => compressForAI(f, 900, 0.75))),
        Promise.all(aiDropFiles.map(f => compressForAI(f, 2000, 0.90))),
      ]);
      const fd = new FormData();
      compressedForAi.forEach((blob, i) => {
        fd.append("images", new File([blob], aiDropFiles[i].name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      });
      fd.append("sites", "professional");
      const [res, storageUrlResults] = await Promise.all([
        fetch("/api/ai-blog-from-photos", { method: "POST", body: fd }),
        Promise.all(compressedForStorage.map((blob, i) => {
          const path = `blog/${ts}_${i}.jpg`;
          return supabase.storage.from("grad-photos")
            .upload(path, blob, { upsert: true, contentType: "image/jpeg" })
            .then(({ error }) => {
              if (error) { console.error("[ai-blog] upload:", error); return null; }
              return supabase.storage.from("grad-photos").getPublicUrl(path).data.publicUrl;
            });
        })),
      ]);
      let json: Record<string, unknown> = {};
      try { json = await res.json(); } catch { /* non-JSON body */ }
      if (!res.ok) { showToast((json.error as string) || `AI generation failed (${res.status})`, false); return; }
      const validUrls = storageUrlResults.filter((u): u is string => u !== null);
      if (validUrls.length > 0 && Array.isArray(json.selectedIndices)) {
        const indices = json.selectedIndices as number[];
        const selectedUrls = indices.filter(i => i < validUrls.length).map(i => validUrls[i]);
        const remainingUrls = validUrls.filter((_, i) => !indices.includes(i));
        if (selectedUrls.length > 0) {
          fetch("/api/update-blog-images", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: json.id, cover_image_url: selectedUrls[0], extra_image_urls: selectedUrls.slice(1), all_image_urls: [...selectedUrls, ...remainingUrls] }) })
            .catch(err => console.error("[ai-blog] image patch error:", err));
        }
      }
      showToast(`Published: "${json.title}" — ${json.photo_count} photos`);
      setAiDropFiles([]); setAiDropPreviews([]); fetchPosts();
    } catch (err) {
      console.error("[ai-blog]", err);
      showToast("AI generation failed", false);
    } finally { setAiGenerating(false); }
  }

  async function savePost() {
    if (!postForm.title || !postForm.body) { showToast("Title and body required", false); return; }
    setPostSaving(true);
    const slug = postForm.slug || slugify(postForm.title);
    let cover_image_url = coverImgPreview ?? (editingPost?.cover_image_url ?? null);
    if (coverImg) { const url = await uploadImage(coverImg, "blog", showToast); if (!url) { setPostSaving(false); return; } cover_image_url = url; }
    else if (!coverImgPreview) { cover_image_url = null; }
    const existingExtras = editingPost?.extra_image_urls ?? [];
    const newExtraUrls: string[] = [];
    for (const f of extraImgs) { const url = await uploadImage(f, "blog", showToast); if (url) newExtraUrls.push(url); }
    const existingKept = existingExtras.filter(url => extraPreviews.includes(url));
    const extra_image_urls = [...existingKept, ...newExtraUrls];
    const sites = ["professional"];
    const payload = { title: postForm.title, body: postForm.body, slug, category: "professional", sites, cover_image_url, extra_image_urls, published_at: new Date(postForm.published_at).toISOString() };
    if (editingPost) {
      const { error } = await supabase.from("blog_posts").update(payload).eq("id", editingPost.id);
      if (error) showToast("Update failed", false);
      else { await syncImagesToLibrary(editingPost.id, slug, postForm.title, cover_image_url, extra_image_urls); showToast("Post updated!"); cancelEditPost(); fetchPosts(); }
    } else {
      const { data: inserted, error } = await supabase.from("blog_posts").insert(payload).select("id").single();
      if (error || !inserted) showToast("Save failed — " + (error?.message ?? ""), false);
      else { await syncImagesToLibrary(inserted.id, slug, postForm.title, cover_image_url, extra_image_urls); showToast("Post published!"); cancelEditPost(); fetchPosts(); }
    }
    setPostSaving(false);
  }

  async function deletePost(id: number) {
    await supabase.from("blog_posts").delete().eq("id", id);
    setPosts(p => p.filter(x => x.id !== id));
    setPostDeleteConfirm(null);
    if (editingPost?.id === id) cancelEditPost();
    showToast("Post deleted");
  }

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-black text-slate-900">{editingPost ? `Editing: ${editingPost.title}` : "New Blog Post"}</h2>
            {editingPost && <button onClick={cancelEditPost} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">Cancel edit</button>}
          </div>
          {editingPost && <div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: C.p1_08, color: C.p1, border: `1px solid ${C.p1_20}` }}>✏️ Editing existing post.</div>}

          {/* AI Photo Drop */}
          <div className="mb-5 rounded-xl p-4" style={{ background: "#f0fdf4", border: "1.5px dashed #22c55e" }}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">✨</span>
              <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: "#16a34a" }}>AI: Drop Photos → Auto-Post</label>
            </div>
            <p className="text-xs text-slate-400 mb-3">Drop 10–30 photos. Claude picks the best 10, writes the post, and publishes it instantly.</p>
            <div className="w-full rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-all"
              style={{ minHeight: "100px", borderColor: aiDropDragging ? "#16a34a" : "#86efac", background: aiDropDragging ? "#dcfce7" : "#f0fdf4" }}
              onClick={() => aiDropRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setAiDropDragging(true); }}
              onDragLeave={() => setAiDropDragging(false)}
              onDrop={e => { e.preventDefault(); setAiDropDragging(false); onAiDropFiles(Array.from(e.dataTransfer.files)); }}>
              {aiDropFiles.length === 0 ? (
                <>
                  <span className="text-2xl">📷</span>
                  <span className="text-xs font-bold" style={{ color: "#16a34a" }}>Drop photos here or tap to select</span>
                  <span className="text-xs text-slate-400">Up to 30 photos · JPG, PNG, HEIC</span>
                </>
              ) : (
                <div className="w-full p-2">
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {aiDropPreviews.map((url, i) => (
                      <div key={i} className="relative aspect-square rounded-lg overflow-hidden">
                        <img src={url} className="w-full h-full object-cover" />
                        <button onClick={e => { e.stopPropagation(); removeAiDropFile(i); }} className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 text-white text-[9px] font-bold flex items-center justify-center">✕</button>
                      </div>
                    ))}
                    <div className="aspect-square rounded-lg border border-dashed flex items-center justify-center" style={{ borderColor: "#86efac", background: "#dcfce7" }}>
                      <span className="text-lg text-green-400">+</span>
                    </div>
                  </div>
                  <p className="text-xs font-bold text-center" style={{ color: "#16a34a" }}>{aiDropFiles.length} photo{aiDropFiles.length !== 1 ? "s" : ""} selected — Claude picks the best 10</p>
                </div>
              )}
            </div>
            <input ref={aiDropRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onAiDropFiles(Array.from(e.target.files ?? []))} />
            {aiDropFiles.length > 0 && (
              <div className="flex gap-2 mt-3">
                <button onClick={generateBlogFromPhotos} disabled={aiGenerating} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95" style={{ background: aiGenerating ? "#86efac" : "#16a34a", opacity: aiGenerating ? 0.8 : 1 }}>
                  {aiGenerating ? "✨ Analyzing & Publishing…" : "✨ Generate & Publish with AI"}
                </button>
                <button onClick={() => { setAiDropFiles([]); setAiDropPreviews([]); }} disabled={aiGenerating} className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 bg-slate-100 hover:bg-slate-200 transition-colors">Clear</button>
              </div>
            )}
          </div>

          {/* Journal paste */}
          <div className="mb-4 rounded-xl p-4" style={{ background: C.p1_04, border: `1.5px dashed ${C.p1_20}` }}>
            <label className="block text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: C.p1 }}>Paste Entry</label>
            <p className="text-xs text-slate-400 mb-2">Paste your raw entry — first line becomes the title, date line sets the date, the rest becomes the body.</p>
            <textarea className={ta} rows={5} placeholder={"Golden Hour at SJSU — Mia's Grad Shoot\nMay 7, 2025 · 3:45 PM\n\nThe light was absolutely perfect that evening..."} value={journalDraft} onChange={e => onJournalDraftChange(e.target.value)} />
            {journalDraft && <button onClick={() => setJournalDraft("")} className="mt-1.5 text-xs font-bold text-slate-400 underline">Clear</button>}
          </div>

          {/* Cover image */}
          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Cover Photo</label>
            {coverImgPreview ? (
              <div className="relative w-full h-52 rounded-xl overflow-hidden mb-2" onDragOver={e => { e.preventDefault(); setCoverDragging(true); }} onDragLeave={() => setCoverDragging(false)} onDrop={onCoverDrop} style={coverDragging ? { outline: `2px solid ${C.p1}` } : {}}>
                <img src={coverImgPreview} className="w-full h-full object-cover" />
                <button onClick={() => { setCoverImg(null); setCoverImgPreview(null); if (coverFileRef.current) coverFileRef.current.value = ""; }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center">✕</button>
                <button onClick={() => coverFileRef.current?.click()} className="absolute bottom-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full" style={{ background: C.p1_20 }}>Change</button>
              </div>
            ) : (
              <div onClick={() => coverFileRef.current?.click()} onDragOver={e => { e.preventDefault(); setCoverDragging(true); }} onDragLeave={() => setCoverDragging(false)} onDrop={onCoverDrop}
                className="w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer"
                style={{ borderColor: coverDragging ? C.p1 : C.p1_20, background: coverDragging ? C.p1_08 : C.p1_04 }}>
                <span className="text-3xl">🖼️</span>
                <span className="text-xs font-bold" style={{ color: C.p1 }}>{coverDragging ? "Drop it" : "Tap or drag cover photo"}</span>
                <span className="text-xs text-slate-400">JPG, PNG, HEIC</span>
              </div>
            )}
            <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={onCoverImg} />
          </div>

          <div className="space-y-3">
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Title</label><input className={inp} placeholder="e.g. Golden Hour at SJSU — Mia's Grad Shoot" value={postForm.title} onChange={e => setPostForm(f => ({ ...f, title: e.target.value, slug: slugify(e.target.value) }))} /></div>
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Slug (URL)</label><input className={inp} placeholder="auto-generated from title" value={postForm.slug} onChange={e => setPostForm(f => ({ ...f, slug: slugify(e.target.value) }))} /></div>
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Date &amp; Time</label><input className={inp} type="datetime-local" value={postForm.published_at} onChange={e => setPostForm(f => ({ ...f, published_at: e.target.value }))} /></div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Body</label>
              <textarea className={ta} rows={8} placeholder={"Write your shoot story here...\n\nUse blank lines between paragraphs — each one becomes its own paragraph on the post page."} value={postForm.body} onChange={e => setPostForm(f => ({ ...f, body: e.target.value }))} />
              <p className="text-xs text-slate-400 mt-1">Separate paragraphs with a blank line.</p>
            </div>

            {/* Extra photos */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Extra Photos ({extraPreviews.length})</label>
              <div className="grid grid-cols-3 gap-2 mb-2 rounded-xl transition-all"
                onDragOver={e => { e.preventDefault(); setExtraDragging(true); }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setExtraDragging(false); }}
                onDrop={onExtraDrop}
                style={extraDragging ? { outline: `2px dashed ${C.p2}`, outlineOffset: "4px", background: C.p2_06 } : {}}>
                {extraPreviews.map((url, i) => (
                  <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                    <img src={url} className="w-full h-full object-cover" />
                    <button onClick={() => removeExtraPreview(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs font-bold flex items-center justify-center">✕</button>
                  </div>
                ))}
                <div onClick={() => extraFileRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer"
                  style={{ borderColor: extraDragging ? C.p2 : C.p2_18, background: extraDragging ? C.p2_06 : "transparent" }}>
                  <span className="text-xl">+</span>
                  <span className="text-[10px] font-bold" style={{ color: C.p2 }}>{extraDragging ? "Drop" : "Add photos"}</span>
                </div>
              </div>
              <input ref={extraFileRef} type="file" accept="image/*" multiple className="hidden" onChange={onExtraImgs} />
              <p className="text-xs text-slate-400">Drag &amp; drop photos here, or tap + to pick. Hit ✕ on any photo to remove it.</p>
            </div>

            <button onClick={savePost} disabled={postSaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{ background: C.grad, opacity: postSaving ? 0.7 : 1 }}>
              {postSaving ? "Publishing…" : editingPost ? "Update Post ✓" : "Publish Post →"}
            </button>
          </div>
        </div>
      </div>

      {/* Post list */}
      <div>
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.p1 }}>Professional Blog Posts</p>
            <span className="text-xs font-bold text-slate-400">({posts.length})</span>
          </div>
        </div>
        {postsLoading ? [...Array(2)].map((_, i) => <div key={i} className="rounded-2xl animate-pulse h-20 mb-3" style={{ background: `linear-gradient(135deg,${C.p1_08},${C.p2_06})` }} />) : (
          posts.length === 0 ? <p className="text-sm text-slate-400 font-medium">No posts yet — write your first one above.</p> : (
            <div className="space-y-3">
              {posts.map(post => (
                <div key={post.id} className={card} style={editingPost?.id === post.id ? { outline: `2px solid ${C.p1}` } : {}}>
                  <div className="flex">
                    {post.cover_image_url ? <div className="w-20 h-20 flex-shrink-0 overflow-hidden"><img src={post.cover_image_url} className="w-full h-full object-cover" /></div> : <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: C.p1_06 }}>✍️</div>}
                    <div className="flex-1 p-4 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-slate-900 truncate mb-0.5">{post.title}</p>
                          <p className="text-xs text-slate-400">{(post.sites && post.sites.length > 0 ? post.sites : [post.category === "professional" ? "professional" : "journal"]).map(s => s === "professional" ? "Professional" : "Journal").join(" + ")} · {new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {(post.extra_image_urls?.length ?? 0) + 1} photo{(post.extra_image_urls?.length ?? 0) > 0 ? "s" : ""}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0 flex-wrap">
                          {(post.sites && post.sites.length > 0 ? post.sites : [post.category === "professional" ? "professional" : "journal"]).map(site => (
                            <a key={site} href={`${site === "professional" ? "/blog" : "/journal"}/${post.slug}`} target="_blank" className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.p1_08, color: C.p1 }}>{site === "professional" ? "Blog →" : "Journal →"}</a>
                          ))}
                          {editingPost?.id !== post.id && <button onClick={() => startEditPost(post)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.p2_08, color: C.p2 }}>Edit</button>}
                          {postDeleteConfirm === post.id ? (
                            <div className="flex gap-1.5">
                              <button onClick={() => deletePost(post.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{ background: "#be123c" }}>Delete</button>
                              <button onClick={() => setPostDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                            </div>
                          ) : <button onClick={() => setPostDeleteConfirm(post.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
