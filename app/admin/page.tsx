"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useRef, useState, useCallback, useSyncExternalStore, Suspense } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/colors";
import { T, INQ_STATUS } from "@/app/admin/adminTheme";
import CommandPalette from "@/app/admin/CommandPalette";
import AdminWebsiteNavigation, { type WebsiteTab } from "@/app/admin/AdminWebsiteNavigation";

function subscribeReducedMotion(onChange:()=>void){
  const mq=window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change",onChange);
  return()=>mq.removeEventListener("change",onChange);
}

// Animated integer counter for the home stat tiles (reduced-motion aware).
function CountUpNumber({value,prefix=""}:{value:number;prefix?:string}){
  const reduced=useSyncExternalStore(subscribeReducedMotion,()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches,()=>false);
  const [v,setV]=useState(0);
  const prev=useRef(0);
  useEffect(()=>{
    if(reduced){prev.current=value;return;}
    const from=prev.current;const t0=performance.now();const dur=500;let raf=0;
    const tick=(now:number)=>{
      const t=Math.min((now-t0)/dur,1);
      const ease=1-Math.pow(1-t,3);
      setV(Math.round(from+(value-from)*ease));
      if(t<1)raf=requestAnimationFrame(tick);else prev.current=value;
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[value,reduced]);
  return <>{prefix}{(reduced?value:v).toLocaleString("en-US")}</>;
}

// Stable inline editor — lives outside the IIFE so autoFocus isn't killed by re-renders
function SessionTypeEditor({id,value,onSave,onCancel}:{id:number;value:string;onSave:(id:number,v:string)=>void;onCancel:()=>void}){
  const [v,setV]=useState(value);
  return(
    <form onSubmit={e=>{e.preventDefault();onSave(id,v);}} onClick={e=>e.stopPropagation()} className="flex items-center gap-1">
      <input
        autoFocus
        className="text-xs font-semibold px-2 py-0.5 rounded-lg border outline-none"
        style={{borderColor:C.p1_20,background:C.p1_04,color:"#334155",fontFamily:"inherit",width:"160px"}}
        value={v}
        onChange={e=>setV(e.target.value)}
        onKeyDown={e=>{if(e.key==="Escape")onCancel();}}
        placeholder="e.g. Grad Portraits"
      />
      <button type="submit" className="text-[10px] font-black px-2 py-0.5 rounded-lg text-white" style={{background:C.grad12}}>✓</button>
      <button type="button" onClick={onCancel} className="text-[10px] font-bold px-1.5 py-0.5 rounded-lg text-slate-400 hover:text-slate-600">✕</button>
    </form>
  );
}
import { checkAuth, login, logout as adminLogout } from "@/lib/adminAuth";
import AdminSessionStatusStrip from "@/app/components/admin-session-status-strip";
import BayAreaLocationsManager from "@/app/admin/BayAreaLocationsManager";
import AnalyticsTab from "@/app/admin/AnalyticsTab";
import QuickFormatTool from "@/app/admin/QuickFormatTool";
import PaymentAnalyticsTab from "@/app/admin/PaymentAnalyticsTab";
import ClientTimeline from "@/app/admin/ClientTimeline";
import InquiryAnalyticsTab from "@/app/admin/InquiryAnalyticsTab";
import AttributionTab from "@/app/admin/AttributionTab";
import VaultTab from "@/app/admin/VaultTab";
import AiTab from "@/app/admin/AiTab";
import ChatTab from "@/app/admin/ChatTab";
import SessionCalendar from "@/app/admin/SessionCalendar";
import AccountsTab from "@/app/admin/AccountsTab";
import PosesTab from "@/app/admin/PosesTab";
import LocationsTab from "@/app/admin/LocationsTab";
import BlogTab from "@/app/admin/BlogTab";
import FamilyGuideTab from "@/app/admin/FamilyGuideTab";
import AboutPhotosTab from "@/app/admin/AboutPhotosTab";
import CouplesLocationsTab from "@/app/admin/CouplesLocationsTab";
import NavigationTab from "@/app/admin/NavigationTab";
import TestimonialsTab from "@/app/admin/TestimonialsTab";
import CouplesPosingGuideTab from "@/app/admin/CouplesPosingGuideTab";
import { uploadImage } from "@/lib/uploadImage";
import {
  type GradLocationOption,
  type GradSchoolOption,
  type GradSessionOption,
  type GradDegreeOption,
  type GradYearOption,
  type GradAttireOption,
} from "@/lib/portfolioSeoDescription";
import PortfolioSeoPanel from "@/app/admin/PortfolioSeoPanel";
import CaseStudiesTab from "@/app/admin/CaseStudiesTab";
import { GRAD_SCHOOLS } from "@/lib/portfolioCategoryContent";
import {
  findMatchingClientSession,
  getClientSessionEmailMatches,
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import {
  createAdminInquiry,
  deleteAdminInquiry,
  inquiryNeedsReply,
  loadAdminInquiries,
  updateAdminInquiry,
  type AdminInquiry,
} from "@/lib/adminInquiries";
import { buildInquiryReplySubject } from "@/lib/schoolDetection";

export const dynamic = 'force-dynamic'

type Tab = "home"|WebsiteTab|"analytics"|"payments"|"inquiries"|"clients"|"testimonials"|"funnel"|"attribution"|"vault"|"ai"|"chat"|"format"|"accounts";
type ImageLibraryRow = { id:number; title:string; alt:string|null; image_url:string; source_type:string; source_post_id:number|null; source_post_slug:string|null; source_role:string; in_portfolio:boolean; created_at:string; };
type Inquiry = AdminInquiry;
type AdminSessionsResponse = { sessions?: AdminClientSessionDTO[]; session?: AdminClientSessionDTO; error?: string; };
type AdminPaymentSummaryRow = { inquiry_id:number|null; amount:string; client_email:string; payment_type:string|null };

function fmt12h(t:string|null):string{
  if(!t)return"";
  const[h,m]=t.split(":").map(Number);
  if(isNaN(h)||isNaN(m))return t;
  const ampm=h>=12?"PM":"AM";
  const h12=h%12||12;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}
type PortfolioCategory = { id:number; name:string; slug:string; description:string|null; sort_order:number; active:boolean; };
type PortfolioImage = { id:number; title:string; alt:string|null; image_url:string; category_id:number|null; category_slug:string; featured:boolean; hero_carousel:boolean; sort_order:number; created_at:string|null; location?:string|null; school?:string|null; content_hash?:string|null; };
type PortfolioSeoDraft = { school: GradSchoolOption|null; location: GradLocationOption|null; session: GradSessionOption|null; degree: GradDegreeOption|null; year: GradYearOption|null; attire: GradAttireOption|null; goldenHour: boolean; };

const EMPTY_CATEGORY = {name:"",slug:"",description:"",sort_order:"1",active:true};
const EMPTY_PORTFOLIO = {title:"",alt:"",category_slug:"graduation",school:"",featured:false,sort_order:""};
const EMPTY_PORTFOLIO_SEO_DRAFT: PortfolioSeoDraft = {school:null,location:null,session:null,degree:null,year:null,attire:null,goldenHour:false};
const CLIENT_TABS:Tab[]=["inquiries","clients","testimonials","analytics","payments","funnel","attribution","ai","chat","format"];
const VAULT_TABS:Tab[]=["vault"];
const TAB_LABELS:Record<Tab,string>={home:"🏠 Home",poses:"📸 Grad Poses",couplesGuide:"💞 Couples Posing Guide",couplesLocations:"💑 Couples Locations",locations:"📍 Campus Spots",bayGuide:"🗺️ Bay Guide",familyGuide:"👨‍👩‍👧 Family Guide",portfolio:"🖼️ Portfolio",caseStudies:"📖 Case Studies",categories:"🏷️ Categories",blog:"✍️ Blog",library:"🗄️ Image Library",navigation:"🧭 Navigation",aboutPage:"🙋 About Page",analytics:"📊 Analytics",payments:"💵 Revenue",funnel:"📈 Funnel",attribution:"🎯 Attribution",inquiries:"📬 Inquiries",clients:"👥 Clients",testimonials:"💬 Testimonials",vault:"📓 Vault",ai:"🤖 AI Training",chat:"💬 AI Chat",format:"✨ Quick Format",accounts:"👤 Accounts"};
// The six home-page "work grid" slots, in display order — used for the batch picker.
const WORK_GRID_KEYS=["home_story_1","home_story_2","home_story_3","home_story_4","home_story_5","home_story_6"] as const;

// SHA-256 of a file's bytes — used to detect duplicate photos regardless of filename.
async function fileHash(file:File):Promise<string>{
  const digest=await crypto.subtle.digest("SHA-256",await file.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("");
}

// Runs `fn` over items with at most `limit` in flight at once, preserving order.
// Used to upload a batch of photos in parallel instead of one slow await-chain.
async function mapWithConcurrency<T,R>(items:T[],limit:number,fn:(item:T)=>Promise<R>):Promise<R[]>{
  const results:R[]=new Array(items.length);
  let next=0;
  async function worker(){while(next<items.length){const idx=next++;results[idx]=await fn(items[idx]);}}
  await Promise.all(Array.from({length:Math.min(limit,items.length)},()=>worker()));
  return results;
}

function matchesPortfolioGroup(image:PortfolioImage,group:"grads"|"families"|"couples"){
  const slug=image.category_slug;
  if(group==="grads")return slug==="grads"||slug==="graduation";
  if(group==="couples")return slug==="couples"||slug==="engagement";
  return slug==="families"||slug==="family"||slug==="portraits";
}

export default function AdminPage() {
  return (
    <Suspense>
      <AdminDashboard />
    </Suspense>
  );
}

function AdminDashboard() {
  const router=useRouter();
  const [authed,setAuthed]=useState(false);
  const [pw,setPw]=useState("");
  const [pwErr,setPwErr]=useState(false);
  const [tab,setTab]=useState<Tab>("home");
  const [toast,setToast]=useState<{msg:string;ok:boolean}|null>(null);

  // Check localStorage on mount + handle OAuth callback params
  useEffect(() => {
    if (checkAuth()) setAuthed(true);
    const searchParams=new URLSearchParams(window.location.search);
    const gmailParam=searchParams.get("gmail");
    const tabParam=searchParams.get("tab") as Tab|null;
    if(tabParam)setTab(tabParam);
    if(gmailParam==="connected"){
      showToast("Gmail connected ✓ — you can now send emails from here");
      router.replace("/admin?tab=inquiries");
    } else if(gmailParam==="error"){
      showToast("Gmail connection failed — try again",false);
      router.replace("/admin?tab=inquiries");
    } else if(gmailParam==="auth_required"){
      showToast("Session expired — sign in again to connect Gmail",false);
      router.replace("/admin?tab=inquiries");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // ── Image library ────────────────────────────────────────────────────
  const [libraryImages,setLibraryImages]=useState<ImageLibraryRow[]>([]);
  const [libraryLoading,setLibraryLoading]=useState(false);
  const [libraryFilter,setLibraryFilter]=useState<"all"|"portfolio"|"unset">("all");
  const [libraryPushingId,setLibraryPushingId]=useState<number|null>(null);
  const [libraryPushCategory,setLibraryPushCategory]=useState("grads");
  const [libraryUploading,setLibraryUploading]=useState(false);
  const [libraryUploadPreviews,setLibraryUploadPreviews]=useState<{file:File;preview:string}[]>([]);
  const libraryUploadRef=useRef<HTMLInputElement>(null);

  // ── Professional portfolio ───────────────────────────────────────────
  const [portfolioImages,setPortfolioImages]=useState<PortfolioImage[]>([]);
  const [portfolioLoading,setPortfolioLoading]=useState(false);
  const [portfolioForm,setPortfolioForm]=useState(EMPTY_PORTFOLIO);
  const [portfolioFile,setPortfolioFile]=useState<File|null>(null);
  const [portfolioPreview,setPortfolioPreview]=useState<string|null>(null);
  const [portfolioSaving,setPortfolioSaving]=useState(false);
  const [editingPortfolioImage,setEditingPortfolioImage]=useState<PortfolioImage|null>(null);
  const [portfolioDeleteConfirm,setPortfolioDeleteConfirm]=useState<number|null>(null);
  const [portfolioSeoEditorId,setPortfolioSeoEditorId]=useState<number|null>(null);
  const [portfolioSeoDraft,setPortfolioSeoDraft]=useState<PortfolioSeoDraft>(EMPTY_PORTFOLIO_SEO_DRAFT);
  const [portfolioSeoSavingId,setPortfolioSeoSavingId]=useState<number|null>(null);
  const [seoBatchMode,setSeoBatchMode]=useState(false);
  const [seoBatchSelected,setSeoBatchSelected]=useState<number[]>([]);
  const [seoBatchOpen,setSeoBatchOpen]=useState(false);
  const [seoBatchDraft,setSeoBatchDraft]=useState<PortfolioSeoDraft>(EMPTY_PORTFOLIO_SEO_DRAFT);
  const [seoBatchSaving,setSeoBatchSaving]=useState(false);
  const [seoBatchProgress,setSeoBatchProgress]=useState<{done:number;total:number}|null>(null);
  const portfolioFileRef=useRef<HTMLInputElement>(null);

  const [categories,setCategories]=useState<PortfolioCategory[]>([]);
  const [categoriesLoading,setCategoriesLoading]=useState(false);
  const [categoryForm,setCategoryForm]=useState(EMPTY_CATEGORY);
  const [categorySaving,setCategorySaving]=useState(false);
  const [editingCategory,setEditingCategory]=useState<PortfolioCategory|null>(null);
  const [categoryDeleteConfirm,setCategoryDeleteConfirm]=useState<number|null>(null);

  // ── Batch upload ─────────────────────────────────────────────────────
  type BatchItem = { id: number; file: File; preview: string; category_slug: string; title: string; location: string; hash: string; };
  const [batchItems, setBatchItems] = useState<BatchItem[]>([]);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchSelected, setBatchSelected] = useState<Set<number>>(new Set());
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkLocation, setBulkLocation] = useState("");
  const [importing, setImporting] = useState(false);
  const batchFileRef = useRef<HTMLInputElement>(null);
  const batchIdRef = useRef(0);
  const batchAnchorRef = useRef<number | null>(null); // last checkbox toggled, for shift-range select

  // ── Site settings (site image selections) ────────────────────────────
  const [siteSettings, setSiteSettings] = useState<Record<string,string|null>>({});
  const [settingsSaving, setSettingsSaving] = useState<string|null>(null);
  const [coverPickerKey, setCoverPickerKey] = useState<string|null>(null);
  // Work-grid batch picker: pick up to 6 photos in order, then fill slots 1–6 in one save.
  const [gridBatchOpen, setGridBatchOpen] = useState(false);
  const [gridBatchPick, setGridBatchPick] = useState<string[]>([]);
  const [gridBatchSaving, setGridBatchSaving] = useState(false);
  const gridBatchAnchorRef = useRef<number|null>(null);

  // ── Reply style ───────────────────────────────────────────────────────


  // ── Clients ───────────────────────────────────────────────────────────────
  const [clientSearch,setClientSearch]=useState("");
  const [clientFilter,setClientFilter]=useState<"all"|"in_progress"|"delivered"|"paid"|"unpaid">("all");
  const [clientSort,setClientSort]=useState<"recent_activity"|"newest_inquiry"|"oldest_inquiry"|"session_date"|"alpha"|"paid_recently">("recent_activity");
  const [inquirySort,setInquirySort]=useState<"needs_reply"|"newest"|"oldest"|"session_date"|"alpha"|"paid_recently">("needs_reply");
  const [inquiryFilter,setInquiryFilter]=useState<"all"|"needs_reply"|"new"|"responded"|"archived"|"not_interested">("all");
  const [paletteOpen,setPaletteOpen]=useState(false);
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();setPaletteOpen(o=>!o);}
    };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[]);
  const [editingSessionType,setEditingSessionType]=useState<number|null>(null);
  const EMPTY_CLIENT={name:"",email:"",phone:"",session_type:"",session_date:"",message:""};
  const EMPTY_EVENT={name:"",email:"",phone:"",session_type:"",session_date:"",session_time:"",location:"",notes:"",payment_received:false};
  const [addClientOpen,setAddClientOpen]=useState(false);
  const [addClientForm,setAddClientForm]=useState(EMPTY_CLIENT);
  const [addClientSaving,setAddClientSaving]=useState(false);
  const [addEventOpen,setAddEventOpen]=useState(false);
  const [addEventForm,setAddEventForm]=useState(EMPTY_EVENT);
  const [addEventSaving,setAddEventSaving]=useState(false);
  const [portalSessions,setPortalSessions]=useState<AdminClientSessionDTO[]>([]);
  const [portalSessionsLoading,setPortalSessionsLoading]=useState(false);
  const [portalStatusSavingKey,setPortalStatusSavingKey]=useState<string|null>(null);

  // ── Content Engine pipeline counts (home card + sidebar badge) ────────
  type EngineCountRow={state:string;itemCounts:Record<string,number>};
  const [engineRows,setEngineRows]=useState<EngineCountRow[]>([]);
  useEffect(()=>{
    if(!authed)return;
    fetch("/api/admin/session-content/sessions")
      .then(r=>r.ok?r.json():Promise.reject(new Error(`engine sessions ${r.status}`)))
      .then((b:{sessions?:EngineCountRow[]})=>setEngineRows(b.sessions??[]))
      .catch(err=>console.error("[ContentEngine] counts fetch failed:",err));
  },[authed]);
  const engineTotals=engineRows.reduce(
    (acc,r)=>({
      draft:acc.draft+(r.itemCounts?.draft??0),
      approved:acc.approved+(r.itemCounts?.approved??0),
      published:acc.published+(r.itemCounts?.published??0),
      failed:acc.failed+(r.itemCounts?.failed??0)+(r.state==="failed"?1:0),
    }),
    {draft:0,approved:0,published:0,failed:0},
  );
  const engineActionable=engineTotals.draft+engineTotals.approved+engineTotals.failed;

  useEffect(() => {
    const searchParams=new URLSearchParams(window.location.search);
    const clientParam=searchParams.get("client");
    if(clientParam){setTab("clients");setClientSearch(clientParam);}
  }, []);

  // ── Inquiries ─────────────────────────────────────────────────────────
  const [inquiries,setInquiries]=useState<Inquiry[]>([]);
  const [inquiriesLoading,setInquiriesLoading]=useState(false);
  const [finalPaymentIds,setFinalPaymentIds]=useState<Set<number>>(new Set());
  const [deposit1Amounts,setDeposit1Amounts]=useState<Map<number,string>>(new Map());
  const [cardPaymentId,setCardPaymentId]=useState<number|null>(null);
  const [cardPaymentAmount,setCardPaymentAmount]=useState("");
  const [cardPaymentMethod,setCardPaymentMethod]=useState("Venmo");
  const [cardPaymentSaving,setCardPaymentSaving]=useState(false);
  const [inquiryDeleteConfirm,setInquiryDeleteConfirm]=useState<number|null>(null);
  const [editingInquiry,setEditingInquiry]=useState<Inquiry|null>(null);
  const [draftLoading,setDraftLoading]=useState<number|null>(null);
  const [drafts,setDrafts]=useState<Record<number,string>>({});
  const [originalAiDrafts,setOriginalAiDrafts]=useState<Record<number,string>>({});
  const [draftCopied,setDraftCopied]=useState<number|null>(null);
  const [draftFeedback,setDraftFeedback]=useState<Record<number,string>>({});
  const [ruleSaved,setRuleSaved]=useState<number|null>(null);
  const [showLearnPanel,setShowLearnPanel]=useState<Record<number,boolean>>({});
  const [actualSent,setActualSent]=useState<Record<number,string>>({});
  const [learnLoading,setLearnLoading]=useState<number|null>(null);
  const [learnedRules,setLearnedRules]=useState<Record<number,string[]>>({});

  // ── Payment sync ──────────────────────────────────────────────────────────
  const [syncLoading,setSyncLoading]=useState(false);
  const [syncResult,setSyncResult]=useState<{name:string;email:string;amount:string;method:string;paymentType:string;paidAt:string;orphan:boolean;pass:number}[]|null>(null);
  const [syncMsg,setSyncMsg]=useState<string|null>(null);
  const [timelineSyncLoading,setTimelineSyncLoading]=useState(false);

  async function syncTimeline(){
    setTimelineSyncLoading(true);
    try{
      const res=await fetch("/api/admin/sessions/sync-sent-invoices",{method:"POST"});
      const json=await res.json();
      if(!res.ok){showToast(json.error??"Gmail sync failed",false);return;}
      showToast(json.message??"Timeline synced from Gmail ✓");
      fetchInquiries();
    }catch{showToast("Gmail sync failed",false);}
    finally{setTimelineSyncLoading(false);}
  }

  async function syncPayments(){
    setSyncLoading(true);setSyncResult(null);setSyncMsg(null);
    try{
      const res=await fetch("/api/sync-payments",{method:"POST"});
      const json=await res.json();
      if(!res.ok){setSyncMsg(json.error??"Sync failed");return;}
      if(json.message){setSyncMsg(json.message);}
      setSyncResult(json.staged??[]);
    }catch{setSyncMsg("Sync request failed");}
    finally{setSyncLoading(false);}
  }

  // ── Gmail ─────────────────────────────────────────────────────────────────
  const [gmailConnected,setGmailConnected]=useState(false);
  const [gmailEmail,setGmailEmail]=useState<string|null>(null);
  const [gmailLoading,setGmailLoading]=useState(false);
  type InboxThread={threadId:string;fromName:string;fromEmail:string;subject:string;snippet:string;timestamp:number;messageCount:number;isUnread:boolean};
  const [inboxThreads,setInboxThreads]=useState<InboxThread[]>([]);
  const [dismissedThreadIds,setDismissedThreadIds]=useState<Set<string>>(()=>{
    try{const s=localStorage.getItem("dismissed_inbox_threads");return new Set(s?JSON.parse(s):[]);}catch{return new Set();}
  });
  const [inboxLoading,setInboxLoading]=useState(false);
  const [blockedSenders,setBlockedSenders]=useState<string[]>([]);
  const [blockedSendersLoading,setBlockedSendersLoading]=useState(false);
  const [blockedSendersOpen,setBlockedSendersOpen]=useState(false);
  const [blockingSender,setBlockingSender]=useState<string|null>(null);
  // inbox thread reply panels — keyed by threadId string
  const [inboxReplyOpen,setInboxReplyOpen]=useState<Record<string,boolean>>({});
  const [inboxContext,setInboxContext]=useState<Record<string,string>>({});
  const [inboxDraft,setInboxDraft]=useState<Record<string,string>>({});
  const [inboxDraftLoading,setInboxDraftLoading]=useState<Record<string,boolean>>({});
  const [inboxSendLoading,setInboxSendLoading]=useState<Record<string,boolean>>({});
  // freeform compose
  const [freeComposeOpen,setFreeComposeOpen]=useState(false);
  const [freeComposeTo,setFreeComposeTo]=useState("");
  const [freeComposeSubject,setFreeComposeSubject]=useState("");
  const [freeComposeBody,setFreeComposeBody]=useState("");
  const [freeComposePolishing,setFreeComposePolishing]=useState(false);
  const [freeComposeSending,setFreeComposeSending]=useState(false);

  const [composeOpen,setComposeOpen]=useState<Record<number,boolean>>({});
  const [composeSubject,setComposeSubject]=useState<Record<number,string>>({});
  // Inquiry ids whose subject the user edited — never auto-regenerated after that.
  const [composeSubjectEdited,setComposeSubjectEdited]=useState<Record<number,boolean>>({});
  const [composeBody,setComposeBody]=useState<Record<number,string>>({});
  const [sendLoading,setSendLoading]=useState<number|null>(null);
  const [sendSuccess,setSendSuccess]=useState<number|null>(null);


  async function generateDraft(inq:Inquiry, feedback?:string){
    setDraftLoading(inq.id);
    try{
      const payload:Record<string,string|null>={name:inq.name,email:inq.email,phone:inq.phone,session_type:inq.session_type,date_in_mind:inq.date_in_mind,message:inq.message,school:inq.school,people:inq.people,preferred_time:inq.preferred_time,location:inq.location,instagram:inq.instagram};
      if(feedback&&drafts[inq.id]){payload.previous_draft=drafts[inq.id];payload.feedback=feedback;}
      const res=await fetch("/api/draft-reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const json=await res.json();
      if(json.draft){
        setDrafts(p=>({...p,[inq.id]:json.draft}));
        setOriginalAiDrafts(p=>({...p,[inq.id]:json.draft}));
        setDraftFeedback(p=>({...p,[inq.id]:""}));
        // Persist to localStorage so the conversation thread page picks it up automatically
        localStorage.setItem(`draft_${inq.id}`, json.draft);
        localStorage.setItem(`ai_draft_${inq.id}`, json.draft);
      }
      else{showToast(json.error??"Draft failed",false);}
    }catch(e){showToast("Draft request failed",false);console.error(e);}
    finally{setDraftLoading(null);}
  }

  function copyDraft(id:number){
    const text=drafts[id];
    if(!text)return;
    navigator.clipboard.writeText(text).then(()=>{setDraftCopied(id);setTimeout(()=>setDraftCopied(null),2000);});
  }

  async function saveRuleFromFeedback(id:number){
    const fb=draftFeedback[id]?.trim();
    if(!fb)return;
    try{
      await fetch("/api/vault/update-rules",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({new_rules:[fb]}),
      });
      setRuleSaved(id);
      setTimeout(()=>setRuleSaved(null),2500);
      showToast("Rule saved to Obsidian vault ✓");
    }catch{
      showToast("Failed to save rule to vault",false);
    }
  }

  async function analyzeAndLearn(inq:Inquiry){
    // originalAiDrafts is React state — lost on page refresh.
    // Fall back to localStorage where the original AI draft is persisted.
    const ai_draft=originalAiDrafts[inq.id]
      ??localStorage.getItem(`ai_draft_${inq.id}`)
      ??undefined;
    const actual=actualSent[inq.id]?.trim();
    if(!actual){showToast("Paste the email you actually sent first",false);return;}
    if(!ai_draft){showToast("No original AI draft found — generate a draft first, then edit and learn from it",false);return;}
    if(ai_draft.trim()===actual){showToast("The two drafts are identical — paste the email you actually sent (after your edits)",false);return;}
    setLearnLoading(inq.id);
    try{
      const res=await fetch("/api/draft-reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:inq.name,email:inq.email,message:inq.message,ai_draft,actual_sent:actual})});
      const json=await res.json() as {rules?:string[];written?:number;error?:string};
      if(json.rules?.length){
        setLearnedRules(p=>({...p,[inq.id]:json.rules!}));
        const written=json.written??0;
        const msg=written===0
          ?"Rules already in vault — nothing new to add"
          :`✓ ${written} new rule${written===1?"":"s"} saved to Obsidian vault`;
        showToast(msg,written>0);
      }else if(json.error){showToast(json.error,false);}
      else{showToast("No differences found — drafts may be very similar",false);}
    }catch(e){showToast("Analysis failed",false);console.error(e);}
    finally{setLearnLoading(null);}
  }

  async function fetchGmailStatus(){
    try{
      const res=await fetch("/api/gmail/status");
      const json=await res.json();
      setGmailConnected(json.connected??false);
      setGmailEmail(json.email??null);
    }catch{setGmailConnected(false);}
  }

  async function fetchInbox(){
    setInboxLoading(true);
    try{
      const res=await fetch("/api/gmail/inbox?limit=20");
      const json=await res.json();
      setInboxThreads(json.threads??[]);
    }catch{setInboxThreads([]);}
    finally{setInboxLoading(false);}
  }

  async function fetchBlockedSenders(){
    setBlockedSendersLoading(true);
    try{
      const res=await fetch("/api/gmail/blocked-senders");
      const json=await res.json();
      setBlockedSenders(json.senders??[]);
    }catch{
      setBlockedSenders([]);
    }finally{
      setBlockedSendersLoading(false);
    }
  }

  async function blockInboxSender(thread:InboxThread){
    const sender=thread.fromEmail.toLowerCase();
    setBlockingSender(sender);
    try{
      const res=await fetch("/api/gmail/blocked-senders",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email:sender}),
      });
      const json=await res.json();
      if(!res.ok){showToast(json.error??"Could not block sender",false);return;}
      setBlockedSenders(json.senders??[]);
      setInboxThreads(prev=>prev.filter(item=>item.fromEmail.toLowerCase()!==sender));
      setInboxReplyOpen(prev=>Object.fromEntries(Object.entries(prev).filter(([threadId])=>threadId!==thread.threadId)));
      showToast("Sender hidden from Studio Admin inbox ✓");
    }catch{
      showToast("Could not block sender",false);
    }finally{
      setBlockingSender(null);
    }
  }

  async function unblockInboxSender(email:string){
    const sender=email.toLowerCase();
    setBlockingSender(sender);
    try{
      const res=await fetch("/api/gmail/blocked-senders",{
        method:"DELETE",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({email:sender}),
      });
      const json=await res.json();
      if(!res.ok){showToast(json.error??"Could not unblock sender",false);return;}
      setBlockedSenders(json.senders??[]);
      showToast("Sender restored to Studio Admin inbox ✓");
      fetchInbox();
    }catch{
      showToast("Could not unblock sender",false);
    }finally{
      setBlockingSender(null);
    }
  }

  async function createInquiryFromThread(t:InboxThread){
    // Check if an inquiry already exists for this email to avoid duplicates
    const existing=inquiries.find(i=>i.email.toLowerCase()===t.fromEmail.toLowerCase());
    if(existing)return existing;
    const row={
      name:t.fromName||t.fromEmail.split("@")[0],
      email:t.fromEmail.toLowerCase(),
      phone:null,session_type:null,session_date:null,date_in_mind:null,
      message:`Subject: ${t.subject}\n\n${t.snippet}`,
      status:"manual",payment_status:null,booking_confirmed:null,
    };
    try{
      const data=await createAdminInquiry(row);
      setInquiries(p=>[data,...p]);
      showToast(`Client card created for ${row.name} ✓`);
      return data;
    }catch(error){
      console.error("createInquiryFromThread",error);
      showToast("Could not create client card",false);
      return null;
    }
  }

  async function generateInboxDraft(t:InboxThread){
    setInboxDraftLoading(p=>({...p,[t.threadId]:true}));
    try{
      const payload={
        name:t.fromName,email:t.fromEmail,
        message:`Subject: ${t.subject}\n\n${inboxContext[t.threadId]??t.snippet}`,
        session_type:null,date_in_mind:null,phone:null,
      };
      const res=await fetch("/api/draft-reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const json=await res.json();
      if(json.draft)setInboxDraft(p=>({...p,[t.threadId]:json.draft}));
      else showToast(json.error??"Draft failed",false);
    }catch{showToast("Draft failed",false);}
    finally{setInboxDraftLoading(p=>({...p,[t.threadId]:false}));}
  }

  async function sendInboxReply(t:InboxThread){
    const body=inboxDraft[t.threadId]?.trim();
    const subject=`Re: ${t.subject}`;
    if(!body)return;
    setInboxSendLoading(p=>({...p,[t.threadId]:true}));
    try{
      const res=await fetch("/api/gmail/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:t.fromEmail,subject,body})});
      const json=await res.json();
      if(json.ok){
        showToast(`Reply sent to ${t.fromName} ✓`);
        setInboxReplyOpen(p=>({...p,[t.threadId]:false}));
        setInboxDraft(p=>({...p,[t.threadId]:""}));
        setInboxThreads(p=>p.filter(x=>x.threadId!==t.threadId));
      }else{showToast(json.error??"Send failed",false);}
    }catch{showToast("Send failed",false);}
    finally{setInboxSendLoading(p=>({...p,[t.threadId]:false}));}
  }

  async function dismissUnreadThread(threadId:string){
    setDismissedThreadIds(prev=>{
      const next=new Set(prev);
      next.add(threadId);
      try{localStorage.setItem("dismissed_inbox_threads",JSON.stringify([...next]));}catch{}
      return next;
    });
    setInboxThreads(p=>p.map(t=>t.threadId===threadId?{...t,isUnread:false}:t));
    try{
      await fetch("/api/gmail/mark-read",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({threadId})});
    }catch{/* best-effort */}
  }

  async function polishFreeCompose(){
    if(!freeComposeBody.trim())return;
    setFreeComposePolishing(true);
    try{
      const payload={name:freeComposeTo||"",email:freeComposeTo,message:freeComposeBody,session_type:null,date_in_mind:null,phone:null};
      const res=await fetch("/api/draft-reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      const json=await res.json();
      if(json.draft)setFreeComposeBody(json.draft);
      else showToast(json.error??"Polish failed",false);
    }catch{showToast("Polish failed",false);}
    finally{setFreeComposePolishing(false);}
  }

  async function sendFreeCompose(){
    if(!freeComposeTo.trim()||!freeComposeSubject.trim()||!freeComposeBody.trim()){showToast("Fill in all fields",false);return;}
    setFreeComposeSending(true);
    try{
      const res=await fetch("/api/gmail/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:freeComposeTo.trim(),subject:freeComposeSubject.trim(),body:freeComposeBody.trim()})});
      const json=await res.json();
      if(json.ok){
        showToast("Email sent ✓");
        setFreeComposeOpen(false);
        setFreeComposeTo("");setFreeComposeSubject("");setFreeComposeBody("");
      }else{showToast(json.error??"Send failed",false);}
    }catch{showToast("Send failed",false);}
    finally{setFreeComposeSending(false);}
  }

  async function disconnectGmail(){
    if(!confirm("Disconnect Gmail? You'll need to reconnect to send emails from here."))return;
    await fetch("/api/gmail/status",{method:"DELETE"});
    setGmailConnected(false);setGmailEmail(null);
    showToast("Gmail disconnected");
  }

  function openCompose(inq:Inquiry){
    const draft=drafts[inq.id]??"";
    // Regenerate from the latest inquiry data unless the user edited the subject.
    setComposeSubject(p=>({...p,[inq.id]:composeSubjectEdited[inq.id]&&p[inq.id]?p[inq.id]:buildInquiryReplySubject(inq)}));
    setComposeBody(p=>({...p,[inq.id]:p[inq.id]??draft}));
    setComposeOpen(p=>({...p,[inq.id]:true}));
  }

  async function sendEmail(inq:Inquiry){
    const subject=composeSubject[inq.id]?.trim();
    const body=composeBody[inq.id]?.trim();
    if(!subject||!body)return;
    setSendLoading(inq.id);
    try{
      const res=await fetch("/api/gmail/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:inq.email,subject,body})});
      const json=await res.json();
      if(json.ok){
        setSendSuccess(inq.id);
        setComposeOpen(p=>({...p,[inq.id]:false}));
        markInquiryReplied(inq);
        showToast(`Email sent to ${inq.name} ✓`);
        setTimeout(()=>setSendSuccess(null),3000);
      }else{
        showToast(json.error??"Send failed",false);
      }
    }catch(e){showToast("Send failed — check console",false);console.error(e);}
    finally{setSendLoading(null);}
  }

  // Sending an email from the app IS the reply — reflect it immediately
  // instead of waiting for the next Gmail reconciliation pass.
  async function markInquiryReplied(inq:Inquiry){
    const now=new Date().toISOString();
    try{
      const updated=await updateAdminInquiry(inq.id,{
        status:"responded",
        status_source:"automatic",
        needs_reply:false,
        reply_sent_at:inq.reply_sent_at??now,
        last_outbound_at:now,
        last_message_at:now,
        last_message_direction:"outbound",
      });
      setInquiries(p=>p.map(x=>x.id===inq.id?updated:x));
    }catch(error){
      console.error("[admin] markInquiryReplied",error);
    }
  }

  function showToast(msg:string,ok=true){setToast({msg,ok});setTimeout(()=>setToast(null),3000);}

  async function getAdminSessionsHeaders(includeJson=false){
    const headers:Record<string,string>={};
    const{data}=await supabase.auth.getSession();
    const token=data.session?.access_token;
    if(token)headers.Authorization=`Bearer ${token}`;
    if(includeJson)headers["Content-Type"]="application/json";
    return Object.keys(headers).length?{headers}:undefined;
  }

  async function fetchInquiries(){
    setInquiriesLoading(true);
    const paymentsReq = fetch("/api/admin/payments")
      .then(res => res.json() as Promise<{ payments?: AdminPaymentSummaryRow[]; error?: string }>)
      .catch(err => {
        console.error("[admin] payments summary failed", err);
        return { payments: [] };
      });
    const [inquiryRows, paymentJson] = await Promise.all([
      loadAdminInquiries().catch(err => {
        console.error("[admin] inquiries load failed",err);
        showToast("Failed to load inquiries",false);
        return [];
      }),
      paymentsReq,
    ]);
    const paymentRows = paymentJson.payments ?? [];
    const dep2 = paymentRows.filter(p => p.payment_type === "deposit_2" && p.inquiry_id);
    const dep1 = paymentRows.filter(p => p.payment_type === "deposit_1");
    setInquiries(inquiryRows);
    setFinalPaymentIds(new Set(dep2.map(p => p.inquiry_id).filter((id): id is number => typeof id === "number")));
    const d1Map = new Map<number,string>();
    const emailAmt = new Map<string,string>();
    dep1.forEach(p => {
      const a = p.amount?.replace(/[^0-9.]/g,"");
      if(!a)return;
      if(p.inquiry_id)d1Map.set(p.inquiry_id,a);
      if(p.client_email)emailAmt.set(p.client_email.toLowerCase(),a);
    });
    inquiryRows.forEach((inq:{id:number;email:string;payment_note:string|null})=>{
      if(d1Map.has(inq.id))return;
      const byEmail=emailAmt.get(inq.email?.toLowerCase());
      if(byEmail){d1Map.set(inq.id,byEmail);return;}
      const m=inq.payment_note?.match(/\$?([\d,]+(?:\.\d{1,2})?)/);
      if(m)d1Map.set(inq.id,m[1].replace(/,/g,""));
    });
    setDeposit1Amounts(d1Map);
    setInquiriesLoading(false);
  }

  async function handleFinalPayment(id:number,amount:string,method:string){
    const inq=inquiries.find(i=>i.id===id);
    const res=await fetch("/api/admin/record-final-payment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({inquiry_id:id,client_name:inq?.name??'',client_email:inq?.email??'',amount,method})});
    const json=await res.json() as {ok?:boolean;error?:string};
    if(!res.ok){showToast(json.error??"Failed to record payment",false);return;}
    setFinalPaymentIds(prev=>new Set([...prev,id]));
    showToast(`Final payment recorded for ${inq?.name??'client'} ✓`);
  }
  async function recordCardPayment(id:number){
    setCardPaymentSaving(true);
    await handleFinalPayment(id,cardPaymentAmount,cardPaymentMethod);
    setCardPaymentSaving(false);
    setCardPaymentId(null);
    setCardPaymentAmount("");
    setCardPaymentMethod("Venmo");
  }
  async function fetchPortalSessions(){
    setPortalSessionsLoading(true);
    try{
      const res=await fetch("/api/admin/sessions",await getAdminSessionsHeaders());
      const json=await res.json() as AdminSessionsResponse;
      if(!res.ok){showToast(json.error??"Failed to load portal sessions",false);return;}
      setPortalSessions(json.sessions??[]);
    }catch(e){
      console.error("[admin] fetchPortalSessions",e);
      showToast("Failed to load portal sessions",false);
    }finally{
      setPortalSessionsLoading(false);
    }
  }
  async function deleteInquiry(id:number){
    try{
      await deleteAdminInquiry(id);
      setInquiries(p=>p.filter(x=>x.id!==id));
      setInquiryDeleteConfirm(null);
      showToast("Inquiry deleted");
    }catch(error){
      console.error("[admin] deleteInquiry",error);
      showToast("Delete failed",false);
    }
  }
  // Status changes from the UI buttons are manual overrides — timeline sync
  // must never undo them. Programmatic paths (e.g. after sending an email)
  // pass "automatic" so sync keeps reconciling those rows.
  async function updateInquiryStatus(id:number,status:string,source:"manual"|"automatic"="manual"){
    try{
      const updated=await updateAdminInquiry(id,{status,status_source:source});
      setInquiries(p=>p.map(x=>x.id===id?updated:x));
      showToast("Status updated");
    }catch(error){
      console.error("[admin] updateInquiryStatus",error);
      showToast("Update failed",false);
    }
  }
  async function saveSessionType(id:number,value:string){
    try{
      const updated=await updateAdminInquiry(id,{session_type:value.trim()||null});
      setInquiries(p=>p.map(x=>x.id===id?updated:x));
      setEditingSessionType(null);
      showToast("Session type updated ✓");
    }catch(error){
      console.error("[admin] saveSessionType",error);
      showToast("Update failed",false);
    }
  }
  async function rescheduleSession(id:number,datetimeLocal:string){
    // datetimeLocal is "YYYY-MM-DDTHH:mm" from datetime-local input
    const date=new Date(datetimeLocal);
    if(isNaN(date.getTime())){showToast("Invalid date",false);return;}
    const sessionDate=`${datetimeLocal.slice(0,10)}`;
    const preferredTime=new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(date);
    try{
      const updated=await updateAdminInquiry(id,{session_date:sessionDate,preferred_time:preferredTime});
      setInquiries(p=>p.map(x=>x.id===id?updated:x));
      showToast("Session rescheduled ✓");
    }catch(error){
      console.error("[admin] rescheduleSession",error);
      showToast("Could not reschedule",false);
    }
  }
  async function saveManualClient(){
    const{name,email,session_type,session_date,phone,message}=addClientForm;
    if(!name.trim()||!email.trim()){showToast("Name and email are required",false);return;}
    setAddClientSaving(true);
    const row={name:name.trim(),email:email.trim().toLowerCase(),phone:phone.trim()||null,session_type:session_type.trim()||null,session_date:session_date||null,message:message.trim()||"Added manually from Instagram DM",status:"manual",payment_status:null,booking_confirmed:null,date_in_mind:null};
    try{
      const data=await createAdminInquiry(row);
      setInquiries(p=>[data,...p]);
      setAddClientForm(EMPTY_CLIENT);
      setAddClientOpen(false);
      showToast(`${name} added ✓`);
    }catch(error){
      console.error("[admin] saveManualClient",error);
      showToast("Failed to add client",false);
    }finally{
      setAddClientSaving(false);
    }
  }

  async function saveCalendarEvent(){
    const{name,email,session_type,session_date,session_time,location,phone,notes}=addEventForm;
    if(!name.trim()||!email.trim()){showToast("Name and email are required",false);return;}
    if(!session_date){showToast("Session date is required",false);return;}
    setAddEventSaving(true);
    const row={name:name.trim(),email:email.trim().toLowerCase(),phone:phone.trim()||null,session_type:session_type.trim()||null,session_date,preferred_time:session_time||null,location:location.trim()||null,message:notes.trim()||"Added manually from calendar",status:"manual",payment_status:addEventForm.payment_received?"paid":null,booking_confirmed:addEventForm.payment_received,date_in_mind:session_date};
    try{
      const data=await createAdminInquiry(row);
      setInquiries(p=>[data,...p]);
      setAddEventForm(EMPTY_EVENT);
      setAddEventOpen(false);
      showToast(`${name} added to calendar ✓`);
    }catch(error){
      console.error("[admin] saveCalendarEvent",error);
      showToast("Failed to add event",false);
    }finally{
      setAddEventSaving(false);
    }
  }

  function replacePortalSession(next:AdminClientSessionDTO){
    setPortalSessions(prev=>{
      const index=prev.findIndex(item=>item.id===next.id);
      if(index===-1)return[next,...prev];
      return prev.map(item=>item.id===next.id?next:item);
    });
  }

  function getPortalMatchInput(inquiry:Inquiry){
    return{
      clientEmail:inquiry.email,
      sessionType:inquiry.session_type,
      sessionDate:inquiry.session_date??inquiry.date_in_mind,
    };
  }

  function getPortalSessionForInquiry(inquiry:Inquiry):AdminClientSessionDTO|null{
    return findMatchingClientSession(portalSessions,getPortalMatchInput(inquiry)) as AdminClientSessionDTO|null;
  }

  function isPortalMatchAmbiguous(inquiry:Inquiry){
    const matches=getClientSessionEmailMatches(portalSessions,inquiry.email);
    return matches.length>1&&!getPortalSessionForInquiry(inquiry);
  }

  function getEffectivePortalStatus(inquiry:Inquiry,portalSession:AdminClientSessionDTO|null):ClientSessionStatus{
    const stored=portalSession?.currentStatus??"inquiry_received";
    const paid=inquiry.payment_status==="paid";
    const statusIndex=CLIENT_SESSION_STATUS_VALUES.indexOf(stored);
    const bookedIndex=CLIENT_SESSION_STATUS_VALUES.indexOf("booked");
    if(paid&&statusIndex<bookedIndex)return"booked";
    if(!paid&&statusIndex===bookedIndex)return"booking_in_progress";
    return stored;
  }

  async function updatePortalStatusFromInquiry(inquiry:Inquiry,status:ClientSessionStatus){
    if(isPortalMatchAmbiguous(inquiry)){
      showToast("This client has multiple portal sessions. Open Client Sessions to update the right one.",false);
      return;
    }

    const existing=getPortalSessionForInquiry(inquiry);
    const savingKey=`${inquiry.id}:${status}`;
    setPortalStatusSavingKey(savingKey);

    try{
      const res=await fetch("/api/admin/sessions",{
        method:"PATCH",
        ...(await getAdminSessionsHeaders(true)),
        body:JSON.stringify({
          quickStatusUpdate:true,
          id:existing?.id,
          clientEmail:inquiry.email,
          clientName:inquiry.name,
          sessionType:inquiry.session_type,
          sessionDate:inquiry.session_date??inquiry.date_in_mind,
          location:inquiry.location,
          invoiceStatus:inquiry.invoice_sent_at?"sent":null,
          contractStatus:inquiry.contract_sent_at?"sent":null,
          currentStatus:status,
        }),
      });
      const json=await res.json() as AdminSessionsResponse;
      if(!res.ok||!json.session){showToast(json.error??"Portal update failed",false);return;}
      replacePortalSession(json.session);
      showToast(`Portal updated to ${CLIENT_SESSION_STATUS_LABELS[status]} ✓`);
    }catch(e){
      console.error("[admin] updatePortalStatusFromInquiry",e);
      showToast("Portal update failed",false);
    }finally{
      setPortalStatusSavingKey(null);
    }
  }

  function isSetupMissing(error:{code?:string;message?:string}|null){const message=error?.message?.toLowerCase()??"";return error?.code==="42P01"||error?.code==="42703"||message.includes("does not exist")||message.includes("schema cache");}

  async function fetchSiteSettings(){
    // Server route returns only the non-secret editable allowlist (never tokens).
    try{
      const res=await fetch('/api/admin/site-settings');
      if(!res.ok)return;
      const json=await res.json();
      setSiteSettings(json.settings??{});
    }catch{/* leave settings as-is on failure */}
  }

  async function onBatchFiles(e:React.ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files??[]);
    if(batchFileRef.current)batchFileRef.current.value=""; // allow re-selecting the same files
    if(!files.length)return;
    const defaultCat=categories[0]?.slug??"grads";
    // Skip files whose content already exists in the queue or in the saved library.
    const seen=new Set<string>([...batchItems.map(i=>i.hash),...portfolioImages.map(i=>i.content_hash).filter(Boolean) as string[]]);
    const additions:BatchItem[]=[];
    let dupes=0;
    for(const f of files){
      const hash=await fileHash(f);
      if(seen.has(hash)){dupes++;continue;}
      seen.add(hash);
      additions.push({id:batchIdRef.current++,file:f,preview:URL.createObjectURL(f),category_slug:defaultCat,title:f.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," "),location:"",hash});
    }
    if(additions.length)setBatchItems(prev=>[...prev,...additions]);
    if(dupes>0)showToast(`Skipped ${dupes} duplicate photo${dupes!==1?"s":""}`,true);
  }

  // ── Batch selection + bulk category/location assignment ──
  const allBatchSelected=batchItems.length>0&&batchSelected.size===batchItems.length;
  // Reusable location suggestions: every location already saved on a photo, plus any typed in this session.
  const locationOptions=Array.from(new Set([...portfolioImages.map(i=>i.location),...batchItems.map(i=>i.location)].map(l=>(l??"").trim()).filter(Boolean))).sort();
  function clearBatchSelection(){setBatchSelected(new Set());batchAnchorRef.current=null;}
  function toggleBatchSelect(id:number){setBatchSelected(prev=>{const next=new Set(prev);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  function toggleSelectAllBatch(){if(allBatchSelected)clearBatchSelection();else setBatchSelected(new Set(batchItems.map(item=>item.id)));}
  function removeBatchItem(id:number){setBatchItems(prev=>prev.filter(item=>item.id!==id));setBatchSelected(prev=>{const next=new Set(prev);next.delete(id);return next;});}
  // Shift+click selects the whole range from the last toggled checkbox to this one.
  function onBatchCheckboxClick(e:React.MouseEvent,index:number,id:number){
    if(e.shiftKey&&batchAnchorRef.current!==null){
      const [a,b]=[batchAnchorRef.current,index].sort((x,y)=>x-y);
      const rangeIds=batchItems.slice(a,b+1).map(item=>item.id);
      setBatchSelected(prev=>{const next=new Set(prev);rangeIds.forEach(rid=>next.add(rid));return next;});
    }else{
      toggleBatchSelect(id);
    }
    batchAnchorRef.current=index;
  }
  // Targets the checked photos, or every queued photo when none are checked.
  function batchTargets(){return batchSelected.size===0?batchItems.map(i=>i.id):batchSelected;}
  // Sets category and location together in one pass. Location is only applied when typed,
  // so leaving it blank keeps each photo's existing location instead of wiping it.
  function applyBulkTags(){
    const cat=bulkCategory||categories[0]?.slug;
    if(!cat){showToast("Add a category first",false);return;}
    const loc=bulkLocation.trim();
    const targets=new Set(batchTargets());
    setBatchItems(prev=>prev.map(item=>targets.has(item.id)?{...item,category_slug:cat,...(loc?{location:loc}:{})}:item));
    showToast(`Updated ${targets.size} photo${targets.size!==1?"s":""}`);
    clearBatchSelection(); // deselect so you can move on to the next group
  }
  // Removes every checked photo from the queue at once (Shift-click selects a range first).
  function removeSelectedBatch(){
    if(batchSelected.size===0)return;
    const ids=new Set(batchSelected);
    const removed=ids.size;
    setBatchItems(prev=>prev.filter(item=>!ids.has(item.id)));
    clearBatchSelection();
    showToast(`Removed ${removed} photo${removed!==1?"s":""} from the queue`);
  }

  async function saveBatchImages(){
    if(!batchItems.length){showToast("No images queued",false);return;}
    setBatchSaving(true);
    // Upload all files in parallel (5 at a time) — the old one-at-a-time loop was the bottleneck.
    const uploads=await mapWithConcurrency(batchItems,5,async item=>({item,url:await uploadImage(item.file,"portfolio",showToast)}));
    const base=portfolioImages.length;
    const rows=uploads.filter(u=>u.url).map((u,idx)=>{
      const cat=categories.find(c=>c.slug===u.item.category_slug);
      return {title:u.item.title||"Portfolio image",alt:u.item.title||"Portfolio image",image_url:u.url,category_id:cat?.id??null,category_slug:u.item.category_slug,location:u.item.location.trim()||null,content_hash:u.item.hash,featured:false,sort_order:base+idx+1};
    });
    let saved=0;
    if(rows.length){
      // Single bulk insert instead of one request per photo (service-role API).
      const res=await fetch('/api/admin/portfolio-images',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(rows)});
      if(!res.ok){const j=await res.json().catch(()=>({}));showToast("Some photos failed to save — "+(j.error||""),false);}else saved=rows.length;
    }
    if(saved<batchItems.length)showToast(`${batchItems.length-saved} photo${batchItems.length-saved!==1?"s":""} failed to upload`,false);
    setBatchSaving(false);
    setBatchItems([]);
    clearBatchSelection();
    if(saved>0){showToast(`${saved} image${saved!==1?"s":""} uploaded`);fetchPortfolioImages();revalidatePublicSite();}
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
      const res=await fetch('/api/admin/portfolio-images',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({title:p.caption||"Graduation portrait",alt:p.caption||"Bay Area graduation portrait by Chris Solorzano",image_url:p.image_url,category_id:gradCat?.id??null,category_slug:"grads",featured:i<6,sort_order:portfolioImages.length+count+1})});
      if(res.ok)count++;
    }
    setImporting(false);
    showToast(`${count} grad photo${count!==1?"s":""} imported`);
    fetchPortfolioImages();
    if(count>0)revalidatePublicSite();
  }

  // Fire-and-forget: refresh the cached public marketing pages after a content
  // change so edits show up immediately instead of waiting for hourly ISR.
  function revalidatePublicSite(){fetch("/api/admin/revalidate",{method:"POST"}).catch(()=>{});}

  async function updateSiteSetting(key:string,value:string|null){
    setSettingsSaving(key);
    try{
      // value null → clear the setting (DELETE); otherwise upsert via PUT.
      const res=value===null
        ? await fetch('/api/admin/site-settings',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({key})})
        : await fetch('/api/admin/site-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value})});
      if(!res.ok){const j=await res.json().catch(()=>({}));showToast(j.error||"Couldn't update photo selection",false);return;}
      setSiteSettings(prev=>({...prev,[key]:value}));
      setCoverPickerKey(null);
      revalidatePublicSite();
      showToast("Photo selection updated");
    }catch{
      showToast("Couldn't update photo selection",false);
    }finally{
      setSettingsSaving(null);
    }
  }

  // ── Work-grid batch picker ──
  function openGridBatch(){setGridBatchOpen(o=>!o);setGridBatchPick([]);gridBatchAnchorRef.current=null;}
  // Click adds/removes a photo in pick order; Shift-click adds the whole range (list order) up to 6.
  function onGridPickClick(e:React.MouseEvent,index:number){
    const url=portfolioImages[index].image_url;
    if(e.shiftKey&&gridBatchAnchorRef.current!==null){
      const [a,b]=[gridBatchAnchorRef.current,index].sort((x,y)=>x-y);
      const next=[...gridBatchPick];
      for(let i=a;i<=b&&next.length<WORK_GRID_KEYS.length;i++){
        const u=portfolioImages[i].image_url;
        if(!next.includes(u))next.push(u);
      }
      setGridBatchPick(next);
    }else if(gridBatchPick.includes(url)){
      setGridBatchPick(gridBatchPick.filter(x=>x!==url));
    }else if(gridBatchPick.length>=WORK_GRID_KEYS.length){
      showToast(`That's all ${WORK_GRID_KEYS.length} slots — deselect one first`,false);
    }else{
      setGridBatchPick([...gridBatchPick,url]);
    }
    gridBatchAnchorRef.current=index;
  }
  async function applyWorkGridBatch(){
    const picks=gridBatchPick;
    if(picks.length===0){showToast("Pick at least one photo",false);return;}
    setGridBatchSaving(true);
    const updates:Record<string,string>={};
    let fail=0;
    for(let i=0;i<picks.length;i++){
      const key=WORK_GRID_KEYS[i];
      try{
        const res=await fetch('/api/admin/site-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({key,value:picks[i]})});
        if(!res.ok)throw new Error();
        updates[key]=picks[i];
      }catch{fail++;}
    }
    setSiteSettings(prev=>({...prev,...updates}));
    setGridBatchSaving(false);
    revalidatePublicSite();
    if(fail===0){
      setGridBatchOpen(false);
      setGridBatchPick([]);
      gridBatchAnchorRef.current=null;
      showToast(`Set ${picks.length} work grid photo${picks.length!==1?"s":""} ✓`);
    }else{
      showToast(`${picks.length-fail} set, ${fail} failed`,false);
    }
  }

  async function fetchCategories(){
    setCategoriesLoading(true);
    const{data,error}=await supabase.from('portfolio_categories').select('*').order('sort_order',{ascending:true});
    if(error&&!isSetupMissing(error))console.error(error);
    if(data)setCategories(data);
    setCategoriesLoading(false);
  }
  function onLibraryFilePick(e:React.ChangeEvent<HTMLInputElement>){
    const files=Array.from(e.target.files??[]);
    if(!files.length)return;
    setLibraryUploadPreviews(prev=>[...prev,...files.map(f=>({file:f,preview:URL.createObjectURL(f)}))]);
    if(libraryUploadRef.current)libraryUploadRef.current.value="";
  }
  function removeLibraryPreview(i:number){
    setLibraryUploadPreviews(p=>p.filter((_,j)=>j!==i));
  }
  async function uploadLibraryFiles(){
    if(!libraryUploadPreviews.length)return;
    setLibraryUploading(true);
    let saved=0;
    for(const{file}of libraryUploadPreviews){
      const url=await uploadImage(file,"library",showToast);
      if(!url)continue;
      const title=file.name.replace(/\.[^.]+$/,"").replace(/[-_]/g," ")||"Library photo";
      const res=await fetch('/api/admin/library-images',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({
        title,alt:title,image_url:url,
        source_type:"manual",source_role:"gallery",in_portfolio:false,
      })});
      if(res.ok)saved++;
    }
    setLibraryUploadPreviews([]);
    setLibraryUploading(false);
    if(saved>0){showToast(`${saved} photo${saved>1?"s":""} added to library!`);fetchLibraryImages();}
    else showToast("Upload failed",false);
  }

  async function fetchLibraryImages(){
    setLibraryLoading(true);
    const res=await fetch('/api/admin/library-images',{credentials:'include'});
    const json=await res.json().catch(()=>({}));
    if(res.ok&&Array.isArray(json.images))setLibraryImages(json.images);
    else if(!res.ok)console.error(json.error);
    setLibraryLoading(false);
  }
  async function pushLibraryImageToPortfolio(row:ImageLibraryRow){
    setLibraryPushingId(row.id);
    const cat=categories.find(c=>c.slug===libraryPushCategory);
    const res=await fetch('/api/admin/portfolio-images',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({
      title:row.title,
      alt:row.alt||row.title,
      image_url:row.image_url,
      category_id:cat?.id??null,
      category_slug:libraryPushCategory,
      featured:false,
      sort_order:portfolioImages.length+1,
    })});
    if(!res.ok){showToast("Failed to add to portfolio",false);}else{
      await fetch('/api/admin/library-images',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({id:row.id,updates:{in_portfolio:true}})});
      setLibraryImages(p=>p.map(x=>x.id===row.id?{...x,in_portfolio:true}:x));
      fetchPortfolioImages();
      revalidatePublicSite();
      showToast("Added to portfolio!");
    }
    setLibraryPushingId(null);
  }
  async function fetchPortfolioImages(){
    setPortfolioLoading(true);
    const{data,error}=await supabase.from('portfolio_images').select('*').order('featured',{ascending:false}).order('sort_order',{ascending:true});
    if(error&&!isSetupMissing(error))console.error(error);
    if(data)setPortfolioImages(data);
    setPortfolioLoading(false);
  }
  useEffect(()=>{if(authed){fetchCategories();fetchPortfolioImages();fetchLibraryImages();fetchSiteSettings();fetchInquiries();fetchPortalSessions();fetchGmailStatus();fetchInbox();fetchBlockedSenders();}},[authed]);
  useEffect(()=>{if(authed&&(tab==="inquiries"||tab==="clients")){fetchInquiries();fetchPortalSessions();fetchGmailStatus();fetchBlockedSenders();}},[authed,tab]);

  // ── Professional portfolio handlers ──────────────────────────────────
  function categoryName(slug:string){return categories.find(c=>c.slug===slug)?.name??slug;}
  function startEditCategory(category:PortfolioCategory){setEditingCategory(category);setCategoryForm({name:category.name,slug:category.slug,description:category.description??"",sort_order:String(category.sort_order),active:category.active});window.scrollTo({top:0,behavior:"smooth"});}
  function cancelEditCategory(){setEditingCategory(null);setCategoryForm(EMPTY_CATEGORY);}
  async function saveCategory(){
    if(!categoryForm.name||!categoryForm.slug){showToast("Category name and slug required",false);return;}
    setCategorySaving(true);
    const payload={name:categoryForm.name,slug:slugify(categoryForm.slug),description:categoryForm.description||null,sort_order:parseInt(categoryForm.sort_order)||categories.length+1,active:categoryForm.active};
    if(editingCategory){
      const res=await fetch('/api/admin/portfolio-categories',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({id:editingCategory.id,updates:payload})});
      if(!res.ok){const j=await res.json().catch(()=>({}));showToast("Category update failed — "+(j.error||""),false);}else{showToast("Category updated!");cancelEditCategory();fetchCategories();revalidatePublicSite();}
    }else{
      const res=await fetch('/api/admin/portfolio-categories',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(payload)});
      if(!res.ok){const j=await res.json().catch(()=>({}));showToast("Category save failed — "+(j.error||""),false);}else{showToast("Category added!");setCategoryForm(EMPTY_CATEGORY);fetchCategories();revalidatePublicSite();}
    }
    setCategorySaving(false);
  }
  async function deleteCategory(id:number){await fetch(`/api/admin/portfolio-categories?id=${id}`,{method:'DELETE',credentials:'include'});setCategories(p=>p.filter(x=>x.id!==id));setCategoryDeleteConfirm(null);if(editingCategory?.id===id)cancelEditCategory();revalidatePublicSite();showToast("Category deleted");}

  function startEditPortfolioImage(image:PortfolioImage){setEditingPortfolioImage(image);setPortfolioForm({title:image.title,alt:image.alt??"",category_slug:image.category_slug,school:image.school??"",featured:image.featured,sort_order:String(image.sort_order)});setPortfolioFile(null);setPortfolioPreview(image.image_url);window.scrollTo({top:0,behavior:"smooth"});}
  function cancelEditPortfolioImage(){setEditingPortfolioImage(null);setPortfolioForm(EMPTY_PORTFOLIO);setPortfolioFile(null);setPortfolioPreview(null);if(portfolioFileRef.current)portfolioFileRef.current.value="";}
  function onPortfolioFile(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;setPortfolioFile(f);setPortfolioPreview(URL.createObjectURL(f));}
  function startPortfolioSeo(image:PortfolioImage){setPortfolioSeoEditorId(image.id);setPortfolioSeoDraft(EMPTY_PORTFOLIO_SEO_DRAFT);}
  function updatePortfolioImageState(image:PortfolioImage){
    setPortfolioImages(prev=>prev.map(item=>item.id===image.id?image:item));
    if(editingPortfolioImage?.id===image.id){
      setEditingPortfolioImage(image);
      setPortfolioForm(f=>({...f,title:image.title,alt:image.alt??""}));
    }
  }
  async function savePortfolioSeoDescription(image:PortfolioImage){
    if(!portfolioSeoDraft.school&&!portfolioSeoDraft.location){showToast("Pick a school or location first",false);return;}
    setPortfolioSeoSavingId(image.id);
    try{
      const res=await fetch("/api/admin/portfolio-image-description",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({imageId:image.id,...portfolioSeoDraft}),
      });
      const json=await res.json();
      if(!res.ok)throw new Error(json.error||"Description update failed");
      updatePortfolioImageState(json.image as PortfolioImage);
      setPortfolioSeoEditorId(null);
      setPortfolioSeoDraft(EMPTY_PORTFOLIO_SEO_DRAFT);
      revalidatePublicSite();
      showToast("SEO description saved");
    }catch(err){
      console.error("[admin] savePortfolioSeoDescription",err);
      showToast(err instanceof Error?err.message:"Description update failed",false);
    }finally{
      setPortfolioSeoSavingId(null);
    }
  }
  function toggleSeoBatchMode(){
    setSeoBatchMode(m=>!m);
    setSeoBatchSelected([]);
    setSeoBatchOpen(false);
    setPortfolioSeoEditorId(null);
  }
  function toggleSeoBatchSelect(id:number){
    setSeoBatchSelected(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);
  }
  async function saveBatchPortfolioSeo(){
    if(!seoBatchDraft.school&&!seoBatchDraft.location){showToast("Pick a school or location first",false);return;}
    const ids=[...seoBatchSelected];
    if(ids.length===0){showToast("Select at least one photo",false);return;}
    setSeoBatchSaving(true);
    let ok=0,fail=0;
    for(const id of ids){
      setSeoBatchProgress({done:ok+fail,total:ids.length});
      try{
        const res=await fetch("/api/admin/portfolio-image-description",{
          method:"POST",
          headers:{"Content-Type":"application/json"},
          body:JSON.stringify({imageId:id,...seoBatchDraft}),
        });
        const json=await res.json();
        if(!res.ok)throw new Error(json.error||"Description update failed");
        updatePortfolioImageState(json.image as PortfolioImage);
        ok++;
      }catch(err){
        console.error("[admin] saveBatchPortfolioSeo",id,err);
        fail++;
      }
    }
    setSeoBatchProgress(null);
    setSeoBatchSaving(false);
    revalidatePublicSite();
    if(fail===0){
      setSeoBatchOpen(false);
      setSeoBatchMode(false);
      setSeoBatchSelected([]);
      setSeoBatchDraft(EMPTY_PORTFOLIO_SEO_DRAFT);
      showToast(`Tagged ${ok} photo${ok===1?"":"s"} ✓`);
    }else{
      showToast(`Tagged ${ok}, ${fail} failed — check console`,false);
    }
  }
  async function savePortfolioImage(){
    if(!portfolioForm.title){showToast("Portfolio title required",false);return;}
    if(!portfolioFile&&!editingPortfolioImage){showToast("Upload a portfolio image",false);return;}
    setPortfolioSaving(true);
    let image_url=editingPortfolioImage?.image_url??"";
    if(portfolioFile){const url=await uploadImage(portfolioFile,"portfolio",showToast);if(!url){setPortfolioSaving(false);return;}image_url=url;}
    const category=categories.find(c=>c.slug===portfolioForm.category_slug);
    const payload={title:portfolioForm.title,alt:portfolioForm.alt||portfolioForm.title,image_url,category_id:category?.id??null,category_slug:portfolioForm.category_slug,school:portfolioForm.school||null,featured:portfolioForm.featured,sort_order:parseInt(portfolioForm.sort_order)||editingPortfolioImage?.sort_order||portfolioImages.length+1};
    if(editingPortfolioImage){
      const res=await fetch('/api/admin/portfolio-images',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({id:editingPortfolioImage.id,updates:payload})});
      if(!res.ok){const j=await res.json().catch(()=>({}));showToast("Portfolio update failed — "+(j.error||""),false);}else{showToast("Portfolio image updated!");cancelEditPortfolioImage();fetchPortfolioImages();revalidatePublicSite();}
    }else{
      const res=await fetch('/api/admin/portfolio-images',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(payload)});
      if(!res.ok){const j=await res.json().catch(()=>({}));showToast("Portfolio save failed — "+(j.error||""),false);}else{showToast("Portfolio image added!");cancelEditPortfolioImage();fetchPortfolioImages();revalidatePublicSite();}
    }
    setPortfolioSaving(false);
  }
  async function deletePortfolioImage(id:number){await fetch(`/api/admin/portfolio-images?id=${id}`,{method:'DELETE',credentials:'include'});setPortfolioImages(p=>p.filter(x=>x.id!==id));setPortfolioDeleteConfirm(null);if(editingPortfolioImage?.id===id)cancelEditPortfolioImage();revalidatePublicSite();showToast("Portfolio image deleted");}

  async function toggleCarousel(id:number, current:boolean){
    const carouselCount = portfolioImages.filter(i=>i.hero_carousel).length;
    if(!current && carouselCount>=5){showToast("Max 5 carousel images — remove one first",false);return;}
    await fetch('/api/admin/portfolio-images',{method:'PATCH',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({id,updates:{hero_carousel:!current}})});
    setPortfolioImages(p=>p.map(x=>x.id===id?{...x,hero_carousel:!current}:x));
    revalidatePublicSite();
    showToast(!current?"Added to carousel":"Removed from carousel");
  }

  function slugify(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}

  const inp="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors";
  const ta=`${inp} resize-none`;
  const card="bg-white rounded-2xl border border-slate-100 overflow-hidden";

  if(!authed){
    return(
      <div className="min-h-screen flex items-center justify-center px-6 font-sans" style={{backgroundColor:T.page,backgroundImage:T.canvasGlow}}>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap"/>
        <style>{`@keyframes adm-safelight { 0%,100% { opacity: 0.85; } 50% { opacity: 0.45; } }`}</style>
        <div className="fixed top-0 left-0 right-0 h-[2px]" style={{background:`linear-gradient(90deg, transparent, ${T.action}, transparent)`,animation:"adm-safelight 5s ease-in-out infinite"}} aria-hidden="true"/>
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] mb-3" style={{color:T.action,fontFamily:T.mono}}>The Darkroom</p>
            <span className="text-4xl font-bold" style={{color:T.ink,fontFamily:T.display}}>Chris<span style={{color:T.action}}>.</span></span>
            <p className="text-sm mt-2 font-medium" style={{color:T.inkFaint}}>Where the business gets developed.</p>
          </div>
          <div className="rounded-2xl p-8" style={{background:T.panel,border:`1px solid ${T.border}`,boxShadow:T.shadowHover}}>
            <label className="block text-[10px] font-bold tracking-[0.2em] uppercase mb-2" style={{color:T.inkFaint,fontFamily:T.mono}}>Password</label>
            <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setPwErr(false);}}
              onKeyDown={e=>{if(e.key==="Enter")login(pw).then(ok=>{if(ok)setAuthed(true);else setPwErr(true);});}}
              placeholder="Enter password" autoFocus
              className="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition-colors mb-4"
              style={{background:T.inset,border:`1px solid ${pwErr?T.red:T.border}`,color:T.ink}}/>
            {pwErr&&<p className="text-xs font-semibold mb-3" style={{color:T.red}}>Incorrect password</p>}
            <button onClick={()=>login(pw).then(ok=>{if(ok)setAuthed(true);else setPwErr(true);})}
              className="w-full py-2.5 rounded-xl font-bold text-sm transition-all hover:opacity-90" style={{background:T.action,color:T.actionText,boxShadow:T.glow}}>
              Step inside →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return(
    <div className="min-h-screen font-sans" style={{backgroundColor:T.page,backgroundImage:T.canvasGlow,backgroundAttachment:"fixed"}}>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap"/>
      <style>{`
        @keyframes adm-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .adm-rise { animation: adm-rise 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes adm-pop { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: none; } }
        .adm-pop { animation: adm-pop 0.18s cubic-bezier(0.22,1,0.36,1) both; }
        @keyframes adm-safelight { 0%,100% { opacity: 0.85; } 50% { opacity: 0.45; } }
        .adm-grain { position: fixed; inset: 0; pointer-events: none; z-index: 90; opacity: 0.04; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"); }
        ::selection { background: rgba(232,160,76,0.35); }
        @media (prefers-reduced-motion: reduce) { .adm-rise, .adm-pop { animation-duration: 0.01ms; } }

        /* ── Legacy dark layer ──────────────────────────────────────────────
           The website/tools tabs were built on light Tailwind utilities.
           Rather than hand-editing ~5k lines, remap those utilities to the
           Darkroom palette inside the .admx content scope. New surfaces use
           T tokens inline and are unaffected. */
        .admx .bg-white { background-color: ${T.panelSolid} !important; }
        .admx .bg-slate-50 { background-color: rgba(255,255,255,0.04) !important; }
        .admx .bg-slate-100 { background-color: rgba(255,255,255,0.08) !important; }
        .admx .bg-slate-200 { background-color: rgba(255,255,255,0.12) !important; }
        .admx .bg-emerald-50, .admx .bg-emerald-100, .admx .bg-green-50, .admx .bg-green-100 { background-color: ${T.greenBg} !important; }
        .admx .bg-amber-50, .admx .bg-amber-100, .admx .bg-yellow-50, .admx .bg-orange-50 { background-color: ${T.amberBg} !important; }
        .admx .bg-violet-50, .admx .bg-violet-100, .admx .bg-purple-50, .admx .bg-indigo-50 { background-color: ${T.violetBg} !important; }
        .admx .bg-red-50, .admx .bg-rose-50 { background-color: ${T.redBg} !important; }
        .admx .bg-blue-50, .admx .bg-sky-50 { background-color: ${T.blueBg} !important; }
        .admx .text-emerald-800, .admx .text-emerald-900, .admx .text-green-700, .admx .text-green-800 { color: ${T.green} !important; }
        .admx .text-indigo-600, .admx .text-indigo-700, .admx .text-purple-600, .admx .text-purple-700 { color: ${T.violet} !important; }
        .admx .text-blue-600, .admx .text-blue-700, .admx .text-sky-600 { color: ${T.blue} !important; }
        .admx .text-orange-600, .admx .text-yellow-700 { color: ${T.amber} !important; }
        .admx .border-emerald-200, .admx .border-emerald-300, .admx .border-green-200 { border-color: ${T.greenBorder} !important; }
        .admx .border-violet-200, .admx .border-violet-100, .admx .border-indigo-200, .admx .border-purple-200 { border-color: ${T.violetBorder} !important; }
        .admx .border-amber-200, .admx .border-yellow-200 { border-color: ${T.amberBorder} !important; }
        .admx .text-slate-950, .admx .text-slate-900, .admx .text-slate-800, .admx .text-black { color: ${T.ink} !important; }
        .admx .text-slate-700, .admx .text-slate-600, .admx .text-slate-500 { color: ${T.inkSoft} !important; }
        .admx .text-slate-400, .admx .text-slate-300 { color: ${T.inkFaint} !important; }
        .admx .text-emerald-700, .admx .text-emerald-600 { color: ${T.green} !important; }
        .admx .text-amber-700, .admx .text-amber-600 { color: ${T.amber} !important; }
        .admx .text-red-600, .admx .text-red-500 { color: ${T.red} !important; }
        .admx .text-violet-600, .admx .text-violet-700 { color: ${T.violet} !important; }
        .admx .border-slate-50, .admx .border-slate-100, .admx .border-slate-200, .admx .border-slate-300, .admx .border-white { border-color: ${T.border} !important; }
        .admx .border-emerald-400 { border-color: ${T.greenBorder} !important; }
        .admx .border-red-200 { border-color: ${T.redBorder} !important; }
        .admx .hover\\:bg-slate-50:hover, .admx .hover\\:bg-slate-100:hover, .admx .hover\\:bg-slate-200:hover { background-color: rgba(255,255,255,0.08) !important; }
        .admx .hover\\:bg-red-50:hover { background-color: ${T.redBg} !important; }
        .admx .hover\\:bg-indigo-50:hover { background-color: ${T.violetBg} !important; }
        .admx .hover\\:text-slate-700:hover, .admx .hover\\:text-slate-600:hover { color: ${T.ink} !important; }
        .admx .shadow-xl, .admx .shadow-lg, .admx .shadow-md, .admx .shadow-sm, .admx .shadow { box-shadow: ${T.shadow} !important; }
        .admx input, .admx select, .admx textarea { color-scheme: dark; }
        .admx ::placeholder { color: rgba(184,178,168,0.45) !important; }
        .admx [style*="background:white"], .admx [style*="background: white"],
        .admx [style*="background:#fff"], .admx [style*="background: #fff"],
        .admx [style*="background-color:white"], .admx [style*="background-color: white"],
        .admx [style*="background:rgba(255,255,255,0.8"], .admx [style*="background: rgba(255,255,255,0.8"],
        .admx [style*="background:rgba(255,255,255,0.9"], .admx [style*="background: rgba(255,255,255,0.9"] {
          background-color: ${T.panelSolid} !important; background-image: none !important;
        }
      `}</style>
      <div className="adm-grain" aria-hidden="true"/>
      <CommandPalette
        open={paletteOpen}
        onClose={()=>setPaletteOpen(false)}
        tabs={(Object.keys(TAB_LABELS) as Tab[]).map(t=>({key:t,icon:TAB_LABELS[t].split(" ")[0],label:TAB_LABELS[t].replace(/^[^\s]+\s/,"")}))}
        actions={[
          {key:"new-client",icon:"➕",label:"New client",run:()=>{setTab("clients");setAddClientOpen(true);}},
          {key:"add-session",icon:"📸",label:"Add session to calendar",run:()=>{setTab("home");setAddEventForm(EMPTY_EVENT);setAddEventOpen(true);}},
          {key:"sync-payments",icon:"💳",label:"Sync payments from Gmail",run:()=>{syncPayments();}},
          {key:"content-engine",icon:"🎞️",label:"Content Engine",run:()=>router.push("/admin/content-engine")},
          {key:"reminders",icon:"🔔",label:"Reminder templates",run:()=>router.push("/admin/reminder-templates")},
          {key:"portal",icon:"🗂️",label:"Portal sessions",run:()=>router.push("/admin/sessions")},
          {key:"availability",icon:"📆",label:"Availability",run:()=>router.push("/admin/availability")},
        ]}
        clients={(()=>{
          const seen=new Map<string,{id:number;name:string;email:string;sessionType:string|null;paid:boolean}>();
          [...inquiries].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).forEach(i=>{
            const k=i.email.toLowerCase();
            if(!seen.has(k))seen.set(k,{id:i.id,name:i.name,email:i.email,sessionType:i.session_type,paid:false});
            if(i.payment_status==="paid")seen.get(k)!.paid=true;
          });
          return Array.from(seen.values());
        })()}
        onGo={t=>{cancelEditPortfolioImage();cancelEditCategory();setEditingInquiry(null);setInquiryDeleteConfirm(null);setTab(t as Tab);}}
        onOpenClient={id=>router.push(`/admin/conversation/${id}`)}
      />
      {/* Safelight strip — the darkroom signature */}
      <div className="fixed top-0 left-0 right-0 h-[2px] z-50 pointer-events-none" style={{background:`linear-gradient(90deg, transparent, ${T.action}, transparent)`,animation:"adm-safelight 5s ease-in-out infinite"}} aria-hidden="true"/>
      {toast&&<div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-sm font-bold adm-pop" style={{background:T.panelSolid,color:T.ink,border:`1px solid ${toast.ok?T.greenBorder:T.redBorder}`,boxShadow:T.shadowHover}}>
        <span style={{color:toast.ok?T.green:T.red}}>{toast.ok?"● ":"● "}</span>{toast.msg}
      </div>}

      {addEventOpen&&(()=>{
        const mInp="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition-colors";
        const mInpStyle={background:T.inset,border:`1px solid ${T.border}`,color:T.ink} as const;
        const mLbl="block text-[10px] font-black uppercase tracking-widest mb-1";
        return(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:T.scrim,backdropFilter:"blur(6px)"}} onClick={e=>{if(e.target===e.currentTarget){setAddEventOpen(false);setAddEventForm(EMPTY_EVENT);}}}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden adm-pop" style={{background:T.panelSolid,border:`1px solid ${T.border}`,boxShadow:T.shadowHover}}>
            <div className="h-[2px]" style={{background:`linear-gradient(90deg, transparent, ${T.action}, transparent)`}}/>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{color:T.amber,fontFamily:T.mono}}>📸 Add to Calendar</p>
                  <p className="text-lg font-black" style={{color:T.ink,fontFamily:T.display}}>New Session</p>
                </div>
                <button onClick={()=>{setAddEventOpen(false);setAddEventForm(EMPTY_EVENT);}} className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors text-lg font-bold" style={{color:T.inkFaint,background:T.inset}}>×</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className={mLbl} style={{color:T.inkFaint}}>Name *</label><input className={mInp} style={mInpStyle} placeholder="e.g. Maria Lopez" value={addEventForm.name} onChange={e=>setAddEventForm(f=>({...f,name:e.target.value}))}/></div>
                <div className="col-span-2"><label className={mLbl} style={{color:T.inkFaint}}>Email *</label><input className={mInp} style={mInpStyle} type="email" placeholder="e.g. maria@gmail.com" value={addEventForm.email} onChange={e=>setAddEventForm(f=>({...f,email:e.target.value}))}/></div>
                <div><label className={mLbl} style={{color:T.inkFaint}}>Phone</label><input className={mInp} style={mInpStyle} type="tel" placeholder="(408) 555-1234" value={addEventForm.phone} onChange={e=>setAddEventForm(f=>({...f,phone:e.target.value}))}/></div>
                <div><label className={mLbl} style={{color:T.inkFaint}}>Session Type</label><input className={mInp} style={mInpStyle} placeholder="e.g. Grad Portraits" value={addEventForm.session_type} onChange={e=>setAddEventForm(f=>({...f,session_type:e.target.value}))}/></div>
                <div><label className={mLbl} style={{color:T.inkFaint}}>Date *</label><input className={mInp} style={mInpStyle} type="text" placeholder="YYYY-MM-DD" value={addEventForm.session_date} onChange={e=>setAddEventForm(f=>({...f,session_date:e.target.value}))}/></div>
                <div><label className={mLbl} style={{color:T.inkFaint}}>Time</label><input className={mInp} style={mInpStyle} type="text" placeholder="HH:MM" value={addEventForm.session_time} onChange={e=>setAddEventForm(f=>({...f,session_time:e.target.value}))}/></div>
                <div className="col-span-2"><label className={mLbl} style={{color:T.inkFaint}}>Location</label><input className={mInp} style={mInpStyle} placeholder="e.g. UC Berkeley" value={addEventForm.location} onChange={e=>setAddEventForm(f=>({...f,location:e.target.value}))}/></div>
                <div className="col-span-2"><label className={mLbl} style={{color:T.inkFaint}}>Notes</label><textarea className={`${mInp} resize-none`} style={mInpStyle} rows={2} placeholder="Anything relevant from the conversation…" value={addEventForm.notes} onChange={e=>setAddEventForm(f=>({...f,notes:e.target.value}))}/></div>
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl transition-colors" style={{background:addEventForm.payment_received?T.greenBg:T.inset,border:`1px solid ${addEventForm.payment_received?T.greenBorder:T.border}`}}>
                    <input type="checkbox" className="w-4 h-4 rounded cursor-pointer" style={{accentColor:T.green}} checked={addEventForm.payment_received} onChange={e=>setAddEventForm(f=>({...f,payment_received:e.target.checked}))}/>
                    <div>
                      <p className="text-xs font-black" style={{color:addEventForm.payment_received?T.green:T.inkSoft}}>Payment received ✓</p>
                      <p className="text-[10px] font-medium" style={{color:T.inkFaint}}>Required to show on calendar</p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={()=>{setAddEventOpen(false);setAddEventForm(EMPTY_EVENT);}} className="px-4 py-2.5 rounded-xl text-sm font-bold transition-colors" style={{color:T.inkSoft}}>Cancel</button>
                <button onClick={saveCalendarEvent} disabled={addEventSaving} className="flex-1 py-2.5 rounded-xl text-sm font-black disabled:opacity-50 transition-opacity" style={{background:T.action,color:T.actionText,boxShadow:T.glow}}>
                  {addEventSaving?"Saving…":"Add to Calendar ✓"}
                </button>
              </div>
            </div>
          </div>
        </div>
        );
      })()}


      <div className="sticky top-0 z-40 px-3 md:px-6 h-14 flex items-center justify-between" style={{background:"rgba(19,17,20,0.82)",backdropFilter:"blur(20px)",borderBottom:`1px solid ${T.border}`}}>
        <span className="shrink-0 flex items-center gap-2.5" style={{color:T.ink}}>
          <span className="w-2 h-2 rounded-full" style={{background:T.action,boxShadow:`0 0 8px ${T.action}`}}/>
          <span className="text-base md:text-lg font-bold" style={{fontFamily:T.display}}>Chris<span style={{color:T.action}}>.</span></span>
          <span className="hidden sm:inline text-[10px] font-bold uppercase tracking-[0.22em]" style={{color:T.inkFaint,fontFamily:T.mono}}>Darkroom</span>
        </span>
        <div className="flex items-center gap-2 md:gap-3">
          <button onClick={()=>setPaletteOpen(true)}
            className="hidden md:inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all hover:-translate-y-px"
            style={{background:T.inset,color:T.inkSoft,border:`1px solid ${T.border}`}}>
            <span>Search</span>
            <kbd className="rounded px-1.5 py-0.5 text-[10px]" style={{background:T.insetStrong,color:T.inkSoft,fontFamily:T.mono}}>⌘K</kbd>
          </button>
          <Link
            href="/admin/sessions"
            className="inline-flex items-center rounded-full px-2 md:px-3 py-1.5 text-[10px] md:text-[11px] font-black uppercase tracking-[0.12em] transition-all hover:-translate-y-px whitespace-nowrap"
            style={{background:T.panelSolid,color:T.inkSoft,border:`1px solid ${T.border}`,boxShadow:T.shadow}}
          >
            Portal Sessions
          </Link>
          <a href="/bay-area-locations" className="hidden md:block text-xs font-bold transition-colors" style={{color:T.inkFaint}} onMouseEnter={e=>{e.currentTarget.style.color=T.ink;}} onMouseLeave={e=>{e.currentTarget.style.color=T.inkFaint;}}>🗺️ Bay Guide</a>
          <a href="/admin/availability" className="hidden md:block text-xs font-bold transition-colors" style={{color:T.inkFaint}} onMouseEnter={e=>{e.currentTarget.style.color=T.ink;}} onMouseLeave={e=>{e.currentTarget.style.color=T.inkFaint;}}>📅 Availability</a>
          <Link href="/" className="hidden md:block text-xs font-bold transition-colors" style={{color:T.inkFaint}} onMouseEnter={e=>{e.currentTarget.style.color=T.ink;}} onMouseLeave={e=>{e.currentTarget.style.color=T.inkFaint;}}>← Site</Link>
        </div>
      </div>

      <div className="flex">
        {/* ── SIDEBAR NAV ── */}
        {(()=>{
          const cancelAll=()=>{cancelEditPortfolioImage();cancelEditCategory();setEditingInquiry(null);setInquiryDeleteConfirm(null);};
          const go=(t:Tab)=>{cancelAll();setTab(t);};
          const pendingNavCount=inquiries.filter(inquiryNeedsReply).length;
          const NavBtn=({t,icon,label,badge}:{t:Tab;icon:string;label:string;badge?:number})=>(
            <button onClick={()=>go(t)}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-xl text-[13px] font-semibold transition-all text-left group"
              style={tab===t
                ?{background:T.action,color:T.actionText,boxShadow:T.glow}
                :{color:T.inkSoft,background:"transparent"}}
              onMouseEnter={e=>{if(tab!==t)e.currentTarget.style.background=T.inset;}}
              onMouseLeave={e=>{if(tab!==t)e.currentTarget.style.background="transparent";}}>
              <span className="w-5 flex-shrink-0 text-center text-base leading-none">{icon}</span>
              <span className="truncate">{label}</span>
              {(badge??0)>0&&(
                <span className="ml-auto flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none tabular-nums"
                      style={tab===t?{background:"rgba(0,0,0,0.22)",color:T.actionText}:{background:T.amberBg,color:T.amber}}>
                  {badge}
                </span>
              )}
            </button>
          );
          return(
            <div className="hidden md:flex sticky top-14 flex-shrink-0 w-[200px] h-[calc(100vh-56px)] overflow-y-auto flex-col py-3 px-2"
                 style={{background:"rgba(255,255,255,0.025)",borderRight:`1px solid ${T.border}`}}>
              <div className="flex-1 space-y-0.5 pb-3">
                <NavBtn t="home" icon="🏠" label="Home"/>
                <div className="h-px my-2 mx-1" style={{background:T.rowBorder}}/>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] px-3 pt-0.5 pb-1" style={{color:T.inkFaint}}>Client Work</p>
                {(["inquiries","clients","testimonials","analytics","payments","funnel","attribution"] as Tab[]).map(t=>(
                  <NavBtn key={t} t={t} icon={t==="inquiries"?"📬":t==="clients"?"👥":t==="testimonials"?"💬":t==="analytics"?"📊":t==="payments"?"💵":t==="attribution"?"🎯":"📈"} label={TAB_LABELS[t].replace(/^[^\s]+\s/,"")} badge={t==="inquiries"?pendingNavCount:undefined}/>
                ))}
                <div className="h-px my-2 mx-1" style={{background:T.rowBorder}}/>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] px-3 pt-0.5 pb-1" style={{color:T.inkFaint}}>Website</p>
                <AdminWebsiteNavigation key={tab} activeTab={tab} onNavigate={go}/>
                <div className="h-px my-2 mx-1" style={{background:T.rowBorder}}/>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] px-3 pt-0.5 pb-1" style={{color:T.inkFaint}}>Marketing</p>
                <button onClick={()=>router.push("/admin/content-engine")}
                  className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-xl text-[13px] font-semibold transition-all text-left"
                  style={{color:T.inkSoft,background:"transparent"}}
                  onMouseEnter={e=>{e.currentTarget.style.background=T.inset;}}
                  onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                  <span className="w-5 flex-shrink-0 text-center text-base leading-none">🎞️</span>
                  <span className="truncate">Content Engine</span>
                  {engineActionable>0&&(
                    <span className="ml-auto flex-shrink-0 text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none tabular-nums"
                          style={{background:T.amberBg,color:T.amber}}>
                      {engineActionable}
                    </span>
                  )}
                </button>
                <div className="h-px my-2 mx-1" style={{background:T.rowBorder}}/>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] px-3 pt-0.5 pb-1" style={{color:T.inkFaint}}>Tools</p>
                {(["ai","chat","format","vault","accounts"] as Tab[]).map(t=>(
                  <NavBtn key={t} t={t} icon={t==="ai"?"🤖":t==="chat"?"💬":t==="format"?"✨":t==="vault"?"📓":"👤"} label={TAB_LABELS[t].replace(/^[^\s]+\s/,"")}/>
                ))}
              </div>
              <div className="border-t pt-2.5 px-1" style={{borderColor:T.rowBorder}}>
                <button onClick={()=>adminLogout().then(()=>{setAuthed(false);setPw("");})}
                  className="w-full flex items-center gap-2 px-3 py-[7px] rounded-xl text-[13px] font-semibold transition-colors"
                  style={{color:T.inkFaint}}
                  onMouseEnter={e=>{e.currentTarget.style.color=T.inkSoft;e.currentTarget.style.background=T.inset;}}
                  onMouseLeave={e=>{e.currentTarget.style.color=T.inkFaint;e.currentTarget.style.background="transparent";}}>
                  ← Sign out
                </button>
              </div>
            </div>
          );
        })()}

        {/* ── MAIN CONTENT COLUMN (mobile nav + content) ── */}
        <div className="flex-1 min-w-0 flex flex-col">

        {/* Mobile tab nav — only visible on mobile */}
        {(()=>{
          const cancelAll=()=>{cancelEditPortfolioImage();cancelEditCategory();setEditingInquiry(null);setInquiryDeleteConfirm(null);};
          const go=(t:Tab)=>{cancelAll();setTab(t);};
          type MobileNavItem={t:Tab;icon:string;label:string};
          const all:MobileNavItem[]=[
            {t:"home",icon:"🏠",label:"Home"},{t:"inquiries",icon:"📬",label:"Inquiries"},{t:"clients",icon:"👥",label:"Clients"},{t:"testimonials",icon:"💬",label:"Testimonials"},{t:"analytics",icon:"📊",label:"Analytics"},{t:"payments",icon:"💵",label:"Revenue"},{t:"funnel",icon:"📈",label:"Funnel"},{t:"attribution",icon:"🎯",label:"Attribution"},
            {t:"poses",icon:"📸",label:"Poses"},{t:"couplesGuide",icon:"💞",label:"Couples Guide"},{t:"locations",icon:"📍",label:"Spots"},{t:"bayGuide",icon:"🗺️",label:"Bay Guide"},{t:"portfolio",icon:"🖼️",label:"Portfolio"},{t:"categories",icon:"🏷️",label:"Categories"},{t:"blog",icon:"✍️",label:"Blog"},{t:"library",icon:"🗄️",label:"Library"},{t:"navigation",icon:"🧭",label:"Navigation"},
            {t:"ai",icon:"🤖",label:"AI Training"},{t:"chat",icon:"💬",label:"AI Chat"},{t:"format",icon:"✨",label:"Format"},{t:"vault",icon:"📓",label:"Vault"},{t:"accounts",icon:"👤",label:"Accounts"},
          ];
          return(
            <div className="md:hidden sticky top-14 z-30 overflow-x-auto flex items-center gap-1.5 px-3 py-2 [&::-webkit-scrollbar]:hidden" style={{background:"rgba(19,17,20,0.88)",backdropFilter:"blur(16px)",borderBottom:`1px solid ${T.border}`}}>
              {all.map(({t,icon,label})=>(
                <button key={t} onClick={()=>go(t)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all"
                  style={tab===t?{background:T.action,color:T.actionText,boxShadow:T.glow}:{color:T.inkSoft,background:T.inset}}>
                  <span className="text-sm leading-none">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
              <button onClick={()=>router.push("/admin/content-engine")}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all"
                style={{color:T.inkSoft,background:T.inset}}>
                <span className="text-sm leading-none">🎞️</span>
                <span>Content Engine</span>
              </button>
              <button onClick={()=>adminLogout().then(()=>{setAuthed(false);setPw("");})}
                className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all"
                style={{color:T.inkFaint,background:T.inset,border:`1px solid ${T.border}`}}>
                <span className="text-sm leading-none">←</span>
                <span>Sign out</span>
              </button>
            </div>
          );
        })()}

        {/* ── MAIN CONTENT — key={tab} re-runs the rise animation on every tab switch ── */}
        <div key={tab} className="admx flex-1 px-4 py-4 md:px-8 md:py-8 adm-rise">

        {/* ── HOME ── */}
        {tab==="home"&&(()=>{
          const today=new Date();today.setHours(0,0,0,0);
          const now=new Date();
          const monthStart=new Date(now.getFullYear(),now.getMonth(),1);

          // Upcoming confirmed sessions
          const upcoming=inquiries
            .filter(inq=>inq.session_date&&inq.booking_confirmed&&new Date(inq.session_date+"T12:00:00")>=today)
            .sort((a,b)=>new Date(a.session_date!+"T12:00:00").getTime()-new Date(b.session_date!+"T12:00:00").getTime())
            .slice(0,5);

          // Revenue this month (paid sessions with payment detected this month)
          const parsePayment=(inq:Inquiry)=>{
            const match=(inq.payment_note||"").match(/\$?([\d,]+(?:\.\d{2})?)/);
            return match?parseFloat(match[1].replace(",","")):0;
          };
          const monthRevenue=inquiries
            .filter(inq=>inq.payment_status==="paid"&&inq.payment_detected_at&&new Date(inq.payment_detected_at)>=monthStart)
            .reduce((sum,inq)=>sum+parsePayment(inq),0);
          const prevMonthStart=new Date(now.getFullYear(),now.getMonth()-1,1);
          const prevMonthRevenue=inquiries
            .filter(inq=>inq.payment_status==="paid"&&inq.payment_detected_at&&new Date(inq.payment_detected_at)>=prevMonthStart&&new Date(inq.payment_detected_at)<monthStart)
            .reduce((sum,inq)=>sum+parsePayment(inq),0);

          // Quick stats
          const totalClients=new Set(inquiries.map(i=>i.email.toLowerCase())).size;
          const confirmedSessions=inquiries.filter(i=>i.booking_confirmed).length;
          const newThisMonth=inquiries.filter(i=>new Date(i.created_at)>=monthStart).length;
          const paidSessions=inquiries.filter(i=>i.payment_status==="paid").length;
          const pendingInquiries=inquiries.filter(inquiryNeedsReply).length;

          const pad2=(n:number)=>String(n).padStart(2,"0");
          const todayStr=`${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
          const tom=new Date(today);tom.setDate(tom.getDate()+1);
          const tomorrowStr=`${tom.getFullYear()}-${pad2(tom.getMonth()+1)}-${pad2(tom.getDate())}`;
          const dayLabel=(d:string)=>{
            if(d===todayStr)return"TODAY";
            if(d===tomorrowStr)return"TOMORROW";
            return new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
          };

          // Daily brief numbers. Gallery tracking only exists for recent work, so
          // cap "to deliver" at sessions shot in the last 60 days — older paid
          // sessions were delivered before the timeline feature existed.
          const weekEnd=new Date(today);weekEnd.setDate(weekEnd.getDate()+7);
          const weekSessions=inquiries.filter(i=>i.booking_confirmed&&i.session_date&&new Date(i.session_date+"T12:00:00")>=today&&new Date(i.session_date+"T12:00:00")<weekEnd).length;
          const galleryCutoff=(()=>{const d=new Date(today);d.setDate(d.getDate()-60);return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;})();
          const isGalleryDue=(i:Inquiry)=>i.payment_status==="paid"&&!!i.session_date&&i.session_date<todayStr&&i.session_date>=galleryCutoff&&!i.gallery_delivered_at;
          const galleriesDue=inquiries.filter(isGalleryDue).length;

          const pillStyle={background:T.panel,border:`1px solid ${T.border}`,color:T.inkSoft} as const;
          const pillCls="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-px hover:shadow-sm active:translate-y-0";
          return(
            <div>
              {/* Greeting + quick actions */}
              <div className="adm-rise flex flex-wrap items-end justify-between gap-4 mb-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.28em] mb-2" style={{color:T.action,fontFamily:T.mono}}>Soloxsnaps · The Darkroom</p>
                  <h1 className="text-[30px] font-semibold leading-none" style={{color:T.ink,fontFamily:T.display}}>
                    {now.getHours()<12?"Good morning":now.getHours()<17?"Good afternoon":"Good evening"}, <em>Chris</em>
                  </h1>
                  <p className="text-sm mt-2 font-medium" style={{color:T.inkSoft}}>
                    {now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}
                    <span style={{color:T.inkFaint}}> · </span>
                    {pendingInquiries>0?(
                      <button onClick={()=>setTab("inquiries")} className="font-bold hover:underline" style={{color:T.amber}}>
                        {pendingInquiries} {pendingInquiries===1?"inquiry needs":"inquiries need"} a reply
                      </button>
                    ):(
                      <span className="font-bold" style={{color:T.green}}>inbox clear ✓</span>
                    )}
                    {weekSessions>0&&(
                      <>
                        <span style={{color:T.inkFaint}}> · </span>
                        <span><b style={{color:T.ink}}>{weekSessions}</b> session{weekSessions===1?"":"s"} this week</span>
                      </>
                    )}
                    {galleriesDue>0&&(
                      <>
                        <span style={{color:T.inkFaint}}> · </span>
                        <button onClick={()=>setTab("clients")} className="font-bold hover:underline" style={{color:T.violet}}>
                          {galleriesDue} galler{galleriesDue===1?"y":"ies"} to deliver
                        </button>
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={()=>{setTab("clients");setAddClientOpen(true);}}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-px active:translate-y-0"
                    style={{background:T.action,color:T.actionText,boxShadow:T.shadow}}>
                    + New Client
                  </button>
                  <button onClick={()=>router.push("/admin/reminder-templates")} className={pillCls} style={pillStyle}>
                    🔔 Reminders
                  </button>
                  <Link href="/admin/sessions" className={pillCls} style={pillStyle}>
                    🗂️ Portal Sessions
                  </Link>
                  <Link href="/admin/content-engine" className={pillCls} style={pillStyle}>
                    🎞️ Content Engine
                  </Link>
                  <a href={`webcal://soloxsnaps.com/api/calendar/sessions?token=${process.env.NEXT_PUBLIC_ICS_TOKEN??""}`} className={pillCls} style={pillStyle}>
                    📅 Subscribe
                  </a>
                  <a href="/admin/availability" className={pillCls} style={pillStyle}>
                    📆 Availability
                  </a>
                </div>
              </div>

              {/* Stats — clickable, animated */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
                {([
                  {label:"Revenue",value:Math.round(monthRevenue),prefix:"$",sub:"collected this month",accent:T.green,go:"payments" as Tab},
                  {label:"Booked",value:confirmedSessions,prefix:"",sub:"confirmed sessions",accent:T.violet,go:"clients" as Tab},
                  {label:"New",value:newThisMonth,prefix:"",sub:"inquiries this month",accent:T.amber,go:"inquiries" as Tab},
                  {label:"Clients",value:totalClients,prefix:"",sub:"all-time clients",accent:T.blue,go:"clients" as Tab},
                ]).map((s,i)=>(
                  <button key={s.label} onClick={()=>setTab(s.go)}
                    className="adm-rise group rounded-2xl p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
                    style={{background:T.panel,border:`1px solid ${T.border}`,boxShadow:T.shadow,animationDelay:`${60+i*50}ms`}}
                    onMouseEnter={e=>{e.currentTarget.style.background=T.panelHover;e.currentTarget.style.borderColor=T.borderStrong;}}
                    onMouseLeave={e=>{e.currentTarget.style.background=T.panel;e.currentTarget.style.borderColor=T.border;}}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{color:T.inkSoft,fontFamily:T.mono}}>{s.label}</p>
                      <span className="w-1.5 h-1.5 rounded-full" style={{background:s.accent,boxShadow:`0 0 6px ${s.accent}`}}/>
                    </div>
                    <p className="text-[26px] font-bold leading-none tabular-nums flex items-baseline gap-2" style={{color:T.ink,fontFamily:T.mono}}>
                      <CountUpNumber value={s.value} prefix={s.prefix}/>
                      {s.label==="Revenue"&&prevMonthRevenue>0&&(()=>{
                        const pct=Math.round(((monthRevenue-prevMonthRevenue)/prevMonthRevenue)*100);
                        return(
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:pct>=0?T.greenBg:T.redBg,color:pct>=0?T.green:T.red}} title={`vs $${Math.round(prevMonthRevenue).toLocaleString()} last month`}>
                            {pct>=0?"↑":"↓"}{Math.abs(pct)}%
                          </span>
                        );
                      })()}
                    </p>
                    <p className="text-[11px] mt-1.5 font-medium flex items-center" style={{color:T.inkFaint}}>
                      {s.sub}
                      <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold" style={{color:T.action}}>Open →</span>
                    </p>
                  </button>
                ))}
              </div>

              {/* Content Engine — session → marketing pipeline at a glance */}
              <div className="adm-rise rounded-2xl mb-5 p-4 flex flex-wrap items-center gap-4"
                   style={{background:T.panel,border:`1px solid ${engineActionable>0?T.amberBorder:T.border}`,boxShadow:T.shadow,animationDelay:"140ms"}}>
                <div className="min-w-[180px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{color:engineActionable>0?T.amber:T.inkSoft,fontFamily:T.mono}}>🎞️ Content Engine</p>
                  <p className="text-[11px] font-medium" style={{color:T.inkFaint}}>
                    Session → Photos → Analyze → Generate → Review → Publish
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  {([
                    {label:"Drafts",sub:"awaiting approval",value:engineTotals.draft,color:T.amber,bg:T.amberBg},
                    {label:"Approved",sub:"ready to publish",value:engineTotals.approved,color:T.violet,bg:T.violetBg},
                    {label:"Published",sub:"live",value:engineTotals.published,color:T.green,bg:T.greenBg},
                    {label:"Attention",sub:"failed",value:engineTotals.failed,color:T.red,bg:T.redBg},
                  ]).map(c=>(
                    <span key={c.label} className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl" style={{background:T.inset}}>
                      <span className="text-sm font-bold tabular-nums" style={{color:c.value>0?c.color:T.inkFaint,fontFamily:T.mono}}>{c.value}</span>
                      <span className="text-[10px] font-bold leading-tight" style={{color:T.inkSoft}}>
                        {c.label}<span className="block font-medium" style={{color:T.inkFaint}}>{c.sub}</span>
                      </span>
                    </span>
                  ))}
                </div>
                <Link href="/admin/content-engine"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all hover:-translate-y-px active:translate-y-0"
                  style={{background:T.action,color:T.actionText,boxShadow:T.shadow}}>
                  Open Engine →
                </Link>
              </div>

              {/* Calendar + right column */}
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-5 mb-5 items-start">
                {/* Calendar — untouched */}
                <SessionCalendar
                  sessions={inquiries
                    .filter(i=>i.session_date&&i.booking_confirmed)
                    .map(i=>({id:i.id,name:i.name,session_type:i.session_type,session_date:i.session_date!,payment_status:i.payment_status,booking_confirmed:i.booking_confirmed,deposit2Received:finalPaymentIds.has(i.id)}))}
                  onClientClick={(id)=>router.push(`/admin/conversation/${id}`)}
                  onReschedule={rescheduleSession}
                  onRemindersClick={(id)=>router.push(`/admin/reminders/${id}`)}
                  onThankYouClick={(id)=>router.push(`/admin/reminders/${id}?focus=thank-you`)}
                  onAddEvent={(date)=>{setAddEventForm(f=>({...EMPTY_EVENT,session_date:date??f.session_date}));setAddEventOpen(true);}}
                  onFinalPayment={handleFinalPayment}
                  deposit1Amounts={deposit1Amounts}
                />

                {/* Right column: upcoming + needs reply */}
                <div className="space-y-4">
                  {/* Upcoming sessions */}
                  <div className="adm-rise rounded-2xl overflow-hidden" style={{background:T.panel,border:`1px solid ${T.border}`,boxShadow:T.shadow,animationDelay:"160ms"}}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{color:T.green,fontFamily:T.mono}}>Up Next</p>
                        <button onClick={()=>setTab("clients")} className="text-[11px] font-bold transition-opacity hover:opacity-70" style={{color:T.inkFaint}}>All →</button>
                      </div>
                      {upcoming.length===0?(
                        <p className="text-sm py-1" style={{color:T.inkFaint}}>No confirmed sessions yet.</p>
                      ):(
                        <div className="flex flex-col">
                          {upcoming.map((inq,idx)=>{
                            const isToday=inq.session_date===todayStr;const isTomorrow=inq.session_date===tomorrowStr;
                            return(
                              <div key={inq.id} className="group flex items-center gap-2 py-2.5 -mx-2 px-2 rounded-xl transition-colors"
                                   style={idx>0?{borderTop:`1px solid ${T.rowBorder}`}:undefined}
                                   onMouseEnter={e=>{e.currentTarget.style.background=T.inset;}}
                                   onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
                                <div className="flex-shrink-0 w-[52px]">
                                  <span className="text-[9px] font-black tracking-wide block leading-tight" style={{color:isToday?T.red:isTomorrow?T.amber:T.inkFaint}}>{dayLabel(inq.session_date!)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold truncate" style={{color:T.ink}}>{inq.name}</p>
                                  <p className="text-[10px] truncate" style={{color:T.inkFaint}}>{inq.session_type||"Session"}</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {inq.payment_status==="paid"&&<span className="text-[9px] font-black px-1.5 py-0.5 rounded-full" style={{background:T.greenBg,color:T.green}}>✓</span>}
                                  <button onClick={()=>router.push(`/admin/reminders/${inq.id}`)}
                                    className="px-1.5 py-0.5 rounded-lg transition-all hover:opacity-80 text-[11px]"
                                    style={{background:T.amberBg,color:T.amber}} title="Send reminder">🔔</button>
                                  <button onClick={()=>router.push(`/admin/reminders/${inq.id}?focus=thank-you`)}
                                    className="px-1.5 py-0.5 rounded-lg transition-all hover:opacity-80 text-[11px]"
                                    style={{background:T.violetBg,color:T.violet}} title="Thank you">🙏</button>
                                  <button onClick={()=>router.push(`/admin/conversation/${inq.id}`)}
                                    className="text-[10px] px-2 py-0.5 rounded-lg transition-all hover:opacity-80 font-bold"
                                    style={{background:T.action,color:T.actionText}}>→</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Queue — the highest-ROI next moves, ranked */}
                  {(()=>{
                    const hoursAgo=(iso:string)=>{
                      const h=Math.round((Date.now()-new Date(iso).getTime())/(1000*60*60));
                      if(h<1)return"just now";if(h===1)return"1h ago";if(h<24)return`${h}h ago`;
                      const d=Math.round(h/24);return d===1?"1d ago":`${d}d ago`;
                    };
                    const active=(i:Inquiry)=>i.status!=="archived"&&i.status!=="not_interested";
                    const replies=inquiries
                      .filter(i=>!i.reply_sent_at&&active(i)&&i.status!=="responded"&&i.status!=="manual")
                      .sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
                    const galleries=inquiries
                      .filter(isGalleryDue)
                      .sort((a,b)=>a.session_date!.localeCompare(b.session_date!));
                    const leadCutoff=Date.now()-90*24*60*60*1000;
                    const leads=inquiries
                      .filter(i=>i.payment_status!=="paid"&&active(i)&&(i.reply_sent_at||i.status==="responded")&&new Date(i.created_at).getTime()>=leadCutoff)
                      .sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
                    const paidAmounts=inquiries.filter(i=>i.payment_status==="paid").map(parsePayment).filter(n=>n>0);
                    const avgPaid=paidAmounts.length?paidAmounts.reduce((a,b)=>a+b,0)/paidAmounts.length:350;
                    const atStake=Math.round(leads.length*avgPaid);
                    const markDelivered=async(i:Inquiry)=>{
                      const ts=new Date().toISOString();
                      try{
                        await updateAdminInquiry(i.id,{gallery_delivered_at:ts});
                        setInquiries(prev=>prev.map(x=>x.id===i.id?{...x,gallery_delivered_at:ts}:x));
                        showToast("Gallery marked delivered ✓");
                      }catch(err){
                        console.error("[ActionQueue] mark delivered failed:",err);
                        showToast("Could not mark delivered",false);
                      }
                    };
                    type QItem={key:string;inq:Inquiry;chip:string;chipColor:string;chipBg:string;note:string;act:()=>void;cta:string;done?:()=>void};
                    const queue:QItem[]=[
                      ...replies.map(i=>({key:`r${i.id}`,inq:i,chip:"REPLY",chipColor:T.amber,chipBg:T.amberBg,note:`${i.session_type||"Session"} · ${hoursAgo(i.created_at)}`,act:()=>setTab("inquiries"),cta:"Reply →"})),
                      ...galleries.map(i=>({key:`g${i.id}`,inq:i,chip:"DELIVER",chipColor:T.violet,chipBg:T.violetBg,note:`shot ${new Date(i.session_date!+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} · gallery not sent`,act:()=>router.push(`/admin/conversation/${i.id}`),cta:"Open →",done:()=>{markDelivered(i);}})),
                      ...leads.map(i=>({key:`l${i.id}`,inq:i,chip:`~$${Math.round(avgPaid)}`,chipColor:T.green,chipBg:T.greenBg,note:`${i.session_type||"Session"} · warm, unpaid`,act:()=>router.push(`/admin/conversation/${i.id}`),cta:"Nudge →"})),
                    ];
                    const shown=queue.slice(0,6);
                    return(
                      <div className="adm-rise rounded-2xl overflow-hidden" style={{background:T.panel,border:`1px solid ${queue.length?T.amberBorder:T.border}`,boxShadow:T.shadow,animationDelay:"220ms"}}>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-[10px] font-bold uppercase tracking-[0.18em] flex items-center gap-1.5" style={{color:queue.length?T.amber:T.green,fontFamily:T.mono}}>
                              {queue.length>0&&<span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:T.amber,boxShadow:`0 0 6px ${T.amber}`}}/>}
                              Action Queue
                            </p>
                            {queue.length>6&&<span className="text-[10px] font-bold" style={{color:T.inkFaint,fontFamily:T.mono}}>+{queue.length-6} more</span>}
                          </div>
                          {leads.length>0&&(
                            <p className="text-[10px] mb-2" style={{color:T.inkFaint}}>
                              ≈ <span className="font-bold" style={{color:T.green,fontFamily:T.mono}}>${atStake.toLocaleString()}</span> sitting in warm leads
                            </p>
                          )}
                          {queue.length===0?(
                            <p className="text-sm py-2" style={{color:T.inkFaint}}>Darkroom clear — nothing waiting on you. ✓</p>
                          ):(
                            <div className="flex flex-col gap-1.5 mt-1">
                              {shown.map(q=>(
                                <div key={q.key} className="group/q flex items-center gap-2 p-2 rounded-xl transition-colors" style={{background:T.inset}}
                                     onMouseEnter={e=>{e.currentTarget.style.background=T.insetStrong;}}
                                     onMouseLeave={e=>{e.currentTarget.style.background=T.inset;}}>
                                  <span className="flex-shrink-0 text-[8px] font-black px-1.5 py-0.5 rounded-full tracking-wider" style={{background:q.chipBg,color:q.chipColor,fontFamily:T.mono}}>{q.chip}</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold truncate" style={{color:T.ink}}>{q.inq.name}</p>
                                    <p className="text-[10px] truncate" style={{color:T.inkFaint}}>{q.note}</p>
                                  </div>
                                  {q.done&&(
                                    <button onClick={q.done} title="Mark gallery delivered"
                                      className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg transition-all opacity-80 group-hover/q:opacity-100 hover:-translate-y-px"
                                      style={{background:T.greenBg,color:T.green,border:`1px solid ${T.greenBorder}`}}>
                                      ✓ Done
                                    </button>
                                  )}
                                  <button onClick={q.act}
                                    className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg transition-all opacity-80 group-hover/q:opacity-100"
                                    style={{background:T.action,color:T.actionText}}>
                                    {q.cta}
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Client email replies */}
              {gmailConnected&&(()=>{
                const timeAgo=(ts:number)=>{
                  const h=Math.round((Date.now()-ts)/(1000*60*60));
                  if(h<1)return"just now";if(h===1)return"1h ago";if(h<24)return`${h}h ago`;
                  const d=Math.round(h/24);return d===1?"1d ago":`${d}d ago`;
                };
                const decodeSnippet=(s:string)=>{
                  try{const el=document.createElement("textarea");el.innerHTML=s;return el.value;}catch{return s;}
                };
                const initials=(name:string)=>{
                  const parts=name.trim().split(/\s+/);
                  if(parts.length>=2)return(parts[0][0]+(parts[parts.length-1][0])).toUpperCase();
                  return(name[0]??"?").toUpperCase();
                };
                return(
                  <div className="adm-rise rounded-2xl overflow-hidden" style={{background:T.panel,border:`1px solid ${T.border}`,boxShadow:T.shadow,animationDelay:"260ms"}}>
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{color:T.inkSoft,fontFamily:T.mono}}>✉️ Inbox</p>
                        <div className="flex items-center gap-3">
                          <button onClick={()=>setFreeComposeOpen(p=>!p)}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
                            style={freeComposeOpen?{background:T.action,color:T.actionText}:{background:T.inset,color:T.inkSoft,border:`1px solid ${T.border}`}}>
                            {freeComposeOpen?"✕ Cancel":"+ Compose"}
                          </button>
                          <button onClick={fetchInbox} className="text-[11px] font-bold transition-opacity hover:opacity-70" style={{color:T.inkFaint}}>↻ Refresh</button>
                        </div>
                      </div>

                      <div className="mb-3 rounded-xl" style={{border:`1px solid ${T.border}`,background:T.inset}}>
                        <button
                          onClick={()=>setBlockedSendersOpen(o=>!o)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                        >
                          <span className="text-[11px] font-bold" style={{color:T.inkSoft}}>
                            🚫 Blocked senders {blockedSenders.length>0&&<span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{background:T.insetStrong,color:T.inkSoft}}>{blockedSenders.length}</span>}
                          </span>
                          <span className="text-[10px]" style={{color:T.inkFaint}}>{blockedSendersOpen?"▲ hide":"▼ show"}</span>
                        </button>
                        {blockedSendersOpen&&(
                          <div className="px-3 pb-2.5" style={{borderTop:`1px solid ${T.rowBorder}`}}>
                            <p className="text-[10px] mt-2 mb-2" style={{color:T.inkFaint}}>Dashboard-only. Hidden here, untouched in Gmail.</p>
                            {blockedSendersLoading&&<span className="text-[10px] font-bold" style={{color:T.inkFaint}}>Loading…</span>}
                            {blockedSenders.length>0?(
                              <div className="flex flex-wrap gap-2">
                                {blockedSenders.map(email=>(
                                  <button
                                    key={email}
                                    onClick={()=>unblockInboxSender(email)}
                                    disabled={blockingSender===email}
                                    className="rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition-all disabled:opacity-50"
                                    style={{border:`1px solid ${T.borderStrong}`,background:T.panelSolid,color:T.inkSoft}}
                                  >
                                    {blockingSender===email?`Restoring…`:`Unblock ${email}`}
                                  </button>
                                ))}
                              </div>
                            ):(
                              !blockedSendersLoading&&<p className="text-[10px]" style={{color:T.inkFaint}}>No blocked senders.</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Freeform compose panel */}
                      {freeComposeOpen&&(
                        <div className="mb-4 p-3 rounded-xl space-y-2" style={{border:`1px solid ${T.border}`,background:T.inset}}>
                          <p className="text-xs font-black" style={{color:T.ink}}>New Email</p>
                          <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" placeholder="To (email address)" value={freeComposeTo} onChange={e=>setFreeComposeTo(e.target.value)} style={{fontFamily:"inherit",border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink}}/>
                          <input className="w-full px-3 py-2 rounded-lg text-sm outline-none" placeholder="Subject" value={freeComposeSubject} onChange={e=>setFreeComposeSubject(e.target.value)} style={{fontFamily:"inherit",border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink}}/>
                          <textarea rows={4} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" placeholder="Write your message — or jot rough notes and hit AI Polish…" value={freeComposeBody} onChange={e=>setFreeComposeBody(e.target.value)} style={{fontFamily:"inherit",border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink}}/>
                          <div className="flex gap-2">
                            <button onClick={polishFreeCompose} disabled={freeComposePolishing||!freeComposeBody.trim()}
                              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                              style={{background:T.violetBg,color:T.violet,border:`1px solid ${T.violetBorder}`}}>
                              {freeComposePolishing?"Polishing…":"✨ AI Polish"}
                            </button>
                            <button onClick={sendFreeCompose} disabled={freeComposeSending||!freeComposeTo.trim()||!freeComposeBody.trim()}
                              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                              style={{background:T.action,color:T.actionText}}>
                              {freeComposeSending?"Sending…":"Send →"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Thread list */}
                      {inboxLoading?(
                        <p className="text-xs py-2" style={{color:T.inkFaint}}>Loading…</p>
                      ):inboxThreads.length===0&&!freeComposeOpen?(
                        <p className="text-xs py-2" style={{color:T.inkFaint}}>No new client emails.</p>
                      ):(
                        <div className="flex flex-col gap-3">
                          {inboxThreads.map(t=>{
                            const isOpen=inboxReplyOpen[t.threadId]??false;
                            const draft=inboxDraft[t.threadId]??"";
                            const isGenerating=inboxDraftLoading[t.threadId]??false;
                            const isSending=inboxSendLoading[t.threadId]??false;
                            const name=t.fromName||t.fromEmail;
                            return(
                              <div key={t.threadId} className="rounded-xl overflow-hidden transition-shadow"
                                   style={t.isUnread
                                     ?{background:T.panelSolid,border:`1px solid ${T.amberBorder}`,borderLeft:`3px solid ${T.amber}`,boxShadow:T.shadow}
                                     :{background:T.panelSolid,border:`1px solid ${T.border}`}}>
                                {/* Sender row */}
                                <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                                    style={{background:T.insetStrong,color:T.ink}}>
                                    {initials(name)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-black" style={{color:T.ink}}>{name}</p>
                                      {t.isUnread&&<span className="text-[10px] font-black rounded-full px-1.5 py-0.5 leading-none" style={{background:T.amber,color:T.actionText}}>NEW</span>}
                                      {t.messageCount>1&&<span className="text-[10px] font-bold" style={{color:T.inkFaint}}>{t.messageCount} msgs</span>}
                                      <span className="text-[10px] font-bold ml-auto" style={{color:t.isUnread?T.amber:T.inkFaint}}>{timeAgo(t.timestamp)}</span>
                                    </div>
                                    <p className="text-[11px] truncate" style={{color:T.inkFaint}}>{t.fromEmail}</p>
                                  </div>
                                </div>
                                {/* Subject + snippet */}
                                <div className="px-3 pb-3">
                                  <p className="text-xs font-bold mb-1" style={{color:T.ink}}>{t.subject}</p>
                                  <p className="text-[12px] leading-relaxed line-clamp-3" style={{color:T.inkSoft}}>{decodeSnippet(t.snippet)}</p>
                                </div>
                                {/* Action buttons */}
                                {(()=>{
                                  const matchedInquiry=inquiries.find(i=>i.email.toLowerCase()===t.fromEmail.toLowerCase());
                                  return(
                                    <div className="flex" style={{borderTop:`1px solid ${T.rowBorder}`}}>
                                      <button
                                        onClick={async()=>{
                                          if(matchedInquiry){
                                            router.push(`/admin/conversation/${matchedInquiry.id}`);
                                          }else{
                                            const created=await createInquiryFromThread(t);
                                            if(created)router.push(`/admin/conversation/${created.id}`);
                                          }
                                        }}
                                        className="flex-1 py-2 text-[11px] font-bold transition-colors hover:bg-black/[0.03]" style={{color:T.inkSoft}}>
                                        ✏️ Draft Reply
                                      </button>
                                      <div className="w-px" style={{background:T.rowBorder}}/>
                                      <button
                                        onClick={()=>blockInboxSender(t)}
                                        disabled={blockingSender===t.fromEmail.toLowerCase()}
                                        className="flex-1 py-2 text-[11px] font-bold transition-colors hover:bg-black/[0.03] disabled:opacity-50" style={{color:T.red}}
                                      >
                                        {blockingSender===t.fromEmail.toLowerCase()?"Blocking…":"🚫 Block Sender"}
                                      </button>
                                      <div className="w-px" style={{background:T.rowBorder}}/>
                                      <a href={`https://mail.google.com/mail/u/0/#inbox/${t.threadId}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="flex-1 py-2 text-[11px] font-bold transition-colors hover:bg-black/[0.03] text-center" style={{color:T.inkSoft}}>
                                        Open in Gmail ↗
                                      </a>
                                    </div>
                                  );
                                })()}
                                {isOpen&&(
                                  <div className="p-3 space-y-2" style={{borderTop:`1px solid ${T.rowBorder}`,background:T.inset}}>
                                    <textarea rows={2} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none" placeholder="Add context for the AI (optional) — e.g. 'Tell them SFSU spots are available May 18'" value={inboxContext[t.threadId]??""} onChange={e=>setInboxContext(p=>({...p,[t.threadId]:e.target.value}))} style={{fontFamily:"inherit",border:`1px solid ${T.border}`,background:T.panelSolid,color:T.inkSoft}}/>
                                    <button onClick={()=>generateInboxDraft(t)} disabled={isGenerating}
                                      className="w-full py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                      style={{background:T.violetBg,color:T.violet,border:`1px solid ${T.violetBorder}`}}>
                                      {isGenerating?"Drafting…":"✨ AI Draft"}
                                    </button>
                                    {draft&&(
                                      <>
                                        <textarea rows={6} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-y" value={draft} onChange={e=>setInboxDraft(p=>({...p,[t.threadId]:e.target.value}))} style={{fontFamily:"inherit",border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink}}/>
                                        <div className="flex gap-2">
                                          <button onClick={()=>navigator.clipboard.writeText(draft).then(()=>showToast("Copied ✓"))}
                                            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                                            style={{background:T.neutralBg,color:T.inkSoft}}>
                                            Copy
                                          </button>
                                          <button onClick={()=>sendInboxReply(t)} disabled={isSending}
                                            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                            style={{background:T.action,color:T.actionText}}>
                                            {isSending?"Sending…":"Send →"}
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })()}

        {/* ── POSES ── */}
        {tab==="poses"&&<PosesTab showToast={showToast}/>}
        {tab==="couplesGuide"&&<CouplesPosingGuideTab showToast={showToast}/>}

        {tab==="locations"&&<LocationsTab showToast={showToast}/>}

        {tab==="bayGuide"&&<BayAreaLocationsManager />}
        {tab==="familyGuide"&&<FamilyGuideTab showToast={showToast}/>}
        {tab==="aboutPage"&&<AboutPhotosTab showToast={showToast}/>}
        {tab==="couplesLocations"&&<CouplesLocationsTab showToast={showToast}/>}

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
                    <button onClick={()=>portfolioFileRef.current?.click()} className="w-full h-44 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2" style={{borderColor:T.borderStrong,background:T.inset}}>
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
                  <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1.5">School <span className="text-slate-300 normal-case">(grads only)</span></label><select className={inp} value={portfolioForm.school} onChange={e=>setPortfolioForm(f=>({...f,school:e.target.value}))}><option value="">— None —</option>{GRAD_SCHOOLS.map(s=><option key={s.slug} value={s.slug}>{s.label}</option>)}</select></div>
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
                <p className="text-xs text-slate-400 mb-4">Check the photos you want (Shift-click to select a range), then apply category and location together in one tap — or delete the selected ones if you added them by mistake. Location is optional and helps SEO later. Duplicate photos already in the queue or your library are skipped automatically. You can also edit each photo individually.</p>
                <input ref={batchFileRef} type="file" accept="image/*" multiple className="hidden" onChange={onBatchFiles}/>
                <datalist id="batch-location-options">{locationOptions.map(loc=><option key={loc} value={loc}/>)}</datalist>

                {batchItems.length>0?(
                  <>
                    {/* Bulk bar: select photos, then apply category + location together (or delete the selected ones) */}
                    <div className="mb-3 p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer select-none">
                          <input type="checkbox" checked={allBatchSelected} onChange={toggleSelectAllBatch} className="w-4 h-4 accent-slate-900"/>
                          {batchSelected.size>0?`${batchSelected.size} selected`:"Select all"}
                        </label>
                        {batchSelected.size>0&&(
                          <button onClick={removeSelectedBatch} className="text-xs font-bold px-3 py-1.5 rounded-lg text-red-500 bg-red-50 hover:bg-red-100 transition-colors">
                            Delete {batchSelected.size} selected
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-16">Category</span>
                        <select value={bulkCategory||categories[0]?.slug||""} onChange={e=>setBulkCategory(e.target.value)} className="flex-1 min-w-[120px] px-2 py-1 rounded-lg text-xs font-medium text-slate-800 outline-none border border-slate-200 bg-white">
                          {categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-500 w-16">Location</span>
                        <input list="batch-location-options" value={bulkLocation} onChange={e=>setBulkLocation(e.target.value)} placeholder="e.g. Crissy Field (optional)" className="flex-1 min-w-[120px] px-2 py-1 rounded-lg text-xs font-medium text-slate-800 outline-none border border-slate-200 bg-white"/>
                      </div>
                      <button onClick={applyBulkTags} className="w-full text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{background:C.grad12}}>
                        Apply category{bulkLocation.trim()?" + location":""} to {batchSelected.size>0?`${batchSelected.size} selected`:"all"}
                      </button>
                    </div>
                    <div className="space-y-2 mb-4">
                      {batchItems.map((item,idx)=>(
                        <div key={item.id} className="flex items-center gap-3 p-2 rounded-xl bg-slate-50 border border-slate-100" style={{borderColor:batchSelected.has(item.id)?C.p1:undefined}}>
                          <input type="checkbox" checked={batchSelected.has(item.id)} onChange={()=>{}} onClick={e=>onBatchCheckboxClick(e,idx,item.id)} className="w-4 h-4 flex-shrink-0 accent-slate-900"/>
                          <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden bg-slate-200">
                            <img src={item.preview} className="w-full h-full object-cover"/>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <input className="w-full px-2 py-1 rounded-lg text-xs font-medium text-slate-800 outline-none border border-slate-200 bg-white" placeholder="Title" value={item.title} onChange={e=>setBatchItems(prev=>prev.map(x=>x.id===item.id?{...x,title:e.target.value}:x))}/>
                            <div className="flex gap-1.5">
                              <select className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs font-medium text-slate-800 outline-none border border-slate-200 bg-white" value={item.category_slug} onChange={e=>setBatchItems(prev=>prev.map(x=>x.id===item.id?{...x,category_slug:e.target.value}:x))}>
                                {categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}
                              </select>
                              <input list="batch-location-options" className="flex-1 min-w-0 px-2 py-1 rounded-lg text-xs font-medium text-slate-800 outline-none border border-slate-200 bg-white" placeholder="Location (optional)" value={item.location} onChange={e=>setBatchItems(prev=>prev.map(x=>x.id===item.id?{...x,location:e.target.value}:x))}/>
                            </div>
                          </div>
                          <button onClick={()=>removeBatchItem(item.id)} className="w-7 h-7 rounded-full bg-slate-200 text-slate-500 text-xs font-bold flex-shrink-0 flex items-center justify-center hover:bg-red-100 hover:text-red-500 transition-colors">✕</button>
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

            {/* ── Home Page Photos ── */}
            <div className={card}>
              <div className="h-[3px]" style={{background:"#111827"}}/>
              <div className="p-6">
                <h2 className="text-base font-black text-slate-900 mb-1">Home Page Photos</h2>
                <p className="text-xs text-slate-400 mb-5">Pick the photo for every slot on the home page. Each slot falls back to an automatic portfolio photo until you set it, so you only need to choose the ones you care about.</p>
                <div className="space-y-4">
                  {([
                    {key:"home_hero_primary",label:"Hero — main photo",helper:"The large photo at the very top of the home page.",category:"grads"},
                    {key:"home_hero_secondary",label:"Hero — small photo",helper:"The small photo tucked beside the main hero photo.",category:"couples"},
                    {key:"home_card_grads",label:"Graduation card",helper:"Photo on the Graduation card in 'Choose your session.'",category:"grads"},
                    {key:"home_card_couples",label:"Couples card",helper:"Photo on the Couples card in 'Choose your session.'",category:"couples"},
                    {key:"home_card_portrait",label:"Portrait card",helper:"Photo on the Portrait card in 'Choose your session.'",category:"families"},
                    {key:"home_couples_1",label:"Couples section — photo 1",helper:"First photo in the 'Couples sessions that feel like a date' gallery.",category:"couples"},
                    {key:"home_couples_2",label:"Couples section — photo 2",helper:"Second photo in the couples gallery.",category:"couples"},
                    {key:"home_couples_3",label:"Couples section — photo 3",helper:"Third photo in the couples gallery.",category:"couples"},
                    {key:"home_story_1",label:"The work grid — photo 1",helper:"Photo 1 in the 'Bright, natural photographs' grid.",category:"all"},
                    {key:"home_story_2",label:"The work grid — photo 2",helper:"Photo 2 in the work grid.",category:"all"},
                    {key:"home_story_3",label:"The work grid — photo 3",helper:"Photo 3 in the work grid.",category:"all"},
                    {key:"home_story_4",label:"The work grid — photo 4",helper:"Photo 4 in the work grid.",category:"all"},
                    {key:"home_story_5",label:"The work grid — photo 5",helper:"Photo 5 in the work grid.",category:"all"},
                    {key:"home_story_6",label:"The work grid — photo 6",helper:"Photo 6 in the work grid.",category:"all"},
                    {key:"home_about_portrait",label:"Chris portrait",helper:"Photo in the 'Hi, I'm Chris' section.",category:"all"},
                    {key:"home_final_cta",label:"Closing banner",helper:"Wide photo in the 'Ready to plan your session?' banner.",category:"all"},
                  ] as {key:string;label:string;helper:string;category:"grads"|"families"|"couples"|"all"}[]).map(({key,label,helper,category})=>{
                    // Show every portfolio photo; for a tagged slot, float the matching category to the top so it's handy without hiding the rest.
                    const pickerImages=category==="all"?portfolioImages:[...portfolioImages.filter(img=>matchesPortfolioGroup(img,category)),...portfolioImages.filter(img=>!matchesPortfolioGroup(img,category))];

                    return(
                      <div key={key}>
                        {key==="home_story_1"&&(
                          <div className="mb-4 rounded-xl border p-3" style={{borderColor:C.borderSubtle,background:C.p3_10}}>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-black uppercase tracking-widest text-slate-700">Work grid — set all {WORK_GRID_KEYS.length} at once</p>
                                <p className="text-xs text-slate-400 mt-0.5">Shift-click to grab a run of photos. They fill photos 1–{WORK_GRID_KEYS.length} in the order you pick them.</p>
                              </div>
                              <button onClick={openGridBatch}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0"
                                style={gridBatchOpen?{background:C.ink,color:C.white,borderColor:C.ink}:{background:C.white,color:C.inkSoft,borderColor:C.borderSubtle}}>
                                {gridBatchOpen?"Cancel":"Select multiple"}
                              </button>
                            </div>
                            {gridBatchOpen&&(
                              <div className="mt-3">
                                {portfolioImages.length>0?(
                                  <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto mb-2">
                                    {portfolioImages.map((img,idx)=>{
                                      const pos=gridBatchPick.indexOf(img.image_url);
                                      return(
                                        <button key={img.id} onClick={e=>onGridPickClick(e,idx)}
                                          className="relative aspect-square rounded-xl overflow-hidden border-2 transition-all hover:scale-105"
                                          style={{borderColor:pos>=0?C.p1:"transparent"}}>
                                          <img src={img.image_url} className="w-full h-full object-cover"/>
                                          {pos>=0&&(
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                              <span className="text-white text-sm font-black w-6 h-6 rounded-full flex items-center justify-center" style={{background:C.p1}}>{pos+1}</span>
                                            </div>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                ):(
                                  <p className="text-xs text-slate-400 mb-2 rounded-xl bg-white border border-slate-100 p-3">Upload portfolio images first.</p>
                                )}
                                <div className="flex items-center gap-2">
                                  <button onClick={applyWorkGridBatch} disabled={gridBatchSaving||gridBatchPick.length===0}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{background:C.grad12,opacity:gridBatchSaving||gridBatchPick.length===0?0.5:1}}>
                                    {gridBatchSaving?"Saving…":`Apply ${gridBatchPick.length} to grid`}
                                  </button>
                                  {gridBatchPick.length>0&&<button onClick={()=>{setGridBatchPick([]);gridBatchAnchorRef.current=null;}} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-slate-500 border border-slate-200">Clear</button>}
                                  <span className="text-xs text-slate-400">{gridBatchPick.length}/{WORK_GRID_KEYS.length} chosen</span>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
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
                              <p className="text-xs text-slate-400 mb-2 rounded-xl bg-slate-50 border border-slate-100 p-3">Upload portfolio images first, then come back here to choose home page photos.</p>
                            )}
                            <div className="flex gap-2">
                              <button onClick={()=>setCoverPickerKey(null)} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500">Cancel</button>
                              {siteSettings[key]&&<button onClick={()=>updateSiteSetting(key,null)} className="text-xs font-bold px-3 py-1.5 rounded-lg text-red-500 bg-red-50">Reset to automatic</button>}
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
                              <p className="text-xs font-black text-slate-800">{siteSettings[key]?"Change photo":"Set photo"}</p>
                              <p className="text-xs text-slate-400">{siteSettings[key]?"Click to pick a different image":"Using an automatic photo"}</p>
                            </div>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Pricing Page Photos ── */}
            <div className={card}>
              <div className="h-[3px]" style={{background:"#111827"}}/>
              <div className="p-6">
                <h2 className="text-base font-black text-slate-900 mb-1">Pricing Page Photos</h2>
                <p className="text-xs text-slate-400 mb-5">Pick which portfolio images appear on the grad, family, and couples pricing pages.</p>
                <div className="space-y-4">
                  {([
                    {key:"pricing_grad_standard_image",label:"Grad package photo",helper:"Shown beside the standard graduation package.",category:"grads"},
                    {key:"pricing_grad_group_image",label:"Group grad photo",helper:"Shown in the group grad package section.",category:"grads"},
                    {key:"pricing_card_families_image",label:"Family rates card cover",helper:"Background photo for the Family rates card on the /pricing page.",category:"families"},
                    {key:"pricing_family_session_image",label:"Family session photo",helper:"Shown beside the family session package.",category:"families"},
                    {key:"pricing_family_extended_image",label:"Extended family photo",helper:"Shown beside the extended family package.",category:"families"},
                    {key:"pricing_couples_standard_image",label:"Couples session photo",helper:"Shown beside the standard couples package.",category:"couples"},
                    {key:"pricing_couples_engagement_image",label:"Engagement session photo",helper:"Shown beside the engagement package.",category:"couples"},
                    {key:"pricing_couples_proposal_image",label:"Proposal coverage photo",helper:"Shown beside the proposal coverage package.",category:"couples"},
                  ] as {key:string;label:string;helper:string;category:"grads"|"families"|"couples"}[]).map(({key,label,helper,category})=>{
                    // Show every portfolio photo; float this package's category to the top so it's handy without hiding the rest.
                    const pickerImages=[...portfolioImages.filter(img=>matchesPortfolioGroup(img,category)),...portfolioImages.filter(img=>!matchesPortfolioGroup(img,category))];

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
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-900">Portfolio Images</p>
                  <span className="text-xs font-bold text-slate-400">({portfolioImages.length})</span>
                </div>
                <button onClick={toggleSeoBatchMode}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors"
                  style={seoBatchMode?{background:C.ink,color:C.white,borderColor:C.ink}:{background:C.white,color:C.inkSoft,borderColor:C.borderSubtle}}>
                  {seoBatchMode?"Done selecting":"Select multiple for SEO"}
                </button>
              </div>
              {seoBatchMode&&(
                <div className="flex items-center justify-between gap-2 mb-3 rounded-xl border px-3 py-2" style={{borderColor:C.borderSubtle,background:C.p3_10}}>
                  <p className="text-xs font-bold text-slate-700">{seoBatchSelected.length} selected · check the grad photos that share the same tags</p>
                  <div className="flex gap-2">
                    {seoBatchSelected.length>0&&<button onClick={()=>setSeoBatchSelected([])} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-white text-slate-500 border border-slate-200">Clear</button>}
                    <button onClick={()=>{if(seoBatchSelected.length===0){showToast("Select at least one photo",false);return;}setSeoBatchOpen(true);}}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{background:C.grad12,opacity:seoBatchSelected.length===0?0.5:1}}>
                      Tag {seoBatchSelected.length||""} selected
                    </button>
                  </div>
                </div>
              )}
              {seoBatchMode&&seoBatchOpen&&(
                <div className={`${card} mb-3`} style={{outline:"2px solid #111827"}}>
                  <PortfolioSeoPanel
                    draft={seoBatchDraft}
                    setDraft={setSeoBatchDraft}
                    heading={`Batch SEO · ${seoBatchSelected.length} photos`}
                    subheading={seoBatchProgress?`Saving ${seoBatchProgress.done} of ${seoBatchProgress.total}…`:"These tags apply to every selected photo. Each photo still gets its own AI-written alt text."}
                    saveLabel={`Generate with AI and save (${seoBatchSelected.length})`}
                    saving={seoBatchSaving}
                    onSave={saveBatchPortfolioSeo}
                    onClose={()=>setSeoBatchOpen(false)}/>
                </div>
              )}
              {portfolioLoading?[...Array(3)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-20 mb-3 bg-slate-100"/>):(
                portfolioImages.length===0?<p className="text-sm text-slate-400 font-medium">No portfolio images yet — upload the first one above.</p>:(
                  <div className="space-y-3">
                    {portfolioImages.map(image=>{
                      const isGradImage=matchesPortfolioGroup(image,"grads");
                      const batchSelected=seoBatchSelected.includes(image.id);
                      return(
                      <div key={image.id} className={card} style={editingPortfolioImage?.id===image.id||(seoBatchMode&&batchSelected)?{outline:"2px solid #111827"}:{}}>
                        <div className="flex">
                          <div className="w-24 h-24 flex-shrink-0 overflow-hidden bg-slate-100 relative">
                            <img src={image.image_url} className="w-full h-full object-cover"/>
                            {seoBatchMode&&isGradImage&&(
                              <button onClick={()=>toggleSeoBatchSelect(image.id)} title={batchSelected?"Deselect":"Select for batch SEO"}
                                className="absolute inset-0 flex items-center justify-center transition-colors"
                                style={{background:batchSelected?"rgba(17,24,39,0.45)":"rgba(0,0,0,0.12)"}}>
                                <span className="w-6 h-6 rounded-md flex items-center justify-center text-sm font-black border-2"
                                  style={batchSelected?{background:C.white,borderColor:C.white,color:C.ink}:{background:"rgba(255,255,255,0.45)",borderColor:C.white,color:"transparent"}}>
                                  ✓
                                </span>
                              </button>
                            )}
                          </div>
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
                                  style={image.hero_carousel?{background:T.action,color:T.actionText}:{background:T.inset,color:T.inkSoft}}>
                                  {image.hero_carousel?"★":"☆"}
                                </button>
                                {isGradImage&&<button onClick={()=>startPortfolioSeo(image)} className="text-xs font-bold px-3 py-1.5 rounded-lg" style={{background:C.p3_10,color:C.ink}}>SEO</button>}
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
                        {portfolioSeoEditorId===image.id&&(
                          <PortfolioSeoPanel
                            draft={portfolioSeoDraft}
                            setDraft={setPortfolioSeoDraft}
                            heading="AI SEO description"
                            subheading="Pick what is visible, then save the generated title and alt text to this photo."
                            saveLabel="Generate with AI and save"
                            saving={portfolioSeoSavingId===image.id}
                            onSave={()=>savePortfolioSeoDescription(image)}
                            onClose={()=>setPortfolioSeoEditorId(null)}/>
                        )}
                      </div>
                    )})}
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* ── CASE STUDIES ── */}
        {tab==="caseStudies"&&<CaseStudiesTab showToast={showToast} categories={categories} />}

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

        {tab==="blog"&&<BlogTab showToast={showToast}/>}

        {tab==="navigation"&&<NavigationTab showToast={showToast}/>}

                {/* ── ANALYTICS ── */}
        {tab==="analytics"&&(
          <AnalyticsTab/>
        )}

        {tab==="payments"&&(
          <PaymentAnalyticsTab/>
        )}

        {tab==="funnel"&&(
          <InquiryAnalyticsTab/>
        )}

        {tab==="attribution"&&(
          <AttributionTab/>
        )}

        {/* ── INQUIRIES ── */}
        {tab==="inquiries"&&(
          <div className="space-y-4">

            {/* ── Header / toolbar ── */}
            <div className="adm-rise rounded-2xl p-4 sm:p-5" style={{background:T.panel,border:`1px solid ${T.border}`,boxShadow:T.shadow}}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] mb-1" style={{color:T.inkFaint}}>Client Work</p>
                  <h2 className="text-xl font-black leading-none" style={{color:T.ink}}>Inquiries</h2>
                  <p className="text-xs font-medium mt-1.5" style={{color:T.inkSoft}}>
                    {inquiries.filter(i=>i.status==="new").length} new · {inquiries.length} total
                  </p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={inquirySort}
                    onChange={e=>setInquirySort(e.target.value as typeof inquirySort)}
                    className="text-[11px] font-bold px-2.5 py-2 rounded-xl outline-none cursor-pointer"
                    style={{border:`1px solid ${T.border}`,background:T.panelSolid,color:T.inkSoft,fontFamily:"inherit"}}>
                    <option value="needs_reply">Needs reply first</option>
                    <option value="paid_recently">Paid recently</option>
                    <option value="newest">Newest inquiry</option>
                    <option value="oldest">Oldest inquiry</option>
                    <option value="session_date">Session date</option>
                    <option value="alpha">A → Z</option>
                  </select>
                  <button onClick={syncPayments} disabled={syncLoading}
                    className="text-xs font-bold px-3 py-2 rounded-xl transition-all hover:-translate-y-px disabled:opacity-50 flex items-center gap-1.5"
                    style={{background:T.greenBg,color:T.green,border:`1px solid ${T.greenBorder}`}}>
                    {syncLoading?<><span className="animate-spin inline-block">◌</span> Scanning…</>:"💳 Sync Payments"}
                  </button>
                  <button onClick={syncTimeline} disabled={timelineSyncLoading}
                    className="text-xs font-bold px-3 py-2 rounded-xl transition-all hover:-translate-y-px disabled:opacity-50 flex items-center gap-1.5"
                    style={{background:T.violetBg,color:T.violet,border:`1px solid ${T.violetBorder}`}}>
                    {timelineSyncLoading?<><span className="animate-spin inline-block">◌</span> Syncing…</>:"📬 Sync Timeline"}
                  </button>
                  <button onClick={fetchInquiries} disabled={inquiriesLoading}
                    className="text-xs font-bold px-3 py-2 rounded-xl transition-all hover:-translate-y-px flex items-center gap-1.5"
                    style={{background:T.action,color:T.actionText}}>
                    {inquiriesLoading?"Loading…":"↻ Refresh"}
                  </button>
                </div>
              </div>

              {/* Gmail status row */}
              <div className="flex items-center justify-between gap-3 flex-wrap mt-4 pt-3" style={{borderTop:`1px solid ${T.rowBorder}`}}>
                <p className="text-xs font-medium flex items-center gap-2" style={{color:T.inkSoft}}>
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:gmailConnected?T.green:T.inkFaint}}/>
                  {gmailConnected
                    ?<>Gmail connected — sending as <span className="font-bold" style={{color:T.ink}}>{gmailEmail}</span></>
                    :"Gmail not connected — link it to send replies without leaving this page"}
                </p>
                {gmailConnected?(
                  <button onClick={disconnectGmail}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                    style={{background:T.redBg,color:T.red}}>
                    Disconnect
                  </button>
                ):(
                  <a href="/api/gmail/auth"
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-85"
                    style={{background:T.action,color:T.actionText}}>
                    Connect Gmail →
                  </a>
                )}
              </div>
            </div>

            {/* ── Filter chips ── */}
            {(()=>{
              const needsReplyFn=inquiryNeedsReply;
              const chips=[
                {key:"all" as const,label:"All",count:inquiries.length},
                {key:"needs_reply" as const,label:"Needs reply",count:inquiries.filter(needsReplyFn).length},
                {key:"new" as const,label:"New",count:inquiries.filter(i=>i.status==="new").length},
                {key:"responded" as const,label:"Responded",count:inquiries.filter(i=>i.status==="responded").length},
                {key:"archived" as const,label:"Archived",count:inquiries.filter(i=>i.status==="archived").length},
                {key:"not_interested" as const,label:"Not interested",count:inquiries.filter(i=>i.status==="not_interested").length},
              ];
              return(
                <div className="adm-rise flex gap-1.5 flex-wrap" style={{animationDelay:"80ms"}}>
                  {chips.map(c=>{
                    const active=inquiryFilter===c.key;
                    return(
                      <button key={c.key} onClick={()=>setInquiryFilter(c.key)}
                        className="text-[11px] font-bold px-3 py-1.5 rounded-full transition-all"
                        style={active
                          ?{background:T.action,color:T.actionText}
                          :{background:T.panel,color:T.inkSoft,border:`1px solid ${T.border}`}}>
                        {c.label} <span style={{color:active?"rgba(255,255,255,0.65)":T.inkFaint}}>{c.count}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Inquiry list */}
            <div className="space-y-3">

              {/* Sync result banner */}
              {(syncResult!==null||syncMsg)&&(
                <div className="rounded-xl px-4 py-3 text-sm"
                     style={syncResult?.length?{background:T.greenBg,border:`1px solid ${T.greenBorder}`}:{background:T.inset,border:`1px solid ${T.border}`}}>
                  {syncMsg&&<p className="text-xs" style={{color:T.inkSoft}}>{syncMsg}</p>}
                  {syncResult?.length?(
                    <div className="space-y-1">
                      <p className="text-xs font-black mb-2" style={{color:T.green}}>✓ {syncResult.length} payment{syncResult.length===1?"":"s"} found — review &amp; approve in the Payments tab</p>
                      {syncResult.map((r,i)=>(
                        <div key={i} className="flex items-center gap-3 text-xs flex-wrap" style={{color:T.inkSoft}}>
                          <span className="font-semibold">{r.name}</span>
                          {r.email&&<span style={{color:T.inkFaint}}>{r.email}</span>}
                          {r.amount&&<span className="font-bold" style={{color:T.green}}>{r.amount}</span>}
                          {r.method&&<span style={{color:T.inkFaint}}>via {r.method}</span>}
                          {r.paidAt&&<span style={{color:T.inkFaint}}>{new Date(r.paidAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
                          {r.paymentType&&r.paymentType!=="deposit_1"&&<span className="font-semibold capitalize" style={{color:T.amber}}>{r.paymentType.replace("_"," ")}</span>}
                          {r.orphan&&<span className="font-bold" style={{color:T.red}}>no inquiry</span>}
                        </div>
                      ))}
                    </div>
                  ):syncResult?.length===0&&!syncMsg?(
                    <p className="text-xs" style={{color:T.inkSoft}}>No new Pixieset payments found in Gmail.</p>
                  ):null}
                </div>
              )}

              {inquiriesLoading?(
                <div className="text-center py-16 text-sm rounded-2xl" style={{color:T.inkFaint,background:T.panel,border:`1px solid ${T.border}`}}>Loading inquiries…</div>
              ):inquiries.length===0?(
                <div className="text-center py-16 rounded-2xl" style={{background:T.panel,border:`1px solid ${T.border}`}}>
                  <p className="text-2xl mb-2">📭</p>
                  <p className="font-semibold" style={{color:T.inkSoft}}>No inquiries yet</p>
                  <p className="text-xs mt-1" style={{color:T.inkFaint}}>New contact form submissions will appear here</p>
                </div>
              ):(()=>{
                const needsReply=inquiryNeedsReply;
                const hasUnread=(i:Inquiry)=>!!inboxThreads.find(t=>t.fromEmail.toLowerCase()===i.email.toLowerCase()&&t.isUnread);
                const todayMs=new Date().setHours(0,0,0,0);
                const filteredInquiries=inquiries.filter(i=>{
                  if(inquiryFilter==="all")return true;
                  if(inquiryFilter==="needs_reply")return needsReply(i);
                  return i.status===inquiryFilter;
                });
                if(filteredInquiries.length===0)return(
                  <div className="text-center py-12 rounded-2xl" style={{background:T.panel,border:`1px solid ${T.border}`}}>
                    <p className="text-sm font-semibold" style={{color:T.inkSoft}}>Nothing matches this filter</p>
                    <button onClick={()=>setInquiryFilter("all")} className="text-xs font-bold mt-1 hover:underline" style={{color:T.inkFaint}}>Show all →</button>
                  </div>
                );
                const sortedInquiries=[...filteredInquiries].sort((a,b)=>{
                  if(inquirySort==="needs_reply"){
                    const aPriority=(hasUnread(a)?0:1)*2+(needsReply(a)?0:1);
                    const bPriority=(hasUnread(b)?0:1)*2+(needsReply(b)?0:1);
                    if(aPriority!==bPriority)return aPriority-bPriority;
                    return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
                  }
                  if(inquirySort==="paid_recently"){
                    // Most recent payment first; unpaid sink to bottom
                    const aPaid=a.payment_status==="paid";
                    const bPaid=b.payment_status==="paid";
                    if(aPaid!==bPaid)return aPaid?-1:1;
                    const aP=a.deposit_paid_at?new Date(a.deposit_paid_at).getTime():a.payment_detected_at?new Date(a.payment_detected_at).getTime():0;
                    const bP=b.deposit_paid_at?new Date(b.deposit_paid_at).getTime():b.payment_detected_at?new Date(b.payment_detected_at).getTime():0;
                    return bP-aP;
                  }
                  if(inquirySort==="newest")return new Date(b.created_at).getTime()-new Date(a.created_at).getTime();
                  if(inquirySort==="oldest")return new Date(a.created_at).getTime()-new Date(b.created_at).getTime();
                  if(inquirySort==="alpha")return a.name.localeCompare(b.name);
                  // session_date: upcoming closest first, no-date at end
                  const aD=a.session_date?new Date(a.session_date+"T12:00:00").getTime():null;
                  const bD=b.session_date?new Date(b.session_date+"T12:00:00").getTime():null;
                  const aFut=aD&&aD>=todayMs?aD:Infinity;
                  const bFut=bD&&bD>=todayMs?bD:Infinity;
                  return aFut-bFut;
                });
                return sortedInquiries.map(inq=>{
                  const isOpen=editingInquiry?.id===inq.id;
                  const statusMeta=INQ_STATUS[inq.status as keyof typeof INQ_STATUS]??INQ_STATUS.archived;
                  const hasDraft=!!drafts[inq.id];
                  const unreadThread=inboxThreads.find(t=>t.fromEmail.toLowerCase()===inq.email.toLowerCase()&&t.isUnread&&!dismissedThreadIds.has(t.threadId));

                  const highlighted=!!unreadThread||needsReply(inq);
                  return(
                    <div key={inq.id}
                         className="rounded-2xl overflow-hidden transition-shadow hover:shadow-md"
                         style={highlighted
                           ?{background:T.panelSolid,border:`1px solid ${T.amberBorder}`,borderLeft:`3px solid ${T.amber}`,boxShadow:T.shadow}
                           :{background:T.panelSolid,border:`1px solid ${T.border}`,borderLeft:`3px solid ${statusMeta.color}`}}>

                      {/* ── Card header (always visible) ── */}
                      <div className="flex items-stretch">
                        {/* Clickable info area — div so links inside remain functional */}
                        <div
                          onClick={()=>setEditingInquiry(isOpen?null:inq)}
                          className="flex-1 min-w-0 p-4 sm:p-5 transition-colors duration-150 cursor-pointer hover:bg-black/[0.02]">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                  style={{background:statusMeta.bg,color:statusMeta.color}}>
                              {statusMeta.label}
                            </span>
                            {highlighted&&!unreadThread&&(
                              <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                    style={{background:T.amberBg,color:T.amber}}>
                                Needs reply
                              </span>
                            )}
                            {unreadThread&&(
                              <span className="flex items-center gap-0.5">
                                <button
                                  onClick={e=>{e.stopPropagation();router.push(`/admin/conversation/${inq.id}`);}}
                                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-l-full animate-pulse"
                                  style={{background:T.amber,color:T.actionText}}>
                                  ✉ New Reply
                                </button>
                                <button
                                  onClick={e=>{e.stopPropagation();dismissUnreadThread(unreadThread.threadId);}}
                                  className="flex items-center justify-center text-[10px] font-black px-1.5 py-0.5 rounded-r-full leading-none"
                                  title="Dismiss new reply"
                                  style={{background:T.red,color:T.actionText}}>
                                  ✕
                                </button>
                              </span>
                            )}
                            <p className="text-sm font-black" style={{color:T.ink}}>{inq.name}</p>
                            <p className="text-xs" style={{color:T.inkFaint}}>
                              {new Date(inq.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
                            </p>
                          </div>
                          {/* Contact + session info — links stop propagation so they don't toggle the card */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mb-2.5">
                            <a href={`mailto:${inq.email}`}
                               onClick={e=>e.stopPropagation()}
                               className="font-semibold underline decoration-dotted underline-offset-2 hover:opacity-70 transition-opacity"
                               style={{color:T.inkSoft}}>{inq.email}</a>
                            {inq.phone&&(
                              <>
                                <span style={{color:T.inkFaint}}>·</span>
                                <a href={`tel:${inq.phone}`}
                                   onClick={e=>e.stopPropagation()}
                                   className="font-medium hover:underline transition-colors"
                                   style={{color:T.inkSoft}}>
                                  {inq.phone}
                                </a>
                              </>
                            )}
                            <span style={{color:T.inkFaint}}>·</span>
                            {editingSessionType===inq.id?(
                              <SessionTypeEditor
                                id={inq.id}
                                value={inq.session_type??""}
                                onSave={saveSessionType}
                                onCancel={()=>setEditingSessionType(null)}
                              />
                            ):(
                              <button
                                onClick={e=>{e.stopPropagation();setEditingSessionType(inq.id);}}
                                className="font-semibold transition-colors group flex items-center gap-1"
                                style={{color:T.inkSoft}}
                                title="Edit session type">
                                {inq.session_type||<span className="italic" style={{color:T.inkFaint}}>Set type</span>}
                                <span className="opacity-0 group-hover:opacity-100 text-[9px] transition-opacity" style={{color:T.inkFaint}}>✏️</span>
                              </button>
                            )}
                            {inq.date_in_mind&&<><span style={{color:T.inkFaint}}>·</span><span style={{color:T.inkSoft}}>{inq.date_in_mind}</span></>}
                            {inq.school&&<><span style={{color:T.inkFaint}}>·</span><span style={{color:T.inkSoft}}>{inq.school}</span></>}
                          </div>
                          {/* Payment / confirmation status pills */}
                          {(inq.deposit_paid_at||inq.invoice_sent_at||inq.contract_sent_at||inq.confirmation_sent_at||inq.gallery_delivered_at)&&(
                            <div className="flex flex-wrap gap-1 mb-2">
                              {inq.invoice_sent_at&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{background:T.blueBg,color:T.blue}}>
                                  📄 Invoice {new Date(inq.invoice_sent_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                                </span>
                              )}
                              {inq.contract_sent_at&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{background:T.violetBg,color:T.violet}}>
                                  📝 Contract {new Date(inq.contract_sent_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                                </span>
                              )}
                              {inq.deposit_paid_at&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1"
                                      style={{background:T.greenBg,color:T.green}}>
                                  💳 Paid {new Date(inq.deposit_paid_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                                  {inq.confirmation_sent_at?(
                                    <span style={{color:T.green}}>· ✉ Confirmed</span>
                                  ):(
                                    <span style={{color:T.amber}}>· ✉ Not confirmed</span>
                                  )}
                                </span>
                              )}
                              {inq.gallery_delivered_at&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{background:T.amberBg,color:T.amber}}>
                                  🖼 Gallery {new Date(inq.gallery_delivered_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                                </span>
                              )}
                              {inq.deposit_paid_at&&finalPaymentIds.has(inq.id)&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{background:T.greenBg,color:T.green,border:`1px solid ${T.greenBorder}`}}>
                                  💳 Final Paid ✓
                                </span>
                              )}
                              {inq.deposit_paid_at&&!finalPaymentIds.has(inq.id)&&(
                                <button onClick={e=>{e.stopPropagation();const isOpen=cardPaymentId===inq.id;setCardPaymentId(isOpen?null:inq.id);setCardPaymentAmount(isOpen?"":deposit1Amounts.get(inq.id)??"");setCardPaymentMethod("Venmo");}}
                                  className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full cursor-pointer"
                                  style={{background:T.blueBg,color:T.blue}}>
                                  💳 Record 2nd
                                </button>
                              )}
                            </div>
                          )}
                          {cardPaymentId===inq.id&&(
                            <div className="mt-2 rounded-xl p-3" style={{background:T.greenBg,border:`1px solid ${T.greenBorder}`}} onClick={e=>e.stopPropagation()}>
                              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{color:T.green}}>Record Final Payment</p>
                              <div className="flex gap-2 mb-2">
                                <input type="text" placeholder="Amount (e.g. 150)" value={cardPaymentAmount}
                                  onChange={e=>setCardPaymentAmount(e.target.value)}
                                  className="flex-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold outline-none"
                                  style={{border:`1px solid ${T.greenBorder}`,background:T.panelSolid,color:T.ink}}/>
                                <select value={cardPaymentMethod} onChange={e=>setCardPaymentMethod(e.target.value)}
                                  className="rounded-lg px-2 py-1.5 text-xs font-bold outline-none"
                                  style={{border:`1px solid ${T.greenBorder}`,background:T.panelSolid,color:T.ink}}>
                                  <option>Venmo</option><option>Zelle</option><option>PayPal</option><option>Cash App</option><option>Cash</option><option>Other</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={()=>recordCardPayment(inq.id)} disabled={!cardPaymentAmount||cardPaymentSaving}
                                  className="flex-1 rounded-lg py-1.5 text-xs font-black disabled:opacity-50"
                                  style={{background:T.green,color:"#0d1f15"}}>
                                  {cardPaymentSaving?"Saving…":"Record Payment ✓"}
                                </button>
                                <button onClick={e=>{e.stopPropagation();setCardPaymentId(null);setCardPaymentAmount("");}}
                                  className="px-3 rounded-lg py-1.5 text-xs font-bold"
                                  style={{background:T.neutralBg,color:T.inkSoft}}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                          {/* Message preview */}
                          {!isOpen?(
                            <div>
                              <p className="text-xs leading-relaxed line-clamp-2 font-medium" style={{color:T.inkSoft}}>
                                &ldquo;{inq.message}&rdquo;
                              </p>
                              {inq.message.length>120&&(
                                <p className="text-[10px] font-bold mt-1" style={{color:T.inkFaint}}>Read full message ↓</p>
                              )}
                            </div>
                          ):(
                            <p className="text-[10px] font-bold" style={{color:T.inkFaint}}>▲ Collapse</p>
                          )}
                          {/* Quick status buttons — always visible */}
                          <div className="flex items-center gap-1 mt-2 flex-wrap" onClick={e=>e.stopPropagation()}>
                            {(["new","responded","archived","not_interested"] as const).map(s=>(
                              <button key={s}
                                onClick={()=>updateInquiryStatus(inq.id,s)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all hover:opacity-80"
                                style={inq.status===s
                                  ?{background:INQ_STATUS[s].bg,color:INQ_STATUS[s].color,fontWeight:800,boxShadow:`inset 0 0 0 1px ${INQ_STATUS[s].color}33`}
                                  :{background:T.inset,color:T.inkFaint}}>
                                {s==="new"?"● New":s==="responded"?"✓ Replied":s==="not_interested"?"✕ Not Int.":"○ Archive"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Right: action buttons */}
                        <div className="flex flex-col justify-center gap-2 p-3 sm:p-4 flex-shrink-0" style={{borderLeft:`1px solid ${T.rowBorder}`}}>
                          {/* Primary: open full conversation page */}
                          <a href={`/admin/conversation/${inq.id}`}
                            onClick={e=>e.stopPropagation()}
                            className="text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-85 flex items-center gap-1.5 whitespace-nowrap text-center justify-center"
                            style={{background:T.action,color:T.actionText}}>
                            💬 Open Thread
                          </a>
                          {/* Secondary: quick draft without leaving admin */}
                          <button
                            onClick={e=>{e.stopPropagation();if(!isOpen)setEditingInquiry(inq);generateDraft(inq);}}
                            disabled={draftLoading===inq.id}
                            className="text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap justify-center"
                            style={{background:T.violetBg,color:T.violet,border:`1px solid ${T.violetBorder}`}}>
                            {draftLoading===inq.id?(
                              <><span className="animate-spin inline-block">◌</span> Writing…</>
                            ):hasDraft?(
                              <>↻ Redraft</>
                            ):(
                              <>✦ Quick Draft</>
                            )}
                          </button>
                          {hasDraft&&(
                            <button
                              onClick={e=>{e.stopPropagation();if(!isOpen)setEditingInquiry(inq);copyDraft(inq.id);}}
                              className="text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all hover:opacity-80 flex items-center gap-1 justify-center"
                              style={draftCopied===inq.id?{background:T.green,color:T.actionText}:{background:T.inset,color:T.inkSoft}}>
                              {draftCopied===inq.id?"✓ Copied":"📋 Copy"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ── Expanded detail panel ── */}
                      {isOpen&&(
                        <div style={{borderTop:`1px solid ${T.rowBorder}`}}>

                          {/* Session details */}
                          {(inq.school||inq.instagram||inq.people||inq.preferred_time||inq.location)&&(
                            <div className="p-4 sm:p-5" style={{background:T.inset}}>
                              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:T.inkFaint}}>Session Details</p>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                                {inq.school&&<div><span className="font-bold uppercase tracking-wide text-[10px]" style={{color:T.inkFaint}}>School / Campus </span><span className="font-medium" style={{color:T.ink}}>{inq.school}</span></div>}
                                {inq.people&&<div><span className="font-bold uppercase tracking-wide text-[10px]" style={{color:T.inkFaint}}>People </span><span className="font-medium" style={{color:T.ink}}>{inq.people}</span></div>}
                                {inq.preferred_time&&<div><span className="font-bold uppercase tracking-wide text-[10px]" style={{color:T.inkFaint}}>Preferred time </span><span className="font-medium" style={{color:T.ink}}>{fmt12h(inq.preferred_time)}</span></div>}
                                {inq.location&&<div><span className="font-bold uppercase tracking-wide text-[10px]" style={{color:T.inkFaint}}>Desired location </span><span className="font-medium" style={{color:T.ink}}>{inq.location}</span></div>}
                                {inq.instagram&&<div><span className="font-bold uppercase tracking-wide text-[10px]" style={{color:T.inkFaint}}>Instagram </span><span className="font-medium" style={{color:T.ink}}>@{inq.instagram.replace(/^@/,"")}</span></div>}
                              </div>
                            </div>
                          )}

                          {/* Full message */}
                          <div className="p-4 sm:p-5" style={{background:T.inset,borderTop:`1px solid ${T.rowBorder}`}}>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{color:T.inkFaint}}>Message</p>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{color:T.ink}}>{inq.message}</p>
                          </div>

                          {/* ── AI Draft section ── */}
                          <div className="p-4 sm:p-5 space-y-4" style={{borderTop:`1px solid ${T.rowBorder}`}}>
                            {/* Section header */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{background:T.violetBg,color:T.violet}}>✦</div>
                                <p className="text-sm font-black" style={{color:T.ink}}>AI Draft Reply</p>
                              </div>
                              <button
                                onClick={()=>generateDraft(inq)}
                                disabled={draftLoading===inq.id}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
                                style={{background:T.violetBg,color:T.violet}}>
                                {draftLoading===inq.id?<><span className="animate-spin inline-block">◌</span> Writing…</>:"↻ Regenerate"}
                              </button>
                            </div>

                            {/* Draft textarea */}
                            {hasDraft?(
                              <div className="space-y-2">
                                <div className="relative">
                                  <textarea
                                    value={drafts[inq.id]}
                                    onChange={e=>setDrafts(p=>({...p,[inq.id]:e.target.value}))}
                                    rows={9}
                                    className="w-full leading-relaxed rounded-xl p-4 resize-none sm:resize-y outline-none"
                                    style={{border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink,fontFamily:"inherit",fontSize:"16px"}}
                                  />
                                  <button
                                    onClick={()=>copyDraft(inq.id)}
                                    className="absolute top-2.5 right-2.5 text-xs font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                                    style={draftCopied===inq.id?{background:T.green,color:T.actionText}:{background:T.panelSolid,color:T.inkSoft,border:`1px solid ${T.border}`,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                                    {draftCopied===inq.id?"✓ Copied":"📋 Copy"}
                                  </button>
                                </div>
                                {/* Send action row */}
                                {gmailConnected?(
                                  <button
                                    onClick={()=>openCompose(inq)}
                                    className="w-full text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-90 flex items-center justify-center gap-2"
                                    style={{background:T.action,color:T.actionText}}>
                                    ✉️ Send from Gmail
                                  </button>
                                ):(
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="text-[11px] font-medium" style={{color:T.inkFaint}}>Copy → paste into Gmail → send to {inq.email}</p>
                                    <a href={`mailto:${inq.email}?subject=Re: Your inquiry&body=${encodeURIComponent(drafts[inq.id])}`}
                                       className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                                       style={{background:T.inset,color:T.inkSoft}}>
                                      Open in Gmail →
                                    </a>
                                  </div>
                                )}
                              </div>
                            ):(
                              <div className="rounded-xl p-6 text-center" style={{border:`1px dashed ${T.borderStrong}`,background:T.inset}}>
                                <p className="text-sm" style={{color:T.inkSoft}}>Click <strong>✦ Quick Draft</strong> to generate a personalized email</p>
                                <p className="text-xs mt-1" style={{color:T.inkFaint}}>Uses your Obsidian vault + live availability data</p>
                              </div>
                            )}

                            {/* Refine row */}
                            {hasDraft&&(
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest" style={{color:T.inkFaint}}>Refine draft</p>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={draftFeedback[inq.id]??""}
                                    onChange={e=>setDraftFeedback(p=>({...p,[inq.id]:e.target.value}))}
                                    onKeyDown={e=>{if(e.key==="Enter"&&draftFeedback[inq.id]?.trim())generateDraft(inq,draftFeedback[inq.id]);}}
                                    placeholder='e.g. "be more direct" · "remove the pricing mention" · "add turnaround time"'
                                    className="flex-1 px-3 py-2.5 rounded-xl outline-none"
                                    style={{border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink,fontFamily:"inherit",fontSize:"16px"}}
                                  />
                                  <button
                                    onClick={()=>{if(draftFeedback[inq.id]?.trim())generateDraft(inq,draftFeedback[inq.id]);}}
                                    disabled={!draftFeedback[inq.id]?.trim()||draftLoading===inq.id}
                                    className="text-xs font-bold px-4 py-2.5 rounded-xl transition-all hover:opacity-80 disabled:opacity-30 flex-shrink-0"
                                    style={{background:T.action,color:T.actionText}}>
                                    {draftLoading===inq.id?"…":"Refine"}
                                  </button>
                                </div>
                                {draftFeedback[inq.id]?.trim()&&(
                                  <button
                                    onClick={()=>saveRuleFromFeedback(inq.id)}
                                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5"
                                    style={ruleSaved===inq.id?{background:T.green,color:T.actionText}:{background:T.panelSolid,color:T.violet,border:`1px solid ${T.violetBorder}`}}>
                                    {ruleSaved===inq.id?"✓ Saved to Obsidian":"➕ Always remember this"}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Learn from actual email */}
                            {hasDraft&&(
                              <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${T.border}`}}>
                                <button
                                  onClick={()=>setShowLearnPanel(p=>({...p,[inq.id]:!p[inq.id]}))}
                                  className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-black/[0.02] text-left"
                                  style={{background:showLearnPanel[inq.id]?T.inset:"transparent"}}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">🧠</span>
                                    <div>
                                      <p className="text-xs font-bold" style={{color:T.ink}}>What did you actually send?</p>
                                      <p className="text-[10px]" style={{color:T.inkFaint}}>Paste your email → Claude extracts style rules automatically</p>
                                    </div>
                                  </div>
                                  <span className="text-xs" style={{color:T.inkFaint}}>{showLearnPanel[inq.id]?"▲":"▼"}</span>
                                </button>
                                {showLearnPanel[inq.id]&&(
                                  <div className="p-4 space-y-3" style={{background:T.inset,borderTop:`1px solid ${T.rowBorder}`}}>
                                    <textarea
                                      value={actualSent[inq.id]??""}
                                      onChange={e=>setActualSent(p=>({...p,[inq.id]:e.target.value}))}
                                      placeholder="Paste the final email you sent here…"
                                      rows={6}
                                      className="w-full leading-relaxed rounded-xl p-3 resize-none sm:resize-y outline-none"
                                      style={{border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink,fontFamily:"inherit",fontSize:"16px"}}
                                    />
                                    <button
                                      onClick={()=>analyzeAndLearn(inq)}
                                      disabled={!actualSent[inq.id]?.trim()||learnLoading===inq.id}
                                      className="text-xs font-bold px-4 py-2 rounded-xl transition-all hover:opacity-80 disabled:opacity-30 flex items-center gap-1.5"
                                      style={{background:T.action,color:T.actionText}}>
                                      {learnLoading===inq.id?<><span className="animate-spin inline-block">◌</span> Analyzing…</>:"🧠 Learn from this →"}
                                    </button>
                                    {learnedRules[inq.id]?.length>0&&(
                                      <div className="rounded-xl p-3 space-y-2.5" style={{background:T.greenBg,border:`1px solid ${T.greenBorder}`}}>
                                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{color:T.green}}>Rules extracted from your edits</p>
                                        <ul className="space-y-1.5">
                                          {learnedRules[inq.id].map((rule,i)=>(
                                            <li key={i} className="text-xs flex gap-2 items-start" style={{color:T.ink}}>
                                              <span className="mt-0.5 flex-shrink-0" style={{color:T.green}}>✓</span>
                                              <span>{rule}</span>
                                            </li>
                                          ))}
                                        </ul>
                                        <p className="text-[10px]" style={{color:T.inkFaint}}>Saved to Obsidian vault automatically</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* ── Compose & send panel (Gmail connected) ── */}
                          {composeOpen[inq.id]&&(
                            <div className="p-4 sm:p-5 space-y-3" style={{background:T.greenBg,borderTop:`1px solid ${T.rowBorder}`}}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">✉️</span>
                                  <p className="text-sm font-black" style={{color:T.ink}}>Send Email</p>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:T.panelSolid,color:T.green,border:`1px solid ${T.greenBorder}`}}>via {gmailEmail}</span>
                                </div>
                                <button onClick={()=>setComposeOpen(p=>({...p,[inq.id]:false}))} className="text-lg leading-none transition-opacity hover:opacity-70" style={{color:T.inkFaint}}>×</button>
                              </div>
                              {/* To (read-only) */}
                              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm" style={{background:T.inset,border:`1px solid ${T.border}`}}>
                                <span className="text-[10px] font-bold uppercase tracking-widest flex-shrink-0" style={{color:T.inkFaint}}>To</span>
                                <span className="font-medium" style={{color:T.ink}}>{inq.name} &lt;{inq.email}&gt;</span>
                              </div>
                              {/* Subject */}
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{color:T.inkFaint}}>Subject</label>
                                <input
                                  type="text"
                                  value={composeSubject[inq.id]??""}
                                  onChange={e=>{setComposeSubjectEdited(p=>({...p,[inq.id]:true}));setComposeSubject(p=>({...p,[inq.id]:e.target.value}));}}
                                  className="w-full px-3 py-2 rounded-xl outline-none font-medium"
                                  style={{border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink,fontFamily:"inherit",fontSize:"16px"}}
                                />
                              </div>
                              {/* Body */}
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest block mb-1" style={{color:T.inkFaint}}>Message</label>
                                <textarea
                                  value={composeBody[inq.id]??""}
                                  onChange={e=>setComposeBody(p=>({...p,[inq.id]:e.target.value}))}
                                  rows={10}
                                  className="w-full leading-relaxed rounded-xl p-3 resize-none sm:resize-y outline-none"
                                  style={{border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink,fontFamily:"inherit",fontSize:"16px"}}
                                />
                              </div>
                              {/* Send button */}
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={()=>sendEmail(inq)}
                                  disabled={!composeSubject[inq.id]?.trim()||!composeBody[inq.id]?.trim()||sendLoading===inq.id}
                                  className="flex-1 text-sm font-black py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                                  style={{background:T.action,color:T.actionText}}>
                                  {sendLoading===inq.id?(
                                    <><span className="animate-spin inline-block">◌</span> Sending…</>
                                  ):(
                                    <>✉️ Send now</>
                                  )}
                                </button>
                                <button onClick={()=>setComposeOpen(p=>({...p,[inq.id]:false}))}
                                  className="text-xs font-bold px-4 py-3 rounded-xl transition-all hover:opacity-80"
                                  style={{background:T.inset,color:T.inkSoft}}>
                                  Cancel
                                </button>
                              </div>
                              <p className="text-[10px] text-center" style={{color:T.inkFaint}}>Sends from your Gmail · goes into Sent Mail · client sees your real address</p>
                            </div>
                          )}

                          {/* ── Footer: status + delete ── */}
                          <div className="px-4 sm:px-5 py-3 flex items-center justify-between gap-3 flex-wrap" style={{background:T.inset,borderTop:`1px solid ${T.rowBorder}`}}>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest mr-1" style={{color:T.inkFaint}}>Status</span>
                              {(["new","responded","archived","not_interested"] as const).map(s=>(
                                <button key={s}
                                  onClick={()=>updateInquiryStatus(inq.id,s)}
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80 capitalize"
                                  style={inq.status===s
                                    ?{background:INQ_STATUS[s].bg,color:INQ_STATUS[s].color,fontWeight:800,boxShadow:`inset 0 0 0 1px ${INQ_STATUS[s].color}33`}
                                    :{background:T.neutralBg,color:T.inkFaint}}>
                                  {s==="new"?"● New":s==="responded"?"✓ Responded":s==="not_interested"?"✕ Not Interested":"○ Archive"}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              {inquiryDeleteConfirm===inq.id?(
                                <div className="flex gap-1.5 items-center">
                                  <span className="text-xs" style={{color:T.inkSoft}}>Delete?</span>
                                  <button onClick={()=>deleteInquiry(inq.id)} className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{background:T.red,color:T.actionText}}>Yes</button>
                                  <button onClick={()=>setInquiryDeleteConfirm(null)} className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{background:T.neutralBg,color:T.inkSoft}}>No</button>
                                </div>
                              ):(
                                <button onClick={()=>setInquiryDeleteConfirm(inq.id)} className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all hover:opacity-70" style={{color:T.inkFaint}}>🗑 Delete</button>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ── CLIENTS ── */}
        {tab==="clients"&&(()=>{
          // Deduplicate by email, group all sessions per client
          const clientMap=new Map<string,{name:string;email:string;phone:string|null;sessions:Inquiry[]}>();
          [...inquiries].sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).forEach(inq=>{
            const key=inq.email.toLowerCase();
            if(!clientMap.has(key))clientMap.set(key,{name:inq.name,email:inq.email,phone:inq.phone,sessions:[]});
            clientMap.get(key)!.sessions.push(inq);
          });
          const today=new Date();today.setHours(0,0,0,0);
          const nearestSessionDate=(sessions:Inquiry[])=>{
            const future=sessions.filter(s=>s.session_date&&new Date(s.session_date+"T12:00:00")>=today).map(s=>new Date(s.session_date!+"T12:00:00").getTime());
            return future.length?Math.min(...future):Infinity;
          };
          const latestInquiryDate=(sessions:Inquiry[])=>Math.max(...sessions.map(s=>new Date(s.created_at).getTime()));
          // Most recent activity = latest of: client message (created_at) or your reply (reply_sent_at)
          const latestActivityDate=(sessions:Inquiry[])=>Math.max(...sessions.map(s=>{
            const inq=new Date(s.created_at).getTime();
            const reply=s.reply_sent_at?new Date(s.reply_sent_at).getTime():0;
            return Math.max(inq,reply);
          }));
          const latestDepositDate=(sessions:Inquiry[])=>{
            const paid=sessions.filter(s=>s.payment_status==="paid");
            if(!paid.length)return 0;
            return Math.max(...paid.map(s=>s.deposit_paid_at?new Date(s.deposit_paid_at).getTime():s.payment_detected_at?new Date(s.payment_detected_at).getTime():0));
          };
          const clients=Array.from(clientMap.values()).sort((a,b)=>{
            if(clientSort==="alpha")return a.name.localeCompare(b.name);
            if(clientSort==="recent_activity")return latestActivityDate(b.sessions)-latestActivityDate(a.sessions);
            if(clientSort==="newest_inquiry")return latestInquiryDate(b.sessions)-latestInquiryDate(a.sessions);
            if(clientSort==="oldest_inquiry")return latestInquiryDate(a.sessions)-latestInquiryDate(b.sessions);
            if(clientSort==="paid_recently"){
              const aPaid=a.sessions.some(s=>s.payment_status==="paid");
              const bPaid=b.sessions.some(s=>s.payment_status==="paid");
              if(aPaid!==bPaid)return aPaid?-1:1;
              return latestDepositDate(b.sessions)-latestDepositDate(a.sessions);
            }
            // session_date: upcoming first, then no-date clients at end
            return nearestSessionDate(a.sessions)-nearestSessionDate(b.sessions);
          });
          const q=clientSearch.toLowerCase().trim();
          // Pipeline state per client: a session is "done" once its gallery is
          // delivered; it's "in progress" while active (not archived/declined)
          // and not yet delivered.
          const sessionDone=(s:Inquiry)=>!!s.gallery_delivered_at;
          const sessionInProgress=(s:Inquiry)=>!sessionDone(s)&&s.status!=="archived"&&s.status!=="not_interested";
          const clientInProgress=(c:{sessions:Inquiry[]})=>c.sessions.some(sessionInProgress);
          const clientDelivered=(c:{sessions:Inquiry[]})=>c.sessions.some(sessionDone)&&!clientInProgress(c);
          const filtered=clients.filter(c=>{
            const matchesSearch=!q||c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q);
            const hasPaid=c.sessions.some(s=>s.payment_status==="paid");
            const matchesFilter=
              clientFilter==="all"||
              (clientFilter==="paid"&&hasPaid)||
              (clientFilter==="unpaid"&&!hasPaid)||
              (clientFilter==="in_progress"&&clientInProgress(c))||
              (clientFilter==="delivered"&&clientDelivered(c));
            return matchesSearch&&matchesFilter;
          });
          const pendingOnClients=inquiries.filter(inquiryNeedsReply).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
          const hoursAgoClient=(iso:string)=>{
            const h=Math.round((Date.now()-new Date(iso).getTime())/(1000*60*60));
            if(h<1)return"just now";if(h===1)return"1h ago";if(h<24)return`${h}h ago`;
            const d=Math.round(h/24);return d===1?"1d ago":`${d}d ago`;
          };
          return(
            <div className="space-y-6">
              {/* New inquiries section */}
              {pendingOnClients.length>0&&(
                <div className="adm-rise rounded-2xl overflow-hidden" style={{background:T.panel,border:`1px solid ${T.amberBorder}`,boxShadow:T.shadow}}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] flex items-center gap-1.5" style={{color:T.amber}}>
                        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:T.amber}}/>
                        New Inquiries — Needs Reply
                      </p>
                      <button onClick={()=>setTab("inquiries")} className="text-[11px] font-bold transition-opacity hover:opacity-70" style={{color:T.inkFaint}}>Open Inquiries tab →</button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {pendingOnClients.map(inq=>(
                        <div key={inq.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{background:T.amberBg}}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold" style={{color:T.ink}}>{inq.name}</p>
                              <span className="text-[10px] font-bold" style={{color:T.amber}}>{hoursAgoClient(inq.created_at)}</span>
                            </div>
                            <p className="text-xs truncate" style={{color:T.inkSoft}}>
                              {inq.session_type||"Session"}{inq.date_in_mind?` · ${inq.date_in_mind}`:""}
                            </p>
                            <p className="text-[11px] truncate mt-0.5" style={{color:T.inkFaint}}>{inq.email}</p>
                          </div>
                          <button onClick={()=>setTab("inquiries")}
                            className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:-translate-y-px"
                            style={{background:T.action,color:T.actionText}}>
                            Reply →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Search bar */}
              <div className="adm-rise rounded-2xl overflow-hidden" style={{background:T.panel,border:`1px solid ${T.border}`,boxShadow:T.shadow,animationDelay:"60ms"}}>
                <div className="p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[220px]">
                      <input
                        type="search"
                        value={clientSearch}
                        onChange={e=>setClientSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        className="w-full px-4 py-2.5 rounded-xl outline-none text-sm transition-colors"
                        style={{border:`1px solid ${T.border}`,background:T.panelSolid,color:T.ink,fontFamily:"inherit"}}
                        onFocus={e=>{e.currentTarget.style.borderColor=T.borderStrong;}}
                        onBlur={e=>{e.currentTarget.style.borderColor=T.border;}}
                      />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Pipeline + payment filter pills */}
                      <div className="flex gap-1 p-1 rounded-xl flex-wrap" style={{background:T.inset}}>
                        {(["all","in_progress","delivered","paid","unpaid"] as const).map(f=>(
                          <button key={f} onClick={()=>setClientFilter(f)}
                            className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all whitespace-nowrap"
                            style={clientFilter===f
                              ?f==="paid"?{background:T.blueBg,color:T.blue}
                                :f==="unpaid"?{background:T.panelSolid,color:T.inkSoft,boxShadow:T.shadow}
                                :f==="in_progress"?{background:T.amberBg,color:T.amber}
                                :f==="delivered"?{background:T.greenBg,color:T.green}
                                :{background:T.action,color:T.actionText}
                              :{background:"transparent",color:T.inkFaint}}>
                            {f==="all"?"All":f==="in_progress"?"● In Progress":f==="delivered"?"✓ Delivered":f==="paid"?"$ Paid":"Unpaid"}
                          </button>
                        ))}
                      </div>
                      {/* Sort dropdown */}
                      <select
                        value={clientSort}
                        onChange={e=>setClientSort(e.target.value as typeof clientSort)}
                        className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
                        style={{border:`1px solid ${T.border}`,background:T.panelSolid,color:T.inkSoft,fontFamily:"inherit"}}>
                        <option value="recent_activity">Most recent message</option>
                        <option value="paid_recently">Paid recently</option>
                        <option value="newest_inquiry">Newest inquiry</option>
                        <option value="oldest_inquiry">Oldest inquiry</option>
                        <option value="session_date">Session date</option>
                        <option value="alpha">A → Z</option>
                      </select>
                      <p className="text-xs font-medium" style={{color:T.inkFaint}}>
                        {filtered.length} client{filtered.length===1?"":"s"}
                        {q?` matching "${q}"`:""}
                        {" · "}{inquiries.length} total session{inquiries.length===1?"":"s"}
                      </p>
                      <button onClick={syncPayments} disabled={syncLoading}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:-translate-y-px flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                        style={{background:T.greenBg,color:T.green,border:`1px solid ${T.greenBorder}`}}>
                        {syncLoading?<><span className="animate-spin inline-block">◌</span> Scanning…</>:"💳 Sync Payments"}
                      </button>
                      <button onClick={syncTimeline} disabled={timelineSyncLoading}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:-translate-y-px flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                        style={{background:T.violetBg,color:T.violet,border:`1px solid ${T.violetBorder}`}}>
                        {timelineSyncLoading?<><span className="animate-spin inline-block">◌</span> Syncing…</>:"📬 Sync Timeline"}
                      </button>
                      <button onClick={()=>setAddClientOpen(o=>!o)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:-translate-y-px flex items-center gap-1.5 flex-shrink-0"
                        style={addClientOpen?{background:T.inset,color:T.inkSoft,border:`1px solid ${T.border}`}:{background:T.action,color:T.actionText,boxShadow:T.shadow}}>
                        {addClientOpen?"✕ Cancel":"+ Add Client"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add client form */}
              {addClientOpen&&(
                <div className="adm-rise rounded-2xl overflow-hidden" style={{background:T.panel,border:`1px solid ${T.borderStrong}`,boxShadow:T.shadowHover}}>
                  <div className="p-5 space-y-3">
                    <p className="text-sm font-black" style={{color:T.ink}}>Add Client from Instagram DM</p>
                    {(()=>{
                      const dInp="w-full px-3 py-2.5 rounded-xl text-sm font-medium outline-none transition-colors";
                      const dInpStyle={background:T.inset,border:`1px solid ${T.border}`,color:T.ink,colorScheme:"dark"} as const;
                      const dLbl="block text-xs font-bold uppercase tracking-widest mb-1";
                      return(
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div><label className={dLbl} style={{color:T.inkFaint}}>Name *</label><input className={dInp} style={dInpStyle} placeholder="e.g. Karina Lopez" value={addClientForm.name} onChange={e=>setAddClientForm(f=>({...f,name:e.target.value}))}/></div>
                      <div><label className={dLbl} style={{color:T.inkFaint}}>Email *</label><input className={dInp} style={dInpStyle} type="email" placeholder="e.g. karina@gmail.com" value={addClientForm.email} onChange={e=>setAddClientForm(f=>({...f,email:e.target.value}))}/></div>
                      <div><label className={dLbl} style={{color:T.inkFaint}}>Phone</label><input className={dInp} style={dInpStyle} type="tel" placeholder="e.g. (408) 555-1234" value={addClientForm.phone} onChange={e=>setAddClientForm(f=>({...f,phone:e.target.value}))}/></div>
                      <div><label className={dLbl} style={{color:T.inkFaint}}>Session Type</label><input className={dInp} style={dInpStyle} placeholder="e.g. Grad Portraits" value={addClientForm.session_type} onChange={e=>setAddClientForm(f=>({...f,session_type:e.target.value}))}/></div>
                      <div className="sm:col-span-2"><label className={dLbl} style={{color:T.inkFaint}}>Session Date</label><input className={dInp} style={dInpStyle} type="date" value={addClientForm.session_date} onChange={e=>setAddClientForm(f=>({...f,session_date:e.target.value}))}/></div>
                      <div className="sm:col-span-2"><label className={dLbl} style={{color:T.inkFaint}}>Notes</label><textarea className={`${dInp} resize-none`} style={dInpStyle} rows={2} placeholder="Anything from the DM — location, time, vibe, etc." value={addClientForm.message} onChange={e=>setAddClientForm(f=>({...f,message:e.target.value}))}/></div>
                    </div>
                      );
                    })()}
                    <button onClick={saveManualClient} disabled={addClientSaving}
                      className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-[0.99]"
                      style={{background:T.action,color:T.actionText,opacity:addClientSaving?0.7:1,boxShadow:T.shadow}}>
                      {addClientSaving?"Adding…":"Add Client →"}
                    </button>
                  </div>
                </div>
              )}

              {/* Sync result banner */}
              {(syncResult!==null||syncMsg)&&(
                <div className="adm-rise rounded-xl px-4 py-3 text-sm"
                     style={syncResult?.length?{background:T.greenBg,border:`1px solid ${T.greenBorder}`}:{background:T.inset,border:`1px solid ${T.border}`}}>
                  {syncMsg&&<p className="text-xs" style={{color:T.inkSoft}}>{syncMsg}</p>}
                  {syncResult?.length?(
                    <div className="space-y-1">
                      <p className="text-xs font-black mb-2" style={{color:T.green}}>✓ {syncResult.length} payment{syncResult.length===1?"":"s"} found — review &amp; approve in the Payments tab</p>
                      {syncResult.map((r,i)=>(
                        <div key={i} className="flex items-center gap-3 text-xs flex-wrap" style={{color:T.inkSoft}}>
                          <span className="font-semibold">{r.name}</span>
                          {r.email&&<span style={{color:T.inkFaint}}>{r.email}</span>}
                          {r.amount&&<span className="font-bold" style={{color:T.green}}>{r.amount}</span>}
                          {r.method&&<span style={{color:T.inkFaint}}>via {r.method}</span>}
                          {r.paidAt&&<span style={{color:T.inkFaint}}>{new Date(r.paidAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
                          {r.paymentType&&r.paymentType!=="deposit_1"&&<span className="font-semibold capitalize" style={{color:T.amber}}>{r.paymentType.replace("_"," ")}</span>}
                          {r.orphan&&<span className="font-bold" style={{color:T.red}}>no inquiry</span>}
                        </div>
                      ))}
                    </div>
                  ):syncResult?.length===0&&!syncMsg?(
                    <p className="text-xs" style={{color:T.inkSoft}}>No new Pixieset payments found in Gmail.</p>
                  ):null}
                </div>
              )}

              {/* Client cards */}
              {inquiriesLoading?(
                <div className="text-center py-12 text-sm" style={{color:T.inkFaint}}>Loading clients…</div>
              ):filtered.length===0?(
                <div className="text-center py-12 text-sm" style={{color:T.inkFaint}}>{q?"No clients match that search.":"No clients yet."}</div>
              ):(
                <div className="space-y-3">
                  {filtered.map((client,cardIdx)=>{
                    const paid=client.sessions.some(s=>s.payment_status==="paid");
                    const initials=(()=>{const parts=client.name.trim().split(/\s+/);return parts.length>=2?(parts[0][0]+parts[parts.length-1][0]).toUpperCase():(client.name[0]??"?").toUpperCase();})();
                    return(
                      <div key={client.email} className="adm-rise rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
                           style={{background:T.panel,border:`1px solid ${T.border}`,boxShadow:T.shadow,animationDelay:`${Math.min(cardIdx,8)*40}ms`}}
                           onMouseEnter={e=>{e.currentTarget.style.boxShadow=T.shadowHover;e.currentTarget.style.borderColor=T.borderStrong;}}
                           onMouseLeave={e=>{e.currentTarget.style.boxShadow=T.shadow;e.currentTarget.style.borderColor=T.border;}}>
                        <div className="p-5">
                          {/* Client header */}
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                                   style={{background:paid?T.greenBg:T.insetStrong,color:paid?T.green:T.ink,border:`1px solid ${paid?T.greenBorder:T.border}`}}>
                                {initials}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button className="text-base font-black cursor-pointer select-none hover:opacity-70 transition-opacity text-left" style={{color:T.ink}} title="View client profile" onClick={()=>{const latest=client.sessions.slice().sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0];if(latest)router.push(`/admin/conversation/${latest.id}`)}}>{client.name}</button>
                                  {paid&&(
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                          style={{background:T.greenBg,color:T.green}}>
                                      Paid ✓
                                    </span>
                                  )}
                                  {clientDelivered(client)?(
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                          style={{background:T.greenBg,color:T.green,border:`1px solid ${T.greenBorder}`}}>
                                      ✓ Delivered
                                    </span>
                                  ):clientInProgress(client)?(
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                                          style={{background:T.amberBg,color:T.amber}}>
                                      ● In Progress
                                    </span>
                                  ):null}
                                </div>
                                <div className="flex gap-3 mt-0.5 flex-wrap">
                                  <a href={`mailto:${client.email}`} className="text-xs hover:underline font-medium" style={{color:T.blue}}>{client.email}</a>
                                  {client.phone&&<a href={`tel:${client.phone}`} className="text-xs hover:underline" style={{color:T.inkFaint}}>{client.phone}</a>}
                                </div>
                              </div>
                            </div>
                            <span className="text-xs font-medium flex-shrink-0" style={{color:T.inkFaint}}>
                              {client.sessions.length} session{client.sessions.length===1?"":"s"}
                            </span>
                          </div>

                          {/* Session rows */}
                          <div className="space-y-3">
                            {client.sessions.map(s=>{
                              const portalSession=getPortalSessionForInquiry(s);
                              const portalAmbiguous=isPortalMatchAmbiguous(s);
                              const portalSavingStatus=portalStatusSavingKey?.startsWith(`${s.id}:`)
                                ? portalStatusSavingKey.split(":")[1] as ClientSessionStatus
                                : null;
                              const effectivePortalStatus=getEffectivePortalStatus(s,portalSession);
                              const portalStatusLabel=portalSession
                                ? CLIENT_SESSION_STATUS_LABELS[effectivePortalStatus]
                                : null;

                              return(
                              <div key={s.id}
                                   className="px-3 py-2.5 rounded-xl"
                                   style={{background:T.inset,border:`1px solid ${T.rowBorder}`}}>
                                <div className="flex items-center gap-3 flex-wrap">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {editingSessionType===s.id?(
                                        <SessionTypeEditor
                                          id={s.id}
                                          value={s.session_type??""}
                                          onSave={saveSessionType}
                                          onCancel={()=>setEditingSessionType(null)}
                                        />
                                      ):(
                                        <button
                                          onClick={()=>setEditingSessionType(s.id)}
                                          className="text-xs font-semibold transition-colors group flex items-center gap-1"
                                          style={{color:T.ink}}
                                          title="Edit session type">
                                          {s.session_type||<span className="italic" style={{color:T.inkFaint}}>No session type</span>}
                                          <span className="opacity-0 group-hover:opacity-100 text-[9px] transition-opacity" style={{color:T.inkFaint}}>✏️</span>
                                        </button>
                                      )}
                                      {s.date_in_mind&&!s.session_date&&<span className="text-xs" style={{color:T.inkFaint}}>{s.date_in_mind}</span>}
                                      {s.session_date&&<span className="text-xs font-bold" style={{color:T.green}}>{new Date(s.session_date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}{s.preferred_time?` · ${fmt12h(s.preferred_time)}`:""}</span>}
                                    </div>
                                    <p className="text-[11px] mt-0.5 truncate" style={{color:T.inkFaint}}>{s.message.slice(0,80)}{s.message.length>80?"…":""}</p>
                                    {(s.deposit_paid_at||s.invoice_sent_at||s.contract_sent_at||s.confirmation_sent_at||s.gallery_delivered_at)&&(
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {s.invoice_sent_at&&<span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{background:T.blueBg,color:T.blue}}>📄 Invoice {new Date(s.invoice_sent_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                                        {s.contract_sent_at&&<span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{background:T.violetBg,color:T.violet}}>📝 Contract {new Date(s.contract_sent_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                                        {s.deposit_paid_at&&<span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{background:T.greenBg,color:T.green}}>💳 Paid {new Date(s.deposit_paid_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}{s.confirmation_sent_at?<span style={{color:T.green}}>· ✉ Confirmed</span>:<span style={{color:T.amber}}>· ✉ Not confirmed</span>}</span>}
                                        {s.gallery_delivered_at&&<span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{background:T.amberBg,color:T.amber}}>🖼 Gallery {new Date(s.gallery_delivered_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {/* Payment badge */}
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                          style={s.payment_status==="paid"
                                            ?{background:T.greenBg,color:T.green}
                                            :{background:T.neutralBg,color:T.inkFaint}}>
                                      {s.payment_status==="paid"?"Paid":"Unpaid"}
                                    </span>
                                    {/* Status picker */}
                                    <div className="relative group">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity"
                                            style={{background:INQ_STATUS[(s.status==="new"||s.status==="responded"||s.status==="not_interested")?s.status:"archived"].bg,color:INQ_STATUS[(s.status==="new"||s.status==="responded"||s.status==="not_interested")?s.status:"archived"].color}}>
                                        {s.status==="new"?"● New":s.status==="responded"?"✓ Replied":s.status==="not_interested"?"✕ Not Int.":"○ Archive"} ▾
                                      </span>
                                      <div className="absolute right-0 top-full mt-1 z-20 hidden group-hover:flex flex-col gap-0.5 rounded-xl p-1.5 min-w-[130px]"
                                           style={{background:T.panelSolid,border:`1px solid ${T.border}`,boxShadow:T.shadowHover}}>
                                        {(["new","responded","archived","not_interested"] as const).map(st=>(
                                          <button key={st}
                                            onClick={e=>{e.stopPropagation();updateInquiryStatus(s.id,st);}}
                                            className="text-left text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                                            style={s.status===st
                                              ?{background:INQ_STATUS[st].bg,color:INQ_STATUS[st].color}
                                              :{background:"transparent",color:T.inkSoft}}>
                                            {st==="new"?"● New":st==="responded"?"✓ Replied":st==="not_interested"?"✕ Not Interested":"○ Archive"}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <a href={`/admin/conversation/${s.id}`}
                                       className="text-[11px] font-black px-2.5 py-1 rounded-lg transition-all hover:opacity-85"
                                       style={{background:T.action,color:T.actionText}}>
                                      Open →
                                    </a>
                                    {/* Delete duplicate */}
                                    {inquiryDeleteConfirm===s.id?(
                                      <span className="flex items-center gap-1">
                                        <span className="text-[10px]" style={{color:T.inkSoft}}>Delete?</span>
                                        <button onClick={()=>deleteInquiry(s.id)} className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{background:T.red,color:T.actionText}}>Yes</button>
                                        <button onClick={()=>setInquiryDeleteConfirm(null)} className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{background:T.neutralBg,color:T.inkSoft}}>No</button>
                                      </span>
                                    ):(
                                      <button onClick={()=>setInquiryDeleteConfirm(s.id)}
                                        className="text-[11px] px-2 py-0.5 rounded-lg transition-all hover:opacity-80"
                                        style={{background:T.redBg,color:T.red}}
                                        title="Delete duplicate inquiry">
                                        🗑
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-3 rounded-xl p-3" style={{background:T.panelSolid,border:`1px solid ${T.border}`}}>
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{color:T.amber,fontFamily:T.mono}}>Client Portal Progress</p>
                                      <p className="mt-1 text-[11px]" style={{color:T.inkFaint}}>
                                        {portalSessionsLoading
                                          ?"Loading portal state..."
                                          :portalSession
                                            ?`Currently ${portalStatusLabel}`
                                            :"No portal session yet. Your first click will create one."}
                                      </p>
                                    </div>
                                    {portalAmbiguous&&(
                                      <a href="/admin/sessions" className="text-[11px] font-black px-2.5 py-1 rounded-lg"
                                         style={{background:T.violetBg,color:T.violet,border:`1px solid ${T.violetBorder}`}}>
                                        Open Client Sessions →
                                      </a>
                                    )}
                                  </div>
                                  {!portalAmbiguous&&(
                                    <div className="mt-3">
                                      <AdminSessionStatusStrip
                                        compact
                                        appearance="dark"
                                        currentStatus={effectivePortalStatus}
                                        savingStatus={portalSavingStatus}
                                        onSelect={status=>updatePortalStatusFromInquiry(s,status)}
                                      />
                                    </div>
                                  )}
                                </div>
                                <ClientTimeline
                                  inq={s}
                                  onUpdate={patch=>setInquiries(prev=>prev.map(x=>x.id===s.id?{...x,...patch}:x))}
                                />
                              </div>
                            )})}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── IMAGE LIBRARY ── */}
        {tab==="library"&&(()=>{
          const existingPortfolioUrls=new Set(portfolioImages.map(p=>p.image_url));
          const filtered=libraryImages.filter(img=>
            libraryFilter==="all"?true:
            libraryFilter==="portfolio"?img.in_portfolio:
            !img.in_portfolio
          );
          return(
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-black text-slate-800">Image Library</h2>
                  <p className="text-sm text-slate-400 mt-0.5">Upload from your phone or desktop. Push any photo to the portfolio with one click.</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(["all","unset","portfolio"] as const).map(f=>(
                    <button key={f} onClick={()=>setLibraryFilter(f)}
                      className="px-3 py-1.5 rounded-full text-xs font-black transition-colors"
                      style={libraryFilter===f?{background:C.grad12,color:"#fff"}:{background:C.p1_08,color:C.p1}}>
                      {f==="all"?"All":f==="portfolio"?"In Portfolio":"Not in Portfolio"}
                      {" "}({f==="all"?libraryImages.length:f==="portfolio"?libraryImages.filter(x=>x.in_portfolio).length:libraryImages.filter(x=>!x.in_portfolio).length})
                    </button>
                  ))}
                  <button onClick={fetchLibraryImages} className="px-3 py-1.5 rounded-full text-xs font-black" style={{background:C.p1_08,color:C.p1}}>↻ Refresh</button>
                </div>
              </div>

              {/* ── Upload panel ── */}
              <div className="rounded-2xl border-2 border-dashed p-4 space-y-3" style={{borderColor:C.p1_25,background:C.p1_04}}>
                <input ref={libraryUploadRef} type="file" accept="image/*" multiple className="hidden" onChange={onLibraryFilePick}/>
                {libraryUploadPreviews.length===0?(
                  <button onClick={()=>libraryUploadRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center gap-2 py-6 text-center">
                    <span className="text-3xl">📷</span>
                    <span className="font-black text-sm" style={{color:C.p1}}>Upload photos</span>
                    <span className="text-xs text-slate-400">Tap to choose from your camera roll or take a new photo</span>
                  </button>
                ):(
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                      {libraryUploadPreviews.map(({preview},i)=>(
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                          <img src={preview} className="w-full h-full object-cover"/>
                          <button onClick={()=>removeLibraryPreview(i)}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-[10px] font-black flex items-center justify-center">✕</button>
                        </div>
                      ))}
                      <button onClick={()=>libraryUploadRef.current?.click()}
                        className="aspect-square rounded-xl border-2 border-dashed flex items-center justify-center text-2xl"
                        style={{borderColor:C.p1_25,color:C.p1}}>+</button>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={uploadLibraryFiles} disabled={libraryUploading}
                        className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-60"
                        style={{background:C.grad12}}>
                        {libraryUploading?`Uploading…`:`Save ${libraryUploadPreviews.length} photo${libraryUploadPreviews.length>1?"s":""} to library`}
                      </button>
                      <button onClick={()=>setLibraryUploadPreviews([])} disabled={libraryUploading}
                        className="px-4 py-2.5 rounded-xl text-sm font-black text-slate-400 border"
                        style={{borderColor:"rgba(0,0,0,0.08)"}}>Clear</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Category picker for push */}
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl border text-sm" style={{borderColor:C.p1_15,background:C.p1_04}}>
                <span className="font-black text-slate-600">Push to portfolio as:</span>
                <select value={libraryPushCategory} onChange={e=>setLibraryPushCategory(e.target.value)}
                  className="rounded-lg border px-2 py-1 text-sm font-semibold text-slate-700 outline-none"
                  style={{borderColor:C.p1_20,background:"#fff"}}>
                  {categories.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}
                </select>
                <span className="text-slate-400 text-xs">Select a category, then click &ldquo;Add to Portfolio&rdquo; on any image below.</span>
              </div>

              {libraryLoading?(
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {Array.from({length:10}).map((_,i)=><div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse"/>)}
                </div>
              ):filtered.length===0?(
                <div className="text-center py-16 text-slate-400 text-sm font-semibold">
                  {libraryImages.length===0?"No images yet — save a journal post to populate the library.":"No images match this filter."}
                </div>
              ):(
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {filtered.map(img=>{
                    const alreadyInPortfolio=img.in_portfolio||existingPortfolioUrls.has(img.image_url);
                    const isPushing=libraryPushingId===img.id;
                    return(
                      <div key={img.id} className="group relative rounded-xl overflow-hidden border bg-slate-50" style={{borderColor:alreadyInPortfolio?C.p1_25:"rgba(0,0,0,0.07)"}}>
                        <div className="aspect-square">
                          <img src={img.image_url} alt={img.alt||img.title} className="w-full h-full object-cover"/>
                        </div>
                        {/* Overlay on hover */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2 gap-1.5">
                          <p className="text-white text-[10px] font-bold leading-tight truncate">{img.title}</p>
                          <p className="text-white/60 text-[9px] font-semibold uppercase tracking-wide">{img.source_role} · {img.source_post_slug??""}</p>
                          {alreadyInPortfolio?(
                            <span className="text-[10px] font-black px-2 py-1 rounded-lg text-center" style={{background:C.p1_25,color:"#fff"}}>✓ In Portfolio</span>
                          ):(
                            <button
                              onClick={()=>pushLibraryImageToPortfolio(img)}
                              disabled={isPushing}
                              className="text-[10px] font-black px-2 py-1 rounded-lg text-white text-center disabled:opacity-60"
                              style={{background:C.grad12}}>
                              {isPushing?"Adding…":"Add to Portfolio"}
                            </button>
                          )}
                        </div>
                        {/* In-portfolio badge */}
                        {alreadyInPortfolio&&(
                          <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-black" style={{background:C.p1}}>✓</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── ACCOUNTS ── */}
        {tab==="accounts"&&<AccountsTab showToast={showToast} />}
        {tab==="testimonials"&&<TestimonialsTab showToast={showToast} />}

        {/* ── VAULT ── */}
        {tab==="vault"&&<VaultTab />}
        {tab==="ai"&&<AiTab />}
        {tab==="chat"&&<ChatTab />}
        {tab==="format"&&(()=>{
          const seenEmails=new Set<string>();
          const quickFormatClients=inquiries.reduce<{name:string;email:string}[]>((acc,inq)=>{
            const key=inq.email.toLowerCase();
            if(!seenEmails.has(key)){seenEmails.add(key);acc.push({name:inq.name,email:inq.email});}
            return acc;
          },[]);
          return <QuickFormatTool clients={quickFormatClients}/>;
        })()}
        </div>{/* end inner content */}
        </div>{/* end main column */}
      </div>{/* end flex */}
    </div>
  );
}
