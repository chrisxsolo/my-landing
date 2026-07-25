"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/colors";
import { uploadImage } from "@/lib/uploadImage";

type Pose = { id: number; title: string; image_url: string; instructions: string; order: number };
type Props = { showToast: (msg: string, ok?: boolean) => void };

const EMPTY_POSE = { title: "", instructions: "", order: "" };
const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";
const inp = "w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors";
const ta = `${inp} resize-none`;

export default function PosesTab({ showToast }: Props) {
  const [poses, setPoses] = useState<Pose[]>([]);
  const [posesLoading, setPosesLoading] = useState(true);
  const [poseForm, setPoseForm] = useState(EMPTY_POSE);
  const [poseImg, setPoseImg] = useState<File | null>(null);
  const [poseImgPreview, setPoseImgPreview] = useState<string | null>(null);
  const [poseSaving, setPoseSaving] = useState(false);
  const [editingPose, setEditingPose] = useState<Pose | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const poseFileRef = useRef<HTMLInputElement>(null);

  function fetchPoses() {
    supabase.from("grad_poses").select("*").order("order", { ascending: true })
      .then(({ data }) => {
        if (data) setPoses(data);
        setPosesLoading(false);
      });
  }

  useEffect(() => { fetchPoses(); }, []);

  function startEditPose(pose: Pose) {
    setEditingPose(pose);
    setPoseForm({ title: pose.title, instructions: pose.instructions, order: String(pose.order) });
    setPoseImg(null);
    setPoseImgPreview(pose.image_url || null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEditPose() {
    setEditingPose(null);
    setPoseForm(EMPTY_POSE);
    setPoseImg(null);
    setPoseImgPreview(null);
    if (poseFileRef.current) poseFileRef.current.value = "";
  }

  function onPoseImg(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPoseImg(f);
    setPoseImgPreview(URL.createObjectURL(f));
  }

  async function savePose() {
    if (!poseForm.title || !poseForm.instructions) { showToast("Title and instructions required", false); return; }
    setPoseSaving(true);
    let image_url = editingPose?.image_url ?? "";
    if (poseImg) {
      const url = await uploadImage(poseImg, "poses", showToast);
      if (!url) { setPoseSaving(false); return; }
      image_url = url;
    }
    if (editingPose) {
      const res = await fetch("/api/admin/grad-poses", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id: editingPose.id, updates: { title: poseForm.title, instructions: poseForm.instructions, image_url, order: parseInt(poseForm.order) || editingPose.order } }) });
      if (!res.ok) showToast("Update failed", false);
      else { showToast("Pose updated!"); cancelEditPose(); fetchPoses(); revalidatePublicSite(); }
    } else {
      const res = await fetch("/api/admin/grad-poses", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ title: poseForm.title, instructions: poseForm.instructions, image_url, order: parseInt(poseForm.order) || poses.length + 1 }) });
      if (!res.ok) showToast("Save failed", false);
      else { showToast("Pose added!"); setPoseForm(EMPTY_POSE); setPoseImg(null); setPoseImgPreview(null); if (poseFileRef.current) poseFileRef.current.value = ""; fetchPoses(); revalidatePublicSite(); }
    }
    setPoseSaving(false);
  }

  async function deletePose(id: number) {
    const res = await fetch(`/api/admin/grad-poses?id=${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) { showToast("Delete failed", false); return; }
    setPoses(p => p.filter(x => x.id !== id));
    setDeleteConfirm(null);
    if (editingPose?.id === id) cancelEditPose();
    showToast("Pose deleted");
    revalidatePublicSite();
  }

  // Fire-and-forget: busts the cached /grad-guide/posing content so edits show
  // up on the public page immediately instead of at the next hourly refresh.
  function revalidatePublicSite() { fetch("/api/admin/revalidate", { method: "POST", credentials: "include" }).catch(() => {}); }

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad90_12 }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-black text-slate-900">{editingPose ? `Editing: ${editingPose.title}` : "Add New Pose"}</h2>
            {editingPose && <button onClick={cancelEditPose} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">Cancel edit</button>}
          </div>
          {editingPose && <div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: C.p1_08, color: C.p1, border: `1px solid ${C.p1_20}` }}>✏️ Editing existing pose — changes will overwrite.</div>}

          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Photo</label>
            {poseImgPreview ? (
              <div className="relative w-full h-52 rounded-xl overflow-hidden mb-2">
                <img src={poseImgPreview} className="w-full h-full object-cover" />
                <button onClick={() => { setPoseImg(null); setPoseImgPreview(editingPose?.image_url || null); if (poseFileRef.current) poseFileRef.current.value = ""; }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center">✕</button>
                <button onClick={() => poseFileRef.current?.click()} className="absolute bottom-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full" style={{ background: `rgba(157,111,232,0.8)` }}>Change photo</button>
              </div>
            ) : (
              <button onClick={() => poseFileRef.current?.click()} className="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:border-violet-300" style={{ borderColor: C.p1_20, background: C.p1_04 }}>
                <span className="text-3xl">📷</span>
                <span className="text-xs font-bold" style={{ color: C.p1 }}>Tap to upload photo</span>
                <span className="text-xs text-slate-400">JPG, PNG, HEIC — works from phone camera roll</span>
              </button>
            )}
            <input ref={poseFileRef} type="file" accept="image/*" className="hidden" onChange={onPoseImg} />
          </div>

          <div className="space-y-3">
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Pose Title</label><input className={inp} placeholder="e.g. Over the Shoulder" value={poseForm.title} onChange={e => setPoseForm(f => ({ ...f, title: e.target.value }))} /></div>
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Instructions</label><textarea className={ta} rows={4} placeholder="Describe how to do this pose..." value={poseForm.instructions} onChange={e => setPoseForm(f => ({ ...f, instructions: e.target.value }))} /></div>
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order #</label><input className={inp} type="number" placeholder="e.g. 5" value={poseForm.order} onChange={e => setPoseForm(f => ({ ...f, order: e.target.value }))} /></div>
            <button onClick={savePose} disabled={poseSaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{ background: C.grad12, opacity: poseSaving ? 0.7 : 1 }}>
              {poseSaving ? "Saving…" : editingPose ? "Update Pose ✓" : "Save Pose →"}
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.p1 }}>Current Poses</p>
          <span className="text-xs font-bold text-slate-400">({poses.length})</span>
        </div>
        {posesLoading ? [...Array(3)].map((_, i) => <div key={i} className="rounded-2xl animate-pulse h-20 mb-3" style={{ background: `linear-gradient(135deg,${C.p1_08},${C.p2_06})` }} />) : (
          <div className="space-y-3">
            {poses.map(pose => (
              <div key={pose.id} className={card} style={editingPose?.id === pose.id ? { outline: `2px solid ${C.p1}` } : {}}>
                <div className="flex">
                  {pose.image_url ? <div className="w-20 h-20 flex-shrink-0 overflow-hidden"><img src={pose.image_url} className="w-full h-full object-cover" /></div> : <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: C.p1_06 }}>📷</div>}
                  <div className="flex-1 p-4 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0" style={{ background: C.p1_08, color: C.p1 }}>#{pose.order}</span>
                          <p className="text-sm font-black text-slate-900 truncate">{pose.title}</p>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{pose.instructions}</p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        {editingPose?.id !== pose.id && <button onClick={() => startEditPose(pose)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.p1_08, color: C.p1 }}>Edit</button>}
                        {deleteConfirm === pose.id ? (
                          <div className="flex gap-1.5">
                            <button onClick={() => deletePose(pose.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{ background: "#be123c" }}>Delete</button>
                            <button onClick={() => setDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                          </div>
                        ) : <button onClick={() => setDeleteConfirm(pose.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
