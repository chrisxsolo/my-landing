"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";
import { ADMIN_PASSWORD, checkAuth, setAuth, logout } from "@/lib/adminAuth";

export const dynamic = 'force-dynamic'

type Tab = "poses"|"locations"|"blog"|"analytics";
type Pose = { id:number; title:string; image_url:string; instructions:string; order:number; };
type Spot = { id:number; school_id:string; school_name:string; school_short:string; name:string; description:string; tip:string; icon:string; image_url:string|null; order:number; };
type BlogPost = { id:number; title:string; body:string; published_at:string; slug:string; cover_image_url:string|null; extra_image_urls:string[]; };
type LinkClick = { id:number; link_id:number; clicked_at:string; };
type LinkStat = { id:number; label:string; emoji:string|null; url:string; clicks:number; ctr:number; };
type DailyStat = { date:string; clicks:number; views:number; };

const SCHOOLS = [
  {id:"sjsu",    name:"San Jose State University",      short:"SJSU"},
  {id:"berkeley",name:"UC Berkeley",                    short:"UC Berkeley"},
  {id:"sfsu",    name:"San Francisco State University", short:"SF State"},
  {id:"csueb",   name:"Cal State East Bay",             short:"CSUEB"},
  {id:"usf",     name:"University of San Francisco",    short:"USF"},
];

const ICONS = ["🏫","🏛️","🌴","📚","🌸","🚪","🌳","🗼","🌿","🌊","🏢","🌅","🌁","🏔️","⛪","🌉","🦅","🔵","🐻"];
const EMPTY_POSE = {title:"",instructions:"",order:""};
const EMPTY_SPOT = {school_id:"sjsu",name:"",description:"",tip:"",icon:"🏫",order:""};

export default function AdminDashboard() {
  const [authed,setAuthed]=useState(false);
  const [pw,setPw]=useState("");
  const [pwErr,setPwErr]=useState(false);
  const [tab,setTab]=useState<Tab>("poses");
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null);

  // Check localStorage on mount
  useEffect(() => {
    if (checkAuth()) {
      setAuthed(true);
    }
  }, []);

  const [poses,setPoses]=useState<Pose[]>([]);
  const [posesLoading,setPosesLoading]=useState(false);
  const [poseForm,setPoseForm]=useState(EMPTY_POSE);
  const [poseImg,setPoseImg]=useState<File|null>(null);
  const [poseImgPreview,setPoseImgPreview]=useState<string|null>(null);
  const [poseSaving,setPoseSaving]=useState(false);
  const [editingPose,setEditingPose]=useState<Pose|null>(null);
  const [deleteConfirm,setDeleteConfirm]=useState<number|null>(null);
  const poseFileRef=useRef<HTMLInputElement>(null);

  const [spots,setSpots]=useState<Spot[]>([]);
  const [spotsLoading,setSpotsLoading]=useState(false);
  const [spotForm,setSpotForm]=useState(EMPTY_SPOT);
  const [spotImg,setSpotImg]=useState<File|null>(null);
  const [spotImgPreview,setSpotImgPreview]=useState<string|null>(null);
  const [spotSaving,setSpotSaving]=useState(false);
  const [editingSpot,setEditingSpot]=useState<Spot|null>(null);
  const [spotDeleteConfirm,setSpotDeleteConfirm]=useState<number|null>(null);
  const spotFileRef=useRef<HTMLInputElement>(null);

  // ── Blog ──────────────────────────────────────────────────────────────
  const [posts,setPosts]=useState<BlogPost[]>([]);
  const [postsLoading,setPostsLoading]=useState(false);
  const EMPTY_POST={title:"",body:"",slug:"",published_at:new Date().toISOString().slice(0,16)};
  const [postForm,setPostForm]=useState(EMPTY_POST);
  const [coverImg,setCoverImg]=useState<File|null>(null);
  const [coverImgPreview,setCoverImgPreview]=useState<string|null>(null);
  const [extraImgs,setExtraImgs]=useState<File[]>([]);
  const [extraPreviews,setExtraPreviews]=useState<string[]>([]);
  const [postSaving,setPostSaving]=useState(false);
  const [editingPost,setEditingPost]=useState<BlogPost|null>(null);
  const [postDeleteConfirm,setPostDeleteConfirm]=useState<number|null>(null);
  const coverFileRef=useRef<HTMLInputElement>(null);
  const extraFileRef=useRef<HTMLInputElement>(null);

  const [linkStats,setLinkStats]=useState<LinkStat[]>([]);
  const [statsLoading,setStatsLoading]=useState(false);
  const [totalViews,setTotalViews]=useState(0);
  const [totalClicks,setTotalClicks]=useState(0);
  const [dailyStats,setDailyStats]=useState<DailyStat[]>([]);
  const [timeRange,setTimeRange]=useState<7|30>(7);

  function showToast(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3000);}

  async function fetchPoses(){setPosesLoading(true);const{data}=await supabase.from('grad_poses').select('*').order('order',{ascending:true});if(data)setPoses(data);setPosesLoading(false);}
  async function fetchSpots(){setSpotsLoading(true);const{data}=await supabase.from('location_spots').select('*').order('school_id').order('order',{ascending:true});if(data)setSpots(data);setSpotsLoading(false);}
  async function fetchPosts(){setPostsLoading(true);const{data}=await supabase.from('blog_posts').select('*').order('published_at',{ascending:false});if(data)setPosts(data);setPostsLoading(false);}
  
  async function fetchLinkStats(){
    setStatsLoading(true);
    
    // Get total views
    const{count:viewCount}=await supabase.from('link_views').select('*',{count:'exact',head:true});
    setTotalViews(viewCount||0);
    
    // Get links with click counts
    const{data:links}=await supabase.from('links').select('id,label,emoji,url').eq('active',true).order('order',{ascending:true});
    if(!links){setStatsLoading(false);return;}
    
    const stats:LinkStat[]=[];
    let totalClickCount=0;
    
    for(const link of links){
      const{count}=await supabase.from('link_clicks').select('*',{count:'exact',head:true}).eq('link_id',link.id);
      const clicks=count||0;
      totalClickCount+=clicks;
      const ctr=viewCount>0?(clicks/viewCount)*100:0;
      stats.push({...link,clicks,ctr});
    }
    
    // Sort by clicks descending
    stats.sort((a,b)=>b.clicks-a.clicks);
    setLinkStats(stats);
    setTotalClicks(totalClickCount);
    
    // Get daily breakdown for last N days
    await fetchDailyStats(timeRange);
    
    setStatsLoading(false);
  }
  
  async function fetchDailyStats(days:7|30){
    const startDate=new Date();
    startDate.setDate(startDate.getDate()-days);
    
    const{data:clicks}=await supabase.from('link_clicks').select('clicked_at').gte('clicked_at',startDate.toISOString());
    const{data:views}=await supabase.from('link_views').select('viewed_at').gte('viewed_at',startDate.toISOString());
    
    const dailyMap:Record<string,{clicks:number;views:number}>={};
    
    // Initialize all days
    for(let i=0;i<days;i++){
      const d=new Date();
      d.setDate(d.getDate()-i);
      const key=d.toISOString().split('T')[0];
      dailyMap[key]={clicks:0,views:0};
    }
    
    // Count clicks per day
    clicks?.forEach(c=>{
      const key=c.clicked_at.split('T')[0];
      if(dailyMap[key])dailyMap[key].clicks++;
    });
    
    // Count views per day
    views?.forEach(v=>{
      const key=v.viewed_at.split('T')[0];
      if(dailyMap[key])dailyMap[key].views++;
    });
    
    const daily=Object.entries(dailyMap).map(([date,stats])=>({date,...stats})).sort((a,b)=>a.date.localeCompare(b.date));
    setDailyStats(daily);
  }
  
  useEffect(()=>{if(authed){fetchPoses();fetchSpots();fetchPosts();if(tab==="analytics")fetchLinkStats();}},[authed,tab]);

  async function uploadImage(file:File,folder:string):Promise<string|null>{
    const ext=file.name.split('.').pop();
    const name=`${folder}/${Date.now()}.${ext}`;
    const{error}=await supabase.storage.from('grad-photos').upload(name,file,{upsert:true});
    if(error){
      console.error("Upload error:", error);
      showToast(`Image upload failed: ${error.message}`,false);
      return null;
    }
    const{data}=supabase.storage.from('grad-photos').getPublicUrl(name);
    return data.publicUrl;
  }

  function startEditPose(pose:Pose){setEditingPose(pose);setPoseForm({title:pose.title,instructions:pose.instructions,order:String(pose.order)});setPoseImg(null);setPoseImgPreview(pose.image_url||null);window.scrollTo({top:0,behavior:"smooth"});}
  function cancelEditPose(){setEditingPose(null);setPoseForm(EMPTY_POSE);setPoseImg(null);setPoseImgPreview(null);if(poseFileRef.current)poseFileRef.current.value="";}
  function onPoseImg(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setPoseImg(f);setPoseImgPreview(URL.createObjectURL(f));}

  async function savePose(){
    if(!poseForm.title||!poseForm.instructions){showToast("Title and instructions required",false);return;}
    setPoseSaving(true);
    let image_url=editingPose?.image_url??"";
    if(poseImg){const url=await uploadImage(poseImg,"poses");if(!url){setPoseSaving(false);return;}image_url=url;}
    if(editingPose){
      const{error}=await supabase.from('grad_poses').update({title:poseForm.title,instructions:poseForm.instructions,image_url,order:parseInt(poseForm.order)||editingPose.order}).eq('id',editingPose.id);
      if(error)showToast("Update failed",false);else{showToast("Pose updated!");cancelEditPose();fetchPoses();}
    }else{
      const{error}=await supabase.from('grad_poses').insert({title:poseForm.title,instructions:poseForm.instructions,image_url,order:parseInt(poseForm.order)||poses.length+1});
      if(error)showToast("Save failed",false);else{showToast("Pose added!");setPoseForm(EMPTY_POSE);setPoseImg(null);setPoseImgPreview(null);if(poseFileRef.current)poseFileRef.current.value="";fetchPoses();}
    }
    setPoseSaving(false);
  }

  async function deletePose(id:number){await supabase.from('grad_poses').delete().eq('id',id);setPoses(p=>p.filter(x=>x.id!==id));setDeleteConfirm(null);if(editingPose?.id===id)cancelEditPose();showToast("Pose deleted");}

  function startEditSpot(spot:Spot){setEditingSpot(spot);setSpotForm({school_id:spot.school_id,name:spot.name,description:spot.description,tip:spot.tip,icon:spot.icon,order:String(spot.order)});setSpotImg(null);setSpotImgPreview(spot.image_url||null);window.scrollTo({top:0,behavior:"smooth"});}
  function cancelEditSpot(){setEditingSpot(null);setSpotForm(EMPTY_SPOT);setSpotImg(null);setSpotImgPreview(null);if(spotFileRef.current)spotFileRef.current.value="";}
  function onSpotImg(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setSpotImg(f);setSpotImgPreview(URL.createObjectURL(f));}

  async function saveSpot(){
    if(!spotForm.name||!spotForm.description||!spotForm.tip){showToast("Name, description and tip required",false);return;}
    setSpotSaving(true);
    let image_url:string|null=editingSpot?.image_url??null;
    if(spotImg){const url=await uploadImage(spotImg,"locations");if(!url){setSpotSaving(false);return;}image_url=url;}
    const school=SCHOOLS.find(s=>s.id===spotForm.school_id)!;
    if(editingSpot){
      const{error}=await supabase.from('location_spots').update({school_id:school.id,school_name:school.name,school_short:school.short,name:spotForm.name,description:spotForm.description,tip:spotForm.tip,icon:spotForm.icon,image_url,order:parseInt(spotForm.order)||editingSpot.order}).eq('id',editingSpot.id);
      if(error)showToast("Update failed",false);else{showToast("Location updated!");cancelEditSpot();fetchSpots();}
    }else{
      const{error}=await supabase.from('location_spots').insert({school_id:school.id,school_name:school.name,school_short:school.short,name:spotForm.name,description:spotForm.description,tip:spotForm.tip,icon:spotForm.icon,image_url,order:parseInt(spotForm.order)||spots.filter(s=>s.school_id===school.id).length+1});
      if(error)showToast("Save failed",false);else{showToast("Location added!");setSpotForm(EMPTY_SPOT);setSpotImg(null);setSpotImgPreview(null);if(spotFileRef.current)spotFileRef.current.value="";fetchSpots();}
    }
    setSpotSaving(false);
  }

  async function deleteSpot(id:number){await supabase.from('location_spots').delete().eq('id',id);setSpots(p=>p.filter(x=>x.id!==id));setSpotDeleteConfirm(null);if(editingSpot?.id===id)cancelEditSpot();showToast("Spot deleted");}

  // ── Blog handlers ──────────────────────────────────────────────────────
  function slugify(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
  function startEditPost(post:BlogPost){setEditingPost(post);setPostForm({title:post.title,body:post.body,slug:post.slug,published_at:post.published_at.slice(0,16)});setCoverImg(null);setCoverImgPreview(post.cover_image_url||null);setExtraImgs([]);setExtraPreviews(post.extra_image_urls??[]);window.scrollTo({top:0,behavior:"smooth"});}
  function cancelEditPost(){setEditingPost(null);setPostForm(EMPTY_POST);setCoverImg(null);setCoverImgPreview(null);setExtraImgs([]);setExtraPreviews([]);if(coverFileRef.current)coverFileRef.current.value="";if(extraFileRef.current)extraFileRef.current.value="";}
  function onCoverImg(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setCoverImg(f);setCoverImgPreview(URL.createObjectURL(f));}
  function onExtraImgs(e:React.ChangeEvent<HTMLInputElement>){const files=Array.from(e.target.files??[]);if(!files.length)return;setExtraImgs(prev=>[...prev,...files]);setExtraPreviews(prev=>[...prev,...files.map(f=>URL.createObjectURL(f))]);}
  function removeExtraPreview(i:number){setExtraPreviews(p=>p.filter((_,j)=>j!==i));setExtraImgs(p=>p.filter((_,j)=>j!==i));}

  async function savePost(){
    if(!postForm.title||!postForm.body){showToast("Title and body required",false);return;}
    setPostSaving(true);
    const slug=postForm.slug||slugify(postForm.title);
    let cover_image_url=editingPost?.cover_image_url??null;
    if(coverImg){const url=await uploadImage(coverImg,"blog");if(!url){setPostSaving(false);return;}cover_image_url=url;}
    // Upload extra images (new ones only — existing ones kept from editingPost)
    const existingExtras=editingPost?.extra_image_urls??[];
    const newExtraUrls:string[]=[];
    for(const f of extraImgs){const url=await uploadImage(f,"blog");if(url)newExtraUrls.push(url);}
    // extra_image_urls = existing that still show in previews + newly uploaded
    const existingKept=existingExtras.filter(url=>extraPreviews.includes(url));
    const extra_image_urls=[...existingKept,...newExtraUrls];
    const payload={title:postForm.title,body:postForm.body,slug,cover_image_url,extra_image_urls,published_at:new Date(postForm.published_at).toISOString()};
    if(editingPost){
      const{error}=await supabase.from('blog_posts').update(payload).eq('id',editingPost.id);
      if(error)showToast("Update failed",false);else{showToast("Post updated!");cancelEditPost();fetchPosts();}
    }else{
      const{error}=await supabase.from('blog_posts').insert(payload);
      if(error)showToast("Save failed — "+error.message,false);else{showToast("Post published!");cancelEditPost();fetchPosts();}
    }
    setPostSaving(false);
  }

  async function deletePost(id:number){await supabase.from('blog_posts').delete().eq('id',id);setPosts(p=>p.filter(x=>x.id!==id));setPostDeleteConfirm(null);if(editingPost?.id===id)cancelEditPost();showToast("Post deleted");}

  const inp="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors";
  const ta=`${inp} resize-none`;
  const card="bg-white rounded-2xl border border-slate-100 overflow-hidden";

  if(!authed){
    return(
      <div className="min-h-screen bg-white flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="font-black text-2xl" style={C.text}>Chris.</span>
            <p className="text-slate-400 text-sm mt-1 font-medium">Admin Dashboard</p>
          </div>
          <div className="rounded-2xl p-8 shadow-xl" style={{border:`1px solid ${C.p1_15}`}}>
            <div className="h-[3px] rounded-full mb-6" style={{background:C.grad90}}/>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Password</label>
            <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setPwErr(false);}}
              onKeyDown={e=>{if(e.key==="Enter"){if(pw===ADMIN_PASSWORD){setAuth(true);setAuthed(true);}else setPwErr(true);}}}
              placeholder="Enter password" className={inp+" mb-4"} style={pwErr?{borderColor:C.p2}:{}}/>
            {pwErr&&<p className="text-xs font-semibold mb-3" style={{color:C.p2}}>Incorrect password</p>}
            <button onClick={()=>{if(pw===ADMIN_PASSWORD){setAuth(true);setAuthed(true);}else setPwErr(true);}}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90" style={{background:C.grad12}}>
              Enter →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div className="min-h-screen font-sans" style={{background:"#f8f7ff"}}>
      {toast&&<div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-xl" style={{background:toast.ok?C.grad12:"#be123c"}}>{toast.msg}</div>}

      <div className="sticky top-0 z-40 border-b border-black/[0.06] px-6 h-14 flex items-center justify-between" style={{background:"rgba(255,255,255,0.95)",backdropFilter:"blur(20px)"}}>
        <span className="font-black text-lg" style={C.text}>Chris. Admin</span>
        <div className="flex items-center gap-4">
          <a href="/admin/availability" className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">📅 Availability</a>
          <a href="/" className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">← Site</a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 p-1 rounded-2xl bg-white border border-slate-100 w-fit">
          {(["poses","locations","blog","analytics"] as Tab[]).map(t=>(
            <button key={t} onClick={()=>{setTab(t);cancelEditPose();cancelEditSpot();cancelEditPost();}}
              className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
              style={tab===t?{background:C.grad12,color:"#fff"}:{color:"#94a3b8"}}>
              {t==="poses"?"📸 Grad Poses":t==="locations"?"📍 Locations":t==="blog"?"✍️ Blog":"📊 Analytics"}
            </button>
          ))}
        </div>

        {/* ── POSES ── */}
        {tab==="poses"&&(
          <div className="space-y-6">
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90_12}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-black text-slate-900">{editingPose?`Editing: ${editingPose.title}`:"Add New Pose"}</h2>
                  {editingPose&&<button onClick={cancelEditPose} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">Cancel edit</button>}
                </div>
                {editingPose&&<div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{background:C.p1_08,color:C.p1,border:`1px solid ${C.p1_20}`}}>✏️ Editing existing pose — changes will overwrite.</div>}

                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Photo</label>
                  {poseImgPreview?(
                    <div className="relative w-full h-52 rounded-xl overflow-hidden mb-2">
                      <img src={poseImgPreview} className="w-full h-full object-cover"/>
                      <button onClick={()=>{setPoseImg(null);setPoseImgPreview(editingPose?.image_url||null);if(poseFileRef.current)poseFileRef.current.value="";}} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center">✕</button>
                      <button onClick={()=>poseFileRef.current?.click()} className="absolute bottom-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full" style={{background:`rgba(${C.p1},0.8)`}}>Change photo</button>
                    </div>
                  ):(
                    <button onClick={()=>poseFileRef.current?.click()} className="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors hover:border-violet-300" style={{borderColor:C.p1_20,background:C.p1_04}}>
                      <span className="text-3xl">📷</span>
                      <span className="text-xs font-bold" style={{color:C.p1}}>Tap to upload photo</span>
                      <span className="text-xs text-slate-400">JPG, PNG, HEIC — works from phone camera roll</span>
                    </button>
                  )}
                  <input ref={poseFileRef} type="file" accept="image/*" className="hidden" onChange={onPoseImg}/>
                </div>

                <div className="space-y-3">
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Pose Title</label><input className={inp} placeholder="e.g. Over the Shoulder" value={poseForm.title} onChange={e=>setPoseForm(f=>({...f,title:e.target.value}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Instructions</label><textarea className={ta} rows={4} placeholder="Describe how to do this pose..." value={poseForm.instructions} onChange={e=>setPoseForm(f=>({...f,instructions:e.target.value}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order #</label><input className={inp} type="number" placeholder="e.g. 5" value={poseForm.order} onChange={e=>setPoseForm(f=>({...f,order:e.target.value}))}/></div>
                  <button onClick={savePose} disabled={poseSaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{background:C.grad12,opacity:poseSaving?0.7:1}}>
                    {poseSaving?"Saving…":editingPose?"Update Pose ✓":"Save Pose →"}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-black uppercase tracking-widest" style={{color:C.p1}}>Current Poses</p>
                <span className="text-xs font-bold text-slate-400">({poses.length})</span>
              </div>
              {posesLoading?[...Array(3)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-20 mb-3" style={{background:`linear-gradient(135deg,${C.p1_08},${C.p2_06})`}}/>):(
                <div className="space-y-3">
                  {poses.map(pose=>(
                    <div key={pose.id} className={card+(editingPose?.id===pose.id?` ring-2`:"")+(editingPose?.id===pose.id?" ring-violet-300":"")} style={editingPose?.id===pose.id?{outline:`2px solid ${C.p1}`}:{}}>
                      <div className="flex">
                        {pose.image_url?<div className="w-20 h-20 flex-shrink-0 overflow-hidden"><img src={pose.image_url} className="w-full h-full object-cover"/></div>:<div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-2xl" style={{background:C.p1_06}}>📷</div>}
                        <div className="flex-1 p-4 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md flex-shrink-0" style={{background:C.p1_08,color:C.p1}}>#{pose.order}</span>
                                <p className="text-sm font-black text-slate-900 truncate">{pose.title}</p>
                              </div>
                              <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{pose.instructions}</p>
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              {editingPose?.id!==pose.id&&<button onClick={()=>startEditPose(pose)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:C.p1_08,color:C.p1}}>Edit</button>}
                              {deleteConfirm===pose.id?(
                                <div className="flex gap-1.5">
                                  <button onClick={()=>deletePose(pose.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{background:"#be123c"}}>Delete</button>
                                  <button onClick={()=>setDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                                </div>
                              ):<button onClick={()=>setDeleteConfirm(pose.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>}
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

        {/* ── LOCATIONS ── */}
        {tab==="locations"&&(
          <div className="space-y-6">
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90_23}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-black text-slate-900">{editingSpot?`Editing: ${editingSpot.name}`:"Add New Location Spot"}</h2>
                  {editingSpot&&<button onClick={cancelEditSpot} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">Cancel edit</button>}
                </div>
                {editingSpot&&<div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{background:C.p2_08,color:C.p2,border:`1px solid ${C.p2_18}`}}>✏️ Editing existing spot — changes will overwrite.</div>}

                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Photo</label>
                  {spotImgPreview?(
                    <div className="relative w-full h-52 rounded-xl overflow-hidden mb-2">
                      <img src={spotImgPreview} className="w-full h-full object-cover"/>
                      <button onClick={()=>{setSpotImg(null);setSpotImgPreview(editingSpot?.image_url||null);if(spotFileRef.current)spotFileRef.current.value="";}} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center">✕</button>
                      <button onClick={()=>spotFileRef.current?.click()} className="absolute bottom-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full" style={{background:C.p2_20}}>Change photo</button>
                    </div>
                  ):(
                    <button onClick={()=>spotFileRef.current?.click()} className="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-colors" style={{borderColor:C.p2_18,background:C.p2_06}}>
                      <span className="text-3xl">📷</span>
                      <span className="text-xs font-bold" style={{color:C.p2}}>Tap to upload photo</span>
                      <span className="text-xs text-slate-400">JPG, PNG, HEIC — works from phone camera roll</span>
                    </button>
                  )}
                  <input ref={spotFileRef} type="file" accept="image/*" className="hidden" onChange={onSpotImg}/>
                </div>

                <div className="space-y-3">
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">School</label><select className={inp} value={spotForm.school_id} onChange={e=>setSpotForm(f=>({...f,school_id:e.target.value}))}>{SCHOOLS.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Spot Name</label><input className={inp} placeholder="e.g. Sather Gate" value={spotForm.name} onChange={e=>setSpotForm(f=>({...f,name:e.target.value}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Description</label><textarea className={ta} rows={3} placeholder="Describe the spot..." value={spotForm.description} onChange={e=>setSpotForm(f=>({...f,description:e.target.value}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Pro Tip</label><input className={inp} placeholder="e.g. Arrive before 9am on weekdays" value={spotForm.tip} onChange={e=>setSpotForm(f=>({...f,tip:e.target.value}))}/></div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Icon</label>
                    <div className="flex flex-wrap gap-2">
                      {ICONS.map(icon=>(
                        <button key={icon} onClick={()=>setSpotForm(f=>({...f,icon}))} className="w-9 h-9 rounded-xl text-lg flex items-center justify-center transition-all"
                          style={{background:spotForm.icon===icon?C.grad23:"rgba(0,0,0,0.04)",transform:spotForm.icon===icon?"scale(1.15)":"scale(1)"}}>{icon}</button>
                      ))}
                    </div>
                  </div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order #</label><input className={inp} type="number" placeholder="e.g. 3" value={spotForm.order} onChange={e=>setSpotForm(f=>({...f,order:e.target.value}))}/></div>
                  <button onClick={saveSpot} disabled={spotSaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{background:C.grad23,opacity:spotSaving?0.7:1}}>
                    {spotSaving?"Saving…":editingSpot?"Update Location ✓":"Save Location →"}
                  </button>
                </div>
              </div>
            </div>

            {spotsLoading?[...Array(4)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-20" style={{background:`linear-gradient(135deg,${C.p2_08},${C.p3_08})`}}/>):(
              SCHOOLS.map(school=>{
                const schoolSpots=spots.filter(s=>s.school_id===school.id);
                if(schoolSpots.length===0)return null;
                return(
                  <div key={school.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <p className="text-xs font-black uppercase tracking-widest" style={{color:C.p2}}>{school.short}</p>
                      <span className="text-xs font-bold text-slate-400">({schoolSpots.length} spots)</span>
                    </div>
                    <div className="space-y-3">
                      {schoolSpots.map(spot=>(
                        <div key={spot.id} className={card} style={editingSpot?.id===spot.id?{outline:`2px solid ${C.p2}`}:{}}>
                          <div className="flex">
                            {spot.image_url?<div className="w-20 h-20 flex-shrink-0 overflow-hidden"><img src={spot.image_url} className="w-full h-full object-cover"/></div>:<div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-2xl" style={{background:C.p2_06}}>{spot.icon}</div>}
                            <div className="flex-1 p-4 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900 truncate mb-0.5">{spot.name}</p>
                                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">{spot.description}</p>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                  {editingSpot?.id!==spot.id&&<button onClick={()=>startEditSpot(spot)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:C.p2_08,color:C.p2}}>Edit</button>}
                                  {spotDeleteConfirm===spot.id?(
                                    <div className="flex gap-1.5">
                                      <button onClick={()=>deleteSpot(spot.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{background:"#be123c"}}>Delete</button>
                                      <button onClick={()=>setSpotDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                                    </div>
                                  ):<button onClick={()=>setSpotDeleteConfirm(spot.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>}
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
        {/* ── BLOG ── */}
        {tab==="blog"&&(
          <div className="space-y-6">
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-black text-slate-900">{editingPost?`Editing: ${editingPost.title}`:"New Blog Post"}</h2>
                  {editingPost&&<button onClick={cancelEditPost} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">Cancel edit</button>}
                </div>
                {editingPost&&<div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{background:C.p1_08,color:C.p1,border:`1px solid ${C.p1_20}`}}>✏️ Editing existing post.</div>}

                {/* Cover image */}
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Cover Photo</label>
                  {coverImgPreview?(
                    <div className="relative w-full h-52 rounded-xl overflow-hidden mb-2">
                      <img src={coverImgPreview} className="w-full h-full object-cover"/>
                      <button onClick={()=>{setCoverImg(null);setCoverImgPreview(editingPost?.cover_image_url||null);if(coverFileRef.current)coverFileRef.current.value="";}} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center">✕</button>
                      <button onClick={()=>coverFileRef.current?.click()} className="absolute bottom-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full" style={{background:C.p1_20}}>Change</button>
                    </div>
                  ):(
                    <button onClick={()=>coverFileRef.current?.click()} className="w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2" style={{borderColor:C.p1_20,background:C.p1_04}}>
                      <span className="text-3xl">🖼️</span>
                      <span className="text-xs font-bold" style={{color:C.p1}}>Tap to upload cover photo</span>
                      <span className="text-xs text-slate-400">JPG, PNG, HEIC</span>
                    </button>
                  )}
                  <input ref={coverFileRef} type="file" accept="image/*" className="hidden" onChange={onCoverImg}/>
                </div>

                <div className="space-y-3">
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Title</label><input className={inp} placeholder="e.g. Golden Hour at SJSU — Mia's Grad Shoot" value={postForm.title} onChange={e=>setPostForm(f=>({...f,title:e.target.value,slug:slugify(e.target.value)}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Slug (URL)</label><input className={inp} placeholder="auto-generated from title" value={postForm.slug} onChange={e=>setPostForm(f=>({...f,slug:slugify(e.target.value)}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Date & Time</label><input className={inp} type="datetime-local" value={postForm.published_at} onChange={e=>setPostForm(f=>({...f,published_at:e.target.value}))}/></div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Body</label>
                    <textarea className={ta} rows={8} placeholder={"Write your shoot story here...\n\nUse blank lines between paragraphs — each one becomes its own paragraph on the post page."} value={postForm.body} onChange={e=>setPostForm(f=>({...f,body:e.target.value}))}/>
                    <p className="text-xs text-slate-400 mt-1">Separate paragraphs with a blank line.</p>
                  </div>

                  {/* Extra photos */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Extra Photos ({extraPreviews.length})</label>
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      {extraPreviews.map((url,i)=>(
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden">
                          <img src={url} className="w-full h-full object-cover"/>
                          <button onClick={()=>removeExtraPreview(i)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/50 text-white text-xs font-bold flex items-center justify-center">✕</button>
                        </div>
                      ))}
                      <button onClick={()=>extraFileRef.current?.click()} className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1" style={{borderColor:C.p2_18,background:C.p2_06}}>
                        <span className="text-xl">+</span>
                        <span className="text-[10px] font-bold" style={{color:C.p2}}>Add photos</span>
                      </button>
                    </div>
                    <input ref={extraFileRef} type="file" accept="image/*" multiple className="hidden" onChange={onExtraImgs}/>
                    <p className="text-xs text-slate-400">Add as many as you want. They'll show in a grid below the post body.</p>
                  </div>

                  <button onClick={savePost} disabled={postSaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{background:C.grad,opacity:postSaving?0.7:1}}>
                    {postSaving?"Publishing…":editingPost?"Update Post ✓":"Publish Post →"}
                  </button>
                </div>
              </div>
            </div>

            {/* Existing posts */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-black uppercase tracking-widest" style={{color:C.p1}}>Published Posts</p>
                <span className="text-xs font-bold text-slate-400">({posts.length})</span>
              </div>
              {postsLoading?[...Array(2)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-20 mb-3" style={{background:`linear-gradient(135deg,${C.p1_08},${C.p2_06})`}}/>):(
                posts.length===0?<p className="text-sm text-slate-400 font-medium">No posts yet — write your first one above.</p>:(
                  <div className="space-y-3">
                    {posts.map(post=>(
                      <div key={post.id} className={card} style={editingPost?.id===post.id?{outline:`2px solid ${C.p1}`}:{}}>
                        <div className="flex">
                          {post.cover_image_url?<div className="w-20 h-20 flex-shrink-0 overflow-hidden"><img src={post.cover_image_url} className="w-full h-full object-cover"/></div>:<div className="w-20 h-20 flex-shrink-0 flex items-center justify-center text-2xl" style={{background:C.p1_06}}>✍️</div>}
                          <div className="flex-1 p-4 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-slate-900 truncate mb-0.5">{post.title}</p>
                                <p className="text-xs text-slate-400">{new Date(post.published_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} · {(post.extra_image_urls?.length??0)+1} photo{(post.extra_image_urls?.length??0)>0?"s":""}</p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <a href={`/blog/${post.slug}`} target="_blank" className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:C.p1_08,color:C.p1}}>View</a>
                                {editingPost?.id!==post.id&&<button onClick={()=>startEditPost(post)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:C.p2_08,color:C.p2}}>Edit</button>}
                                {postDeleteConfirm===post.id?(
                                  <div className="flex gap-1.5">
                                    <button onClick={()=>deletePost(post.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{background:"#be123c"}}>Delete</button>
                                    <button onClick={()=>setPostDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                                  </div>
                                ):<button onClick={()=>setPostDeleteConfirm(post.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>}
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
        )}

        {/* ── ANALYTICS ── */}
        {tab==="analytics"&&(
          <div className="space-y-6">
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={card}>
                <div className="h-[3px]" style={{background:C.grad12}}/>
                <div className="p-6">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Total Views</p>
                  <p className="text-4xl font-black mb-1" style={{color:C.p1}}>{totalViews}</p>
                  <p className="text-xs text-slate-400">Page visits</p>
                </div>
              </div>
              <div className={card}>
                <div className="h-[3px]" style={{background:C.grad23}}/>
                <div className="p-6">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Total Clicks</p>
                  <p className="text-4xl font-black mb-1" style={{color:C.p2}}>{totalClicks}</p>
                  <p className="text-xs text-slate-400">Link clicks</p>
                </div>
              </div>
              <div className={card}>
                <div className="h-[3px]" style={{background:C.grad321}}/>
                <div className="p-6">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Click Rate</p>
                  <p className="text-4xl font-black mb-1" style={{color:C.p3}}>{totalViews>0?((totalClicks/totalViews)*100).toFixed(1):0}%</p>
                  <p className="text-xs text-slate-400">CTR</p>
                </div>
              </div>
            </div>

            {/* Time Range Toggle + Refresh */}
            <div className="flex items-center justify-between">
              <div className="flex gap-2 p-1 rounded-xl bg-white border border-slate-100 w-fit">
                <button onClick={()=>{setTimeRange(7);if(!statsLoading)fetchDailyStats(7);}} className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all" style={timeRange===7?{background:C.p1_10,color:C.p1}:{color:"#94a3b8"}}>7 Days</button>
                <button onClick={()=>{setTimeRange(30);if(!statsLoading)fetchDailyStats(30);}} className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all" style={timeRange===30?{background:C.p1_10,color:C.p1}:{color:"#94a3b8"}}>30 Days</button>
              </div>
              <button onClick={fetchLinkStats} disabled={statsLoading} className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80" style={{background:C.p2_08,color:C.p2}}>
                {statsLoading?"Loading...":"↻ Refresh"}
              </button>
            </div>

            {/* Chart */}
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90}}/>
              <div className="p-6">
                <h3 className="text-sm font-black text-slate-900 mb-4">Activity Over Time</h3>
                {statsLoading?(
                  <div className="h-64 flex items-center justify-center text-slate-400 text-sm">Loading chart...</div>
                ):(
                  <div className="h-64 flex items-end justify-between gap-2">
                    {dailyStats.map((stat,i)=>{
                      const maxVal=Math.max(...dailyStats.map(s=>Math.max(s.clicks,s.views)),1);
                      const clickHeight=(stat.clicks/maxVal)*100;
                      const viewHeight=(stat.views/maxVal)*100;
                      return(
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="w-full flex gap-1 items-end" style={{height:240}}>
                            <div className="flex-1 rounded-t" style={{height:`${viewHeight}%`,background:C.p1_20,minHeight:viewHeight>0?4:0}} title={`${stat.views} views`}/>
                            <div className="flex-1 rounded-t" style={{height:`${clickHeight}%`,background:C.p2,minHeight:clickHeight>0?4:0}} title={`${stat.clicks} clicks`}/>
                          </div>
                          <p className="text-[9px] font-bold text-slate-300 text-center">{new Date(stat.date).getDate()}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{background:C.p1_20}}/>
                    <span className="text-xs font-bold text-slate-400">Views</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{background:C.p2}}/>
                    <span className="text-xs font-bold text-slate-400">Clicks</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Links */}
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90_23}}/>
              <div className="p-6">
                <h2 className="text-base font-black text-slate-900 mb-5">Top Performing Links</h2>
                {statsLoading?(
                  <div className="text-center py-12 text-slate-400 text-sm">Loading analytics...</div>
                ):(
                  <div className="space-y-3">
                    {linkStats.length===0?(
                      <div className="text-center py-12">
                        <p className="text-slate-400 text-sm mb-2">No links found</p>
                        <p className="text-xs text-slate-300">Add links from the Links Admin page</p>
                      </div>
                    ):(
                      linkStats.map((stat,idx)=>{
                        const maxClicks=linkStats[0]?.clicks||1;
                        const barWidth=(stat.clicks/maxClicks)*100;
                        return(
                          <div key={stat.id} className="p-4 rounded-xl border border-slate-100 relative overflow-hidden">
                            <div className="absolute inset-0 rounded-xl" style={{background:`linear-gradient(90deg,${C.p1_06} ${barWidth}%,transparent ${barWidth}%)`}}/>
                            <div className="relative flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-black" style={{background:idx===0?C.p1_15:idx===1?C.p2_10:idx===2?C.p3_10:C.p1_06,color:idx<3?C.p1:"#94a3b8"}}>#{idx+1}</div>
                                <span className="text-xl flex-shrink-0">{stat.emoji||"🔗"}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-black text-sm text-slate-900 truncate">{stat.label}</p>
                                  <p className="text-xs text-slate-400 truncate">{stat.url}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 flex-shrink-0">
                                <div className="text-right">
                                  <p className="text-xl font-black" style={{color:C.p1}}>{stat.clicks}</p>
                                  <p className="text-[9px] font-bold tracking-widest uppercase text-slate-300">clicks</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-black" style={{color:C.p2}}>{stat.ctr.toFixed(1)}%</p>
                                  <p className="text-[9px] font-bold tracking-widest uppercase text-slate-300">CTR</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}