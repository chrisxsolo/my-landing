"use client";
import { useState, useEffect, useRef } from "react";
import { C } from "@/lib/colors";
import { uploadImage } from "@/lib/uploadImage";
import { GRAD_SCHOOL_OPTIONS, GRAD_LOCATION_OPTIONS, GRAD_SESSION_OPTIONS } from "@/lib/portfolioSeoDescription";
import { metadataWarnings } from "@/lib/seo/metadataChecks";
import { uploadToSignedTarget } from "@/lib/adminSignedUpload";
import type { BlogPostDraftDto } from "@/lib/contentPublishing/types";
import { publishingApi } from "@/app/admin/publishing/publishingApi";
import ScheduleControl, { emptyScheduleDraft, type ScheduleDraft } from "@/app/admin/publishing/ScheduleControl";
import { useBlogDraftActions } from "@/app/admin/blog/useBlogDraftActions";
import BlogDraftsPanel, { prepareDraftForEditing } from "@/app/admin/blog/BlogDraftsPanel";
import BlogPostList, { type BlogCategory, type BlogPost } from "@/app/admin/blog/BlogPostList";
import AiPhotoDropZone from "@/app/admin/blog/AiPhotoDropZone";
import { compressForAI, parseJournalEntry, slugify } from "@/app/admin/blog/blogFormHelpers";

// Clickable keyword chips for blog SEO — same vocabulary as the photo SEO tagger.
const BLOG_KEYWORD_OPTIONS: readonly string[] = [...GRAD_SCHOOL_OPTIONS, ...GRAD_LOCATION_OPTIONS, ...GRAD_SESSION_OPTIONS];
const META_DESCRIPTION_MAX = 155;
type Props = { showToast: (msg: string, ok?: boolean) => void };

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";
const inp = "w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors";
const ta = `${inp} resize-none`;

export default function BlogTab({ showToast }: Props) {
  const EMPTY_POST = { title: "", body: "", slug: "", category: "professional" as BlogCategory, sites: ["professional"] as string[], published_at: new Date().toISOString().slice(0, 16), meta_description: "", meta_keywords: "" };

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
  const [imagesOpenId, setImagesOpenId] = useState<number | null>(null);
  const [seoGeneratingId, setSeoGeneratingId] = useState<number | null>(null);
  const [journalDraft, setJournalDraft] = useState("");
  const [aiDropFiles, setAiDropFiles] = useState<File[]>([]);
  const [aiDropPreviews, setAiDropPreviews] = useState<string[]>([]);
  const [aiDropDragging, setAiDropDragging] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [coverDragging, setCoverDragging] = useState(false);
  const [extraDragging, setExtraDragging] = useState(false);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const extraFileRef = useRef<HTMLInputElement>(null);
  // Drafts & scheduling: the form edits either a live post, a private draft, or nothing yet.
  const [editingDraft, setEditingDraft] = useState<BlogPostDraftDto | null>(null);
  const [draftsRefresh, setDraftsRefresh] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleWhen, setScheduleWhen] = useState<ScheduleDraft>(() => emptyScheduleDraft());

  useEffect(() => { fetchPosts(); }, []);

  // The queue page links here with ?draft=<id> to open that draft for editing
  // — through the same confirm-and-cancel a scheduled draft gets in the panel.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("draft");
    if (!id) return;
    publishingApi.getDraft(id)
      .then(async ({ draft }) => {
        const ready = await prepareDraftForEditing(draft, showToast);
        if (ready) { startEditDraft(ready); setDraftsRefresh(n => n + 1); }
      })
      .catch(() => showToast("That draft could not be loaded", false));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time deep link on mount
  }, []);

  async function fetchPosts(): Promise<BlogPost[]> {
    setPostsLoading(true);
    const res = await fetch("/api/admin/blog-posts", { credentials: "include" });
    const json = await res.json().catch(() => ({}));
    const list: BlogPost[] = res.ok && Array.isArray(json.posts) ? json.posts : [];
    if (res.ok) setPosts(list);
    setPostsLoading(false);
    return list;
  }

  // The live row changed outside the edit form (cover replaced, gallery photo
  // removed, revision restored): refetch, and reload the form if it shows that post.
  async function onLiveImagesChanged(postId: number) {
    const fresh = (await fetchPosts()).find(p => p.id === postId);
    if (fresh && editingPost?.id === postId) startEditPost(fresh);
  }

  function startEditPost(post: BlogPost) {
    setEditingDraft(null);
    setScheduleOpen(false);
    setEditingPost(post);
    setPostForm({ title: post.title, body: post.body, slug: post.slug, category: "professional", sites: ["professional"], published_at: post.published_at.slice(0, 16), meta_description: post.meta_description ?? "", meta_keywords: post.meta_keywords ?? "" });
    setCoverImg(null); setCoverImgPreview(post.cover_image_url || null);
    setExtraImgs([]); setExtraPreviews(post.extra_image_urls ?? []);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // A draft opens in the same form; its images show through signed previews.
  function startEditDraft(draft: BlogPostDraftDto) {
    setEditingPost(null);
    setEditingDraft(draft);
    setPostForm({ title: draft.title, body: draft.body, slug: draft.slug, category: "professional", sites: ["professional"], published_at: EMPTY_POST.published_at, meta_description: draft.meta_description ?? "", meta_keywords: draft.meta_keywords ?? "" });
    setCoverImg(null); setCoverImgPreview(draft.previewUrls[0] ?? null);
    setExtraImgs([]); setExtraPreviews(draft.previewUrls.slice(1).filter((u): u is string => !!u));
    setScheduleOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditPost() {
    setEditingPost(null);
    setEditingDraft(null);
    setScheduleOpen(false);
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
    // Server-side (service-role) sync — mirrors buildJournalImageLibraryRows + upsert.
    await fetch("/api/admin/image-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ mode: "sync-post", postId, postSlug, postTitle, coverImageUrl: cover_image_url, extraImageUrls: extra_image_urls }),
    }).catch(err => console.error("[blog] image library sync error:", err));
  }

  // Generate draft: the copy lands on a PRIVATE draft and the photos go to the
  // private draft bucket; nothing is public until the admin schedules or
  // publishes it. The legacy publish-at-once path is unchanged below.
  async function generateDraftFromPhotos(compressedForAi: Blob[], compressedForStorage: Blob[]) {
    const { draft } = await publishingApi.createDraft({ title: "", body: "", slug: "" }, "ai_photos");
    const fd = new FormData();
    compressedForAi.forEach((blob, i) => {
      fd.append("images", new File([blob], aiDropFiles[i].name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
    });
    fd.append("sites", "professional");
    fd.append("draftId", draft.id);
    const [res, uploads] = await Promise.all([
      fetch("/api/ai-blog-from-photos", { method: "POST", body: fd }),
      Promise.all(compressedForStorage.map((blob, i) =>
        uploadToSignedTarget("blog-draft", draft.id, new File([blob], `draft-${i}.jpg`, { type: "image/jpeg" })).then(r => r.path).catch(() => null))),
    ]);
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      // Nothing to review: the empty draft (and its private uploads) go too.
      await publishingApi.deleteDraft(draft.id).catch(() => undefined);
      throw new Error((json.error as string) || `AI generation failed (${res.status})`);
    }
    const indices = Array.isArray(json.selectedIndices) ? (json.selectedIndices as number[]) : [];
    const ordered = [...indices.filter(i => uploads[i]), ...uploads.map((_, i) => i).filter(i => !indices.includes(i) && uploads[i])];
    const images = ordered.map(i => ({ path: uploads[i] as string, alt: "" }));
    const saved = await publishingApi.updateDraft(draft.id, json.revision as number, { images });
    showToast(`Draft ready: "${saved.draft.title}" — review it, then schedule or publish`);
    setAiDropFiles([]); setAiDropPreviews([]);
    setDraftsRefresh(n => n + 1);
    startEditDraft(saved.draft);
  }

  async function generateBlogFromPhotos(mode: "publish" | "draft" = "publish") {
    if (aiDropFiles.length < 1) { showToast("Drop at least 1 photo", false); return; }
    setAiGenerating(true);
    try {
      const ts = Date.now();
      const [compressedForAi, compressedForStorage] = await Promise.all([
        Promise.all(aiDropFiles.map(f => compressForAI(f, 900, 0.75))),
        Promise.all(aiDropFiles.map(f => compressForAI(f, 2000, 0.90))),
      ]);
      if (mode === "draft") { await generateDraftFromPhotos(compressedForAi, compressedForStorage); return; }
      const fd = new FormData();
      compressedForAi.forEach((blob, i) => {
        fd.append("images", new File([blob], aiDropFiles[i].name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
      });
      fd.append("sites", "professional");
      const [res, storageUrlResults] = await Promise.all([
        fetch("/api/ai-blog-from-photos", { method: "POST", body: fd }),
        Promise.all(compressedForStorage.map((blob, i) =>
          // Upload straight to Storage via a signed URL (bypasses the serverless
          // body limit). Quiet toast — this is a background batch.
          uploadImage(new File([blob], `blog-${ts}-${i}.jpg`, { type: "image/jpeg" }), "blog", () => {}),
        )),
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
      setAiDropFiles([]); setAiDropPreviews([]); fetchPosts(); revalidatePublicSite();
    } catch (err) {
      console.error("[ai-blog]", err);
      showToast(err instanceof Error ? err.message : "AI generation failed", false);
    } finally { setAiGenerating(false); }
  }

  // Refresh the cached /blog pages after a change made by a route that does not
  // revalidate itself (AI auto-post, SEO generation). The blog-posts API
  // revalidates on its own writes. A failure is said out loud: the hourly ISR
  // window is the backstop, but the admin should know the page may lag.
  function revalidatePublicSite() {
    fetch("/api/admin/revalidate", { method: "POST", credentials: "include" })
      .then(res => { if (!res.ok) throw new Error(`revalidate responded ${res.status}`); })
      .catch(err => {
        console.error("[blog] public cache refresh failed:", err);
        showToast("Saved, but the public pages did not refresh — they update within the hour", false);
      });
  }

  const { saveDraftAndClose, scheduleDraft, publishDraftNow } = useBlogDraftActions({
    form: postForm, editingDraft, scheduleWhen, showToast, setSaving: setPostSaving,
    images: () => ({ coverFile: coverImg, coverPreview: coverImgPreview, extraFiles: extraImgs, extraPreviews }),
    draftsChanged: () => setDraftsRefresh(n => n + 1), close: cancelEditPost, reopen: startEditDraft, postsChanged: () => { fetchPosts(); },
  });

  async function savePost() {
    if (!postForm.title || !postForm.body) { showToast("Title and body required", false); return; }
    if (editingDraft) { await publishDraftNow(); return; }
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
    const payload = { title: postForm.title, body: postForm.body, slug, category: "professional", sites, cover_image_url, extra_image_urls, published_at: new Date(postForm.published_at).toISOString(), meta_description: postForm.meta_description.trim() || null, meta_keywords: postForm.meta_keywords.trim() || null };
    if (editingPost) {
      const res = await fetch("/api/admin/blog-posts", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id: editingPost.id, updates: payload }) });
      if (!res.ok) showToast("Update failed", false);
      else { await syncImagesToLibrary(editingPost.id, slug, postForm.title, cover_image_url, extra_image_urls); showToast("Post updated!"); cancelEditPost(); fetchPosts(); }
    } else {
      const res = await fetch("/api/admin/blog-posts", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(payload) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.id) showToast("Save failed — " + (json.error ?? ""), false);
      else { await syncImagesToLibrary(json.id, slug, postForm.title, cover_image_url, extra_image_urls); showToast("Post published!"); cancelEditPost(); fetchPosts(); }
    }
    setPostSaving(false);
  }

  async function deletePost(id: number) {
    const res = await fetch(`/api/admin/blog-posts?id=${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { showToast("Delete failed", false); return; }
    setPosts(p => p.filter(x => x.id !== id));
    setPostDeleteConfirm(null);
    if (editingPost?.id === id) cancelEditPost();
    showToast("Post deleted");
  }

  async function generateSeoForPost(post: BlogPost) {
    setSeoGeneratingId(post.id);
    try {
      const res = await fetch("/api/admin/blog-seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: post.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "SEO generation failed");
      const seo = json.seo as { meta_description: string; meta_keywords: string; cover_image_alt: string; extra_image_alts: string[] };
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, meta_description: seo.meta_description, meta_keywords: seo.meta_keywords, cover_image_alt: seo.cover_image_alt, extra_image_alts: seo.extra_image_alts } : p));
      if (editingPost?.id === post.id) setPostForm(f => ({ ...f, meta_description: seo.meta_description, meta_keywords: seo.meta_keywords }));
      revalidatePublicSite();
      showToast("AI SEO generated & saved ✓");
    } catch (err) {
      console.error("[blog] generateSeoForPost", err);
      showToast(err instanceof Error ? err.message : "SEO generation failed", false);
    } finally {
      setSeoGeneratingId(null);
    }
  }

  const keywordList = postForm.meta_keywords.split(",").map(k => k.trim()).filter(Boolean);
  function toggleKeyword(kw: string) {
    const exists = keywordList.some(k => k.toLowerCase() === kw.toLowerCase());
    const next = exists ? keywordList.filter(k => k.toLowerCase() !== kw.toLowerCase()) : [...keywordList, kw];
    setPostForm(f => ({ ...f, meta_keywords: next.join(", ") }));
  }

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-black text-slate-900">{editingPost ? `Editing: ${editingPost.title}` : editingDraft ? `Editing draft: ${editingDraft.title || "Untitled"}` : "New Blog Post"}</h2>
            {(editingPost || editingDraft) && <button onClick={cancelEditPost} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100 min-h-[44px]">Cancel edit</button>}
          </div>
          {editingPost && <div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: C.p1_08, color: C.p1, border: `1px solid ${C.p1_20}` }}>✏️ Editing existing post.</div>}
          {editingDraft && <div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: C.p1_08, color: C.p1, border: `1px solid ${C.p1_20}` }}>📝 Editing a private draft — nothing is public until you schedule or publish it.</div>}

          <AiPhotoDropZone files={aiDropFiles} previews={aiDropPreviews} dragging={aiDropDragging} setDragging={setAiDropDragging}
            onFiles={onAiDropFiles} onRemove={removeAiDropFile} onClear={() => { setAiDropFiles([]); setAiDropPreviews([]); }}
            generating={aiGenerating} onGenerate={mode => { void generateBlogFromPhotos(mode); }} />

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
            {!editingDraft && (
              <div>
                <label htmlFor="blog-published-at" className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">{editingPost ? "Published date & time" : "Shown publication date"}</label>
                <input id="blog-published-at" className={inp} type="datetime-local" value={postForm.published_at} onChange={e => setPostForm(f => ({ ...f, published_at: e.target.value }))} />
                <p className="text-xs text-slate-400 mt-1">The date shown on the post. A future date hides it until then (and up to an hour late) — to publish at an exact time, use Schedule below.</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Body</label>
              <textarea className={ta} rows={8} placeholder={"Write your shoot story here...\n\nUse blank lines between paragraphs — each one becomes its own paragraph on the post page."} value={postForm.body} onChange={e => setPostForm(f => ({ ...f, body: e.target.value }))} />
              <p className="text-xs text-slate-400 mt-1">Separate paragraphs with a blank line.</p>
            </div>

            {/* SEO */}
            <div className="rounded-xl p-4 space-y-3" style={{ background: C.p1_04, border: `1.5px dashed ${C.p1_20}` }}>
              <label className="block text-xs font-bold uppercase tracking-widest" style={{ color: C.p1 }}>SEO</label>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="block text-xs font-bold uppercase tracking-widest text-slate-400">Meta description</span>
                  <span className="text-xs font-bold" style={{ color: postForm.meta_description.length > META_DESCRIPTION_MAX ? "#be123c" : C.p1 }}>{postForm.meta_description.length}/{META_DESCRIPTION_MAX}</span>
                </div>
                <textarea className={ta} rows={2} placeholder="One or two sentences that show under the title in Google. If blank, the post body is used." value={postForm.meta_description} onChange={e => setPostForm(f => ({ ...f, meta_description: e.target.value }))} />
                {/* Search-snippet advice only; long copy still saves. */}
                {metadataWarnings({ title: postForm.title, description: postForm.meta_description }).map(warning => (
                  <p key={warning} className="text-xs mt-1.5" style={{ color: C.p2 }}>{warning}</p>
                ))}
              </div>
              <div>
                <span className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Tags / keywords</span>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {BLOG_KEYWORD_OPTIONS.map(kw => {
                    const active = keywordList.some(k => k.toLowerCase() === kw.toLowerCase());
                    return (
                      <button key={kw} type="button" onClick={() => toggleKeyword(kw)}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg border transition-colors"
                        style={active ? { background: C.p1, color: C.white, borderColor: C.p1 } : { background: C.white, color: C.inkSoft, borderColor: C.borderSubtle }}>
                        {kw}
                      </button>
                    );
                  })}
                </div>
                <input className={inp} placeholder="Comma-separated keywords (tap chips above or type your own)" value={postForm.meta_keywords} onChange={e => setPostForm(f => ({ ...f, meta_keywords: e.target.value }))} />
              </div>
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

            {editingPost ? (
              <button onClick={savePost} disabled={postSaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{ background: C.grad, opacity: postSaving ? 0.7 : 1 }}>
                {postSaving ? "Saving…" : "Update Post ✓"}
              </button>
            ) : (
              <div className="space-y-3 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button onClick={saveDraftAndClose} disabled={postSaving} className="py-3 rounded-xl font-bold text-sm min-h-[44px] transition-all hover:opacity-90 active:scale-95" style={{ background: C.p1_08, color: C.p1, opacity: postSaving ? 0.7 : 1 }}>
                    {postSaving ? "Saving…" : "Save draft"}
                  </button>
                  <button onClick={async () => { if (scheduleOpen) { await scheduleDraft(); } else { setScheduleWhen(emptyScheduleDraft()); setScheduleOpen(true); } }} disabled={postSaving} aria-expanded={scheduleOpen} className="py-3 rounded-xl font-bold text-sm min-h-[44px] transition-all hover:opacity-90 active:scale-95" style={{ background: C.p2_08, color: C.p2, opacity: postSaving ? 0.7 : 1 }}>
                    {scheduleOpen ? "Confirm schedule" : "Schedule…"}
                  </button>
                  <button onClick={savePost} disabled={postSaving} className="py-3 rounded-xl font-bold text-sm text-white min-h-[44px] transition-all hover:opacity-90 active:scale-95" style={{ background: C.grad, opacity: postSaving ? 0.7 : 1 }}>
                    {postSaving ? "Publishing…" : "Publish now →"}
                  </button>
                </div>
                {scheduleOpen && (
                  <div className="rounded-xl p-4" style={{ background: C.p2_06, border: `1.5px dashed ${C.p2_18}` }}>
                    <ScheduleControl value={scheduleWhen} onChange={setScheduleWhen} theme="dark" />
                    <button onClick={() => setScheduleOpen(false)} className="mt-2 text-xs font-bold text-slate-400 underline min-h-[44px] px-2">Close without scheduling</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <BlogDraftsPanel showToast={showToast} onEdit={startEditDraft} editingDraftId={editingDraft?.id ?? null} refreshKey={draftsRefresh}
        onPublished={id => { if (editingDraft?.id === id) cancelEditPost(); fetchPosts(); }}
        onDeleted={id => { if (editingDraft?.id === id) cancelEditPost(); }} />

      <BlogPostList posts={posts} loading={postsLoading} editingPostId={editingPost?.id ?? null} imagesOpenId={imagesOpenId}
        seoGeneratingId={seoGeneratingId} deleteConfirmId={postDeleteConfirm} showToast={showToast}
        onToggleImages={id => setImagesOpenId(imagesOpenId === id ? null : id)} onSeo={generateSeoForPost}
        onEdit={startEditPost} onAskDelete={setPostDeleteConfirm} onDelete={deletePost}
        onLiveImagesChanged={id => { void onLiveImagesChanged(id); }} />
    </div>
  );
}
