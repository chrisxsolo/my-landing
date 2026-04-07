"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from "react";
export const dynamic = 'force-dynamic'  // ← ADD THIS

const ADMIN_PASSWORD = "chris2026"; // ← change this

type Tab = "poses" | "locations";

type Pose = {
  id: number;
  title: string;
  image_url: string;
  instructions: string;
  order: number;
};

type Spot = {
  id: number;
  school_id: string;
  school_name: string;
  school_short: string;
  name: string;
  description: string;
  tip: string;
  icon: string;
  image_url: string | null;
  order: number;
};

const SCHOOLS = [
  { id:"sjsu",     name:"San Jose State University",      short:"SJSU"        },
  { id:"berkeley", name:"UC Berkeley",                    short:"UC Berkeley"  },
  { id:"sfsu",     name:"San Francisco State University", short:"SF State"     },
  { id:"csueb",    name:"Cal State East Bay",             short:"CSUEB"        },
  { id:"usf",      name:"University of San Francisco",    short:"USF"          },
];

const ICONS = ["🏫","🏛️","🌴","📚","🌸","🚪","🌳","🗼","🌿","🌊","🏢","🌅","🌁","🏔️","⛪","🌉","🦅","🔵","🐻"];

const EMPTY_POSE  = { title:"", instructions:"", order:"" };
const EMPTY_SPOT  = { school_id:"sjsu", name:"", description:"", tip:"", icon:"🏫", order:"" };

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw]         = useState("");
  const [pwErr, setPwErr]   = useState(false);
  const [tab, setTab]       = useState<Tab>("poses");
  const [toast, setToast]   = useState<{msg:string;ok:boolean}|null>(null);

  // ── Poses ──────────────────────────────────────────────────────────────
  const [poses, setPoses]             = useState<Pose[]>([]);
  const [posesLoading, setPosesLoading] = useState(false);
  const [poseForm, setPoseForm]       = useState(EMPTY_POSE);
  const [poseImg, setPoseImg]         = useState<File|null>(null);
  const [poseImgPreview, setPoseImgPreview] = useState<string|null>(null);
  const [poseSaving, setPoseSaving]   = useState(false);
  const [editingPose, setEditingPose] = useState<Pose|null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<number|null>(null);
  const poseFileRef = useRef<HTMLInputElement>(null);

  // ── Spots ──────────────────────────────────────────────────────────────
  const [spots, setSpots]               = useState<Spot[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(false);
  const [spotForm, setSpotForm]         = useState(EMPTY_SPOT);
  const [spotImg, setSpotImg]           = useState<File|null>(null);
  const [spotImgPreview, setSpotImgPreview] = useState<string|null>(null);
  const [spotSaving, setSpotSaving]     = useState(false);
  const [editingSpot, setEditingSpot]   = useState<Spot|null>(null);
  const [spotDeleteConfirm, setSpotDeleteConfirm] = useState<number|null>(null);
  const spotFileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, ok = true) {
    setToast({msg,ok});
    setTimeout(() => setToast(null), 3000);
  }

  // ── Fetch ──────────────────────────────────────────────────────────────
  async function fetchPoses() {
    setPosesLoading(true);
    const { data } = await supabase.from('grad_poses').select('*').order('order',{ascending:true});
    if (data) setPoses(data);
    setPosesLoading(false);
  }
  async function fetchSpots() {
    setSpotsLoading(true);
    const { data } = await supabase.from('location_spots').select('*').order('school_id').order('order',{ascending:true});
    if (data) setSpots(data);
    setSpotsLoading(false);
  }
  useEffect(() => { if (authed) { fetchPoses(); fetchSpots(); } }, [authed]);

  // ── Upload image ────────────────────────────────────────────────────────
  async function uploadImage(file: File, folder: string): Promise<string|null> {
    const ext  = file.name.split('.').pop();
    const name = `${folder}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('grad-photos').upload(name, file, { upsert:true });
    if (error) { showToast("Image upload failed", false); return null; }
    const { data } = supabase.storage.from('grad-photos').getPublicUrl(name);
    return data.publicUrl;
  }

  // ── POSE: start editing ─────────────────────────────────────────────────
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
      const url = await uploadImage(poseImg, "poses");
      if (!url) { setPoseSaving(false); return; }
      image_url = url;
    }

    if (editingPose) {
      // UPDATE
      const { error } = await supabase.from('grad_poses').update({
        title: poseForm.title,
        instructions: poseForm.instructions,
        image_url,
        order: parseInt(poseForm.order) || editingPose.order,
      }).eq('id', editingPose.id);
      if (error) showToast("Update failed — " + error.message, false);
      else { showToast("Pose updated!"); cancelEditPose(); fetchPoses(); }
    } else {
      // INSERT
      const { error } = await supabase.from('grad_poses').insert({
        title: poseForm.title,
        instructions: poseForm.instructions,
        image_url,
        order: parseInt(poseForm.order) || poses.length + 1,
      });
      if (error) showToast("Save failed — " + error.message, false);
      else {
        showToast("Pose added!");
        setPoseForm(EMPTY_POSE);
        setPoseImg(null);
        setPoseImgPreview(null);
        if (poseFileRef.current) poseFileRef.current.value = "";
        fetchPoses();
      }
    }
    setPoseSaving(false);
  }

  async function deletePose(id: number) {
    await supabase.from('grad_poses').delete().eq('id', id);
    setPoses(prev => prev.filter(p => p.id !== id));
    setDeleteConfirm(null);
    if (editingPose?.id === id) cancelEditPose();
    showToast("Pose deleted");
  }

  // ── SPOT: start editing ─────────────────────────────────────────────────
  function startEditSpot(spot: Spot) {
    setEditingSpot(spot);
    setSpotForm({
      school_id:   spot.school_id,
      name:        spot.name,
      description: spot.description,
      tip:         spot.tip,
      icon:        spot.icon,
      order:       String(spot.order),
    });
    setSpotImg(null);
    setSpotImgPreview(spot.image_url || null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function cancelEditSpot() {
    setEditingSpot(null);
    setSpotForm(EMPTY_SPOT);
    setSpotImg(null);
    setSpotImgPreview(null);
    if (spotFileRef.current) spotFileRef.current.value = "";
  }

  function onSpotImg(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setSpotImg(f);
    setSpotImgPreview(URL.createObjectURL(f));
  }

  async function saveSpot() {
    if (!spotForm.name || !spotForm.description || !spotForm.tip) { showToast("Name, description and tip required", false); return; }
    setSpotSaving(true);

    let image_url: string|null = editingSpot?.image_url ?? null;
    if (spotImg) {
      const url = await uploadImage(spotImg, "locations");
      if (!url) { setSpotSaving(false); return; }
      image_url = url;
    }

    const school = SCHOOLS.find(s => s.id === spotForm.school_id)!;

    if (editingSpot) {
      // UPDATE
      const { error } = await supabase.from('location_spots').update({
        school_id:    school.id,
        school_name:  school.name,
        school_short: school.short,
        name:         spotForm.name,
        description:  spotForm.description,
        tip:          spotForm.tip,
        icon:         spotForm.icon,
        image_url,
        order: parseInt(spotForm.order) || editingSpot.order,
      }).eq('id', editingSpot.id);
      if (error) showToast("Update failed — " + error.message, false);
      else { showToast("Location updated!"); cancelEditSpot(); fetchSpots(); }
    } else {
      // INSERT
      const { error } = await supabase.from('location_spots').insert({
        school_id:    school.id,
        school_name:  school.name,
        school_short: school.short,
        name:         spotForm.name,
        description:  spotForm.description,
        tip:          spotForm.tip,
        icon:         spotForm.icon,
        image_url,
        order: parseInt(spotForm.order) || spots.filter(s=>s.school_id===school.id).length + 1,
      });
      if (error) showToast("Save failed — " + error.message, false);
      else {
        showToast("Location added!");
        setSpotForm(EMPTY_SPOT);
        setSpotImg(null);
        setSpotImgPreview(null);
        if (spotFileRef.current) spotFileRef.current.value = "";
        fetchSpots();
      }
    }
    setSpotSaving(false);
  }

  async function deleteSpot(id: number) {
    await supabase.from('location_spots').delete().eq('id', id);
    setSpots(prev => prev.filter(s => s.id !== id));
    setSpotDeleteConfirm(null);
    if (editingSpot?.id === id) cancelEditSpot();
    showToast("Spot deleted");
  }

  // ── Shared styles ───────────────────────────────────────────────────────
  const inp  = "w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-400 bg-white transition-colors";
  const ta   = `${inp} resize-none`;
  const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";

  // ── Password gate ───────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="font-black text-2xl" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Chris.</span>
            <p className="text-slate-400 text-sm mt-1 font-medium">Admin Dashboard</p>
          </div>
          <div className="rounded-2xl p-8 shadow-xl shadow-violet-500/10" style={{border:"1px solid rgba(124,58,237,0.15)"}}>
            <div className="h-[3px] rounded-full mb-6" style={{background:"linear-gradient(90deg,#7c3aed,#db2777,#f59e0b)"}}/>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Password</label>
            <input type="password" value={pw}
              onChange={e=>{setPw(e.target.value);setPwErr(false);}}
              onKeyDown={e=>{if(e.key==="Enter"){if(pw===ADMIN_PASSWORD)setAuthed(true);else setPwErr(true);}}}
              placeholder="Enter password" className={inp+" mb-4"}
              style={pwErr?{borderColor:"#db2777"}:{}}
            />
            {pwErr && <p className="text-xs font-semibold text-pink-600 mb-3">Incorrect password</p>}
            <button onClick={()=>{if(pw===ADMIN_PASSWORD)setAuthed(true);else setPwErr(true);}}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90"
              style={{background:"linear-gradient(135deg,#7c3aed,#db2777)"}}>
              Enter →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans" style={{background:"#f8f7ff"}}>

      {/* Toast */}
      {toast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-xl" style={{background:toast.ok?"linear-gradient(135deg,#7c3aed,#db2777)":"#be123c"}}>
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-black/[0.06] px-6 h-14 flex items-center justify-between" style={{background:"rgba(255,255,255,0.95)",backdropFilter:"blur(20px)"}}>
        <span className="font-black text-lg" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
          Chris. Admin
        </span>
        <div className="flex items-center gap-4">
          <a href="/admin/availability" className="text-xs font-bold text-slate-400 hover:text-violet-600 transition-colors">📅 Availability</a>
          <a href="/" className="text-xs font-bold text-slate-400 hover:text-violet-600 transition-colors">← Site</a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">

        {/* Tab switcher */}
        <div className="flex gap-2 mb-8 p-1 rounded-2xl bg-white border border-slate-100 w-fit">
          {(["poses","locations"] as Tab[]).map(t => (
            <button key={t} onClick={()=>{ setTab(t); cancelEditPose(); cancelEditSpot(); }}
              className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
              style={tab===t?{background:"linear-gradient(135deg,#7c3aed,#db2777)",color:"#fff"}:{color:"#94a3b8"}}>
              {t==="poses"?"📸 Grad Poses":"📍 Locations"}
            </button>
          ))}
        </div>

        {/* ── POSES TAB ──────────────────────────────────────────────────── */}
        {tab === "poses" && (
          <div className="space-y-6">

            {/* Form — Add or Edit */}
            <div className={card}>
              <div className="h-[3px]" style={{background:"linear-gradient(90deg,#7c3aed,#db2777)"}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-black text-slate-900">
                    {editingPose ? `Editing: ${editingPose.title}` : "Add New Pose"}
                  </h2>
                  {editingPose && (
                    <button onClick={cancelEditPose} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg bg-slate-100 transition-colors">
                      Cancel edit
                    </button>
                  )}
                </div>

                {/* Editing badge */}
                {editingPose && (
                  <div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{background:"rgba(124,58,237,0.08)",color:"#7c3aed",border:"1px solid rgba(124,58,237,0.2)"}}>
                    ✏️ You're editing an existing pose. Changes will overwrite the current version.
                  </div>
                )}

                {/* Image upload */}
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Photo</label>
                  {poseImgPreview ? (
                    <div className="relative w-full h-52 rounded-xl overflow-hidden mb-2">
                      <img src={poseImgPreview} className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"/>
                      <button
                        onClick={()=>{
                          setPoseImg(null);
                          setPoseImgPreview(editingPose?.image_url || null);
                          if(poseFileRef.current) poseFileRef.current.value="";
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center hover:bg-black/70 transition-colors">
                        ✕
                      </button>
                      <button onClick={()=>poseFileRef.current?.click()}
                        className="absolute bottom-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full" style={{background:"rgba(124,58,237,0.8)"}}>
                        Change photo
                      </button>
                    </div>
                  ) : (
                    <button onClick={()=>poseFileRef.current?.click()}
                      className="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:border-violet-400"
                      style={{borderColor:"rgba(124,58,237,0.2)",background:"rgba(124,58,237,0.03)"}}>
                      <span className="text-3xl">📷</span>
                      <span className="text-xs font-bold text-violet-500">Tap to upload photo</span>
                      <span className="text-xs text-slate-400">JPG, PNG, HEIC — works from phone camera roll</span>
                    </button>
                  )}
                  <input ref={poseFileRef} type="file" accept="image/*" className="hidden" onChange={onPoseImg}/>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Pose Title</label>
                    <input className={inp} placeholder="e.g. Over the Shoulder" value={poseForm.title} onChange={e=>setPoseForm(f=>({...f,title:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Instructions</label>
                    <textarea className={ta} rows={4} placeholder="Describe how to do this pose..." value={poseForm.instructions} onChange={e=>setPoseForm(f=>({...f,instructions:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order #</label>
                    <input className={inp} type="number" placeholder="e.g. 5" value={poseForm.order} onChange={e=>setPoseForm(f=>({...f,order:e.target.value}))}/>
                  </div>
                  <button onClick={savePose} disabled={poseSaving}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2"
                    style={{background:"linear-gradient(135deg,#7c3aed,#db2777)",opacity:poseSaving?0.7:1}}>
                    {poseSaving ? "Saving…" : editingPose ? "Update Pose ✓" : "Save Pose →"}
                  </button>
                </div>
              </div>
            </div>

            {/* Existing poses list */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-black uppercase tracking-widest text-violet-600">Current Poses</p>
                <span className="text-xs font-bold text-slate-400">({poses.length})</span>
              </div>
              {posesLoading ? (
                [...Array(3)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-20 mb-3" style={{background:"linear-gradient(135deg,#ede9fe,#fce7f3)"}}/>)
              ) : poses.length === 0 ? (
                <p className="text-sm text-slate-400 font-medium">No poses yet — add your first one above.</p>
              ) : (
                <div className="space-y-3">
                  {poses.map(pose => (
                    <div key={pose.id} className={card + (editingPose?.id===pose.id?" ring-2 ring-violet-400":"")}>
                      <div className="flex">
                        {pose.image_url ? (
                          <div className="w-20 h-20 flex-shrink-0 overflow-hidden">
                            <img src={pose.image_url} className="w-full h-full object-cover"/>
                          </div>
                        ) : (
                          <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-2xl" style={{background:"rgba(124,58,237,0.06)"}}>📷</div>
                        )}
                        <div className="flex-1 p-4 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0" style={{background:"rgba(124,58,237,0.08)",color:"#7c3aed"}}>#{pose.order}</span>
                                <p className="text-sm font-black text-slate-900 truncate">{pose.title}</p>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{pose.instructions}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              {editingPose?.id !== pose.id && (
                                <button onClick={()=>startEditPose(pose)}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                                  style={{background:"rgba(124,58,237,0.08)",color:"#7c3aed"}}>
                                  Edit
                                </button>
                              )}
                              {deleteConfirm === pose.id ? (
                                <div className="flex gap-1.5">
                                  <button onClick={()=>deletePose(pose.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{background:"#be123c"}}>Delete</button>
                                  <button onClick={()=>setDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                                </div>
                              ) : (
                                <button onClick={()=>setDeleteConfirm(pose.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>
                              )}
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
        )}

        {/* ── LOCATIONS TAB ──────────────────────────────────────────────── */}
        {tab === "locations" && (
          <div className="space-y-6">

            {/* Form — Add or Edit */}
            <div className={card}>
              <div className="h-[3px]" style={{background:"linear-gradient(90deg,#db2777,#f59e0b)"}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-black text-slate-900">
                    {editingSpot ? `Editing: ${editingSpot.name}` : "Add New Location Spot"}
                  </h2>
                  {editingSpot && (
                    <button onClick={cancelEditSpot} className="text-xs font-bold text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg bg-slate-100 transition-colors">
                      Cancel edit
                    </button>
                  )}
                </div>

                {editingSpot && (
                  <div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{background:"rgba(219,39,119,0.07)",color:"#db2777",border:"1px solid rgba(219,39,119,0.2)"}}>
                    ✏️ You're editing an existing spot. Changes will overwrite the current version.
                  </div>
                )}

                {/* Image upload */}
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Photo</label>
                  {spotImgPreview ? (
                    <div className="relative w-full h-52 rounded-xl overflow-hidden mb-2">
                      <img src={spotImgPreview} className="w-full h-full object-cover"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"/>
                      <button
                        onClick={()=>{
                          setSpotImg(null);
                          setSpotImgPreview(editingSpot?.image_url || null);
                          if(spotFileRef.current) spotFileRef.current.value="";
                        }}
                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center hover:bg-black/70 transition-colors">
                        ✕
                      </button>
                      <button onClick={()=>spotFileRef.current?.click()}
                        className="absolute bottom-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full" style={{background:"rgba(219,39,119,0.8)"}}>
                        Change photo
                      </button>
                    </div>
                  ) : (
                    <button onClick={()=>spotFileRef.current?.click()}
                      className="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:border-pink-400"
                      style={{borderColor:"rgba(219,39,119,0.2)",background:"rgba(219,39,119,0.03)"}}>
                      <span className="text-3xl">📷</span>
                      <span className="text-xs font-bold text-pink-500">Tap to upload photo</span>
                      <span className="text-xs text-slate-400">JPG, PNG, HEIC — works from phone camera roll</span>
                    </button>
                  )}
                  <input ref={spotFileRef} type="file" accept="image/*" className="hidden" onChange={onSpotImg}/>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">School</label>
                    <select className={inp} value={spotForm.school_id} onChange={e=>setSpotForm(f=>({...f,school_id:e.target.value}))}>
                      {SCHOOLS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Spot Name</label>
                    <input className={inp} placeholder="e.g. Sather Gate" value={spotForm.name} onChange={e=>setSpotForm(f=>({...f,name:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Description</label>
                    <textarea className={ta} rows={3} placeholder="Describe the spot and why it's great..." value={spotForm.description} onChange={e=>setSpotForm(f=>({...f,description:e.target.value}))}/>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Pro Tip</label>
                    <input className={inp} placeholder="e.g. Arrive before 9am on weekdays" value={spotForm.tip} onChange={e=>setSpotForm(f=>({...f,tip:e.target.value}))}/>
                  </div>
                  {/* Icon picker */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Icon</label>
                    <div className="flex flex-wrap gap-2">
                      {ICONS.map(icon => (
                        <button key={icon} onClick={()=>setSpotForm(f=>({...f,icon}))}
                          className="w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all"
                          style={{background:spotForm.icon===icon?"linear-gradient(135deg,#db2777,#f59e0b)":"rgba(0,0,0,0.04)",transform:spotForm.icon===icon?"scale(1.15)":"scale(1)"}}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order #</label>
                    <input className={inp} type="number" placeholder="e.g. 3" value={spotForm.order} onChange={e=>setSpotForm(f=>({...f,order:e.target.value}))}/>
                  </div>
                  <button onClick={saveSpot} disabled={spotSaving}
                    className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2"
                    style={{background:"linear-gradient(135deg,#db2777,#f59e0b)",opacity:spotSaving?0.7:1}}>
                    {spotSaving ? "Saving…" : editingSpot ? "Update Location ✓" : "Save Location →"}
                  </button>
                </div>
              </div>
            </div>

            {/* Existing spots grouped by school */}
            {spotsLoading ? (
              [...Array(4)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-20" style={{background:"linear-gradient(135deg,#fce7f3,#fef3c7)"}}/>)
            ) : (
              SCHOOLS.map(school => {
                const schoolSpots = spots.filter(s => s.school_id === school.id);
                if (schoolSpots.length === 0) return null;
                return (
                  <div key={school.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-black uppercase tracking-widest text-pink-600">{school.short}</p>
                      <span className="text-xs font-bold text-slate-400">({schoolSpots.length} spots)</span>
                    </div>
                    <div className="space-y-3">
                      {schoolSpots.map(spot => (
                        <div key={spot.id} className={card + (editingSpot?.id===spot.id?" ring-2 ring-pink-400":"")}>
                          <div className="flex">
                            {spot.image_url ? (
                              <div className="w-20 h-20 flex-shrink-0 overflow-hidden">
                                <img src={spot.image_url} className="w-full h-full object-cover"/>
                              </div>
                            ) : (
                              <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-2xl" style={{background:"rgba(219,39,119,0.06)"}}>
                                {spot.icon}
                              </div>
                            )}
                            <div className="flex-1 p-4 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900 truncate mb-0.5">{spot.name}</p>
                                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{spot.description}</p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  {editingSpot?.id !== spot.id && (
                                    <button onClick={()=>startEditSpot(spot)}
                                      className="text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                                      style={{background:"rgba(219,39,119,0.08)",color:"#db2777"}}>
                                      Edit
                                    </button>
                                  )}
                                  {spotDeleteConfirm === spot.id ? (
                                    <div className="flex gap-1.5">
                                      <button onClick={()=>deleteSpot(spot.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{background:"#be123c"}}>Delete</button>
                                      <button onClick={()=>setSpotDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                                    </div>
                                  ) : (
                                    <button onClick={()=>setSpotDeleteConfirm(spot.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>
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
        )}
      </div>
    </div>
  );
}