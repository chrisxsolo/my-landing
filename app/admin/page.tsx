"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { C } from "@/lib/colors";

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
import VaultTab from "@/app/admin/VaultTab";
import AiTab from "@/app/admin/AiTab";
import ChatTab from "@/app/admin/ChatTab";
import SessionCalendar from "@/app/admin/SessionCalendar";
import AccountsTab from "@/app/admin/AccountsTab";
import PosesTab from "@/app/admin/PosesTab";
import LocationsTab from "@/app/admin/LocationsTab";
import BlogTab from "@/app/admin/BlogTab";
import { uploadImage } from "@/lib/uploadImage";
import {
  findMatchingClientSession,
  getClientSessionEmailMatches,
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

export const dynamic = 'force-dynamic'

type Tab = "home"|"poses"|"locations"|"bayGuide"|"portfolio"|"categories"|"blog"|"library"|"analytics"|"payments"|"inquiries"|"clients"|"funnel"|"vault"|"ai"|"chat"|"format"|"accounts";
type ImageLibraryRow = { id:number; title:string; alt:string|null; image_url:string; source_type:string; source_post_id:number|null; source_post_slug:string|null; source_role:string; in_portfolio:boolean; created_at:string; };
type Inquiry = { id:number; name:string; email:string; phone:string|null; session_type:string|null; date_in_mind:string|null; message:string; status:string; created_at:string; payment_status:string|null; payment_note:string|null; payment_detected_at:string|null; session_date:string|null; booking_confirmed:boolean|null; reply_sent_at:string|null; invoice_sent_at:string|null; contract_sent_at:string|null; deposit_paid_at:string|null; gallery_delivered_at:string|null; confirmation_sent_at:string|null; preferred_time:string|null; location:string|null; school:string|null; instagram:string|null; people:string|null; };
type AdminSessionsResponse = { sessions?: AdminClientSessionDTO[]; session?: AdminClientSessionDTO; error?: string; };

function fmt12h(t:string|null):string{
  if(!t)return"";
  const[h,m]=t.split(":").map(Number);
  if(isNaN(h)||isNaN(m))return t;
  const ampm=h>=12?"PM":"AM";
  const h12=h%12||12;
  return `${h12}:${String(m).padStart(2,"0")} ${ampm}`;
}
type PortfolioCategory = { id:number; name:string; slug:string; description:string|null; sort_order:number; active:boolean; };
type PortfolioImage = { id:number; title:string; alt:string|null; image_url:string; category_id:number|null; category_slug:string; featured:boolean; hero_carousel:boolean; sort_order:number; created_at:string|null; };

const EMPTY_CATEGORY = {name:"",slug:"",description:"",sort_order:"1",active:true};
const EMPTY_PORTFOLIO = {title:"",alt:"",category_slug:"graduation",featured:false,sort_order:""};
const WEBSITE_TABS:Tab[]=["poses","locations","bayGuide","portfolio","categories","blog","library"];
const CLIENT_TABS:Tab[]=["inquiries","clients","analytics","payments","funnel","ai","chat","format"];
const VAULT_TABS:Tab[]=["vault"];
const TAB_LABELS:Record<Tab,string>={home:"🏠 Home",poses:"📸 Grad Poses",locations:"📍 Campus Spots",bayGuide:"🗺️ Bay Guide",portfolio:"🖼️ Portfolio",categories:"🏷️ Categories",blog:"✍️ Blog",library:"🗄️ Image Library",analytics:"📊 Analytics",payments:"💵 Revenue",funnel:"📈 Funnel",inquiries:"📬 Inquiries",clients:"👥 Clients",vault:"📓 Vault",ai:"🤖 AI Training",chat:"💬 AI Chat",format:"✨ Quick Format",accounts:"👤 Accounts"};

function detectSchool(text:string):string|null{
  // Normalize accents (e.g. "José" → "Jose") so accented names still match
  const t=text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"");
  if(/\bsjsu\b|san jose state/.test(t))               return "SJSU";
  if(/\buc berkeley\b|\bberkeley\b|cal bears/.test(t)) return "UC Berkeley";
  if(/\bsfsu\b|sf state|san francisco state/.test(t))  return "SF State";
  if(/\bcsueb\b|cal state east bay|eastbay/.test(t))   return "CSUEB";
  if(/\busf\b|university of san francisco/.test(t))    return "USF";
  if(/\bstanford\b/.test(t))                           return "Stanford";
  if(/\bsanta clara\b|\bscu\b/.test(t))                return "Santa Clara";
  if(/\bsacramento state\b|\bsac state\b|\bcsus\b/.test(t)) return "Sac State";
  if(/\bchico state\b|\bcsuchico\b/.test(t))           return "Chico State";
  if(/\bfresno state\b/.test(t))                       return "Fresno State";
  return null;
}
function buildSubject(inq:{session_type:string|null;message:string;date_in_mind:string|null}):string{
  const isGrad=(inq.session_type??"").toLowerCase().includes("grad");
  if(!isGrad) return `Re: Your ${inq.session_type??"photography"} inquiry`;
  const haystack=[inq.message,inq.session_type,inq.date_in_mind].filter(Boolean).join(" ");
  const school=detectSchool(haystack);
  return school?`${school} Graduation Inquiry`:"Graduation Inquiry";
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

  // ── Reply style ───────────────────────────────────────────────────────


  // ── Clients ───────────────────────────────────────────────────────────────
  const [clientSearch,setClientSearch]=useState("");
  const [clientFilter,setClientFilter]=useState<"all"|"paid"|"unpaid">("all");
  const [clientSort,setClientSort]=useState<"recent_activity"|"newest_inquiry"|"oldest_inquiry"|"session_date"|"alpha"|"paid_recently">("recent_activity");
  const [inquirySort,setInquirySort]=useState<"needs_reply"|"newest"|"oldest"|"session_date"|"alpha"|"paid_recently">("needs_reply");
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

  // ── Inquiries ─────────────────────────────────────────────────────────
  const [inquiries,setInquiries]=useState<Inquiry[]>([]);
  const [inquiriesLoading,setInquiriesLoading]=useState(false);
  const [finalPaymentIds,setFinalPaymentIds]=useState<Set<number>>(new Set());
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
  const [syncResult,setSyncResult]=useState<{name:string;email:string;amount:string;method:string;paymentType:string;paidAt:string;alreadyPaid:boolean;dateBooked?:string;orphan:boolean;pass:number}[]|null>(null);
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
      setSyncResult(json.synced??[]);
      if((json.synced??[]).length>0)fetchInquiries();
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
    const{data,error}=await supabase.from("inquiries").insert(row).select().single();
    if(error){console.error("createInquiryFromThread",error);return null;}
    setInquiries(p=>[data,...p]);
    showToast(`Client card created for ${row.name} ✓`);
    return data as Inquiry;
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
    setComposeSubject(p=>({...p,[inq.id]:p[inq.id]??buildSubject(inq)}));
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
        updateInquiryStatus(inq.id,"responded");
        showToast(`Email sent to ${inq.name} ✓`);
        setTimeout(()=>setSendSuccess(null),3000);
      }else{
        showToast(json.error??"Send failed",false);
      }
    }catch(e){showToast("Send failed — check console",false);console.error(e);}
    finally{setSendLoading(null);}
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

  async function fetchInquiries(){setInquiriesLoading(true);const[{data},{data:dep2}]=await Promise.all([supabase.from('inquiries').select('*').order('created_at',{ascending:false}),supabase.from('payments').select('inquiry_id').eq('payment_type','deposit_2').not('inquiry_id','is',null)]);setInquiries(data??[]);setFinalPaymentIds(new Set((dep2??[]).map((p:{inquiry_id:number})=>p.inquiry_id)));setInquiriesLoading(false);}

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
  async function deleteInquiry(id:number){const{error}=await supabase.from('inquiries').delete().eq('id',id);if(error){showToast("Delete failed",false);}else{setInquiries(p=>p.filter(x=>x.id!==id));setInquiryDeleteConfirm(null);showToast("Inquiry deleted");}}
  async function updateInquiryStatus(id:number,status:string){const{error}=await supabase.from('inquiries').update({status}).eq('id',id);if(error){showToast("Update failed",false);}else{setInquiries(p=>p.map(x=>x.id===id?{...x,status}:x));showToast("Status updated");}}
  async function saveSessionType(id:number,value:string){const{error}=await supabase.from('inquiries').update({session_type:value.trim()||null}).eq('id',id);if(error){showToast("Update failed",false);}else{setInquiries(p=>p.map(x=>x.id===id?{...x,session_type:value.trim()||null}:x));setEditingSessionType(null);showToast("Session type updated ✓");}}
  async function rescheduleSession(id:number,datetimeLocal:string){
    // datetimeLocal is "YYYY-MM-DDTHH:mm" from datetime-local input
    const date=new Date(datetimeLocal);
    if(isNaN(date.getTime())){showToast("Invalid date",false);return;}
    const sessionDate=`${datetimeLocal.slice(0,10)}`;
    const preferredTime=new Intl.DateTimeFormat("en-US",{hour:"numeric",minute:"2-digit"}).format(date);
    const{error}=await supabase.from('inquiries').update({session_date:sessionDate,preferred_time:preferredTime}).eq('id',id);
    if(error){showToast("Could not reschedule",false);}else{setInquiries(p=>p.map(x=>x.id===id?{...x,session_date:sessionDate,preferred_time:preferredTime}:x));showToast("Session rescheduled ✓");}
  }
  async function saveManualClient(){
    const{name,email,session_type,session_date,phone,message}=addClientForm;
    if(!name.trim()||!email.trim()){showToast("Name and email are required",false);return;}
    setAddClientSaving(true);
    const row={name:name.trim(),email:email.trim().toLowerCase(),phone:phone.trim()||null,session_type:session_type.trim()||null,session_date:session_date||null,message:message.trim()||"Added manually from Instagram DM",status:"manual",payment_status:null,booking_confirmed:null,date_in_mind:null};
    const{data,error}=await supabase.from('inquiries').insert(row).select().single();
    setAddClientSaving(false);
    if(error){showToast("Failed to add client",false);return;}
    setInquiries(p=>[data,...p]);
    setAddClientForm(EMPTY_CLIENT);
    setAddClientOpen(false);
    showToast(`${name} added ✓`);
  }

  async function saveCalendarEvent(){
    const{name,email,session_type,session_date,session_time,location,phone,notes}=addEventForm;
    if(!name.trim()||!email.trim()){showToast("Name and email are required",false);return;}
    if(!session_date){showToast("Session date is required",false);return;}
    setAddEventSaving(true);
    const row={name:name.trim(),email:email.trim().toLowerCase(),phone:phone.trim()||null,session_type:session_type.trim()||null,session_date,preferred_time:session_time||null,location:location.trim()||null,message:notes.trim()||"Added manually from calendar",status:"manual",payment_status:addEventForm.payment_received?"paid":null,booking_confirmed:addEventForm.payment_received,date_in_mind:session_date};
    const{data,error}=await supabase.from('inquiries').insert(row).select().single();
    setAddEventSaving(false);
    if(error){showToast("Failed to add event",false);return;}
    setInquiries(p=>[data,...p]);
    setAddEventForm(EMPTY_EVENT);
    setAddEventOpen(false);
    showToast(`${name} added to calendar ✓`);
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
    const{data}=await supabase.from('site_settings').select('key,value');
    if(data){
      const map=data.reduce((acc:{[k:string]:string|null},r)=>{acc[r.key]=r.value;return acc;},{});
      setSiteSettings(map);
    }
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
      const url=await uploadImage(item.file,"portfolio",showToast);
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
      const{error}=await supabase.from('image_library').insert({
        title,alt:title,image_url:url,
        source_type:"manual",source_role:"gallery",in_portfolio:false,
      });
      if(!error)saved++;
    }
    setLibraryUploadPreviews([]);
    setLibraryUploading(false);
    if(saved>0){showToast(`${saved} photo${saved>1?"s":""} added to library!`);fetchLibraryImages();}
    else showToast("Upload failed",false);
  }

  async function fetchLibraryImages(){
    setLibraryLoading(true);
    const{data,error}=await supabase.from('image_library').select('*').order('created_at',{ascending:false});
    if(error)console.error(error);
    if(data)setLibraryImages(data);
    setLibraryLoading(false);
  }
  async function pushLibraryImageToPortfolio(row:ImageLibraryRow){
    setLibraryPushingId(row.id);
    const cat=categories.find(c=>c.slug===libraryPushCategory);
    const{error}=await supabase.from('portfolio_images').insert({
      title:row.title,
      alt:row.alt||row.title,
      image_url:row.image_url,
      category_id:cat?.id??null,
      category_slug:libraryPushCategory,
      featured:false,
      sort_order:portfolioImages.length+1,
    });
    if(error){showToast("Failed to add to portfolio",false);}else{
      await supabase.from('image_library').update({in_portfolio:true}).eq('id',row.id);
      setLibraryImages(p=>p.map(x=>x.id===row.id?{...x,in_portfolio:true}:x));
      fetchPortfolioImages();
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
    if(portfolioFile){const url=await uploadImage(portfolioFile,"portfolio",showToast);if(!url){setPortfolioSaving(false);return;}image_url=url;}
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

  function slugify(s:string){return s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");}

  const inp="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors";
  const ta=`${inp} resize-none`;
  const card="bg-white rounded-2xl border border-slate-100 overflow-hidden";

  if(!authed){
    return(
      <div className="min-h-screen bg-white flex items-center justify-center px-6 font-sans">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <span className="font-black text-2xl" style={C.text}>Chris.</span>
            <p className="text-slate-400 text-sm mt-1 font-medium">Studio Admin</p>
          </div>
          <div className="rounded-2xl p-8 shadow-xl" style={{border:`1px solid ${C.p1_15}`}}>
            <div className="h-[3px] rounded-full mb-6" style={{background:C.grad90}}/>
            <label className="block text-xs font-bold tracking-widest uppercase text-slate-400 mb-2">Password</label>
            <input type="password" value={pw} onChange={e=>{setPw(e.target.value);setPwErr(false);}}
              onKeyDown={e=>{if(e.key==="Enter")login(pw).then(ok=>{if(ok)setAuthed(true);else setPwErr(true);});}}
              placeholder="Enter password" className={inp+" mb-4"} style={pwErr?{borderColor:C.p2}:{}}/>
            {pwErr&&<p className="text-xs font-semibold mb-3" style={{color:C.p2}}>Incorrect password</p>}
            <button onClick={()=>login(pw).then(ok=>{if(ok)setAuthed(true);else setPwErr(true);})}
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

      {addEventOpen&&(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{background:"rgba(0,0,0,0.45)",backdropFilter:"blur(6px)"}} onClick={e=>{if(e.target===e.currentTarget){setAddEventOpen(false);setAddEventForm(EMPTY_EVENT);}}}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{background:"white",boxShadow:"0 24px 64px rgba(124,58,237,0.2)"}}>
            <div className="h-[3px]" style={{background:"linear-gradient(90deg,#a78bfa,#7c3aed,#6366f1)"}}/>
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest mb-0.5" style={{color:"#7c3aed"}}>📸 Add to Calendar</p>
                  <p className="text-base font-black text-slate-900">New Session</p>
                </div>
                <button onClick={()=>{setAddEventOpen(false);setAddEventForm(EMPTY_EVENT);}} className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors text-lg font-bold">×</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Name *</label><input className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors" placeholder="e.g. Maria Lopez" value={addEventForm.name} onChange={e=>setAddEventForm(f=>({...f,name:e.target.value}))}/></div>
                <div className="col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Email *</label><input className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors" type="email" placeholder="e.g. maria@gmail.com" value={addEventForm.email} onChange={e=>setAddEventForm(f=>({...f,email:e.target.value}))}/></div>
                <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Phone</label><input className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors" type="tel" placeholder="(408) 555-1234" value={addEventForm.phone} onChange={e=>setAddEventForm(f=>({...f,phone:e.target.value}))}/></div>
                <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Session Type</label><input className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors" placeholder="e.g. Grad Portraits" value={addEventForm.session_type} onChange={e=>setAddEventForm(f=>({...f,session_type:e.target.value}))}/></div>
                <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Date *</label><input className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors" type="text" placeholder="YYYY-MM-DD" value={addEventForm.session_date} onChange={e=>setAddEventForm(f=>({...f,session_date:e.target.value}))}/></div>
                <div><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Time</label><input className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors" type="text" placeholder="HH:MM" value={addEventForm.session_time} onChange={e=>setAddEventForm(f=>({...f,session_time:e.target.value}))}/></div>
                <div className="col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Location</label><input className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors" placeholder="e.g. UC Berkeley" value={addEventForm.location} onChange={e=>setAddEventForm(f=>({...f,location:e.target.value}))}/></div>
                <div className="col-span-2"><label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Notes</label><textarea className="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 focus:border-violet-300 bg-white transition-colors resize-none" rows={2} placeholder="Anything relevant from the conversation…" value={addEventForm.notes} onChange={e=>setAddEventForm(f=>({...f,notes:e.target.value}))}/></div>
                <div className="col-span-2">
                  <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl transition-colors" style={{background:addEventForm.payment_received?"rgba(16,185,129,0.08)":"rgba(0,0,0,0.03)",border:`1px solid ${addEventForm.payment_received?"rgba(16,185,129,0.25)":"rgba(0,0,0,0.08)"}`}}>
                    <input type="checkbox" className="w-4 h-4 rounded accent-emerald-500 cursor-pointer" checked={addEventForm.payment_received} onChange={e=>setAddEventForm(f=>({...f,payment_received:e.target.checked}))}/>
                    <div>
                      <p className="text-xs font-black" style={{color:addEventForm.payment_received?"#059669":"#64748b"}}>Payment received ✓</p>
                      <p className="text-[10px] text-slate-400 font-medium">Required to show on calendar</p>
                    </div>
                  </label>
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={()=>{setAddEventOpen(false);setAddEventForm(EMPTY_EVENT);}} className="px-4 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors">Cancel</button>
                <button onClick={saveCalendarEvent} disabled={addEventSaving} className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50 transition-opacity" style={{background:"linear-gradient(135deg,#a78bfa,#7c3aed)"}}>
                  {addEventSaving?"Saving…":"Add to Calendar ✓"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      <div className="sticky top-0 z-40 border-b border-black/[0.06] px-3 md:px-6 h-14 flex items-center justify-between" style={{background:"rgba(255,255,255,0.95)",backdropFilter:"blur(20px)"}}>
        <span className="font-black text-sm md:text-lg shrink-0" style={C.text}>Chris. Studio Admin</span>
        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/admin/sessions"
            className="inline-flex items-center rounded-full px-2 md:px-3 py-1.5 text-[10px] md:text-[11px] font-black uppercase tracking-[0.12em] transition-all hover:opacity-90 whitespace-nowrap"
            style={{background:C.p1_08,color:C.p1,border:`1px solid ${C.p1_20}`}}
          >
            Portal Sessions
          </Link>
          <a href="/bay-area-locations" className="hidden md:block text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">🗺️ Bay Guide</a>
          <a href="/admin/availability" className="hidden md:block text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">📅 Availability</a>
          <a href="/" className="hidden md:block text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">← Site</a>
        </div>
      </div>

      <div className="flex">
        {/* ── SIDEBAR NAV ── */}
        {(()=>{
          const cancelAll=()=>{cancelEditPortfolioImage();cancelEditCategory();setEditingInquiry(null);setInquiryDeleteConfirm(null);};
          const go=(t:Tab)=>{cancelAll();setTab(t);};
          const NavBtn=({t,icon,label}:{t:Tab;icon:string;label:string})=>(
            <button onClick={()=>go(t)}
              className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-xl text-[13px] font-semibold transition-all text-left group"
              style={tab===t
                ?{background:C.grad12,color:"#fff",boxShadow:"0 2px 10px rgba(157,111,232,0.25)"}
                :{color:"#4b5563",background:"transparent"}}>
              <span className="w-5 flex-shrink-0 text-center text-base leading-none">{icon}</span>
              <span className="truncate">{label}</span>
            </button>
          );
          return(
            <div className="hidden md:flex sticky top-14 flex-shrink-0 w-[200px] h-[calc(100vh-56px)] overflow-y-auto flex-col border-r py-3 px-2"
                 style={{background:"white",borderColor:"rgba(0,0,0,0.07)"}}>
              <div className="flex-1 space-y-0.5 pb-3">
                <NavBtn t="home" icon="🏠" label="Home"/>
                <div className="h-px my-2 mx-1" style={{background:"rgba(0,0,0,0.06)"}}/>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] px-3 pt-0.5 pb-1" style={{color:C.mutedSoft}}>Client Work</p>
                {(["inquiries","clients","analytics","payments","funnel"] as Tab[]).map(t=>(
                  <NavBtn key={t} t={t} icon={t==="inquiries"?"📬":t==="clients"?"👥":t==="analytics"?"📊":t==="payments"?"💵":"📈"} label={TAB_LABELS[t].replace(/^[^\s]+\s/,"")}/>
                ))}
                <div className="h-px my-2 mx-1" style={{background:"rgba(0,0,0,0.06)"}}/>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] px-3 pt-0.5 pb-1" style={{color:C.mutedSoft}}>Website</p>
                {(["poses","locations","bayGuide","portfolio","categories","blog","library"] as Tab[]).map(t=>(
                  <NavBtn key={t} t={t} icon={t==="poses"?"📸":t==="locations"?"📍":t==="bayGuide"?"🗺️":t==="portfolio"?"🖼️":t==="categories"?"🏷️":t==="blog"?"✍️":"🗄️"} label={TAB_LABELS[t].replace(/^[^\s]+\s/,"")}/>
                ))}
                <div className="h-px my-2 mx-1" style={{background:"rgba(0,0,0,0.06)"}}/>
                <p className="text-[10px] font-black uppercase tracking-[0.13em] px-3 pt-0.5 pb-1" style={{color:C.mutedSoft}}>Tools</p>
                {(["ai","chat","format","vault","accounts"] as Tab[]).map(t=>(
                  <NavBtn key={t} t={t} icon={t==="ai"?"🤖":t==="chat"?"💬":t==="format"?"✨":t==="vault"?"📓":"👤"} label={TAB_LABELS[t].replace(/^[^\s]+\s/,"")}/>
                ))}
              </div>
              <div className="border-t pt-2.5 px-1" style={{borderColor:"rgba(0,0,0,0.06)"}}>
                <button onClick={()=>adminLogout().then(()=>{setAuthed(false);setPw("");})}
                  className="w-full flex items-center gap-2 px-3 py-[7px] rounded-xl text-[13px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
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
            {t:"home",icon:"🏠",label:"Home"},{t:"inquiries",icon:"📬",label:"Inquiries"},{t:"clients",icon:"👥",label:"Clients"},{t:"analytics",icon:"📊",label:"Analytics"},{t:"payments",icon:"💵",label:"Revenue"},{t:"funnel",icon:"📈",label:"Funnel"},
            {t:"poses",icon:"📸",label:"Poses"},{t:"locations",icon:"📍",label:"Spots"},{t:"bayGuide",icon:"🗺️",label:"Bay Guide"},{t:"portfolio",icon:"🖼️",label:"Portfolio"},{t:"categories",icon:"🏷️",label:"Categories"},{t:"blog",icon:"✍️",label:"Blog"},{t:"library",icon:"🗄️",label:"Library"},
            {t:"ai",icon:"🤖",label:"AI Training"},{t:"chat",icon:"💬",label:"AI Chat"},{t:"format",icon:"✨",label:"Format"},{t:"vault",icon:"📓",label:"Vault"},{t:"accounts",icon:"👤",label:"Accounts"},
          ];
          return(
            <div className="md:hidden sticky top-14 z-30 border-b overflow-x-auto flex items-center gap-1.5 px-3 py-2 [&::-webkit-scrollbar]:hidden" style={{background:"white",borderColor:"rgba(0,0,0,0.06)"}}>
              {all.map(({t,icon,label})=>(
                <button key={t} onClick={()=>go(t)}
                  className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all"
                  style={tab===t?{background:C.grad12,color:"#fff",boxShadow:"0 2px 8px rgba(157,111,232,0.25)"}:{color:"#6b7280",background:"rgba(0,0,0,0.04)"}}>
                  <span className="text-sm leading-none">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          );
        })()}

        {/* ── MAIN CONTENT ── */}
        <div className="flex-1 px-4 py-4 md:px-8 md:py-8">

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
          const monthRevenue=inquiries
            .filter(inq=>inq.payment_status==="paid"&&inq.payment_detected_at&&new Date(inq.payment_detected_at)>=monthStart)
            .reduce((sum,inq)=>{
              const note=inq.payment_note||"";
              const match=note.match(/\$?([\d,]+(?:\.\d{2})?)/);
              return sum+(match?parseFloat(match[1].replace(",","")): 0);
            },0);

          // Quick stats
          const totalClients=new Set(inquiries.map(i=>i.email.toLowerCase())).size;
          const confirmedSessions=inquiries.filter(i=>i.booking_confirmed).length;
          const newThisMonth=inquiries.filter(i=>new Date(i.created_at)>=monthStart).length;
          const paidSessions=inquiries.filter(i=>i.payment_status==="paid").length;
          const pendingInquiries=inquiries.filter(i=>!i.reply_sent_at&&i.status!=="archived"&&i.status!=="not_interested"&&i.status!=="responded"&&i.status!=="manual").length;

          const pad2=(n:number)=>String(n).padStart(2,"0");
          const todayStr=`${today.getFullYear()}-${pad2(today.getMonth()+1)}-${pad2(today.getDate())}`;
          const tom=new Date(today);tom.setDate(tom.getDate()+1);
          const tomorrowStr=`${tom.getFullYear()}-${pad2(tom.getMonth()+1)}-${pad2(tom.getDate())}`;
          const dayLabel=(d:string)=>{
            if(d===todayStr)return"TODAY";
            if(d===tomorrowStr)return"TOMORROW";
            return new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"}).toUpperCase();
          };

          return(
            <div>
              {/* Greeting */}
              <div className="mb-5">
                <h1 className="text-2xl font-black text-slate-900">Hey Chris 👋</h1>
                <p className="text-sm text-slate-400 mt-0.5">{now.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})}</p>
              </div>

              {/* Quick actions bar */}
              <div className="flex flex-wrap gap-2 mb-5 p-3 rounded-2xl border bg-white" style={{borderColor:"rgba(0,0,0,0.07)"}}>
                <button onClick={()=>{setTab("clients");setAddClientOpen(true);}}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{background:C.grad12}}>
                  + New Client
                </button>
                <button onClick={()=>router.push("/admin/reminder-templates")}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                  style={{background:"rgba(245,158,11,0.08)",color:"#d97706",border:"1px solid rgba(245,158,11,0.2)"}}>
                  🔔 Reminder Templates
                </button>
                <Link href="/admin/sessions"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                  style={{background:"rgba(99,102,241,0.08)",color:"#6366f1",border:"1px solid rgba(99,102,241,0.15)"}}>
                  🗂️ Portal Sessions
                </Link>
                <a href={`webcal://soloxsnaps.com/api/calendar/sessions?token=${process.env.NEXT_PUBLIC_ICS_TOKEN??""}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                  style={{background:"rgba(16,185,129,0.08)",color:"#059669",border:"1px solid rgba(16,185,129,0.2)"}}>
                  📅 Subscribe Calendar
                </a>
                <a href="/admin/availability"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all hover:opacity-80"
                  style={{background:"rgba(148,163,184,0.08)",color:"#64748b",border:"1px solid rgba(148,163,184,0.15)"}}>
                  📆 Availability
                </a>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-5">
                {[
                  {label:"This Month",value:monthRevenue>0?`$${monthRevenue.toLocaleString("en-US",{minimumFractionDigits:0})}`:pendingInquiries>0?"—":"$0",sub:"revenue",accent:"#10b981",bg:"rgba(16,185,129,0.06)",border:"rgba(16,185,129,0.2)"},
                  {label:"Confirmed",value:String(confirmedSessions),sub:"sessions booked",accent:C.p1,bg:C.p1_04,border:C.p1_20},
                  {label:"New",value:String(newThisMonth),sub:"inquiries this month",accent:"#f59e0b",bg:"rgba(245,158,11,0.06)",border:"rgba(245,158,11,0.2)"},
                  {label:"Clients",value:String(totalClients),sub:"total",accent:"#6366f1",bg:"rgba(99,102,241,0.06)",border:"rgba(99,102,241,0.2)"},
                ].map(s=>(
                  <div key={s.label} className="rounded-2xl p-4 border" style={{background:s.bg,borderColor:s.border}}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1" style={{color:s.accent}}>{s.label}</p>
                    <p className="text-2xl font-black text-slate-900 leading-none">{s.value}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{s.sub}</p>
                  </div>
                ))}
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
                />

                {/* Right column: upcoming + needs reply */}
                <div className="space-y-4">
                  {/* Upcoming sessions */}
                  <div className="rounded-2xl overflow-hidden border" style={{borderColor:"rgba(16,185,129,0.2)",background:"white"}}>
                    <div className="h-[3px]" style={{background:"linear-gradient(90deg,#10b981,#059669)"}}/>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black uppercase tracking-widest text-emerald-600">📅 Upcoming</p>
                        <button onClick={()=>setTab("clients")} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">All →</button>
                      </div>
                      {upcoming.length===0?(
                        <p className="text-sm text-slate-400 py-1">No confirmed sessions yet.</p>
                      ):(
                        <div className="flex flex-col gap-1.5">
                          {upcoming.map(inq=>{
                            const isToday=inq.session_date===todayStr;const isTomorrow=inq.session_date===tomorrowStr;
                            return(
                              <div key={inq.id} className="flex items-center gap-2 p-2.5 rounded-xl" style={{background:"rgba(16,185,129,0.04)",border:"1px solid rgba(16,185,129,0.1)"}}>
                                <div className="flex-shrink-0 w-[52px] text-center">
                                  <span className={`text-[9px] font-black tracking-wide block leading-tight ${isToday?"text-rose-500":isTomorrow?"text-amber-500":"text-emerald-600"}`}>{dayLabel(inq.session_date!)}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-900 truncate">{inq.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate">{inq.session_type||"Session"}</p>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                  {inq.payment_status==="paid"&&<span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">✓</span>}
                                  <button onClick={()=>router.push(`/admin/reminders/${inq.id}`)}
                                    className="px-1.5 py-0.5 rounded-lg transition-all hover:opacity-80 text-[11px]"
                                    style={{background:"rgba(245,158,11,0.08)",color:"#d97706"}} title="Send reminder">🔔</button>
                                  <button onClick={()=>router.push(`/admin/reminders/${inq.id}?focus=thank-you`)}
                                    className="px-1.5 py-0.5 rounded-lg text-white transition-all hover:opacity-80 text-[11px]"
                                    style={{background:"linear-gradient(135deg,#9d6fe8,#e879a0)"}} title="Thank you">🙏</button>
                                  <button onClick={()=>router.push(`/admin/conversation/${inq.id}`)}
                                    className="text-[10px] px-2 py-0.5 rounded-lg transition-all hover:opacity-80 font-bold"
                                    style={{background:C.p1_08,color:C.p1}}>→</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Needs reply */}
                  {pendingInquiries>0&&(()=>{
                    const newInqs=inquiries
                      .filter(i=>!i.reply_sent_at&&i.status!=="archived"&&i.status!=="not_interested"&&i.status!=="responded"&&i.status!=="manual")
                      .sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
                      .slice(0,4);
                    const hoursAgo=(iso:string)=>{
                      const h=Math.round((Date.now()-new Date(iso).getTime())/(1000*60*60));
                      if(h<1)return"just now";if(h===1)return"1h ago";if(h<24)return`${h}h ago`;
                      const d=Math.round(h/24);return d===1?"1d ago":`${d}d ago`;
                    };
                    return(
                      <div className="rounded-2xl overflow-hidden border" style={{borderColor:"rgba(245,158,11,0.3)",background:"white"}}>
                        <div className="h-[3px]" style={{background:"linear-gradient(90deg,#f59e0b,#d97706)"}}/>
                        <div className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-xs font-black uppercase tracking-widest text-amber-600">📬 Needs Reply</p>
                            <button onClick={()=>setTab("inquiries")} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">
                              {pendingInquiries>4?`+${pendingInquiries-4} more →`:"All →"}
                            </button>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {newInqs.map(inq=>(
                              <div key={inq.id} className="flex items-center gap-2 p-2 rounded-xl border" style={{borderColor:"#fef3c7",background:"#fffbeb"}}>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <p className="text-xs font-bold text-slate-900">{inq.name}</p>
                                    <span className="text-[9px] text-amber-600 font-bold">{hoursAgo(inq.created_at)}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-500 truncate">
                                    {inq.session_type||"Session"}{inq.date_in_mind?` · ${inq.date_in_mind}`:""}
                                  </p>
                                </div>
                                <button onClick={()=>setTab("inquiries")}
                                  className="flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg text-white"
                                  style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                                  Reply →
                                </button>
                              </div>
                            ))}
                          </div>
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
                  <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white">
                    <div className="h-[3px]" style={{background:"linear-gradient(90deg,#6366f1,#8b5cf6)"}}/>
                    <div className="p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500">✉️ Client Emails</p>
                        <div className="flex items-center gap-3">
                          <button onClick={()=>setFreeComposeOpen(p=>!p)}
                            className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all"
                            style={freeComposeOpen?{background:C.grad12,color:"#fff"}:{background:C.p1_04,color:C.p1,border:`1px solid ${C.p1_20}`}}>
                            {freeComposeOpen?"✕ Cancel":"+ Compose"}
                          </button>
                          <button onClick={fetchInbox} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">Refresh</button>
                        </div>
                      </div>

                      <div className="mb-3 rounded-xl border" style={{borderColor:"rgba(99,102,241,0.12)",background:"rgba(99,102,241,0.04)"}}>
                        <button
                          onClick={()=>setBlockedSendersOpen(o=>!o)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left"
                        >
                          <span className="text-[11px] font-bold text-slate-500">
                            🚫 Blocked senders {blockedSenders.length>0&&<span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{background:"rgba(99,102,241,0.12)",color:C.p1}}>{blockedSenders.length}</span>}
                          </span>
                          <span className="text-[10px] text-slate-400">{blockedSendersOpen?"▲ hide":"▼ show"}</span>
                        </button>
                        {blockedSendersOpen&&(
                          <div className="px-3 pb-2.5 border-t" style={{borderColor:"rgba(99,102,241,0.1)"}}>
                            <p className="text-[10px] text-slate-400 mt-2 mb-2">Dashboard-only. Hidden here, untouched in Gmail.</p>
                            {blockedSendersLoading&&<span className="text-[10px] font-bold text-slate-400">Loading…</span>}
                            {blockedSenders.length>0?(
                              <div className="flex flex-wrap gap-2">
                                {blockedSenders.map(email=>(
                                  <button
                                    key={email}
                                    onClick={()=>unblockInboxSender(email)}
                                    disabled={blockingSender===email}
                                    className="rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] transition-all disabled:opacity-50"
                                    style={{borderColor:C.p1_20,background:"white",color:C.p1}}
                                  >
                                    {blockingSender===email?`Restoring…`:`Unblock ${email}`}
                                  </button>
                                ))}
                              </div>
                            ):(
                              !blockedSendersLoading&&<p className="text-[10px] text-slate-400">No blocked senders.</p>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Freeform compose panel */}
                      {freeComposeOpen&&(
                        <div className="mb-4 p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                          <p className="text-xs font-black text-slate-700">New Email</p>
                          <input className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-slate-200 bg-white text-slate-700" placeholder="To (email address)" value={freeComposeTo} onChange={e=>setFreeComposeTo(e.target.value)} style={{fontFamily:"inherit"}}/>
                          <input className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-slate-200 bg-white text-slate-700" placeholder="Subject" value={freeComposeSubject} onChange={e=>setFreeComposeSubject(e.target.value)} style={{fontFamily:"inherit"}}/>
                          <textarea rows={4} className="w-full px-3 py-2 rounded-lg text-sm outline-none border border-slate-200 bg-white text-slate-700 resize-none" placeholder="Write your message — or jot rough notes and hit AI Polish…" value={freeComposeBody} onChange={e=>setFreeComposeBody(e.target.value)} style={{fontFamily:"inherit"}}/>
                          <div className="flex gap-2">
                            <button onClick={polishFreeCompose} disabled={freeComposePolishing||!freeComposeBody.trim()}
                              className="flex-1 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                              style={{background:C.p1_08,color:C.p1,border:`1px solid ${C.p1_20}`}}>
                              {freeComposePolishing?"Polishing…":"✨ AI Polish"}
                            </button>
                            <button onClick={sendFreeCompose} disabled={freeComposeSending||!freeComposeTo.trim()||!freeComposeBody.trim()}
                              className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
                              style={{background:C.grad12}}>
                              {freeComposeSending?"Sending…":"Send →"}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Thread list */}
                      {inboxLoading?(
                        <p className="text-xs text-slate-400 py-2">Loading…</p>
                      ):inboxThreads.length===0&&!freeComposeOpen?(
                        <p className="text-xs text-slate-400 py-2">No new client emails.</p>
                      ):(
                        <div className="flex flex-col gap-3">
                          {inboxThreads.map(t=>{
                            const isOpen=inboxReplyOpen[t.threadId]??false;
                            const draft=inboxDraft[t.threadId]??"";
                            const isGenerating=inboxDraftLoading[t.threadId]??false;
                            const isSending=inboxSendLoading[t.threadId]??false;
                            const name=t.fromName||t.fromEmail;
                            return(
                              <div key={t.threadId} className={`rounded-xl overflow-hidden ${t.isUnread?"border-2 border-violet-400 bg-violet-50 shadow-md shadow-violet-100":"border border-slate-200 bg-white"}`}>
                                {/* Sender row */}
                                <div className="flex items-center gap-3 px-3 pt-3 pb-2">
                                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                                    style={{background:"linear-gradient(135deg,#6366f1,#8b5cf6)"}}>
                                    {initials(name)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className={`text-sm font-black ${t.isUnread?"text-violet-900":"text-slate-900"}`}>{name}</p>
                                      {t.isUnread&&<span className="text-[10px] font-black text-white bg-violet-500 rounded-full px-1.5 py-0.5 leading-none">NEW</span>}
                                      {t.messageCount>1&&<span className="text-[10px] font-bold text-slate-400">{t.messageCount} msgs</span>}
                                      <span className={`text-[10px] font-bold ml-auto ${t.isUnread?"text-violet-600":"text-violet-500"}`}>{timeAgo(t.timestamp)}</span>
                                    </div>
                                    <p className={`text-[11px] truncate ${t.isUnread?"text-violet-500":"text-slate-400"}`}>{t.fromEmail}</p>
                                  </div>
                                </div>
                                {/* Subject + snippet */}
                                <div className="px-3 pb-3">
                                  <p className={`text-xs font-bold mb-1 ${t.isUnread?"text-violet-800":"text-slate-700"}`}>{t.subject}</p>
                                  <p className={`text-[12px] leading-relaxed line-clamp-3 ${t.isUnread?"text-violet-700":"text-slate-500"}`}>{decodeSnippet(t.snippet)}</p>
                                </div>
                                {/* Action buttons */}
                                {(()=>{
                                  const matchedInquiry=inquiries.find(i=>i.email.toLowerCase()===t.fromEmail.toLowerCase());
                                  return(
                                    <div className="flex border-t border-slate-100">
                                      <button
                                        onClick={async()=>{
                                          if(matchedInquiry){
                                            router.push(`/admin/conversation/${matchedInquiry.id}`);
                                          }else{
                                            const created=await createInquiryFromThread(t);
                                            if(created)router.push(`/admin/conversation/${created.id}`);
                                          }
                                        }}
                                        className="flex-1 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                                        ✏️ Draft Reply
                                      </button>
                                      <div className="w-px bg-slate-100"/>
                                      <button
                                        onClick={()=>blockInboxSender(t)}
                                        disabled={blockingSender===t.fromEmail.toLowerCase()}
                                        className="flex-1 py-2 text-[11px] font-bold text-rose-500 hover:bg-rose-50 transition-colors disabled:opacity-50"
                                      >
                                        {blockingSender===t.fromEmail.toLowerCase()?"Blocking…":"🚫 Block Sender"}
                                      </button>
                                      <div className="w-px bg-slate-100"/>
                                      <a href={`https://mail.google.com/mail/u/0/#inbox/${t.threadId}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="flex-1 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50 transition-colors text-center">
                                        Open in Gmail ↗
                                      </a>
                                    </div>
                                  );
                                })()}
                                {isOpen&&(
                                  <div className="border-t border-slate-100 p-3 bg-slate-50 space-y-2">
                                    <textarea rows={2} className="w-full px-3 py-2 rounded-lg text-xs outline-none border border-slate-200 bg-white text-slate-600 resize-none" placeholder="Add context for the AI (optional) — e.g. 'Tell them SFSU spots are available May 18'" value={inboxContext[t.threadId]??""} onChange={e=>setInboxContext(p=>({...p,[t.threadId]:e.target.value}))} style={{fontFamily:"inherit"}}/>
                                    <button onClick={()=>generateInboxDraft(t)} disabled={isGenerating}
                                      className="w-full py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                                      style={{background:C.p1_08,color:C.p1,border:`1px solid ${C.p1_20}`}}>
                                      {isGenerating?"Drafting…":"✨ AI Draft"}
                                    </button>
                                    {draft&&(
                                      <>
                                        <textarea rows={6} className="w-full px-3 py-2 rounded-lg text-xs outline-none border border-slate-200 bg-white text-slate-700 resize-y" value={draft} onChange={e=>setInboxDraft(p=>({...p,[t.threadId]:e.target.value}))} style={{fontFamily:"inherit"}}/>
                                        <div className="flex gap-2">
                                          <button onClick={()=>navigator.clipboard.writeText(draft).then(()=>showToast("Copied ✓"))}
                                            className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                                            style={{background:"rgba(148,163,184,0.12)",color:"#64748b"}}>
                                            Copy
                                          </button>
                                          <button onClick={()=>sendInboxReply(t)} disabled={isSending}
                                            className="flex-1 py-2 rounded-lg text-xs font-bold text-white transition-all disabled:opacity-50"
                                            style={{background:C.grad12}}>
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

        {tab==="locations"&&<LocationsTab showToast={showToast}/>}

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
                  {([["home_cover_grads","Grads card"],["home_cover_families","Families card"],["home_cover_contact","Contact card"],["home_editorial_large","Editorial — large photo (right, back)"],["home_editorial_small","Editorial — small photo (right, front)"]] as [string,string][]).map(([key,label])=>(
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
                <p className="text-xs text-slate-400 mb-5">Pick which portfolio images appear on the grad, family, and couples pricing pages.</p>
                <div className="space-y-4">
                  {([
                    {key:"pricing_grad_standard_image",label:"Grad package photo",helper:"Shown beside the standard graduation package.",category:"grads"},
                    {key:"pricing_grad_group_image",label:"Group grad photo",helper:"Shown in the group grad package section.",category:"grads"},
                    {key:"pricing_family_session_image",label:"Family session photo",helper:"Shown beside the family session package.",category:"families"},
                    {key:"pricing_family_extended_image",label:"Extended family photo",helper:"Shown beside the extended family package.",category:"families"},
                    {key:"pricing_couples_standard_image",label:"Couples session photo",helper:"Shown beside the standard couples package.",category:"couples"},
                    {key:"pricing_couples_engagement_image",label:"Engagement session photo",helper:"Shown beside the engagement package.",category:"couples"},
                    {key:"pricing_couples_proposal_image",label:"Proposal coverage photo",helper:"Shown beside the proposal coverage package.",category:"couples"},
                  ] as {key:string;label:string;helper:string;category:"grads"|"families"|"couples"}[]).map(({key,label,helper,category})=>{
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

        {tab==="blog"&&<BlogTab showToast={showToast}/>}

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

        {/* ── INQUIRIES ── */}
        {tab==="inquiries"&&(
          <div className="space-y-6">

            {/* ── Gmail connection card ── */}
            <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <div className="h-[3px]" style={{background:gmailConnected?"linear-gradient(90deg,#34d399,#10b981)":C.grad90_12}}/>
              <div className="p-5 flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                       style={{background:gmailConnected?"rgba(16,185,129,0.1)":C.p1_08}}>
                    {gmailConnected?"✉️":"🔗"}
                  </div>
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {gmailConnected?"Gmail Connected":"Connect Gmail"}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {gmailConnected
                        ?<>Sending as <span className="font-semibold text-slate-600">{gmailEmail}</span> · emails send directly from your inbox</>
                        :"Link your Gmail to send replies without leaving this page"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {gmailConnected?(
                    <button onClick={disconnectGmail}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80"
                      style={{background:"rgba(239,68,68,0.08)",color:"#dc2626"}}>
                      Disconnect
                    </button>
                  ):(
                    <a href="/api/gmail/auth"
                      className="text-xs font-bold px-4 py-2 rounded-xl transition-all hover:opacity-80 flex items-center gap-1.5"
                      style={{background:C.grad12,color:"#fff"}}>
                      Connect Gmail →
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Inquiry list */}
            <div className="space-y-3">
              {/* Header row */}
              <div className="flex items-center justify-between px-1">
                <div>
                  <h2 className="text-base font-black text-slate-900">Contact Inquiries</h2>
                  <p className="text-xs font-medium text-slate-400 mt-0.5">
                    {inquiries.filter(i=>i.status==="new").length} new · {inquiries.length} total
                  </p>
                </div>
                <div className="flex gap-2 items-center flex-wrap">
                  <select
                    value={inquirySort}
                    onChange={e=>setInquirySort(e.target.value as typeof inquirySort)}
                    className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg outline-none cursor-pointer"
                    style={{border:`1px solid ${C.p1_20}`,background:C.p1_04,color:C.p1,fontFamily:"inherit"}}>
                    <option value="needs_reply">Needs reply first</option>
                    <option value="paid_recently">Paid recently</option>
                    <option value="newest">Newest inquiry</option>
                    <option value="oldest">Oldest inquiry</option>
                    <option value="session_date">Session date</option>
                    <option value="alpha">A → Z</option>
                  </select>
                  <button onClick={syncPayments} disabled={syncLoading}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5 disabled:opacity-50"
                    style={{background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff"}}>
                    {syncLoading?<><span className="animate-spin inline-block">◌</span> Scanning…</>:"💳 Sync Payments"}
                  </button>
                  <button onClick={syncTimeline} disabled={timelineSyncLoading}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5 disabled:opacity-50"
                    style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)",color:"#fff"}}>
                    {timelineSyncLoading?<><span className="animate-spin inline-block">◌</span> Syncing…</>:"📬 Sync Timeline"}
                  </button>
                  <button onClick={fetchInquiries} disabled={inquiriesLoading}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5"
                    style={{background:C.grad12,color:"#fff"}}>
                    {inquiriesLoading?"Loading…":"↻ Refresh"}
                  </button>
                </div>
              </div>

              {/* Sync result banner */}
              {(syncResult!==null||syncMsg)&&(
                <div className="rounded-xl px-4 py-3 text-sm"
                     style={syncResult?.length?{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)"}:{background:"rgba(148,163,184,0.08)",border:"1px solid rgba(148,163,184,0.2)"}}>
                  {syncMsg&&<p className="text-slate-500 text-xs">{syncMsg}</p>}
                  {syncResult?.length?(
                    <div className="space-y-1">
                      <p className="text-xs font-black text-emerald-600 mb-2">✓ {syncResult.length} payment{syncResult.length===1?"":"s"} synced</p>
                      {syncResult.map((r,i)=>(
                        <div key={i} className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                          <span className="font-semibold">{r.name}</span>
                          {r.email&&<span className="text-slate-400">{r.email}</span>}
                          {r.amount&&<span className="text-emerald-600 font-bold">{r.amount}</span>}
                          {r.method&&<span className="text-slate-400">via {r.method}</span>}
                          {r.paidAt&&<span className="text-slate-400">{new Date(r.paidAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
                          {r.paymentType==="deposit_2"&&r.pass===3
                            ?<span className="text-blue-500 font-semibold">balance (auto)</span>
                            :r.paymentType&&r.paymentType!=="deposit_1"
                              ?<span className="text-amber-600 font-semibold capitalize">{r.paymentType.replace("_"," ")}</span>
                              :null}
                          {r.orphan&&<span className="text-orange-500 font-bold">no inquiry</span>}
                          {r.dateBooked&&<span className="font-bold text-violet-600">📅 {new Date(r.dateBooked+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} blocked</span>}
                          {r.alreadyPaid&&r.pass!==3&&<span className="text-slate-400">(already marked)</span>}
                        </div>
                      ))}
                    </div>
                  ):syncResult?.length===0&&!syncMsg?(
                    <p className="text-slate-500 text-xs">No new Pixieset payments found in Gmail.</p>
                  ):null}
                </div>
              )}

              {inquiriesLoading?(
                <div className="text-center py-16 text-slate-400 text-sm bg-white rounded-2xl border border-slate-100">Loading inquiries…</div>
              ):inquiries.length===0?(
                <div className="text-center py-16 bg-white rounded-2xl border border-slate-100">
                  <p className="text-2xl mb-2">📭</p>
                  <p className="text-slate-500 font-semibold">No inquiries yet</p>
                  <p className="text-xs text-slate-400 mt-1">New contact form submissions will appear here</p>
                </div>
              ):(()=>{
                const needsReply=(i:Inquiry)=>!i.reply_sent_at&&i.status!=="archived"&&i.status!=="not_interested"&&i.status!=="responded"&&i.status!=="manual";
                const hasUnread=(i:Inquiry)=>!!inboxThreads.find(t=>t.fromEmail.toLowerCase()===i.email.toLowerCase()&&t.isUnread);
                const todayMs=new Date().setHours(0,0,0,0);
                const sortedInquiries=[...inquiries].sort((a,b)=>{
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
                  const statusColor=inq.status==="new"?"#10b981":inq.status==="responded"?"#3b82f6":inq.status==="not_interested"?"#ef4444":"#94a3b8";
                  const statusBg=inq.status==="new"?"rgba(16,185,129,0.08)":inq.status==="responded"?"rgba(59,130,246,0.08)":inq.status==="not_interested"?"rgba(239,68,68,0.08)":"rgba(148,163,184,0.08)";
                  const hasDraft=!!drafts[inq.id];
                  const unreadThread=inboxThreads.find(t=>t.fromEmail.toLowerCase()===inq.email.toLowerCase()&&t.isUnread&&!dismissedThreadIds.has(t.threadId));

                  const highlighted=!!unreadThread||needsReply(inq);
                  return(
                    <div key={inq.id}
                         className={`rounded-2xl overflow-hidden transition-shadow hover:shadow-md ${highlighted?"border-2 shadow-md shadow-amber-100":"bg-white border border-slate-100"}`}
                         style={highlighted?{background:"#fffbeb"}:{borderLeftWidth:"3px",borderLeftStyle:"solid",borderLeftColor:statusColor,background:"#fff"}}>

                      {/* ── Card header (always visible) ── */}
                      <div className="flex items-stretch">
                        {/* Clickable info area — div so links inside remain functional */}
                        <div
                          onClick={()=>setEditingInquiry(isOpen?null:inq)}
                          className={`flex-1 min-w-0 p-4 sm:p-5 transition-colors duration-150 cursor-pointer ${highlighted?"hover:bg-amber-50/70":"hover:bg-slate-50/70"}`}>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                  style={{background:statusBg,color:statusColor}}>
                              {inq.status==="new"?"● New":inq.status==="responded"?"✓ Responded":inq.status==="not_interested"?"✕ Not Interested":"○ Archived"}
                            </span>
                            {unreadThread&&(
                              <span className="flex items-center gap-0.5">
                                <button
                                  onClick={e=>{e.stopPropagation();router.push(`/admin/conversation/${inq.id}`);}}
                                  className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-l-full animate-pulse"
                                  style={{background:"#f59e0b",color:"#fff"}}>
                                  ✉ New Reply
                                </button>
                                <button
                                  onClick={e=>{e.stopPropagation();dismissUnreadThread(unreadThread.threadId);}}
                                  className="flex items-center justify-center text-[10px] font-black px-1.5 py-0.5 rounded-r-full leading-none"
                                  title="Dismiss new reply"
                                  style={{background:"#ef4444",color:"#fff"}}>
                                  ✕
                                </button>
                              </span>
                            )}
                            <p className="text-sm font-black text-slate-900">{inq.name}</p>
                            <p className="text-xs text-slate-400">
                              {new Date(inq.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
                            </p>
                          </div>
                          {/* Contact + session info — links stop propagation so they don't toggle the card */}
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mb-2.5">
                            <a href={`mailto:${inq.email}`}
                               onClick={e=>e.stopPropagation()}
                               className="font-semibold hover:underline"
                               style={{color:C.p1}}>{inq.email}</a>
                            {inq.phone&&(
                              <>
                                <span className="text-slate-300">·</span>
                                <a href={`tel:${inq.phone}`}
                                   onClick={e=>e.stopPropagation()}
                                   className="font-medium text-slate-600 hover:underline hover:text-slate-900 transition-colors">
                                  {inq.phone}
                                </a>
                              </>
                            )}
                            <span className="text-slate-300">·</span>
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
                                className="font-semibold text-slate-600 hover:text-violet-600 transition-colors group flex items-center gap-1"
                                title="Edit session type">
                                {inq.session_type||<span className="text-slate-400 italic">Set type</span>}
                                <span className="opacity-0 group-hover:opacity-100 text-[9px] text-slate-400 transition-opacity">✏️</span>
                              </button>
                            )}
                            {inq.date_in_mind&&<><span className="text-slate-300">·</span><span className="text-slate-600">{inq.date_in_mind}</span></>}
                            {inq.school&&<><span className="text-slate-300">·</span><span className="text-slate-600">{inq.school}</span></>}
                          </div>
                          {/* Payment / confirmation status pills */}
                          {(inq.deposit_paid_at||inq.invoice_sent_at||inq.contract_sent_at||inq.confirmation_sent_at||inq.gallery_delivered_at)&&(
                            <div className="flex flex-wrap gap-1 mb-2">
                              {inq.invoice_sent_at&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{background:"rgba(99,102,241,0.1)",color:"#6366f1"}}>
                                  📄 Invoice {new Date(inq.invoice_sent_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                                </span>
                              )}
                              {inq.contract_sent_at&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{background:"rgba(139,92,246,0.1)",color:"#7c3aed"}}>
                                  📝 Contract {new Date(inq.contract_sent_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                                </span>
                              )}
                              {inq.deposit_paid_at&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full flex items-center gap-1"
                                      style={{background:"rgba(16,185,129,0.12)",color:"#059669"}}>
                                  💳 Paid {new Date(inq.deposit_paid_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                                  {inq.confirmation_sent_at?(
                                    <span style={{color:"#059669"}}>· ✉ Confirmed</span>
                                  ):(
                                    <span style={{color:"#d97706"}}>· ✉ Not confirmed</span>
                                  )}
                                </span>
                              )}
                              {inq.gallery_delivered_at&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{background:"rgba(251,146,60,0.12)",color:"#ea580c"}}>
                                  🖼 Gallery {new Date(inq.gallery_delivered_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}
                                </span>
                              )}
                              {inq.deposit_paid_at&&finalPaymentIds.has(inq.id)&&(
                                <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full"
                                      style={{background:"rgba(16,185,129,0.15)",color:"#047857"}}>
                                  💳 Final Paid ✓
                                </span>
                              )}
                              {inq.deposit_paid_at&&!finalPaymentIds.has(inq.id)&&(
                                <button onClick={e=>{e.stopPropagation();setCardPaymentId(cardPaymentId===inq.id?null:inq.id);setCardPaymentAmount("");setCardPaymentMethod("Venmo");}}
                                  className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full cursor-pointer"
                                  style={{background:"rgba(99,102,241,0.12)",color:"#6366f1"}}>
                                  💳 Record 2nd
                                </button>
                              )}
                            </div>
                          )}
                          {cardPaymentId===inq.id&&(
                            <div className="mt-2 rounded-xl p-3" style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.2)"}} onClick={e=>e.stopPropagation()}>
                              <p className="text-[10px] font-black uppercase tracking-widest mb-2" style={{color:"#059669"}}>Record Final Payment</p>
                              <div className="flex gap-2 mb-2">
                                <input type="text" placeholder="Amount (e.g. 150)" value={cardPaymentAmount}
                                  onChange={e=>setCardPaymentAmount(e.target.value)}
                                  className="flex-1 rounded-lg border px-2.5 py-1.5 text-sm font-semibold outline-none"
                                  style={{borderColor:"rgba(16,185,129,0.3)",background:"white",color:"#1e293b"}}/>
                                <select value={cardPaymentMethod} onChange={e=>setCardPaymentMethod(e.target.value)}
                                  className="rounded-lg border px-2 py-1.5 text-xs font-bold outline-none"
                                  style={{borderColor:"rgba(16,185,129,0.3)",background:"white",color:"#1e293b"}}>
                                  <option>Venmo</option><option>Zelle</option><option>PayPal</option><option>Cash App</option><option>Cash</option><option>Other</option>
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={()=>recordCardPayment(inq.id)} disabled={!cardPaymentAmount||cardPaymentSaving}
                                  className="flex-1 rounded-lg py-1.5 text-xs font-black text-white disabled:opacity-50"
                                  style={{background:"linear-gradient(135deg,#10b981,#059669)"}}>
                                  {cardPaymentSaving?"Saving…":"Record Payment ✓"}
                                </button>
                                <button onClick={e=>{e.stopPropagation();setCardPaymentId(null);setCardPaymentAmount("");}}
                                  className="px-3 rounded-lg py-1.5 text-xs font-bold"
                                  style={{background:"rgba(0,0,0,0.05)",color:"#64748b"}}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                          {/* Message preview */}
                          {!isOpen?(
                            <div>
                              <p className="text-xs text-slate-700 leading-relaxed line-clamp-2 font-medium">
                                &ldquo;{inq.message}&rdquo;
                              </p>
                              {inq.message.length>120&&(
                                <p className="text-[10px] font-bold mt-1" style={{color:C.p1}}>Read full message ↓</p>
                              )}
                            </div>
                          ):(
                            <p className="text-[10px] font-bold" style={{color:C.p1}}>▲ Collapse</p>
                          )}
                          {/* Quick status buttons — always visible */}
                          <div className="flex items-center gap-1 mt-2 flex-wrap" onClick={e=>e.stopPropagation()}>
                            {(["new","responded","archived","not_interested"] as const).map(s=>(
                              <button key={s}
                                onClick={()=>updateInquiryStatus(inq.id,s)}
                                className="text-[10px] font-bold px-2 py-0.5 rounded-lg transition-all hover:opacity-80"
                                style={inq.status===s
                                  ?{background:s==="new"?"rgba(16,185,129,0.15)":s==="responded"?"rgba(59,130,246,0.12)":s==="not_interested"?"rgba(239,68,68,0.15)":"rgba(148,163,184,0.15)",color:s==="new"?"#10b981":s==="responded"?"#3b82f6":s==="not_interested"?"#ef4444":"#94a3b8",fontWeight:800}
                                  :{background:"rgba(0,0,0,0.04)",color:"#94a3b8"}}>
                                {s==="new"?"● New":s==="responded"?"✓ Replied":s==="not_interested"?"✕ Not Int.":"○ Archive"}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Right: action buttons */}
                        <div className="flex flex-col justify-center gap-2 p-3 sm:p-4 flex-shrink-0 border-l border-slate-100">
                          {/* Primary: open full conversation page */}
                          <a href={`/admin/conversation/${inq.id}`}
                            onClick={e=>e.stopPropagation()}
                            className="text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-80 flex items-center gap-1.5 whitespace-nowrap text-center justify-center"
                            style={{background:C.grad12,color:"#fff"}}>
                            💬 Open Thread
                          </a>
                          {/* Secondary: quick draft without leaving admin */}
                          <button
                            onClick={e=>{e.stopPropagation();if(!isOpen)setEditingInquiry(inq);generateDraft(inq);}}
                            disabled={draftLoading===inq.id}
                            className="text-xs font-bold px-3 py-2 rounded-xl transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap justify-center"
                            style={{background:C.p1_08,color:C.p1}}>
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
                              style={draftCopied===inq.id?{background:"#10b981",color:"#fff"}:{background:C.p1_08,color:C.p1}}>
                              {draftCopied===inq.id?"✓ Copied":"📋 Copy"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* ── Expanded detail panel ── */}
                      {isOpen&&(
                        <div className="border-t border-slate-100">

                          {/* Session details */}
                          {(inq.school||inq.instagram||inq.people||inq.preferred_time||inq.location)&&(
                            <div className="p-4 sm:p-5" style={{background:"rgba(248,250,252,0.6)"}}>
                              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Session Details</p>
                              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                                {inq.school&&<div><span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">School / Campus </span><span className="text-slate-700 font-medium">{inq.school}</span></div>}
                                {inq.people&&<div><span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">People </span><span className="text-slate-700 font-medium">{inq.people}</span></div>}
                                {inq.preferred_time&&<div><span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Preferred time </span><span className="text-slate-700 font-medium">{fmt12h(inq.preferred_time)}</span></div>}
                                {inq.location&&<div><span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Desired location </span><span className="text-slate-700 font-medium">{inq.location}</span></div>}
                                {inq.instagram&&<div><span className="font-bold text-slate-400 uppercase tracking-wide text-[10px]">Instagram </span><span className="text-slate-700 font-medium">@{inq.instagram.replace(/^@/,"")}</span></div>}
                              </div>
                            </div>
                          )}

                          {/* Full message */}
                          <div className="p-4 sm:p-5 border-t border-slate-100" style={{background:"rgba(248,250,252,0.6)"}}>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Message</p>
                            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{inq.message}</p>
                          </div>

                          {/* ── AI Draft section ── */}
                          <div className="p-4 sm:p-5 space-y-4 border-t border-slate-100">
                            {/* Section header */}
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs" style={{background:C.grad12}}>✦</div>
                                <p className="text-sm font-black text-slate-900">AI Draft Reply</p>
                              </div>
                              <button
                                onClick={()=>generateDraft(inq)}
                                disabled={draftLoading===inq.id}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 disabled:opacity-50 flex items-center gap-1.5"
                                style={{background:C.p1_08,color:C.p1}}>
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
                                    className="w-full text-slate-700 leading-relaxed rounded-xl p-4 resize-none sm:resize-y outline-none"
                                    style={{border:`1px solid ${C.p1_20}`,background:C.p1_04,fontFamily:"inherit",fontSize:"16px"}}
                                  />
                                  <button
                                    onClick={()=>copyDraft(inq.id)}
                                    className="absolute top-2.5 right-2.5 text-xs font-bold px-2.5 py-1 rounded-lg transition-all flex items-center gap-1"
                                    style={draftCopied===inq.id?{background:"#10b981",color:"#fff"}:{background:"rgba(255,255,255,0.95)",color:C.p1,border:`1px solid ${C.p1_20}`,boxShadow:"0 1px 4px rgba(0,0,0,0.06)"}}>
                                    {draftCopied===inq.id?"✓ Copied":"📋 Copy"}
                                  </button>
                                </div>
                                {/* Send action row */}
                                {gmailConnected?(
                                  <button
                                    onClick={()=>openCompose(inq)}
                                    className="w-full text-sm font-bold py-2.5 rounded-xl transition-all hover:opacity-90 flex items-center justify-center gap-2"
                                    style={{background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff"}}>
                                    ✉️ Send from Gmail
                                  </button>
                                ):(
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <p className="text-[11px] text-slate-400 font-medium">Copy → paste into Gmail → send to {inq.email}</p>
                                    <a href={`mailto:${inq.email}?subject=Re: Your inquiry&body=${encodeURIComponent(drafts[inq.id])}`}
                                       className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                                       style={{background:C.p2_08,color:C.p2}}>
                                      Open in Gmail →
                                    </a>
                                  </div>
                                )}
                              </div>
                            ):(
                              <div className="rounded-xl p-6 text-center" style={{border:`1px dashed ${C.p1_20}`,background:C.p1_04}}>
                                <p className="text-sm text-slate-500">Click <strong>✦ Draft Reply</strong> to generate a personalized email</p>
                                <p className="text-xs text-slate-400 mt-1">Uses your Obsidian vault + live availability data</p>
                              </div>
                            )}

                            {/* Refine row */}
                            {hasDraft&&(
                              <div className="space-y-2">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Refine draft</p>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    value={draftFeedback[inq.id]??""}
                                    onChange={e=>setDraftFeedback(p=>({...p,[inq.id]:e.target.value}))}
                                    onKeyDown={e=>{if(e.key==="Enter"&&draftFeedback[inq.id]?.trim())generateDraft(inq,draftFeedback[inq.id]);}}
                                    placeholder='e.g. "be more direct" · "remove the pricing mention" · "add turnaround time"'
                                    className="flex-1 px-3 py-2.5 rounded-xl outline-none"
                                    style={{border:`1px solid ${C.p1_20}`,background:"#fff",color:"#334155",fontFamily:"inherit",fontSize:"16px"}}
                                  />
                                  <button
                                    onClick={()=>{if(draftFeedback[inq.id]?.trim())generateDraft(inq,draftFeedback[inq.id]);}}
                                    disabled={!draftFeedback[inq.id]?.trim()||draftLoading===inq.id}
                                    className="text-xs font-bold px-4 py-2.5 rounded-xl transition-all hover:opacity-80 disabled:opacity-30 flex-shrink-0"
                                    style={{background:C.grad12,color:"#fff"}}>
                                    {draftLoading===inq.id?"…":"Refine"}
                                  </button>
                                </div>
                                {draftFeedback[inq.id]?.trim()&&(
                                  <button
                                    onClick={()=>saveRuleFromFeedback(inq.id)}
                                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5"
                                    style={ruleSaved===inq.id?{background:"#10b981",color:"#fff"}:{background:"rgba(255,255,255,0.9)",color:C.p1,border:`1px solid ${C.p1_20}`}}>
                                    {ruleSaved===inq.id?"✓ Saved to Obsidian":"➕ Always remember this"}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Learn from actual email */}
                            {hasDraft&&(
                              <div className="rounded-xl overflow-hidden" style={{border:`1px solid ${C.p1_12}`}}>
                                <button
                                  onClick={()=>setShowLearnPanel(p=>({...p,[inq.id]:!p[inq.id]}))}
                                  className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50 text-left"
                                  style={{background:showLearnPanel[inq.id]?C.p1_04:"transparent"}}>
                                  <div className="flex items-center gap-2">
                                    <span className="text-base">🧠</span>
                                    <div>
                                      <p className="text-xs font-bold text-slate-700">What did you actually send?</p>
                                      <p className="text-[10px] text-slate-400">Paste your email → Claude extracts style rules automatically</p>
                                    </div>
                                  </div>
                                  <span className="text-slate-400 text-xs">{showLearnPanel[inq.id]?"▲":"▼"}</span>
                                </button>
                                {showLearnPanel[inq.id]&&(
                                  <div className="p-4 space-y-3 border-t border-slate-100" style={{background:C.p1_04}}>
                                    <textarea
                                      value={actualSent[inq.id]??""}
                                      onChange={e=>setActualSent(p=>({...p,[inq.id]:e.target.value}))}
                                      placeholder="Paste the final email you sent here…"
                                      rows={6}
                                      className="w-full text-slate-700 leading-relaxed rounded-xl p-3 resize-none sm:resize-y outline-none"
                                      style={{border:`1px solid ${C.p1_20}`,background:"#fff",fontFamily:"inherit",fontSize:"16px"}}
                                    />
                                    <button
                                      onClick={()=>analyzeAndLearn(inq)}
                                      disabled={!actualSent[inq.id]?.trim()||learnLoading===inq.id}
                                      className="text-xs font-bold px-4 py-2 rounded-xl transition-all hover:opacity-80 disabled:opacity-30 flex items-center gap-1.5"
                                      style={{background:C.grad12,color:"#fff"}}>
                                      {learnLoading===inq.id?<><span className="animate-spin inline-block">◌</span> Analyzing…</>:"🧠 Learn from this →"}
                                    </button>
                                    {learnedRules[inq.id]?.length>0&&(
                                      <div className="rounded-xl p-3 space-y-2.5" style={{background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.18)"}}>
                                        <p className="text-[10px] font-bold uppercase tracking-widest" style={{color:"#10b981"}}>Rules extracted from your edits</p>
                                        <ul className="space-y-1.5">
                                          {learnedRules[inq.id].map((rule,i)=>(
                                            <li key={i} className="text-xs text-slate-700 flex gap-2 items-start">
                                              <span className="mt-0.5 flex-shrink-0" style={{color:"#10b981"}}>✓</span>
                                              <span>{rule}</span>
                                            </li>
                                          ))}
                                        </ul>
                                        <p className="text-[10px] text-slate-400">Saved to Obsidian vault automatically</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* ── Compose & send panel (Gmail connected) ── */}
                          {composeOpen[inq.id]&&(
                            <div className="border-t border-slate-100 p-4 sm:p-5 space-y-3" style={{background:"rgba(16,185,129,0.03)"}}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-base">✉️</span>
                                  <p className="text-sm font-black text-slate-900">Send Email</p>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{background:"rgba(16,185,129,0.1)",color:"#10b981"}}>via {gmailEmail}</span>
                                </div>
                                <button onClick={()=>setComposeOpen(p=>({...p,[inq.id]:false}))} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                              </div>
                              {/* To (read-only) */}
                              <div className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm" style={{background:"rgba(0,0,0,0.03)",border:"1px solid rgba(0,0,0,0.06)"}}>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex-shrink-0">To</span>
                                <span className="text-slate-700 font-medium">{inq.name} &lt;{inq.email}&gt;</span>
                              </div>
                              {/* Subject */}
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Subject</label>
                                <input
                                  type="text"
                                  value={composeSubject[inq.id]??""}
                                  onChange={e=>setComposeSubject(p=>({...p,[inq.id]:e.target.value}))}
                                  className="w-full text-slate-700 px-3 py-2 rounded-xl outline-none font-medium"
                                  style={{border:`1px solid ${C.p1_20}`,background:"#fff",fontFamily:"inherit",fontSize:"16px"}}
                                />
                              </div>
                              {/* Body */}
                              <div>
                                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Message</label>
                                <textarea
                                  value={composeBody[inq.id]??""}
                                  onChange={e=>setComposeBody(p=>({...p,[inq.id]:e.target.value}))}
                                  rows={10}
                                  className="w-full text-slate-700 leading-relaxed rounded-xl p-3 resize-none sm:resize-y outline-none"
                                  style={{border:`1px solid ${C.p1_20}`,background:"#fff",fontFamily:"inherit",fontSize:"16px"}}
                                />
                              </div>
                              {/* Send button */}
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={()=>sendEmail(inq)}
                                  disabled={!composeSubject[inq.id]?.trim()||!composeBody[inq.id]?.trim()||sendLoading===inq.id}
                                  className="flex-1 text-sm font-black py-3 rounded-xl transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
                                  style={{background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff"}}>
                                  {sendLoading===inq.id?(
                                    <><span className="animate-spin inline-block">◌</span> Sending…</>
                                  ):(
                                    <>✉️ Send now</>
                                  )}
                                </button>
                                <button onClick={()=>setComposeOpen(p=>({...p,[inq.id]:false}))}
                                  className="text-xs font-bold px-4 py-3 rounded-xl transition-all hover:opacity-80"
                                  style={{background:"rgba(0,0,0,0.05)",color:"#64748b"}}>
                                  Cancel
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-400 text-center">Sends from your Gmail · goes into Sent Mail · client sees your real address</p>
                            </div>
                          )}

                          {/* ── Footer: status + delete ── */}
                          <div className="px-4 sm:px-5 py-3 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap" style={{background:"rgba(248,250,252,0.6)"}}>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mr-1">Status</span>
                              {(["new","responded","archived","not_interested"] as const).map(s=>(
                                <button key={s}
                                  onClick={()=>updateInquiryStatus(inq.id,s)}
                                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80 capitalize"
                                  style={inq.status===s
                                    ?{background:s==="new"?"rgba(16,185,129,0.15)":s==="responded"?"rgba(59,130,246,0.12)":s==="not_interested"?"rgba(239,68,68,0.15)":"rgba(148,163,184,0.15)",color:s==="new"?"#10b981":s==="responded"?"#3b82f6":s==="not_interested"?"#ef4444":"#94a3b8",fontWeight:800}
                                    :{background:"rgba(0,0,0,0.04)",color:"#94a3b8"}}>
                                  {s==="new"?"● New":s==="responded"?"✓ Responded":s==="not_interested"?"✕ Not Interested":"○ Archive"}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              {inquiryDeleteConfirm===inq.id?(
                                <div className="flex gap-1.5 items-center">
                                  <span className="text-xs text-slate-500">Delete?</span>
                                  <button onClick={()=>deleteInquiry(inq.id)} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-500 text-white">Yes</button>
                                  <button onClick={()=>setInquiryDeleteConfirm(null)} className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-200 text-slate-600">No</button>
                                </div>
                              ):(
                                <button onClick={()=>setInquiryDeleteConfirm(inq.id)} className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all hover:bg-red-50 hover:text-red-500 text-slate-400">🗑 Delete</button>
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
          const filtered=clients.filter(c=>{
            const matchesSearch=!q||c.name.toLowerCase().includes(q)||c.email.toLowerCase().includes(q);
            const hasPaid=c.sessions.some(s=>s.payment_status==="paid");
            const matchesFilter=clientFilter==="all"||(clientFilter==="paid"&&hasPaid)||(clientFilter==="unpaid"&&!hasPaid);
            return matchesSearch&&matchesFilter;
          });
          const pendingOnClients=inquiries.filter(i=>!i.reply_sent_at&&i.status!=="archived"&&i.status!=="not_interested"&&i.status!=="responded"&&i.status!=="manual").sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime());
          const hoursAgoClient=(iso:string)=>{
            const h=Math.round((Date.now()-new Date(iso).getTime())/(1000*60*60));
            if(h<1)return"just now";if(h===1)return"1h ago";if(h<24)return`${h}h ago`;
            const d=Math.round(h/24);return d===1?"1d ago":`${d}d ago`;
          };
          return(
            <div className="space-y-6">
              {/* New inquiries section */}
              {pendingOnClients.length>0&&(
                <div className="rounded-2xl overflow-hidden border" style={{borderColor:"rgba(245,158,11,0.3)",background:"white"}}>
                  <div className="h-[3px]" style={{background:"linear-gradient(90deg,#f59e0b,#d97706)"}}/>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-black uppercase tracking-widest text-amber-600">📬 New Inquiries — Needs Reply</p>
                      <button onClick={()=>setTab("inquiries")} className="text-[11px] font-bold text-slate-400 hover:text-slate-600">Open Inquiries tab →</button>
                    </div>
                    <div className="flex flex-col gap-2">
                      {pendingOnClients.map(inq=>(
                        <div key={inq.id} className="flex items-center gap-3 p-2.5 rounded-xl border" style={{borderColor:"#fef3c7",background:"#fffbeb"}}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-bold text-slate-900">{inq.name}</p>
                              <span className="text-[10px] text-amber-600 font-bold">{hoursAgoClient(inq.created_at)}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate">
                              {inq.session_type||"Session"}{inq.date_in_mind?` · ${inq.date_in_mind}`:""}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{inq.email}</p>
                          </div>
                          <button onClick={()=>setTab("inquiries")}
                            className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-lg text-white"
                            style={{background:"linear-gradient(135deg,#f59e0b,#d97706)"}}>
                            Reply →
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Search bar */}
              <div className={card}>
                <div className="h-[3px]" style={{background:C.grad12}}/>
                <div className="p-5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex-1 min-w-[220px]">
                      <input
                        type="search"
                        value={clientSearch}
                        onChange={e=>setClientSearch(e.target.value)}
                        placeholder="Search by name or email…"
                        className="w-full px-4 py-2.5 rounded-xl outline-none text-slate-700 text-sm"
                        style={{border:`1px solid ${C.p1_20}`,background:C.p1_04,fontFamily:"inherit"}}
                      />
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Payment filter pills */}
                      <div className="flex gap-1.5">
                        {(["all","paid","unpaid"] as const).map(f=>(
                          <button key={f} onClick={()=>setClientFilter(f)}
                            className="text-[11px] font-bold px-3 py-1 rounded-lg capitalize transition-all"
                            style={clientFilter===f
                              ?f==="paid"?{background:"rgba(16,185,129,0.15)",color:"#059669"}
                                :f==="unpaid"?{background:"rgba(148,163,184,0.18)",color:"#64748b"}
                                :{background:C.grad12,color:"#fff"}
                              :{background:"rgba(148,163,184,0.1)",color:"#94a3b8"}}>
                            {f==="paid"?"✓ Paid":f==="unpaid"?"Unpaid":"All"}
                          </button>
                        ))}
                      </div>
                      {/* Sort dropdown */}
                      <select
                        value={clientSort}
                        onChange={e=>setClientSort(e.target.value as typeof clientSort)}
                        className="text-[11px] font-bold px-2.5 py-1 rounded-lg outline-none cursor-pointer"
                        style={{border:`1px solid ${C.p1_20}`,background:C.p1_04,color:C.p1,fontFamily:"inherit"}}>
                        <option value="recent_activity">Most recent message</option>
                        <option value="paid_recently">Paid recently</option>
                        <option value="newest_inquiry">Newest inquiry</option>
                        <option value="oldest_inquiry">Oldest inquiry</option>
                        <option value="session_date">Session date</option>
                        <option value="alpha">A → Z</option>
                      </select>
                      <p className="text-xs text-slate-400 font-medium">
                        {filtered.length} client{filtered.length===1?"":"s"}
                        {q?` matching "${q}"`:""}
                        {" · "}{inquiries.length} total session{inquiries.length===1?"":"s"}
                      </p>
                      <button onClick={syncPayments} disabled={syncLoading}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                        style={{background:"linear-gradient(135deg,#10b981,#059669)",color:"#fff"}}>
                        {syncLoading?<><span className="animate-spin inline-block">◌</span> Scanning…</>:"💳 Sync Payments"}
                      </button>
                      <button onClick={syncTimeline} disabled={timelineSyncLoading}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
                        style={{background:"linear-gradient(135deg,#7c3aed,#6d28d9)",color:"#fff"}}>
                        {timelineSyncLoading?<><span className="animate-spin inline-block">◌</span> Syncing…</>:"📬 Sync Timeline"}
                      </button>
                      <button onClick={()=>setAddClientOpen(o=>!o)}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg transition-all hover:opacity-80 flex items-center gap-1.5 flex-shrink-0"
                        style={addClientOpen?{background:C.grad12,color:"#fff"}:{background:C.p1_04,color:C.p1,border:`1px solid ${C.p1_20}`}}>
                        {addClientOpen?"✕ Cancel":"+ Add Client"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add client form */}
              {addClientOpen&&(
                <div className={card}>
                  <div className="h-[3px]" style={{background:C.grad12}}/>
                  <div className="p-5 space-y-3">
                    <p className="text-sm font-black text-slate-900">Add Client from Instagram DM</p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Name *</label><input className={inp} placeholder="e.g. Karina Lopez" value={addClientForm.name} onChange={e=>setAddClientForm(f=>({...f,name:e.target.value}))}/></div>
                      <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Email *</label><input className={inp} type="email" placeholder="e.g. karina@gmail.com" value={addClientForm.email} onChange={e=>setAddClientForm(f=>({...f,email:e.target.value}))}/></div>
                      <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Phone</label><input className={inp} type="tel" placeholder="e.g. (408) 555-1234" value={addClientForm.phone} onChange={e=>setAddClientForm(f=>({...f,phone:e.target.value}))}/></div>
                      <div><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Session Type</label><input className={inp} placeholder="e.g. Grad Portraits" value={addClientForm.session_type} onChange={e=>setAddClientForm(f=>({...f,session_type:e.target.value}))}/></div>
                      <div className="sm:col-span-2"><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Session Date</label><input className={inp} type="date" value={addClientForm.session_date} onChange={e=>setAddClientForm(f=>({...f,session_date:e.target.value}))}/></div>
                      <div className="sm:col-span-2"><label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">Notes</label><textarea className={ta} rows={2} placeholder="Anything from the DM — location, time, vibe, etc." value={addClientForm.message} onChange={e=>setAddClientForm(f=>({...f,message:e.target.value}))}/></div>
                    </div>
                    <button onClick={saveManualClient} disabled={addClientSaving}
                      className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                      style={{background:C.grad,opacity:addClientSaving?0.7:1}}>
                      {addClientSaving?"Adding…":"Add Client →"}
                    </button>
                  </div>
                </div>
              )}

              {/* Sync result banner */}
              {(syncResult!==null||syncMsg)&&(
                <div className="rounded-xl px-4 py-3 text-sm"
                     style={syncResult?.length?{background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.2)"}:{background:"rgba(148,163,184,0.08)",border:"1px solid rgba(148,163,184,0.2)"}}>
                  {syncMsg&&<p className="text-slate-500 text-xs">{syncMsg}</p>}
                  {syncResult?.length?(
                    <div className="space-y-1">
                      <p className="text-xs font-black text-emerald-600 mb-2">✓ {syncResult.length} payment{syncResult.length===1?"":"s"} synced</p>
                      {syncResult.map((r,i)=>(
                        <div key={i} className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
                          <span className="font-semibold">{r.name}</span>
                          {r.email&&<span className="text-slate-400">{r.email}</span>}
                          {r.amount&&<span className="text-emerald-600 font-bold">{r.amount}</span>}
                          {r.method&&<span className="text-slate-400">via {r.method}</span>}
                          {r.paidAt&&<span className="text-slate-400">{new Date(r.paidAt).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>}
                          {r.paymentType==="deposit_2"&&r.pass===3
                            ?<span className="text-blue-500 font-semibold">balance (auto)</span>
                            :r.paymentType&&r.paymentType!=="deposit_1"
                              ?<span className="text-amber-600 font-semibold capitalize">{r.paymentType.replace("_"," ")}</span>
                              :null}
                          {r.orphan&&<span className="text-orange-500 font-bold">no inquiry</span>}
                          {r.dateBooked&&<span className="font-bold text-violet-600">📅 {new Date(r.dateBooked+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})} blocked</span>}
                          {r.alreadyPaid&&r.pass!==3&&<span className="text-slate-400">(already marked)</span>}
                        </div>
                      ))}
                    </div>
                  ):syncResult?.length===0&&!syncMsg?(
                    <p className="text-slate-500 text-xs">No new Pixieset payments found in Gmail.</p>
                  ):null}
                </div>
              )}

              {/* Client cards */}
              {inquiriesLoading?(
                <div className="text-center py-12 text-slate-400 text-sm">Loading clients…</div>
              ):filtered.length===0?(
                <div className="text-center py-12 text-slate-400 text-sm">{q?"No clients match that search.":"No clients yet."}</div>
              ):(
                <div className="space-y-3">
                  {filtered.map(client=>{
                    const paid=client.sessions.some(s=>s.payment_status==="paid");
                    return(
                      <div key={client.email} className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
                        <div className="h-[3px]" style={{background:paid?"linear-gradient(90deg,#10b981,#34d399)":C.grad12}}/>
                        <div className="p-5">
                          {/* Client header */}
                          <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button className="text-base font-black text-slate-900 cursor-pointer select-none hover:opacity-70 transition-opacity text-left" title="View client profile" onClick={()=>{const latest=client.sessions.slice().sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())[0];if(latest)router.push(`/admin/conversation/${latest.id}`)}}>{client.name}</button>
                                {paid&&(
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                                        style={{background:"rgba(16,185,129,0.12)",color:"#059669"}}>
                                    Paid ✓
                                  </span>
                                )}
                              </div>
                              <div className="flex gap-3 mt-0.5 flex-wrap">
                                <a href={`mailto:${client.email}`} className="text-xs hover:underline font-medium" style={{color:C.p1}}>{client.email}</a>
                                {client.phone&&<a href={`tel:${client.phone}`} className="text-xs text-slate-400 hover:underline">{client.phone}</a>}
                              </div>
                            </div>
                            <span className="text-xs text-slate-400 font-medium flex-shrink-0">
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
                                   style={{background:"rgba(148,163,184,0.06)",border:"1px solid rgba(148,163,184,0.12)"}}>
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
                                          className="text-xs font-semibold text-slate-700 hover:text-violet-600 transition-colors group flex items-center gap-1"
                                          title="Edit session type">
                                          {s.session_type||<span className="text-slate-300 italic">No session type</span>}
                                          <span className="opacity-0 group-hover:opacity-100 text-[9px] text-slate-400 transition-opacity">✏️</span>
                                        </button>
                                      )}
                                      {s.date_in_mind&&!s.session_date&&<span className="text-xs text-slate-400">{s.date_in_mind}</span>}
                                      {s.session_date&&<span className="text-xs font-bold text-emerald-600">{new Date(s.session_date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}{s.preferred_time?` · ${fmt12h(s.preferred_time)}`:""}</span>}
                                    </div>
                                    <p className="text-[11px] text-slate-400 mt-0.5 truncate">{s.message.slice(0,80)}{s.message.length>80?"…":""}</p>
                                    {(s.deposit_paid_at||s.invoice_sent_at||s.contract_sent_at||s.confirmation_sent_at||s.gallery_delivered_at)&&(
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {s.invoice_sent_at&&<span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{background:"rgba(99,102,241,0.1)",color:"#6366f1"}}>📄 Invoice {new Date(s.invoice_sent_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                                        {s.contract_sent_at&&<span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{background:"rgba(139,92,246,0.1)",color:"#7c3aed"}}>📝 Contract {new Date(s.contract_sent_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                                        {s.deposit_paid_at&&<span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full inline-flex items-center gap-1" style={{background:"rgba(16,185,129,0.12)",color:"#059669"}}>💳 Paid {new Date(s.deposit_paid_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}{s.confirmation_sent_at?<span style={{color:"#059669"}}>· ✉ Confirmed</span>:<span style={{color:"#d97706"}}>· ✉ Not confirmed</span>}</span>}
                                        {s.gallery_delivered_at&&<span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{background:"rgba(251,146,60,0.12)",color:"#ea580c"}}>🖼 Gallery {new Date(s.gallery_delivered_at).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {/* Payment badge */}
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg"
                                          style={s.payment_status==="paid"
                                            ?{background:"rgba(16,185,129,0.12)",color:"#059669"}
                                            :{background:"rgba(148,163,184,0.12)",color:"#94a3b8"}}>
                                      {s.payment_status==="paid"?"Paid":"Unpaid"}
                                    </span>
                                    {/* Status picker */}
                                    <div className="relative group">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                                            style={s.status==="new"
                                              ?{background:"rgba(16,185,129,0.1)",color:"#10b981"}
                                              :s.status==="responded"
                                                ?{background:"rgba(59,130,246,0.1)",color:"#3b82f6"}
                                                :s.status==="not_interested"
                                                  ?{background:"rgba(239,68,68,0.1)",color:"#ef4444"}
                                                  :{background:"rgba(148,163,184,0.1)",color:"#94a3b8"}}>
                                        {s.status==="new"?"● New":s.status==="responded"?"✓ Replied":s.status==="not_interested"?"✕ Not Int.":"○ Archive"} ▾
                                      </span>
                                      <div className="absolute right-0 top-full mt-1 z-20 hidden group-hover:flex flex-col gap-0.5 bg-white rounded-xl shadow-lg border border-slate-100 p-1.5 min-w-[120px]">
                                        {(["new","responded","archived","not_interested"] as const).map(st=>(
                                          <button key={st}
                                            onClick={e=>{e.stopPropagation();updateInquiryStatus(s.id,st);}}
                                            className="text-left text-[11px] font-bold px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                                            style={s.status===st
                                              ?{background:st==="new"?"rgba(16,185,129,0.15)":st==="responded"?"rgba(59,130,246,0.12)":st==="not_interested"?"rgba(239,68,68,0.15)":"rgba(148,163,184,0.15)",color:st==="new"?"#10b981":st==="responded"?"#3b82f6":st==="not_interested"?"#ef4444":"#94a3b8"}
                                              :{background:"transparent",color:"#64748b"}}>
                                            {st==="new"?"● New":st==="responded"?"✓ Replied":st==="not_interested"?"✕ Not Interested":"○ Archive"}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                    <a href={`/admin/conversation/${s.id}`}
                                       className="text-[11px] font-black px-2.5 py-1 rounded-lg transition-all hover:opacity-80"
                                       style={{background:C.grad12,color:"#fff"}}>
                                      Open →
                                    </a>
                                    {/* Delete duplicate */}
                                    {inquiryDeleteConfirm===s.id?(
                                      <span className="flex items-center gap-1">
                                        <span className="text-[10px] text-slate-500">Delete?</span>
                                        <button onClick={()=>deleteInquiry(s.id)} className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-red-500 text-white">Yes</button>
                                        <button onClick={()=>setInquiryDeleteConfirm(null)} className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-slate-200 text-slate-600">No</button>
                                      </span>
                                    ):(
                                      <button onClick={()=>setInquiryDeleteConfirm(s.id)}
                                        className="text-[11px] px-2 py-0.5 rounded-lg transition-all hover:opacity-80"
                                        style={{background:"rgba(239,68,68,0.08)",color:"#ef4444"}}
                                        title="Delete duplicate inquiry">
                                        🗑
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-3 rounded-xl border p-3" style={{background:"rgba(255,255,255,0.8)",borderColor:"rgba(139,92,246,0.14)"}}>
                                  <div className="flex items-center justify-between gap-3 flex-wrap">
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-widest" style={{color:C.p1}}>Client Portal Progress</p>
                                      <p className="mt-1 text-[11px] text-slate-400">
                                        {portalSessionsLoading
                                          ?"Loading portal state..."
                                          :portalSession
                                            ?`Currently ${portalStatusLabel}`
                                            :"No portal session yet. Your first click will create one."}
                                      </p>
                                    </div>
                                    {portalAmbiguous&&(
                                      <a href="/admin/sessions" className="text-[11px] font-black px-2.5 py-1 rounded-lg"
                                         style={{background:C.p1_04,color:C.p1,border:`1px solid ${C.p1_20}`}}>
                                        Open Client Sessions →
                                      </a>
                                    )}
                                  </div>
                                  {!portalAmbiguous&&(
                                    <div className="mt-3">
                                      <AdminSessionStatusStrip
                                        compact
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
                <span className="text-slate-400 text-xs">Select a category, then click "Add to Portfolio" on any image below.</span>
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
