"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";
import { checkAuth, useAdminAuthed } from "@/lib/adminAuth";
import { useRouter } from "next/navigation";

export const dynamic = 'force-dynamic'

type Link = {
  id: number;
  label: string;
  url: string;
  emoji: string | null;
  description: string | null;
  active: boolean;
  order: number;
};

// Profile config — edit to update avatar/bio without going to Supabase
// After uploading your photo to Supabase Storage, paste the public URL here
const PROFILE_AVATAR_URL = ""; // ← paste URL here

const EMOJI_OPTIONS = ["📸","🎓","📅","💰","🌐","🖼️","📍","✍️","🔗","💬","📱","🎨","⭐","🏆","🎯","🔥","💡","🎁","📞","📧"];

const EMPTY_FORM = { label:"", url:"https://", emoji:"🔗", description:"", order:"" };

export default function AdminLinksPage() {
  const router = useRouter();
  const authed                = useAdminAuthed();
  const [links, setLinks]     = useState<Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [editing, setEditing] = useState<Link|null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number|null>(null);
  const [toast, setToast]     = useState<{msg:string;ok:boolean}|null>(null);
  const [toggling, setToggling] = useState<number|null>(null);

  // Redirect away if not authed (live check — runs only on the client).
  useEffect(() => {
    if (!checkAuth()) router.push('/admin');
  }, [router]);

  function showToast(msg:string, ok=true) { setToast({msg,ok}); setTimeout(()=>setToast(null),3000); }

  function fetchLinks() {
    supabase.from('links').select('*').order('order',{ascending:true})
      .then(({ data }) => {
        if (data) setLinks(data);
        setLoading(false);
      });
  }
  useEffect(() => { if (authed) fetchLinks(); }, [authed]);

  function startEdit(link: Link) {
    setEditing(link);
    setForm({ label:link.label, url:link.url, emoji:link.emoji||"🔗", description:link.description||"", order:String(link.order) });
    window.scrollTo({ top:0, behavior:"smooth" });
  }
  function cancelEdit() { setEditing(null); setForm(EMPTY_FORM); }

  async function saveLink() {
    if (!form.label || !form.url) { showToast("Label and URL required", false); return; }
    setSaving(true);
    const payload = {
      label: form.label,
      url: form.url,
      emoji: form.emoji || null,
      description: form.description || null,
      order: parseInt(form.order) || (editing ? editing.order : links.length + 1),
      active: editing ? editing.active : true,
    };
    if (editing) {
      const res = await fetch('/api/admin/links', { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ id: editing.id, updates: payload }) });
      if (!res.ok) showToast("Update failed", false);
      else { showToast("Link updated!"); cancelEdit(); fetchLinks(); }
    } else {
      const res = await fetch('/api/admin/links', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify(payload) });
      if (!res.ok) showToast("Save failed", false);
      else { showToast("Link added!"); setForm(EMPTY_FORM); fetchLinks(); }
    }
    setSaving(false);
  }

  async function toggleActive(link: Link) {
    setToggling(link.id);
    await fetch('/api/admin/links', { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ id: link.id, updates: { active: !link.active } }) });
    setLinks(prev => prev.map(l => l.id===link.id ? {...l,active:!l.active} : l));
    setToggling(null);
    showToast(link.active ? "Link hidden" : "Link visible");
  }

  async function moveOrder(link: Link, dir: "up"|"down") {
    const sorted = [...links].sort((a,b)=>a.order-b.order);
    const idx = sorted.findIndex(l=>l.id===link.id);
    const swap = dir==="up" ? sorted[idx-1] : sorted[idx+1];
    if (!swap) return;
    await fetch('/api/admin/links', { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ id: link.id, updates: { order: swap.order } }) });
    await fetch('/api/admin/links', { method:'PATCH', headers:{'Content-Type':'application/json'}, credentials:'include', body: JSON.stringify({ id: swap.id, updates: { order: link.order } }) });
    fetchLinks();
  }

  async function deleteLink(id: number) {
    await fetch(`/api/admin/links?id=${id}`, { method:'DELETE', credentials:'include' });
    setLinks(prev => prev.filter(l=>l.id!==id));
    setDeleteConfirm(null);
    if (editing?.id===id) cancelEdit();
    showToast("Link deleted");
  }

  const inp = "w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors";

  // Show loading while checking auth
  if (!authed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 font-sans">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ background:"#f8f7ff" }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-xl"
          style={{ background:toast.ok?C.grad12:"#be123c" }}>{toast.msg}</div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-black/[0.06] px-6 h-14 flex items-center justify-between"
        style={{ background:"rgba(255,255,255,0.95)", backdropFilter:"blur(20px)" }}>
        <span className="font-black text-lg" style={C.text}>Links Admin</span>
        <div className="flex items-center gap-4">
          <a href="/links" target="_blank" className="text-xs font-bold text-slate-400 hover:text-violet-600 transition-colors">View page ↗</a>
          <a href="/admin" className="text-xs font-bold text-slate-400 hover:text-violet-600 transition-colors">← Dashboard</a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">

        {/* Profile avatar hint */}
        {!PROFILE_AVATAR_URL && (
          <div className="rounded-2xl p-4 text-sm font-medium" style={{ background:C.p3_08, border:`1px solid ${C.p3_15}`, color:"#92400e" }}>
            💡 To show your profile photo: upload it to Supabase Storage → copy the public URL → paste it into <code className="bg-amber-100 px-1.5 rounded text-xs">PROFILE_AVATAR_URL</code> at the top of <code className="bg-amber-100 px-1.5 rounded text-xs">app/admin/links/page.tsx</code>
          </div>
        )}

        {/* Add / Edit form */}
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="h-[3px]" style={{ background:C.grad90 }}/>
          <div className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-black text-slate-900">
                {editing ? `Editing: ${editing.label}` : "Add New Link"}
              </h2>
              {editing && (
                <button onClick={cancelEdit} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">
                  Cancel
                </button>
              )}
            </div>

            {editing && (
              <div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{ background:C.p1_08, color:C.p1, border:`1px solid ${C.p1_20}` }}>
                ✏️ Editing existing link — changes save immediately.
              </div>
            )}

            <div className="space-y-3">
              {/* Emoji picker */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Icon</label>
                <div className="flex flex-wrap gap-2">
                  {EMOJI_OPTIONS.map(emoji => (
                    <button key={emoji} onClick={()=>setForm(f=>({...f,emoji}))}
                      className="w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all"
                      style={{ background:form.emoji===emoji?C.grad12:"rgba(0,0,0,0.04)", transform:form.emoji===emoji?"scale(1.15)":"scale(1)" }}>
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Label</label>
                <input className={inp} placeholder="e.g. Book a Shoot!" value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))}/>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">URL</label>
                <input className={inp} placeholder="https://..." value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))} type="url"/>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Description <span className="normal-case font-normal text-slate-300">(optional)</span></label>
                <input className={inp} placeholder="Short subtitle shown under the label" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}/>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order #</label>
                <input className={inp} type="number" placeholder={`e.g. ${links.length + 1}`} value={form.order} onChange={e=>setForm(f=>({...f,order:e.target.value}))}/>
              </div>

              <button onClick={saveLink} disabled={saving}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2"
                style={{ background:C.grad12, opacity:saving?0.7:1 }}>
                {saving ? "Saving…" : editing ? "Update Link ✓" : "Add Link →"}
              </button>
            </div>
          </div>
        </div>

        {/* Link list */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <p className="text-xs font-black uppercase tracking-widest" style={{ color:C.p1 }}>All Links</p>
            <span className="text-xs font-bold text-slate-400">({links.length})</span>
            <span className="text-xs text-slate-400">· {links.filter(l=>l.active).length} visible</span>
          </div>

          {loading ? (
            [...Array(4)].map((_,i)=>(
              <div key={i} className="rounded-2xl animate-pulse h-16 mb-3" style={{ background:`linear-gradient(135deg,${C.p1_08},${C.p2_06})` }}/>
            ))
          ) : links.length === 0 ? (
            <p className="text-sm text-slate-400 font-medium">No links yet — add your first one above.</p>
          ) : (
            <div className="space-y-3">
              {[...links].sort((a,b)=>a.order-b.order).map((link, i, arr) => (
                <div key={link.id}
                  className="bg-white rounded-2xl border overflow-hidden transition-all"
                  style={{ borderColor: editing?.id===link.id ? C.p1_30 : "rgba(0,0,0,0.07)", outline: editing?.id===link.id ? `2px solid ${C.p1}` : "none" }}>

                  {/* Active indicator bar */}
                  <div className="h-[2px]" style={{ background: link.active ? C.grad12 : "#e2e8f0" }}/>

                  <div className="flex items-center gap-3 p-4">
                    {/* Emoji */}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                      style={{ background: link.active ? `linear-gradient(135deg,${C.p1_10},${C.p2_08})` : "rgba(0,0,0,0.04)" }}>
                      {link.emoji || "🔗"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-black text-slate-900 truncate">{link.label}</p>
                        {!link.active && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400">hidden</span>}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{link.url}</p>
                      {link.description && <p className="text-xs text-slate-500 truncate">{link.description}</p>}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5">
                        <button onClick={()=>moveOrder(link,"up")} disabled={i===0}
                          className="w-6 h-5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 flex items-center justify-center text-xs transition-colors">▲</button>
                        <button onClick={()=>moveOrder(link,"down")} disabled={i===arr.length-1}
                          className="w-6 h-5 rounded text-slate-300 hover:text-slate-600 disabled:opacity-20 flex items-center justify-center text-xs transition-colors">▼</button>
                      </div>

                      {/* Toggle visible */}
                      <button onClick={()=>toggleActive(link)} disabled={toggling===link.id}
                        className="text-xs font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ background: link.active ? C.p1_08 : "rgba(0,0,0,0.04)", color: link.active ? C.p1 : "#94a3b8" }}>
                        {toggling===link.id ? "…" : link.active ? "On" : "Off"}
                      </button>

                      {/* Edit */}
                      {editing?.id !== link.id && (
                        <button onClick={()=>startEdit(link)}
                          className="text-xs font-bold px-2.5 py-1.5 rounded-lg"
                          style={{ background:C.p2_08, color:C.p2 }}>
                          Edit
                        </button>
                      )}

                      {/* Delete */}
                      {deleteConfirm === link.id ? (
                        <div className="flex gap-1">
                          <button onClick={()=>deleteLink(link.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{ background:"#be123c" }}>Del</button>
                          <button onClick={()=>setDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2 py-1.5 rounded-lg bg-slate-100">✕</button>
                        </div>
                      ) : (
                        <button onClick={()=>setDeleteConfirm(link.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 font-medium">Changes save instantly · Toggle links on/off without deleting them</p>
      </div>
    </div>
  );
}
