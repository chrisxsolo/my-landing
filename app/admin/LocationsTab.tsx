"use client";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { C } from "@/lib/colors";
import { uploadImage } from "@/lib/uploadImage";

type Spot = { id: number; school_id: string; school_name: string; school_short: string; name: string; description: string; tip: string; icon: string; image_url: string | null; order: number };
type Props = { showToast: (msg: string, ok?: boolean) => void };

const SCHOOLS = [
  { id: "sjsu",     name: "San Jose State University",      short: "SJSU" },
  { id: "berkeley", name: "UC Berkeley",                    short: "UC Berkeley" },
  { id: "sfsu",     name: "San Francisco State University", short: "SF State" },
  { id: "csueb",    name: "Cal State East Bay",             short: "CSUEB" },
  { id: "usf",      name: "University of San Francisco",    short: "USF" },
];
const ICONS = ["🏫","🏛️","🌴","📚","🌸","🚪","🌳","🗼","🌿","🌊","🏢","🌅","🌁","🏔️","⛪","🌉","🦅","🔵","🐻"];
const EMPTY_SPOT = { school_id: "sjsu", name: "", description: "", tip: "", icon: "🏫", order: "" };

const card = "bg-white rounded-2xl border border-slate-100 overflow-hidden";
const inp = "w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors";
const ta = `${inp} resize-none`;

export default function LocationsTab({ showToast }: Props) {
  const [spots, setSpots] = useState<Spot[]>([]);
  const [spotsLoading, setSpotsLoading] = useState(true);
  const [spotForm, setSpotForm] = useState(EMPTY_SPOT);
  const [spotImg, setSpotImg] = useState<File | null>(null);
  const [spotImgPreview, setSpotImgPreview] = useState<string | null>(null);
  const [spotSaving, setSpotSaving] = useState(false);
  const [editingSpot, setEditingSpot] = useState<Spot | null>(null);
  const [spotDeleteConfirm, setSpotDeleteConfirm] = useState<number | null>(null);
  const spotFileRef = useRef<HTMLInputElement>(null);

  function fetchSpots() {
    supabase.from("location_spots").select("*").order("school_id").order("order", { ascending: true })
      .then(({ data }) => {
        if (data) setSpots(data);
        setSpotsLoading(false);
      });
  }

  useEffect(() => { fetchSpots(); }, []);

  function startEditSpot(spot: Spot) {
    setEditingSpot(spot);
    setSpotForm({ school_id: spot.school_id, name: spot.name, description: spot.description, tip: spot.tip, icon: spot.icon, order: String(spot.order) });
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
    let image_url: string | null = editingSpot?.image_url ?? null;
    if (spotImg) {
      const url = await uploadImage(spotImg, "locations", showToast);
      if (!url) { setSpotSaving(false); return; }
      image_url = url;
    }
    const school = SCHOOLS.find(s => s.id === spotForm.school_id)!;
    if (editingSpot) {
      const updates = { school_id: school.id, school_name: school.name, school_short: school.short, name: spotForm.name, description: spotForm.description, tip: spotForm.tip, icon: spotForm.icon, image_url, order: parseInt(spotForm.order) || editingSpot.order };
      const res = await fetch("/api/admin/location-spots", { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id: editingSpot.id, updates }) });
      if (!res.ok) showToast("Update failed", false);
      else { showToast("Location updated!"); cancelEditSpot(); fetchSpots(); revalidatePublicSite(); }
    } else {
      const spot = { school_id: school.id, school_name: school.name, school_short: school.short, name: spotForm.name, description: spotForm.description, tip: spotForm.tip, icon: spotForm.icon, image_url, order: parseInt(spotForm.order) || spots.filter(s => s.school_id === school.id).length + 1 };
      const res = await fetch("/api/admin/location-spots", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(spot) });
      if (!res.ok) showToast("Save failed", false);
      else { showToast("Location added!"); setSpotForm(EMPTY_SPOT); setSpotImg(null); setSpotImgPreview(null); if (spotFileRef.current) spotFileRef.current.value = ""; fetchSpots(); revalidatePublicSite(); }
    }
    setSpotSaving(false);
  }

  async function deleteSpot(id: number) {
    await fetch(`/api/admin/location-spots?id=${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include" });
    setSpots(p => p.filter(x => x.id !== id));
    setSpotDeleteConfirm(null);
    if (editingSpot?.id === id) cancelEditSpot();
    showToast("Spot deleted");
    revalidatePublicSite();
  }

  // Fire-and-forget: busts the cached /grad-guide/campus-spots content so edits
  // show up on the public page immediately instead of at the next hourly refresh.
  function revalidatePublicSite() { fetch("/api/admin/revalidate", { method: "POST", credentials: "include" }).catch(() => {}); }

  return (
    <div className="space-y-6">
      <div className={card}>
        <div className="h-[3px]" style={{ background: C.grad90_23 }} />
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-black text-slate-900">{editingSpot ? `Editing: ${editingSpot.name}` : "Add New Location Spot"}</h2>
            {editingSpot && <button onClick={cancelEditSpot} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">Cancel edit</button>}
          </div>
          {editingSpot && <div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{ background: C.p2_08, color: C.p2, border: `1px solid ${C.p2_18}` }}>✏️ Editing existing spot — changes will overwrite.</div>}

          <div className="mb-4">
            <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Photo</label>
            {spotImgPreview ? (
              <div className="relative w-full h-52 rounded-xl overflow-hidden mb-2">
                <img src={spotImgPreview} className="w-full h-full object-cover" />
                <button onClick={() => { setSpotImg(null); setSpotImgPreview(editingSpot?.image_url || null); if (spotFileRef.current) spotFileRef.current.value = ""; }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center">✕</button>
                <button onClick={() => spotFileRef.current?.click()} className="absolute bottom-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full" style={{ background: C.p2_20 }}>Change photo</button>
              </div>
            ) : (
              <button onClick={() => spotFileRef.current?.click()} className="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors" style={{ borderColor: C.p2_18, background: C.p2_06 }}>
                <span className="text-3xl">📷</span>
                <span className="text-xs font-bold" style={{ color: C.p2 }}>Tap to upload photo</span>
                <span className="text-xs text-slate-400">JPG, PNG, HEIC — works from phone camera roll</span>
              </button>
            )}
            <input ref={spotFileRef} type="file" accept="image/*" className="hidden" onChange={onSpotImg} />
          </div>

          <div className="space-y-3">
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">School</label><select className={inp} value={spotForm.school_id} onChange={e => setSpotForm(f => ({ ...f, school_id: e.target.value }))}>{SCHOOLS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Spot Name</label><input className={inp} placeholder="e.g. Sather Gate" value={spotForm.name} onChange={e => setSpotForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Description</label><textarea className={ta} rows={3} placeholder="Describe the spot..." value={spotForm.description} onChange={e => setSpotForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Pro Tip</label><input className={inp} placeholder="e.g. Arrive before 9am on weekdays" value={spotForm.tip} onChange={e => setSpotForm(f => ({ ...f, tip: e.target.value }))} /></div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICONS.map(icon => (
                  <button key={icon} onClick={() => setSpotForm(f => ({ ...f, icon }))} className="w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all"
                    style={{ background: spotForm.icon === icon ? C.grad23 : "rgba(0,0,0,0.04)", transform: spotForm.icon === icon ? "scale(1.15)" : "scale(1)" }}>{icon}</button>
                ))}
              </div>
            </div>
            <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order #</label><input className={inp} type="number" placeholder="e.g. 3" value={spotForm.order} onChange={e => setSpotForm(f => ({ ...f, order: e.target.value }))} /></div>
            <button onClick={saveSpot} disabled={spotSaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{ background: C.grad23, opacity: spotSaving ? 0.7 : 1 }}>
              {spotSaving ? "Saving…" : editingSpot ? "Update Location ✓" : "Save Location →"}
            </button>
          </div>
        </div>
      </div>

      {spotsLoading ? [...Array(4)].map((_, i) => <div key={i} className="rounded-2xl animate-pulse h-20" style={{ background: `linear-gradient(135deg,${C.p2_08},${C.p3_08})` }} />) : (
        SCHOOLS.map(school => {
          const schoolSpots = spots.filter(s => s.school_id === school.id);
          if (schoolSpots.length === 0) return null;
          return (
            <div key={school.id}>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.p2 }}>{school.short}</p>
                <span className="text-xs font-bold text-slate-400">({schoolSpots.length} spots)</span>
              </div>
              <div className="space-y-3">
                {schoolSpots.map(spot => (
                  <div key={spot.id} className={card} style={editingSpot?.id === spot.id ? { outline: `2px solid ${C.p2}` } : {}}>
                    <div className="flex">
                      {spot.image_url ? <div className="w-20 h-20 flex-shrink-0 overflow-hidden"><img src={spot.image_url} className="w-full h-full object-cover" /></div> : <div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-2xl" style={{ background: C.p2_06 }}>{spot.icon}</div>}
                      <div className="flex-1 p-4 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-slate-900 truncate mb-0.5">{spot.name}</p>
                            <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{spot.description}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {editingSpot?.id !== spot.id && <button onClick={() => startEditSpot(spot)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{ background: C.p2_08, color: C.p2 }}>Edit</button>}
                            {spotDeleteConfirm === spot.id ? (
                              <div className="flex gap-1.5">
                                <button onClick={() => deleteSpot(spot.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{ background: "#be123c" }}>Delete</button>
                                <button onClick={() => setSpotDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                              </div>
                            ) : <button onClick={() => setSpotDeleteConfirm(spot.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>}
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
  );
}
