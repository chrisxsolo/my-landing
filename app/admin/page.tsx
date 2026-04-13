"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useRef, useState } from "react";
import { C } from "@/lib/colors";
import { ADMIN_PASSWORD, checkAuth, setAuth } from "@/lib/adminAuth";
import BayAreaLocationsManager from "@/app/admin/BayAreaLocationsManager";

export const dynamic = 'force-dynamic'

type Tab = "poses"|"locations"|"bayGuide"|"portfolio"|"categories"|"blog"|"analytics"|"inquiries";
type Inquiry = { id:number; name:string; email:string; phone:string|null; session_type:string|null; date_in_mind:string|null; message:string; status:string; created_at:string; };
type BlogCategory = "journal"|"professional";
type Pose = { id:number; title:string; image_url:string; instructions:string; order:number; };
type Spot = { id:number; school_id:string; school_name:string; school_short:string; name:string; description:string; tip:string; icon:string; image_url:string|null; order:number; };
type BlogPost = { id:number; title:string; body:string; published_at:string; slug:string; cover_image_url:string|null; extra_image_urls:string[]; category?:BlogCategory|string|null; };
type PortfolioCategory = { id:number; name:string; slug:string; description:string|null; sort_order:number; active:boolean; };
type PortfolioImage = { id:number; title:string; alt:string|null; image_url:string; category_id:number|null; category_slug:string; featured:boolean; hero_carousel:boolean; sort_order:number; created_at:string|null; };
type LinkClickEvent = { link_id:number|null; user_id:string|null; clicked_at:string; };
type LinkViewEvent = { user_id:string|null; viewed_at:string; };
type LinkStat = { id:number; label:string; emoji:string|null; url:string; clicks:number; uniqueClickers:number; ctr:number; clickShare:number; };
type DailyStat = { date:string; clicks:number; views:number; ctr:number; };

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
const EMPTY_CATEGORY = {name:"",slug:"",description:"",sort_order:"1",active:true};
const EMPTY_PORTFOLIO = {title:"",alt:"",category_slug:"graduation",featured:false,sort_order:""};
const BLOG_CATEGORIES:{value:BlogCategory;label:string;helper:string}[]=[
  {value:"journal",label:"Journal",helper:"Fun shoot stories at /journal"},
  {value:"professional",label:"Professional",helper:"Case studies at /blog"},
];

const numberFmt=new Intl.NumberFormat("en-US");
function fmtNum(value:number){return numberFmt.format(value);}
function fmtPercent(value:number){return `${value.toFixed(1)}%`;}
function fmtRatio(value:number){return value.toFixed(value>=10?1:2);}
function dateFromKey(dateKey:string){const[y,m,d]=dateKey.split("-").map(Number);return new Date(y,m-1,d);}
function matchesPortfolioGroup(image:PortfolioImage,group:"grads"|"families"){
  const slug=image.category_slug;
  if(group==="grads")return slug==="grads"||slug==="graduation";
  return slug==="families"||slug==="family"||slug==="portraits";
}
function buildDailyStats(days:7|30,clicks:Pick<LinkClickEvent,"clicked_at">[],views:Pick<LinkViewEvent,"viewed_at">[]):DailyStat[]{
  const dailyMap:Record<string,{clicks:number;views:number}>={};
  for(let i=0;i<days;i++){
    const d=new Date();
    d.setDate(d.getDate()-i);
    const key=d.toISOString().split('T')[0];
    dailyMap[key]={clicks:0,views:0};
  }
  clicks.forEach(c=>{
    const key=c.clicked_at?.split('T')[0];
    if(key&&dailyMap[key])dailyMap[key].clicks++;
  });
  views.forEach(v=>{
    const key=v.viewed_at?.split('T')[0];
    if(key&&dailyMap[key])dailyMap[key].views++;
  });
  return Object.entries(dailyMap)
    .map(([date,stats])=>({date,...stats,ctr:stats.views>0?(stats.clicks/stats.views)*100:0}))
    .sort((a,b)=>a.date.localeCompare(b.date));
}

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

  // ── Professional portfolio ───────────────────────────────────────────
  const [portfolioImages,setPortfolioImages]=useState<PortfolioImage[]>([]);
  const [portfolioLoading,setPortfolioLoading]=useState(false);
  const [portfolioForm,setPortfolioForm]=useState(EMPTY_PORTFOLIO);
  const [portfolioFile,setPortfolioFile]=useState<File|null>(null);
  const [portfolioPreview,setPortfolioPreview]=useState<string|null>(null);
  const [portfolioSaving,setPortfolioSaving]=useState(false);
  const [editingPortfolioImage,setEditingPortfolioImage]=useState<PortfolioImage|null>(null);
  const [portfolioDeleteConfirm,setPortfolioDeleteConfirm]=useState<number|null>(null);
  const portfolioFileRef=useRef<HTMLInputElement>(null);

  const [categories,setCategories]=useState<PortfolioCategory[]>([]);
  const [categoriesLoading,setCategoriesLoading]=useState(false);
  const [categoryForm,setCategoryForm]=useState(EMPTY_CATEGORY);
  const [categorySaving,setCategorySaving]=useState(false);
  const [editingCategory,setEditingCategory]=useState<PortfolioCategory|null>(null);
  const [categoryDeleteConfirm,setCategoryDeleteConfirm]=useState<number|null>(null);

  // ── Batch upload ─────────────────────────────────────────────────────
  type BatchItem = { file: File; preview: string; category_slug: string; title: string; };
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const batchFileRef = useRef<HTMLInputElement>(null);

  // ── Site settings (site image selections) ────────────────────────────
  const [siteSettings, setSiteSettings] = useState<Record<string,string|null>>({});
  const [settingsSaving, setSettingsSaving] = useState<string|null>(null);
  const [coverPickerKey, setCoverPickerKey] = useState<string|null>(null);

  // ── Blog ──────────────────────────────────────────────────────────────
  const [posts,setPosts]=useState<BlogPost[]>([]);
  const [postsLoading,setPostsLoading]=useState(false);
  const [blogCategory,setBlogCategory]=useState<BlogCategory>("journal");
  const EMPTY_POST={title:"",body:"",slug:"",category:"journal" as BlogCategory,published_at:new Date().toISOString().slice(0,16)};
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

  // ── Inquiries ─────────────────────────────────────────────────────────
  const [inquiries,setInquiries]=useState<Inquiry[]>([]);
  const [inquiriesLoading,setInquiriesLoading]=useState(false);
  const [inquiryDeleteConfirm,setInquiryDeleteConfirm]=useState<number|null>(null);
  const [editingInquiry,setEditingInquiry]=useState<Inquiry|null>(null);

  const [linkStats,setLinkStats]=useState<LinkStat[]>([]);
  const [statsLoading,setStatsLoading]=useState(false);
  const [totalViews,setTotalViews]=useState(0);
  const [totalClicks,setTotalClicks]=useState(0);
  const [uniqueVisitors,setUniqueVisitors]=useState(0);
  const [uniqueClickers,setUniqueClickers]=useState(0);
  const [dailyStats,setDailyStats]=useState<DailyStat[]>([]);
  const [timeRange,setTimeRange]=useState<7|30>(7);

  function showToast(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3000);}

  async function fetchInquiries(){setInquiriesLoading(true);const{data}=await supabase.from('inquiries').select('*').order('created_at',{ascending:false});setInquiries(data??[]);setInquiriesLoading(false);}
  async function deleteInquiry(id:number){const{error}=await supabase.from('inquiries').delete().eq('id',id);if(error){showToast("Delete failed",false);}else{setInquiries(p=>p.filter(x=>x.id!==id));setInquiryDeleteConfirm(null);showToast("Inquiry deleted");}}
  async function updateInquiryStatus(id:number,status:string){const{error}=await supabase.from('inquiries').update({status}).eq('id',id);if(error){showToast("Update failed",false);}else{setInquiries(p=>p.map(x=>x.id===id?{...x,status}:x));showToast("Status updated");}}

  function isSetupMissing(error:{code?:string;message?:string}|null){const message=error?.message?.toLowerCase()??"";return error?.code==="42P01"||error?.code==="42703"||message.includes("does not exist")||message.includes("schema cache");}

  async function fetchSiteSettings(){
    const{data}=await supabase.from('site_settings').select('key,value');
    if(data)setSiteSettings(data.reduce((acc:{[k:string]:string|null},r)=>{acc[r.key]=r.value;return acc;},{}));
  }

  function onBatchFiles(e:React.ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files??[]);
    if(!files.length)return;
    const defaultCat=categories[0]?.slug??"grads";
    setBatchItems(prev=>[...prev,...files.map(f=>({file:f,preview:URL.createObjectURL(f),category_slug:defaultCat,title:f.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," ")}))]);
    if(batchFileRef.current)batchFileRef.current.value="";
  }

  async function saveBatchImages(){
    if(!batchItems.length){showToast("No images queued",false);return;}
    setBatchSaving(true);
    let saved=0;
    for(const item of batchItems){
      const url=await uploadImage(item.file,"portfolio");
      if(!url)continue;
      const cat=categories.find(c=>c.slug===item.category_slug);
      const{error}=await supabase.from('portfolio_images').insert({title:item.title||"Portfolio image",alt:item.title||"Portfolio image",image_url:url,category_id:cat?.id??null,category_slug:item.category_slug,featured:false,sort_order:portfolioImages.length+saved+1});
      if(!error)saved++;
    }
    setBatchSaving(false);
    setBatchItems([]);
    showToast(`${saved} image${saved!==1?"s":""} uploaded`);
    fetchPortfolioImages();
  }

  async function importGradPhotos(){
    setImporting(true);
    const{data:gradPhotos}=await supabase.from('grad_photos').select('id,image_url,caption,created_at').order('created_at',{ascending:false});
    if(!gradPhotos||gradPhotos.length===0){showToast("No grad photos found",false);setImporting(false);return;}
    const{data:existing}=await supabase.from('portfolio_images').select('image_url');
    const existingUrls=new Set((existing??[]).map(r=>r.image_url));
    const toImport=gradPhotos.filter(p=>p.image_url&&!existingUrls.has(p.image_url));
    if(!toImport.length){showToast("All grad photos already imported",true);setImporting(false);return;}
    const gradCat=categories.find(c=>c.slug==="grads");
    let count=0;
    for(let i=0;i<toImport.length;i++){
      const p=toImport[i];
      const{error}=await supabase.from('portfolio_images').insert({title:p.caption||"Graduation portrait",alt:p.caption||"Bay Area graduation portrait by Chris Solorzano",image_url:p.image_url,category_id:gradCat?.id??null,category_slug:"grads",featured:i<6,sort_order:portfolioImages.length+count+1});
      if(!error)count++;
    }
    setImporting(false);
    showToast(`${count} grad photo${count!==1?"s":""} imported`);
    fetchPortfolioImages();
  }

  async function updateSiteSetting(key:string,value:string|null){
    setSettingsSaving(key);
    await supabase.from('site_settings').upsert({key,value,updated_at:new Date().toISOString()},{onConflict:'key'});
    setSiteSettings(prev=>({...prev,[key]:value}));
    setSettingsSaving(null);
    setCoverPickerKey(null);
    showToast("Photo selection updated");
  }

  async function fetchPoses(){setPosesLoading(true);const{data}=await supabase.from('grad_poses').select('*').order('order',{ascending:true});if(data)setPoses(data);setPosesLoading(false);}
  async function fetchSpots(){setSpotsLoading(true);const{data}=await supabase.from('location_spots').select('*').order('school_id').order('order',{ascending:true});if(data)setSpots(data);setSpotsLoading(false);}
  async function fetchCategories(){
    setCategoriesLoading(true);
    const{data,error}=await supabase.from('portfolio_categories').select('*').order('sort_order',{ascending:true});
    if(error&&!isSetupMissing(error))console.error(error);
    if(data)setCategories(data);
    setCategoriesLoading(false);
  }
  async function fetchPortfolioImages(){
    setPortfolioLoading(true);
    const{data,error}=await supabase.from('portfolio_images').select('*').order('featured',{ascending:false}).order('sort_order',{ascending:true});
    if(error&&!isSetupMissing(error))console.error(error);
    if(data)setPortfolioImages(data);
    setPortfolioLoading(false);
  }
  async function fetchPosts(){
    setPostsLoading(true);
    let{data,error}=await supabase.from('blog_posts').select('*').eq('category',blogCategory).order('published_at',{ascending:false});
    if(error&&error.message?.toLowerCase().includes("category")){
      const fallback=await supabase.from('blog_posts').select('*').order('published_at',{ascending:false});
      data=fallback.data;
      error=fallback.error;
    }
    if(error&&!isSetupMissing(error))console.error(error);
    if(data)setPosts(data);
    setPostsLoading(false);
  }
  
  async function fetchLinkStats(){
    setStatsLoading(true);
    try{
      const[
        {data:views,error:viewsError},
        {data:clicks,error:clicksError},
        {data:links,error:linksError},
      ]=await Promise.all([
        supabase.from('link_views').select('user_id,viewed_at'),
        supabase.from('link_clicks').select('link_id,user_id,clicked_at'),
        supabase.from('links').select('id,label,emoji,url').eq('active',true).order('order',{ascending:true}),
      ]);
      if(viewsError||clicksError||linksError)throw viewsError||clicksError||linksError;

      const viewEvents=(views??[]) as LinkViewEvent[];
      const clickEvents=(clicks??[]) as LinkClickEvent[];
      const totalViewCount=viewEvents.length;
      const totalClickCount=clickEvents.length;
      const uniqueUserIds=new Set(viewEvents.map(v=>v.user_id).filter(Boolean));
      const uniqueClickerIds=new Set(clickEvents.map(c=>c.user_id).filter(Boolean));
      const clicksByLink=new Map<number,LinkClickEvent[]>();

      clickEvents.forEach(click=>{
        if(!click.link_id)return;
        const existing=clicksByLink.get(click.link_id)??[];
        existing.push(click);
        clicksByLink.set(click.link_id,existing);
      });

      const stats=((links??[]) as {id:number;label:string;emoji:string|null;url:string}[]).map(link=>{
        const linkClicks=clicksByLink.get(link.id)??[];
        const clickCount=linkClicks.length;
        const linkUniqueClickers=new Set(linkClicks.map(click=>click.user_id).filter(Boolean)).size;
        return {
          ...link,
          clicks:clickCount,
          uniqueClickers:linkUniqueClickers,
          ctr:totalViewCount>0?(clickCount/totalViewCount)*100:0,
          clickShare:totalClickCount>0?(clickCount/totalClickCount)*100:0,
        };
      }).sort((a,b)=>b.clicks-a.clicks);

      setTotalViews(totalViewCount);
      setUniqueVisitors(uniqueUserIds.size);
      setTotalClicks(totalClickCount);
      setUniqueClickers(uniqueClickerIds.size);
      setLinkStats(stats);
      setDailyStats(buildDailyStats(timeRange,clickEvents,viewEvents));
    }catch(err){
      console.error("Failed to load link analytics",err);
      showToast("Failed to load analytics",false);
    }finally{
      setStatsLoading(false);
    }
  }
  
  async function fetchDailyStats(days:7|30){
    const startDate=new Date();
    startDate.setDate(startDate.getDate()-days);

    const[{data:clicks},{data:views}]=await Promise.all([
      supabase.from('link_clicks').select('clicked_at').gte('clicked_at',startDate.toISOString()),
      supabase.from('link_views').select('viewed_at').gte('viewed_at',startDate.toISOString()),
    ]);

    setDailyStats(buildDailyStats(days,(clicks??[]) as Pick<LinkClickEvent,"clicked_at">[],(views??[]) as Pick<LinkViewEvent,"viewed_at">[]));
  }
  
  async function clearAllAnalytics(){
    const confirmed=window.confirm("⚠️ This will permanently delete ALL analytics data (views, clicks, history). Are you sure?");
    if(!confirmed)return;
    
    setStatsLoading(true);
    try{
      // Delete all clicks
      await supabase.from('link_clicks').delete().neq('id',0);
      // Delete all views
      await supabase.from('link_views').delete().neq('id',0);
      
      showToast("Analytics cleared successfully",true);
      // Refresh the data
      await fetchLinkStats();
    }catch(err){
      console.error(err);
      showToast("Failed to clear analytics",false);
      setStatsLoading(false);
    }
  }
  
  useEffect(()=>{if(authed){fetchPoses();fetchSpots();fetchCategories();fetchPortfolioImages();fetchPosts();fetchSiteSettings();if(tab==="analytics")fetchLinkStats();if(tab==="inquiries")fetchInquiries();}},[authed,tab,blogCategory]);

  async function compressImage(file:File, maxPx=2400, quality=0.82):Promise<Blob>{
    return new Promise(resolve=>{
      const img=new Image();
      const url=URL.createObjectURL(file);
      img.onload=()=>{
        URL.revokeObjectURL(url);
        let {width,height}=img;
        if(width>maxPx||height>maxPx){
          if(width>height){height=Math.round(height*(maxPx/width));width=maxPx;}
          else{width=Math.round(width*(maxPx/height));height=maxPx;}
        }
        const canvas=document.createElement('canvas');
        canvas.width=width; canvas.height=height;
        const ctx=canvas.getContext('2d')!;
        ctx.drawImage(img,0,0,width,height);
        canvas.toBlob(blob=>resolve(blob??file),'image/jpeg',quality);
      };
      img.onerror=()=>{URL.revokeObjectURL(url);resolve(file);};
      img.src=url;
    });
  }

  async function uploadImage(file:File,folder:string):Promise<string|null>{
    const compressed = await compressImage(file);
    const name=`${folder}/${Date.now()}.jpg`;
    const{error}=await supabase.storage.from('grad-photos').upload(name,compressed,{upsert:true,contentType:'image/jpeg'});
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

  // ── Professional portfolio handlers ──────────────────────────────────
  function categoryName(slug:string){return categories.find(c=>c.slug===slug)?.name??slug;}
  function startEditCategory(category:PortfolioCategory){setEditingCategory(category);setCategoryForm({name:category.name,slug:category.slug,description:category.description??"",sort_order:String(category.sort_order),active:category.active});window.scrollTo({top:0,behavior:"smooth"});}
  function cancelEditCategory(){setEditingCategory(null);setCategoryForm(EMPTY_CATEGORY);}
  async function saveCategory(){
    if(!categoryForm.name||!categoryForm.slug){showToast("Category name and slug required",false);return;}
    setCategorySaving(true);
    const payload={name:categoryForm.name,slug:slugify(categoryForm.slug),description:categoryForm.description||null,sort_order:parseInt(categoryForm.sort_order)||categories.length+1,active:categoryForm.active};
    if(editingCategory){
      const{error}=await supabase.from('portfolio_categories').update(payload).eq('id',editingCategory.id);
      if(error)showToast("Category update failed — "+error.message,false);else{showToast("Category updated!");cancelEditCategory();fetchCategories();}
    }else{
      const{error}=await supabase.from('portfolio_categories').insert(payload);
      if(error)showToast("Category save failed — "+error.message,false);else{showToast("Category added!");setCategoryForm(EMPTY_CATEGORY);fetchCategories();}
    }
    setCategorySaving(false);
  }
  async function deleteCategory(id:number){await supabase.from('portfolio_categories').delete().eq('id',id);setCategories(p=>p.filter(x=>x.id!==id));setCategoryDeleteConfirm(null);if(editingCategory?.id===id)cancelEditCategory();showToast("Category deleted");}

  function startEditPortfolioImage(image:PortfolioImage){setEditingPortfolioImage(image);setPortfolioForm({title:image.title,alt:image.alt??"",category_slug:image.category_slug,featured:image.featured,sort_order:String(image.sort_order)});setPortfolioFile(null);setPortfolioPreview(image.image_url);window.scrollTo({top:0,behavior:"smooth"});}
  function cancelEditPortfolioImage(){setEditingPortfolioImage(null);setPortfolioForm(EMPTY_PORTFOLIO);setPortfolioFile(null);setPortfolioPreview(null);if(portfolioFileRef.current)portfolioFileRef.current.value="";}
  function onPortfolioFile(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setPortfolioFile(f);setPortfolioPreview(URL.createObjectURL(f));}
  async function savePortfolioImage(){
    if(!portfolioForm.title){showToast("Portfolio title required",false);return;}
    if(!portfolioFile&&!editingPortfolioImage){showToast("Upload a portfolio image",false);return;}
    setPortfolioSaving(true);
    let image_url=editingPortfolioImage?.image_url??"";
    if(portfolioFile){const url=await uploadImage(portfolioFile,"portfolio");if(!url){setPortfolioSaving(false);return;}image_url=url;}
    const category=categories.find(c=>c.slug===portfolioForm.category_slug);
    const payload={title:portfolioForm.title,alt:portfolioForm.alt||portfolioForm.title,image_url,category_id:category?.id??null,category_slug:portfolioForm.category_slug,featured:portfolioForm.featured,sort_order:parseInt(portfolioForm.sort_order)||editingPortfolioImage?.sort_order||portfolioImages.length+1};
    if(editingPortfolioImage){
      const{error}=await supabase.from('portfolio_images').update(payload).eq('id',editingPortfolioImage.id);
      if(error)showToast("Portfolio update failed — "+error.message,false);else{showToast("Portfolio image updated!");cancelEditPortfolioImage();fetchPortfolioImages();}
    }else{
      const{error}=await supabase.from('portfolio_images').insert(payload);
      if(error)showToast("Portfolio save failed — "+error.message,false);else{showToast("Portfolio image added!");cancelEditPortfolioImage();fetchPortfolioImages();}
    }
    setPortfolioSaving(false);
  }
  async function deletePortfolioImage(id:number){await supabase.from('portfolio_images').delete().eq('id',id);setPortfolioImages(p=>p.filter(x=>x.id!==id));setPortfolioDeleteConfirm(null);if(editingPortfolioImage?.id===id)cancelEditPortfolioImage();showToast("Portfolio image deleted");}

  async function toggleCarousel(id:number, current:boolean){
    const carouselCount = portfolioImages.filter(i=>i.hero_carousel).length;
    if(!current && carouselCount>=5){showToast("Max 5 carousel images — remove one first",false);return;}
    await supabase.from('portfolio_images').update({hero_carousel:!current}).eq('id',id);
    setPortfolioImages(p=>p.map(x=>x.id===id?{...x,hero_carousel:!current}:x));
    showToast(!current?"Added to carousel":"Removed from carousel");
  }

  // ── Blog handlers ──────────────────────────────────────────────────────
  function slugify(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}
  function startEditPost(post:BlogPost){const category=post.category==="professional"?"professional":"journal";setEditingPost(post);setPostForm({title:post.title,body:post.body,slug:post.slug,category,published_at:post.published_at.slice(0,16)});setBlogCategory(category);setCoverImg(null);setCoverImgPreview(post.cover_image_url||null);setExtraImgs([]);setExtraPreviews(post.extra_image_urls??[]);window.scrollTo({top:0,behavior:"smooth"});}
  function cancelEditPost(){setEditingPost(null);setPostForm({...EMPTY_POST,category:blogCategory});setCoverImg(null);setCoverImgPreview(null);setExtraImgs([]);setExtraPreviews([]);if(coverFileRef.current)coverFileRef.current.value="";if(extraFileRef.current)extraFileRef.current.value="";}
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
    const payload={title:postForm.title,body:postForm.body,slug,category:postForm.category,cover_image_url,extra_image_urls,published_at:new Date(postForm.published_at).toISOString()};
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
  const overallCtr=totalViews>0?(totalClicks/totalViews)*100:0;
  const visitorClickRate=uniqueVisitors>0?(uniqueClickers/uniqueVisitors)*100:0;
  const clicksPerVisitor=uniqueVisitors>0?totalClicks/uniqueVisitors:0;
  const repeatClicks=Math.max(totalClicks-uniqueClickers,0);
  const topLink=linkStats[0];
  const rangeTotals=dailyStats.reduce((acc,stat)=>({views:acc.views+stat.views,clicks:acc.clicks+stat.clicks}),{views:0,clicks:0});
  const rangeCtr=rangeTotals.views>0?(rangeTotals.clicks/rangeTotals.views)*100:0;
  const busiestDay=dailyStats.reduce<DailyStat|null>((best,stat)=>!best||stat.clicks+stat.views>best.clicks+best.views?stat:best,null);

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
          <a href="/bay-area-locations" className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">🗺️ Bay Guide</a>
          <a href="/admin/availability" className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">📅 Availability</a>
          <a href="/" className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">← Site</a>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8 p-1 rounded-2xl bg-white border border-slate-100 w-fit flex-wrap">
          {(["poses","locations","bayGuide","portfolio","categories","blog","analytics","inquiries"] as Tab[]).map(t=>(
            <button key={t} onClick={()=>{setTab(t);cancelEditPose();cancelEditSpot();cancelEditPortfolioImage();cancelEditCategory();cancelEditPost();setEditingInquiry(null);setInquiryDeleteConfirm(null);}}
              className="px-5 py-2 rounded-xl text-sm font-bold transition-all"
              style={tab===t?{background:C.grad12,color:"#fff"}:{color:"#94a3b8"}}>
              {t==="poses"?"📸 Grad Poses":t==="locations"?"📍 Campus Spots":t==="bayGuide"?"🗺️ Bay Guide":t==="portfolio"?"🖼️ Portfolio":t==="categories"?"🏷️ Categories":t==="blog"?"✍️ Blog":t==="analytics"?"📊 Analytics":"📬 Inquiries"}
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

        {tab==="bayGuide"&&<BayAreaLocationsManager />}

        {/* ── PORTFOLIO ── */}
        {tab==="portfolio"&&(
          <div className="space-y-6">

            {/* ── Single image upload/edit ── */}
            <div className={card}>
              <div className="h-[3px]" style={{background:"#111827"}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-black text-slate-900">{editingPortfolioImage?`Editing: ${editingPortfolioImage.title}`:"Add Single Image"}</h2>
                  {editingPortfolioImage&&<button onClick={cancelEditPortfolioImage} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">Cancel edit</button>}
                </div>
                {editingPortfolioImage&&<div className="mb-4 px-3 py-2 rounded-xl text-xs font-bold" style={{background:C.p1_08,color:C.p1,border:`1px solid ${C.p1_20}`}}>✏️ Editing professional portfolio image.</div>}
                <div className="mb-4">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Photo</label>
                  {portfolioPreview?(
                    <div className="relative w-full h-64 rounded-xl overflow-hidden mb-2 bg-slate-100">
                      <img src={portfolioPreview} className="w-full h-full object-cover"/>
                      <button onClick={()=>{setPortfolioFile(null);setPortfolioPreview(editingPortfolioImage?.image_url||null);if(portfolioFileRef.current)portfolioFileRef.current.value="";}} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white text-sm font-bold flex items-center justify-center">✕</button>
                      <button onClick={()=>portfolioFileRef.current?.click()} className="absolute bottom-2 right-2 text-xs font-bold text-white px-3 py-1.5 rounded-full bg-black/70">Change</button>
                    </div>
                  ):(
                    <button onClick={()=>portfolioFileRef.current?.click()} className="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2" style={{borderColor:"rgba(15,23,42,0.16)",background:"#f8fafc"}}>
                      <span className="text-3xl">🖼️</span>
                      <span className="text-xs font-bold text-slate-800">Tap to upload portfolio photo</span>
                      <span className="text-xs text-slate-400">Saved in grad-photos/portfolio</span>
                    </button>
                  )}
                  <input ref={portfolioFileRef} type="file" accept="image/*" className="hidden" onChange={onPortfolioFile}/>
                </div>
                <div className="space-y-3">
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Title</label><input className={inp} placeholder="e.g. Golden hour grad portrait" value={portfolioForm.title} onChange={e=>setPortfolioForm(f=>({...f,title:e.target.value}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Alt Text</label><input className={inp} placeholder="Describe the image for SEO and accessibility" value={portfolioForm.alt} onChange={e=>setPortfolioForm(f=>({...f,alt:e.target.value}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Category</label><select className={inp} value={portfolioForm.category_slug} onChange={e=>setPortfolioForm(f=>({...f,category_slug:e.target.value}))}>{categories.length>0?categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>):<option value="grads">Grads</option>}</select></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order #</label><input className={inp} type="number" placeholder="e.g. 1" value={portfolioForm.sort_order} onChange={e=>setPortfolioForm(f=>({...f,sort_order:e.target.value}))}/></div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={portfolioForm.featured} onChange={e=>setPortfolioForm(f=>({...f,featured:e.target.checked}))}/> Featured on homepage</label>
                  <button onClick={savePortfolioImage} disabled={portfolioSaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{background:"#111827",opacity:portfolioSaving?0.7:1}}>
                    {portfolioSaving?"Saving…":editingPortfolioImage?"Update Portfolio Image ✓":"Save Portfolio Image →"}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Batch upload ── */}
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad12}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-base font-black text-slate-900">Batch Upload</h2>
                  <button onClick={()=>batchFileRef.current?.click()} className="text-xs font-bold px-4 py-2 rounded-xl text-white" style={{background:C.grad12}}>+ Add photos</button>
                </div>
                <p className="text-xs text-slate-400 mb-4">Select multiple photos at once. Set a category for each before saving.</p>
                <input ref={batchFileRef} type="file" accept="image/*" multiple className="hidden" onChange={onBatchFiles}/>

                {batchItems.length>0?(
                  <>
                    <div className="space-y-2 mb-4">
                      {batchItems.map((item,i)=>(
                        <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100">
                          <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200">
                            <img src={item.preview} className="w-full h-full object-cover"/>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <input className="w-full px-2 py-1 rounded-lg text-xs font-medium text-slate-800 outline-none border border-slate-200 bg-white" placeholder="Title" value={item.title} onChange={e=>setBatchItems(prev=>prev.map((x,j)=>j===i?{...x,title:e.target.value}:x))}/>
                            <select className="w-full px-2 py-1 rounded-lg text-xs font-medium text-slate-800 outline-none border border-slate-200 bg-white" value={item.category_slug} onChange={e=>setBatchItems(prev=>prev.map((x,j)=>j===i?{...x,category_slug:e.target.value}:x))}>
                              {categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}
                            </select>
                          </div>
                          <button onClick={()=>setBatchItems(prev=>prev.filter((_,j)=>j!==i))} className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 text-xs font-bold flex-shrink-0 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-colors">✕</button>
                        </div>
                      ))}
                    </div>
                    <button onClick={saveBatchImages} disabled={batchSaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90" style={{background:C.grad12,opacity:batchSaving?0.7:1}}>
                      {batchSaving?`Uploading…`:`Upload ${batchItems.length} image${batchItems.length!==1?"s":""} →`}
                    </button>
                  </>
                ):(
                  <button onClick={()=>batchFileRef.current?.click()} className="w-full h-32 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2" style={{borderColor:C.p1_20,background:C.p1_04}}>
                    <span className="text-2xl">📁</span>
                    <span className="text-xs font-bold" style={{color:C.p1}}>Tap to select multiple photos</span>
                    <span className="text-xs text-slate-400">Tag each as Grads or Families before uploading</span>
                  </button>
                )}
              </div>
            </div>

            {/* ── Import from grad_photos ── */}
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90_23}}/>
              <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-base font-black text-slate-900 mb-1">Import from Grad Photos</h2>
                  <p className="text-xs text-slate-400">Copies any grad_photos not yet in the portfolio (tagged as Grads).</p>
                </div>
                <button onClick={importGradPhotos} disabled={importing} className="flex-shrink-0 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90" style={{background:C.grad90_23,opacity:importing?0.7:1}}>
                  {importing?"Importing…":"Import Grad Photos →"}
                </button>
              </div>
            </div>

            {/* ── Home Cover Photos ── */}
            <div className={card}>
              <div className="h-[3px]" style={{background:"#111827"}}/>
              <div className="p-6">
                <h2 className="text-base font-black text-slate-900 mb-1">Home Page Cover Photos</h2>
                <p className="text-xs text-slate-400 mb-5">Pick which portfolio image appears on the home page for each section card. Click a slot to open the picker.</p>
                <div className="space-y-4">
                  {([["home_cover_grads","Grads card"],["home_cover_families","Families card"],["home_cover_contact","Contact card"]] as [string,string][]).map(([key,label])=>(
                    <div key={key}>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">{label}</p>
                      {coverPickerKey===key?(
                        <div>
                          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto mb-2">
                            {portfolioImages.map(img=>(
                              <button key={img.id} onClick={()=>updateSiteSetting(key,img.image_url)} disabled={settingsSaving===key}
                                className="relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105"
                                style={{borderColor:siteSettings[key]===img.image_url?"#111827":"transparent"}}>
                                <img src={img.image_url} className="w-full h-full object-cover"/>
                                {siteSettings[key]===img.image_url&&<div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white text-lg font-black">✓</span></div>}
                              </button>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={()=>setCoverPickerKey(null)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500">Cancel</button>
                            {siteSettings[key]&&<button onClick={()=>updateSiteSetting(key,null)} className="text-xs font-bold px-3 py-1.5 rounded-lg text-red-500 bg-red-50">Remove cover</button>}
                          </div>
                        </div>
                      ):(
                        <button onClick={()=>setCoverPickerKey(key)} className="flex items-center gap-3 w-full p-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                          {siteSettings[key]?(
                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-200">
                              <img src={siteSettings[key]!} className="w-full h-full object-cover"/>
                            </div>
                          ):(
                            <div className="w-16 h-16 rounded-lg flex-shrink-0 bg-slate-200 flex items-center justify-center text-slate-400 text-xl">🖼️</div>
                          )}
                          <div>
                            <p className="text-xs font-black text-slate-800">{siteSettings[key]?"Change cover photo":"Set cover photo"}</p>
                            <p className="text-xs text-slate-400">{siteSettings[key]?"Click to pick a different image":"Uses first portfolio image as fallback"}</p>
                          </div>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Pricing Page Photos ── */}
            <div className={card}>
              <div className="h-[3px]" style={{background:"#111827"}}/>
              <div className="p-6">
                <h2 className="text-base font-black text-slate-900 mb-1">Pricing Page Photos</h2>
                <p className="text-xs text-slate-400 mb-5">Pick which portfolio images appear on the grad and family pricing pages.</p>
                <div className="space-y-4">
                  {([
                    {key:"pricing_grad_standard_image",label:"Grad package photo",helper:"Shown beside the standard graduation package.",category:"grads"},
                    {key:"pricing_grad_group_image",label:"Group grad photo",helper:"Shown in the group grad package section.",category:"grads"},
                    {key:"pricing_family_session_image",label:"Family session photo",helper:"Shown beside the family session package.",category:"families"},
                    {key:"pricing_family_extended_image",label:"Extended family photo",helper:"Shown beside the extended family package.",category:"families"},
                  ] as {key:string;label:string;helper:string;category:"grads"|"families"}[]).map(({key,label,helper,category})=>{
                    const categoryImages=portfolioImages.filter(img=>matchesPortfolioGroup(img,category));
                    const pickerImages=categoryImages.length>0?categoryImages:portfolioImages;

                    return(
                      <div key={key}>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">{label}</p>
                        <p className="text-xs text-slate-400 mb-2">{helper}</p>
                        {coverPickerKey===key?(
                          <div>
                            {pickerImages.length>0?(
                              <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto mb-2">
                                {pickerImages.map(img=>(
                                  <button key={img.id} onClick={()=>updateSiteSetting(key,img.image_url)} disabled={settingsSaving===key}
                                    className="relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105"
                                    style={{borderColor:siteSettings[key]===img.image_url?"#111827":"transparent"}}>
                                    <img src={img.image_url} className="w-full h-full object-cover"/>
                                    {siteSettings[key]===img.image_url&&<div className="absolute inset-0 bg-black/40 flex items-center justify-center"><span className="text-white text-lg font-black">✓</span></div>}
                                  </button>
                                ))}
                              </div>
                            ):(
                              <p className="text-xs text-slate-400 mb-2 rounded-xl bg-slate-50 border border-slate-100 p-3">Upload portfolio images first, then come back here to choose pricing photos.</p>
                            )}
                            <div className="flex gap-2">
                              <button onClick={()=>setCoverPickerKey(null)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500">Cancel</button>
                              {siteSettings[key]&&<button onClick={()=>updateSiteSetting(key,null)} className="text-xs font-bold px-3 py-1.5 rounded-lg text-red-500 bg-red-50">Remove photo</button>}
                            </div>
                          </div>
                        ):(
                          <button onClick={()=>setCoverPickerKey(key)} className="flex items-center gap-3 w-full p-2 rounded-xl border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                            {siteSettings[key]?(
                              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-slate-200">
                                <img src={siteSettings[key]!} className="w-full h-full object-cover"/>
                              </div>
                            ):(
                              <div className="w-16 h-16 rounded-lg flex-shrink-0 bg-slate-200 flex items-center justify-center text-slate-400 text-xl">🖼️</div>
                            )}
                            <div>
                              <p className="text-xs font-black text-slate-800">{siteSettings[key]?"Change pricing photo":"Set pricing photo"}</p>
                              <p className="text-xs text-slate-400">{siteSettings[key]?"Click to pick a different image":"Uses the current automatic fallback"}</p>
                            </div>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Hero Carousel Manager ── */}
            <div className={card}>
              <div className="h-[3px]" style={{background:"#111827"}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base font-black text-slate-900">Hero Carousel</h2>
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">{portfolioImages.filter(i=>i.hero_carousel).length} / 5</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">These photos rotate in the full-screen hero on the home page. Pick up to 5.</p>
                {portfolioImages.filter(i=>i.hero_carousel).length===0?(
                  <p className="text-sm text-slate-400 italic">No carousel images set — toggle images below.</p>
                ):(
                  <div className="grid grid-cols-5 gap-2">
                    {portfolioImages.filter(i=>i.hero_carousel).map(img=>(
                      <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden group">
                        <img src={img.image_url} className="w-full h-full object-cover"/>
                        <button onClick={()=>toggleCarousel(img.id,true)}
                          className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <span className="text-white text-xs font-black bg-red-500/80 px-2 py-1 rounded-lg">Remove</span>
                        </button>
                      </div>
                    ))}
                    {portfolioImages.filter(i=>i.hero_carousel).length<5&&(
                      <div className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-slate-300 text-2xl" style={{borderColor:"rgba(0,0,0,0.1)"}}>+</div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Image list ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Portfolio Images</p>
                <span className="text-xs font-bold text-slate-400">({portfolioImages.length})</span>
              </div>
              {portfolioLoading?[...Array(3)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-20 mb-3 bg-slate-100"/>):(
                portfolioImages.length===0?<p className="text-sm text-slate-400 font-medium">No portfolio images yet — upload the first one above.</p>:(
                  <div className="space-y-3">
                    {portfolioImages.map(image=>(
                      <div key={image.id} className={card} style={editingPortfolioImage?.id===image.id?{outline:"2px solid #111827"}:{}}>
                        <div className="flex">
                          <div className="w-24 h-24 flex-shrink-0 overflow-hidden bg-slate-100"><img src={image.image_url} className="w-full h-full object-cover"/></div>
                          <div className="flex-1 p-4 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  {image.featured&&<span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-900 text-white">FEATURED</span>}
                                  <p className="text-sm font-black text-slate-900 truncate">{image.title}</p>
                                </div>
                                <p className="text-xs text-slate-400">{categoryName(image.category_slug)} · #{image.sort_order}</p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0 items-center">
                                <button
                                  onClick={()=>toggleCarousel(image.id, image.hero_carousel)}
                                  title={image.hero_carousel?"Remove from carousel":"Add to carousel"}
                                  className="text-xs font-black px-2.5 py-1.5 rounded-lg transition-colors"
                                  style={image.hero_carousel?{background:"#111827",color:"#fff"}:{background:"#f1f5f9",color:"#64748b"}}>
                                  {image.hero_carousel?"★":"☆"}
                                </button>
                                {editingPortfolioImage?.id!==image.id&&<button onClick={()=>startEditPortfolioImage(image)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">Edit</button>}
                                {portfolioDeleteConfirm===image.id?(
                                  <div className="flex gap-1.5">
                                    <button onClick={()=>deletePortfolioImage(image.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{background:"#be123c"}}>Delete</button>
                                    <button onClick={()=>setPortfolioDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                                  </div>
                                ):<button onClick={()=>setPortfolioDeleteConfirm(image.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>}
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

        {/* ── CATEGORIES ── */}
        {tab==="categories"&&(
          <div className="space-y-6">
            <div className={card}>
              <div className="h-[3px]" style={{background:"#111827"}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-black text-slate-900">{editingCategory?`Editing: ${editingCategory.name}`:"New Portfolio Category"}</h2>
                  {editingCategory&&<button onClick={cancelEditCategory} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg bg-slate-100">Cancel edit</button>}
                </div>
                <div className="space-y-3">
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Name</label><input className={inp} placeholder="e.g. Weddings" value={categoryForm.name} onChange={e=>setCategoryForm(f=>({...f,name:e.target.value,slug:editingCategory?f.slug:slugify(e.target.value)}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Slug</label><input className={inp} placeholder="e.g. weddings" value={categoryForm.slug} onChange={e=>setCategoryForm(f=>({...f,slug:slugify(e.target.value)}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Description</label><textarea className={ta} rows={3} placeholder="Short category description..." value={categoryForm.description} onChange={e=>setCategoryForm(f=>({...f,description:e.target.value}))}/></div>
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">Order #</label><input className={inp} type="number" value={categoryForm.sort_order} onChange={e=>setCategoryForm(f=>({...f,sort_order:e.target.value}))}/></div>
                  <label className="flex items-center gap-2 text-sm font-bold text-slate-700"><input type="checkbox" checked={categoryForm.active} onChange={e=>setCategoryForm(f=>({...f,active:e.target.checked}))}/> Active</label>
                  <button onClick={saveCategory} disabled={categorySaving} className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95 mt-2" style={{background:"#111827",opacity:categorySaving?0.7:1}}>
                    {categorySaving?"Saving…":editingCategory?"Update Category ✓":"Save Category →"}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <p className="text-xs font-black uppercase tracking-widest text-slate-900">Portfolio Categories</p>
                <span className="text-xs font-bold text-slate-400">({categories.length})</span>
              </div>
              {categoriesLoading?[...Array(3)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-20 mb-3 bg-slate-100"/>):(
                categories.length===0?<p className="text-sm text-slate-400 font-medium">No categories yet — add Graduation, Portraits, or Events to start.</p>:(
                  <div className="space-y-3">
                    {categories.map(category=>(
                      <div key={category.id} className={card} style={editingCategory?.id===category.id?{outline:"2px solid #111827"}:{}}>
                        <div className="p-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">#{category.sort_order}</span>
                              <p className="text-sm font-black text-slate-900 truncate">{category.name}</p>
                              {!category.active&&<span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-red-50 text-red-500">INACTIVE</span>}
                            </div>
                            <p className="text-xs text-slate-400 mt-1">/{category.slug}</p>
                            {category.description&&<p className="text-xs text-slate-500 mt-2 leading-relaxed">{category.description}</p>}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {editingCategory?.id!==category.id&&<button onClick={()=>startEditCategory(category)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">Edit</button>}
                            {categoryDeleteConfirm===category.id?(
                              <div className="flex gap-1.5">
                                <button onClick={()=>deleteCategory(category.id)} className="text-xs font-bold text-white px-2.5 py-1.5 rounded-lg" style={{background:"#be123c"}}>Delete</button>
                                <button onClick={()=>setCategoryDeleteConfirm(null)} className="text-xs font-bold text-slate-500 px-2.5 py-1.5 rounded-lg bg-slate-100">✕</button>
                              </div>
                            ):<button onClick={()=>setCategoryDeleteConfirm(category.id)} className="text-xs font-bold text-slate-300 hover:text-red-400 transition-colors px-1">🗑</button>}
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

                <div className="mb-5">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Post Category</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {BLOG_CATEGORIES.map(category=>(
                      <button
                        key={category.value}
                        onClick={()=>{setBlogCategory(category.value);setPostForm(f=>({...f,category:category.value}));}}
                        className="rounded-xl border px-4 py-3 text-left transition-all"
                        style={postForm.category===category.value?{borderColor:C.p1,background:C.p1_08}:{borderColor:"#e2e8f0",background:"#fff"}}
                      >
                        <span className="block text-sm font-black text-slate-900">{category.label}</span>
                        <span className="block text-xs font-medium text-slate-400 mt-0.5">{category.helper}</span>
                      </button>
                    ))}
                  </div>
                </div>

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
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2">
                <p className="text-xs font-black uppercase tracking-widest" style={{color:C.p1}}>{blogCategory==="professional"?"Professional Case Studies":"Journal Posts"}</p>
                <span className="text-xs font-bold text-slate-400">({posts.length})</span>
                </div>
                <div className="flex gap-2 p-1 rounded-xl bg-white border border-slate-100">
                  {BLOG_CATEGORIES.map(category=>(
                    <button key={category.value} onClick={()=>{setBlogCategory(category.value);setPostForm(f=>({...f,category:category.value}));}} className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all" style={blogCategory===category.value?{background:C.p1_10,color:C.p1}:{color:"#94a3b8"}}>
                      {category.label}
                    </button>
                  ))}
                </div>
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
                                <p className="text-xs text-slate-400">{post.category==="professional"?"Professional":"Journal"} · {new Date(post.published_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})} · {(post.extra_image_urls?.length??0)+1} photo{(post.extra_image_urls?.length??0)>0?"s":""}</p>
                              </div>
                              <div className="flex gap-2 flex-shrink-0">
                                <a href={`${post.category==="professional"?"/blog":"/journal"}/${post.slug}`} target="_blank" className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:C.p1_08,color:C.p1}}>View</a>
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
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90}}/>
              <div className="p-6">
                <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest mb-2" style={{color:C.p1}}>Linktree analytics</p>
                    <h2 className="text-2xl font-black leading-tight text-slate-900">A cleaner read on views, clicks, and who actually clicked.</h2>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-500">
                      Stats are based on the link page tracker and a browser-level user id saved locally on each visitor&apos;s device.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 md:justify-end">
                    <div className="flex gap-2 p-1 rounded-xl bg-slate-50 border border-slate-100 w-fit">
                      <button onClick={()=>{setTimeRange(7);if(!statsLoading)fetchDailyStats(7);}} className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all" style={timeRange===7?{background:C.p1_10,color:C.p1}:{color:"#94a3b8"}}>7 Days</button>
                      <button onClick={()=>{setTimeRange(30);if(!statsLoading)fetchDailyStats(30);}} className="px-4 py-1.5 rounded-lg text-xs font-bold transition-all" style={timeRange===30?{background:C.p1_10,color:C.p1}:{color:"#94a3b8"}}>30 Days</button>
                    </div>
                    <button onClick={fetchLinkStats} disabled={statsLoading} className="text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80" style={{background:C.p2_08,color:C.p2}}>
                      {statsLoading?"Loading...":"Refresh"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Overview Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={card}>
                <div className="h-[3px]" style={{background:C.grad12}}/>
                <div className="p-6">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Total Views</p>
                  <p className="text-4xl font-black mb-1" style={{color:C.p1}}>{fmtNum(totalViews)}</p>
                  <p className="text-xs leading-relaxed text-slate-400">All link page loads.</p>
                </div>
              </div>
              <div className={card}>
                <div className="h-[3px]" style={{background:C.grad321}}/>
                <div className="p-6">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Unique Visitors</p>
                  <p className="text-4xl font-black mb-1" style={{color:C.p3}}>{fmtNum(uniqueVisitors)}</p>
                  <p className="text-xs leading-relaxed text-slate-400">Distinct users who opened the links page.</p>
                </div>
              </div>
              <div className={card}>
                <div className="h-[3px]" style={{background:C.grad23}}/>
                <div className="p-6">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Total Clicks</p>
                  <p className="text-4xl font-black mb-1" style={{color:C.p2}}>{fmtNum(totalClicks)}</p>
                  <p className="text-xs leading-relaxed text-slate-400">Every tracked link click, including repeats.</p>
                </div>
              </div>
              <div className={card}>
                <div className="h-[3px]" style={{background:C.grad90}}/>
                <div className="p-6">
                  <p className="text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Unique Clickers</p>
                  <p className="text-4xl font-black mb-1" style={{color:C.p1}}>{fmtNum(uniqueClickers)}</p>
                  <p className="text-xs leading-relaxed text-slate-400">Distinct users who clicked at least one link.</p>
                </div>
              </div>
            </div>

            {/* Engagement Snapshot */}
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad321}}/>
              <div className="p-6">
                <div className="flex flex-col gap-2 mb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest mb-1" style={{color:C.p2}}>Engagement snapshot</p>
                    <h3 className="text-base font-black text-slate-900">The numbers that explain the funnel.</h3>
                  </div>
                  <p className="text-xs font-bold text-slate-400">
                    {timeRange}-day range: {fmtNum(rangeTotals.views)} views · {fmtNum(rangeTotals.clicks)} clicks · {fmtPercent(rangeCtr)} CTR
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="rounded-xl border border-slate-100 p-4" style={{background:C.p1_04}}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Click-through rate</p>
                    <p className="text-2xl font-black" style={{color:C.p1}}>{fmtPercent(overallCtr)}</p>
                    <p className="text-xs leading-relaxed text-slate-400">total clicks divided by total views</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-4" style={{background:C.p2_06}}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Visitor to clicker</p>
                    <p className="text-2xl font-black" style={{color:C.p2}}>{fmtPercent(visitorClickRate)}</p>
                    <p className="text-xs leading-relaxed text-slate-400">unique clickers divided by unique visitors</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-4" style={{background:C.p3_08}}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Clicks per visitor</p>
                    <p className="text-2xl font-black" style={{color:"#d97706"}}>{fmtRatio(clicksPerVisitor)}</p>
                    <p className="text-xs leading-relaxed text-slate-400">average clicks per unique visitor</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-4" style={{background:C.p1_06}}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Repeat clicks</p>
                    <p className="text-2xl font-black" style={{color:C.p1}}>{fmtNum(repeatClicks)}</p>
                    <p className="text-xs leading-relaxed text-slate-400">clicks beyond the first clicker click</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 p-4" style={{background:C.p2_08}}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Top link share</p>
                    <p className="text-2xl font-black" style={{color:C.p2}}>{topLink?fmtPercent(topLink.clickShare):"0.0%"}</p>
                    <p className="text-xs leading-relaxed text-slate-400">{topLink?topLink.label:"no clicks yet"}</p>
                  </div>
                </div>
                <div className="mt-5 rounded-xl border border-slate-100 p-4" style={{background:"rgba(248,250,252,0.82)"}}>
                  <p className="text-sm font-bold leading-relaxed text-slate-600">
                    {totalViews>0?(
                      <>
                        {fmtNum(uniqueClickers)} of {fmtNum(uniqueVisitors)} distinct visitors clicked at least once. {topLink?`${topLink.label} is leading with ${fmtNum(topLink.clicks)} clicks (${fmtPercent(topLink.clickShare)} of all clicks).`:"No link has clicks yet."}
                      </>
                    ):(
                      <>No link page traffic has been recorded yet.</>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Definitions */}
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90_23}}/>
              <div className="p-6">
                <h3 className="text-base font-black text-slate-900 mb-4">What each stat means</h3>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    ["Distinct users","Approximate people/devices, based on the local browser id saved on the link page. A new browser or cleared storage can count as a new distinct user."],
                    ["Unique visitors","Distinct users who loaded the links page at least once."],
                    ["Unique clickers","Distinct users who clicked at least one link."],
                    ["Click-through rate","Total clicks divided by total views, shown as a percentage."],
                    ["Total clicks","Every recorded link click, including repeat clicks from the same user."],
                  ].map(([term,definition])=>(
                    <div key={term} className="rounded-xl border border-slate-100 p-4">
                      <dt className="text-xs font-black uppercase tracking-widest mb-1" style={{color:C.p1}}>{term}</dt>
                      <dd className="text-sm font-medium leading-relaxed text-slate-500">{definition}</dd>
                    </div>
                  ))}
                </dl>
                <button onClick={clearAllAnalytics} disabled={statsLoading} className="mt-5 text-xs font-bold px-4 py-2 rounded-lg transition-all hover:opacity-80" style={{background:"rgba(239,68,68,0.08)",color:"#dc2626"}}>
                  Clear all analytics
                </button>
              </div>
            </div>

            {/* Chart */}
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90}}/>
              <div className="p-6">
                <div className="flex flex-col gap-1 mb-6 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Activity Over Time</h3>
                    <p className="text-xs font-medium text-slate-400">Views and clicks by day for the selected range.</p>
                  </div>
                  {busiestDay&&busiestDay.views+busiestDay.clicks>0&&(
                    <p className="text-xs font-bold text-slate-400">
                      Busiest day: {dateFromKey(busiestDay.date).toLocaleDateString('en-US',{month:'short',day:'numeric'})} · {fmtNum(busiestDay.views+busiestDay.clicks)} events
                    </p>
                  )}
                </div>
                {statsLoading?(
                  <div className="h-80 flex items-center justify-center text-slate-400 text-sm">Loading chart...</div>
                ):(
                  <div className="overflow-x-auto pb-2">
                    <div className="relative min-w-[620px]">
                    {/* Chart area */}
                    <div className="h-80 flex items-end justify-between gap-2 px-4">
                      {dailyStats.map((stat,i)=>{
                        const maxVal=Math.max(...dailyStats.map(s=>Math.max(s.clicks,s.views)),1);
                        const clickHeight=(stat.clicks/maxVal)*100;
                        const viewHeight=(stat.views/maxVal)*100;
                        const date=dateFromKey(stat.date);
                        const dayLabel=date.toLocaleDateString('en-US',{weekday:'short'});
                        const dateLabel=date.getDate();
                        
                        return(
                          <div key={i} className="group flex-1 flex flex-col items-center gap-2 cursor-pointer relative">
                            {/* Hover tooltip */}
                            <div className="absolute -top-20 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-10">
                              <div className="rounded-xl px-3 py-2 shadow-xl whitespace-nowrap" style={{background:"rgba(0,0,0,0.9)"}}>
                                <p className="text-xs font-bold text-white mb-1">{dayLabel}, {dateLabel}</p>
                                <p className="text-xs text-white/70">{stat.views} views</p>
                                <p className="text-xs text-white/70">{stat.clicks} clicks</p>
                                <p className="text-xs text-white/70">{fmtPercent(stat.ctr)} CTR</p>
                              </div>
                            </div>
                            
                            {/* Bars container */}
                            <div className="w-full flex gap-1.5 items-end transition-all duration-300 group-hover:scale-105" style={{height:280}}>
                              {/* Views bar */}
                              <div className="flex-1 rounded-t-lg transition-all duration-500 ease-out relative overflow-hidden" 
                                   style={{
                                     height:`${viewHeight}%`,
                                     background:`linear-gradient(180deg,${C.p1},${C.p1_35})`,
                                     minHeight:viewHeight>0?8:0,
                                     animationDelay:`${i*50}ms`,
                                     boxShadow:`0 -4px 12px ${C.p1_15}`
                                   }}>
                                <div className="absolute inset-0" style={{background:`linear-gradient(180deg,transparent,rgba(255,255,255,0.2))`}}/>
                              </div>
                              
                              {/* Clicks bar */}
                              <div className="flex-1 rounded-t-lg transition-all duration-500 ease-out relative overflow-hidden" 
                                   style={{
                                     height:`${clickHeight}%`,
                                     background:`linear-gradient(180deg,${C.p2},${C.p2_30})`,
                                     minHeight:clickHeight>0?8:0,
                                     animationDelay:`${i*50+25}ms`,
                                     boxShadow:`0 -4px 12px ${C.p2_15}`
                                   }}>
                                <div className="absolute inset-0" style={{background:`linear-gradient(180deg,transparent,rgba(255,255,255,0.2))`}}/>
                              </div>
                            </div>
                            
                            {/* Date labels */}
                            <div className="text-center">
                              <p className="text-xs font-black text-slate-900 transition-colors group-hover:text-violet-600">{dateLabel}</p>
                              <p className="text-[10px] font-bold text-slate-300 uppercase">{dayLabel}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Y-axis grid lines */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between px-4" style={{paddingBottom:56}}>
                      {[...Array(5)].map((_,i)=>(
                        <div key={i} className="w-full h-px" style={{background:"rgba(0,0,0,0.03)"}}/>
                      ))}
                    </div>
                    </div>
                  </div>
                )}
                
                {/* Legend */}
                <div className="flex items-center justify-center gap-8 mt-6 pt-6 border-t" style={{borderColor:C.p1_08}}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-md shadow-sm" style={{background:`linear-gradient(135deg,${C.p1},${C.p1_35})`}}/>
                    <span className="text-sm font-bold text-slate-600">Page Views</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-md shadow-sm" style={{background:`linear-gradient(135deg,${C.p2},${C.p2_30})`}}/>
                    <span className="text-sm font-bold text-slate-600">Link Clicks</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Links */}
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90_23}}/>
              <div className="p-6">
                <div className="flex flex-col gap-1 mb-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-base font-black text-slate-900">Top Performing Links</h2>
                    <p className="text-xs font-medium text-slate-400">Ranked by total clicks. CTR is link clicks divided by all page views.</p>
                  </div>
                  <a href="/admin/links" className="text-xs font-bold transition-colors hover:text-slate-700" style={{color:C.p2}}>Manage links</a>
                </div>
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
                            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-black" style={{background:idx===0?C.p1_15:idx===1?C.p2_10:idx===2?C.p3_10:C.p1_06,color:idx<3?C.p1:"#94a3b8"}}>#{idx+1}</div>
                                <span className="text-xl flex-shrink-0">{stat.emoji||"🔗"}</span>
                                <div className="min-w-0 flex-1">
                                  <p className="font-black text-sm text-slate-900 truncate">{stat.label}</p>
                                  <p className="text-xs text-slate-400 truncate">{stat.url}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
                                <div className="text-right">
                                  <p className="text-xl font-black" style={{color:C.p1}}>{fmtNum(stat.clicks)}</p>
                                  <p className="text-[9px] font-bold tracking-widest uppercase text-slate-300">clicks</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-black" style={{color:C.p3}}>{fmtNum(stat.uniqueClickers)}</p>
                                  <p className="text-[9px] font-bold tracking-widest uppercase text-slate-300">clickers</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-black" style={{color:C.p2}}>{fmtPercent(stat.ctr)}</p>
                                  <p className="text-[9px] font-bold tracking-widest uppercase text-slate-300">CTR</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-black" style={{color:C.p1}}>{fmtPercent(stat.clickShare)}</p>
                                  <p className="text-[9px] font-bold tracking-widest uppercase text-slate-300">share</p>
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

        {/* ── INQUIRIES ── */}
        {tab==="inquiries"&&(
          <div className="space-y-6">
            <div className={card}>
              <div className="h-[3px]" style={{background:C.grad90_12}}/>
              <div className="p-6">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="text-base font-black text-slate-900">Contact Inquiries</h2>
                    <p className="text-xs font-medium text-slate-400">{inquiries.length} total · newest first</p>
                  </div>
                  <button onClick={fetchInquiries} disabled={inquiriesLoading} className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80" style={{background:C.grad12,color:"#fff"}}>
                    {inquiriesLoading?"Loading…":"Refresh"}
                  </button>
                </div>
                {inquiriesLoading?(
                  <div className="text-center py-12 text-slate-400 text-sm">Loading inquiries…</div>
                ):inquiries.length===0?(
                  <div className="text-center py-12 text-slate-400 text-sm">No inquiries yet.</div>
                ):(
                  <div className="space-y-3">
                    {inquiries.map(inq=>(
                      <div key={inq.id} className="rounded-xl border border-slate-100 overflow-hidden">
                        {/* Header row */}
                        <div className="flex items-start justify-between gap-3 p-4 bg-slate-50">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-black text-slate-900">{inq.name}</p>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inq.status==="new"?"bg-emerald-100 text-emerald-700":inq.status==="responded"?"bg-blue-100 text-blue-700":"bg-slate-200 text-slate-500"}`}>
                                {inq.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">{new Date(inq.created_at).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"})}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <select value={inq.status} onChange={e=>updateInquiryStatus(inq.id,e.target.value)}
                              className="text-xs font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 outline-none">
                              <option value="new">new</option>
                              <option value="responded">responded</option>
                              <option value="archived">archived</option>
                            </select>
                            <button onClick={()=>setEditingInquiry(editingInquiry?.id===inq.id?null:inq)}
                              className="text-xs font-bold px-3 py-1 rounded-lg transition-all hover:opacity-80 bg-slate-200 text-slate-700">
                              {editingInquiry?.id===inq.id?"Close":"View"}
                            </button>
                            {inquiryDeleteConfirm===inq.id?(
                              <div className="flex gap-1">
                                <button onClick={()=>deleteInquiry(inq.id)} className="text-xs font-bold px-2 py-1 rounded-lg bg-red-500 text-white">Yes</button>
                                <button onClick={()=>setInquiryDeleteConfirm(null)} className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-200 text-slate-600">No</button>
                              </div>
                            ):(
                              <button onClick={()=>setInquiryDeleteConfirm(inq.id)} className="text-xs font-bold px-2 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all">Delete</button>
                            )}
                          </div>
                        </div>
                        {/* Detail panel */}
                        {editingInquiry?.id===inq.id&&(
                          <div className="p-4 border-t border-slate-100 space-y-3">
                            {[
                              {label:"Email",value:<a href={`mailto:${inq.email}`} className="text-blue-600 hover:underline">{inq.email}</a>},
                              inq.phone&&{label:"Phone",value:inq.phone},
                              inq.session_type&&{label:"Session",value:inq.session_type},
                              inq.date_in_mind&&{label:"Date in mind",value:inq.date_in_mind},
                            ].filter(Boolean).map((row,i)=>{
                              const r=row as {label:string;value:React.ReactNode};
                              return(
                                <div key={i} className="flex gap-4">
                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 min-w-[90px] pt-0.5">{r.label}</span>
                                  <span className="text-sm text-slate-700">{r.value}</span>
                                </div>
                              );
                            })}
                            <div className="flex gap-4 pt-1">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300 min-w-[90px] pt-0.5">Message</span>
                              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{inq.message}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
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
