"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from "react";
import { C } from "@/lib/colors";
import { checkAuth, logout } from "@/lib/adminAuth";
import { useRouter } from "next/navigation";
import Nav from "@/app/components/Nav";

export const dynamic = 'force-dynamic'

type AvailDate = { id?:number; date:string; status:"available"|"booked"|"hold"; note:string|null; };

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getDaysInMonth(y:number,m:number){return new Date(y,m+1,0).getDate();}
function getFirstDay(y:number,m:number){return new Date(y,m,1).getDay();}
function toStr(y:number,m:number,d:number){return`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;}

const STATUS_CYCLE:Record<string,"available"|"booked"|"hold"|"none"> = {
  "none":"available","available":"booked","booked":"hold","hold":"none",
};

export default function AdminAvailabilityPage() {
  const router = useRouter();
  const today = new Date();
  const [authed,setAuthed]=useState(false);
  const [month,setMonth]=useState(today.getMonth());
  const [year,setYear]=useState(today.getFullYear());
  const [dates,setDates]=useState<AvailDate[]>([]);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState<string|null>(null);
  const [toast,setToast]=useState<string|null>(null);

  // Check auth on mount, redirect if not authed
  useEffect(() => {
    if (!checkAuth()) {
      router.push('/admin');
    } else {
      setAuthed(true);
    }
  }, [router]);

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(null),2500);}

  async function fetchDates(){
    setLoading(true);
    try{const{data}=await supabase.from('availability').select('*');if(data)setDates(data);}
    catch(err){console.error(err);}
    finally{setLoading(false);}
  }
  useEffect(()=>{if(authed)fetchDates();},[authed])

  const dateMap=dates.reduce((acc,d)=>{acc[d.date]=d;return acc;},{} as Record<string,AvailDate>)
  const daysInMonth=getDaysInMonth(year,month);
  const firstDay=getFirstDay(year,month);
  const todayStr=toStr(today.getFullYear(),today.getMonth(),today.getDate());

  async function toggleDate(dateStr:string){
    const existing=dateMap[dateStr];
    const cur=existing?.status??"none";
    const next=STATUS_CYCLE[cur];
    setSaving(dateStr);
    if(next==="none"){
      if(existing?.id){await supabase.from('availability').delete().eq('id',existing.id);setDates(p=>p.filter(d=>d.date!==dateStr));showToast("Date cleared");}
    }else if(existing?.id){
      await supabase.from('availability').update({status:next}).eq('id',existing.id);
      setDates(p=>p.map(d=>d.date===dateStr?{...d,status:next}:d));showToast(`Marked as ${next}`);
    }else{
      const{data}=await supabase.from('availability').insert({date:dateStr,status:next,note:null}).select().single();
      if(data)setDates(p=>[...p,data]);showToast(`Marked as ${next}`);
    }
    setSaving(null);
  }

  async function updateNote(dateStr:string,note:string){
    const existing=dateMap[dateStr];
    if(!existing?.id)return;
    await supabase.from('availability').update({note}).eq('id',existing.id);
    setDates(p=>p.map(d=>d.date===dateStr?{...d,note}:d));showToast("Note saved");
  }

  const inp="w-full px-3 py-2.5 rounded-xl text-sm font-medium text-slate-800 outline-none border border-slate-200 bg-white transition-colors";

  // Show loading while checking auth
  if(!authed){
    return(
      <>
        <Nav />
        <div className="min-h-[calc(100vh-72px)] bg-white flex items-center justify-center px-6 font-sans">
          <div className="text-slate-400">Loading...</div>
        </div>
      </>
    );
  }

  return(
    <div className="min-h-screen font-sans" style={{background:"#f8f7ff"}}>
      <Nav />
      <style>{`
        .day-admin{transition:transform 0.12s ease,box-shadow 0.12s ease;cursor:pointer;}
        .day-admin:hover{transform:scale(1.06);}
        .d-avail{background:${C.p1_15};border:1.5px solid ${C.p1_35};}
        .d-booked{background:rgba(0,0,0,0.06);border:1.5px solid rgba(0,0,0,0.12);}
        .d-hold{background:${C.p3_15};border:1.5px solid ${C.p3_30};}
        .d-none{background:white;border:1px solid rgba(0,0,0,0.08);}
        .d-past{opacity:0.3;cursor:not-allowed!important;}
      `}</style>

      {toast&&<div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-full text-white text-sm font-bold shadow-xl" style={{background:C.grad12}}>{toast}</div>}

      <div className="sticky top-[72px] z-40 border-b border-black/[0.06] px-6 h-14 flex items-center justify-between" style={{background:"rgba(255,255,255,0.95)",backdropFilter:"blur(20px)"}}>
        <span className="font-black text-lg" style={C.text}>Chris. Admin</span>
        <div className="flex items-center gap-4">
          <a href="/admin" className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">← Dashboard</a>
          <a href="/availability" className="text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors">Public page</a>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Instructions */}
        <div className="rounded-2xl p-4 mb-6 flex flex-wrap gap-3" style={{background:"white",border:`1px solid ${C.p1_12}`}}>
          <p className="text-xs font-bold text-slate-500 w-full mb-1">Click any date to cycle through:</p>
          {[
            {label:"Available",bg:C.p1_15,border:C.p1_35,color:C.p1},
            {label:"Booked",bg:"rgba(0,0,0,0.06)",border:"rgba(0,0,0,0.12)",color:"#94a3b8"},
            {label:"On Hold",bg:C.p3_15,border:C.p3_30,color:C.p3},
            {label:"Clear",bg:"white",border:"rgba(0,0,0,0.08)",color:"#94a3b8"},
          ].map(s=>(
            <div key={s.label} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{background:s.bg,border:`1px solid ${s.border}`,color:s.color}}>{s.label}</div>
          ))}
        </div>

        {/* Calendar */}
        <div className="rounded-2xl overflow-hidden" style={{border:`1px solid ${C.p1_15}`,boxShadow:`0 12px 40px ${C.p1_08}`}}>
          <div className="relative p-5 text-white" style={{background:C.grad12}}>
            <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:"20px 20px"}}/>
            <div className="relative flex items-center justify-between">
              <button onClick={()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);}} className="w-9 h-9 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center font-bold text-xl">‹</button>
              <p className="font-black text-lg">{MONTHS[month]} {year}</p>
              <button onClick={()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);}} className="w-9 h-9 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center font-bold text-xl">›</button>
            </div>
          </div>
          <div className="grid grid-cols-7" style={{background:C.p1_04,borderBottom:`1px solid ${C.p1_08}`}}>
            {DAYS.map(d=><div key={d} className="py-2 text-center text-[10px] font-black tracking-widest uppercase text-slate-400">{d}</div>)}
          </div>
          <div className="p-3 bg-white">
            {loading ? (
              <div className="grid grid-cols-7 gap-1.5">{[...Array(35)].map((_,i)=><div key={i} className="aspect-square rounded-xl animate-pulse" style={{background:C.p1_08}}/>)}</div>
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {[...Array(firstDay)].map((_,i)=><div key={`e${i}`} className="aspect-square"/>)}
                {[...Array(daysInMonth)].map((_,i)=>{
                  const day=i+1;
                  const dateStr=toStr(year,month,day);
                  const entry=dateMap[dateStr];
                  const isPast=dateStr<todayStr;
                  const isSaving=saving===dateStr;
                  const isToday=dateStr===todayStr;
                  let cls="day-admin aspect-square rounded-xl flex flex-col items-center justify-center relative ";
                  if(isPast)cls+="d-none d-past ";
                  else if(entry?.status==="available")cls+="d-avail ";
                  else if(entry?.status==="booked")cls+="d-booked ";
                  else if(entry?.status==="hold")cls+="d-hold ";
                  else cls+="d-none ";
                  const textColor=isPast?"#cbd5e1":entry?.status==="available"?C.p1:entry?.status==="booked"?"#94a3b8":entry?.status==="hold"?C.p3:"#64748b";
                  return(
                    <button key={day} className={cls} disabled={isPast||isSaving} onClick={()=>!isPast&&toggleDate(dateStr)}
                      style={isToday?{outline:`2px solid ${C.p1}`,outlineOffset:"1px"}:{}}>
                      {isSaving?<span className="text-[10px] animate-spin">◌</span>:(
                        <>
                          <span className="text-xs font-black" style={{color:textColor}}>{day}</span>
                          {entry?.status==="available"&&<span className="w-1 h-1 rounded-full mt-0.5" style={{background:C.p1}}/>}
                          {entry?.status==="hold"&&<span className="w-1 h-1 rounded-full mt-0.5" style={{background:C.p3}}/>}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Note editor */}
        {dates.filter(d=>{const[y,m]=d.date.split("-").map(Number);return y===year&&m===month+1&&d.status==="available";}).length>0&&(
          <div className="mt-6 rounded-2xl p-5" style={{background:"white",border:`1px solid ${C.p1_12}`}}>
            <p className="text-xs font-black uppercase tracking-widest mb-3" style={{color:C.p1}}>Add notes to available dates</p>
            <div className="space-y-2">
              {dates.filter(d=>{const[y,m]=d.date.split("-").map(Number);return y===year&&m===month+1&&d.status==="available";})
                .sort((a,b)=>a.date.localeCompare(b.date))
                .map(d=>(
                  <div key={d.date} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-500 w-20 flex-shrink-0">{new Date(d.date+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                    <input type="text" defaultValue={d.note??""} placeholder="Optional note (e.g. 'Morning only')"
                      onBlur={e=>updateNote(d.date,e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 outline-none"
                      style={{border:`1px solid ${C.p1_20}`,background:C.p1_04}}/>
                  </div>
                ))}
            </div>
          </div>
        )}
        <p className="text-center text-xs text-slate-400 mt-6 font-medium">Changes save instantly to Supabase.</p>
      </div>
    </div>
  );
}
