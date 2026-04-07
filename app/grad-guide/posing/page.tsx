"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";
import { GUIDE_STYLES } from "@/lib/guidestyles";
import { C } from "@/lib/colors";
import GuideNav from "@/app/components/GuideNav";

export const dynamic = 'force-dynamic'

type Pose = { id:number; title:string; image_url:string; instructions:string; order:number; };

const DRAFT_POSES: Pose[] = [
  {id:1,title:"Hand on Hip, Hand on Stool",image_url:"",instructions:"Place one hand on your hip and rest the other on a stool, ledge, or wall. This breaks up stiff posture and gives you something natural to do with your hands. Shift your weight to one leg slightly — it creates a relaxed S-curve that photographs beautifully.",order:1},
  {id:2,title:"Cap in the Air",image_url:"",instructions:"Hold your graduation cap above your head with both hands, arms extended, and look up at it with a genuine smile. The key is to actually laugh or think of something funny — forced smiles read flat on camera. Toss it slightly and catch it mid-air for a more dynamic version.",order:2},
  {id:3,title:"Walking Toward Camera",image_url:"",instructions:"Walk naturally toward the camera with your cap and gown flowing. Look just slightly past the lens and let your expression be relaxed. This shot works best in an open walkway or path with leading lines.",order:3},
  {id:4,title:"Leaning Against a Wall",image_url:"",instructions:"Stand with your back or shoulder against a wall, one foot flat against it. Cross your arms loosely or hold your diploma in one hand. Tilt your chin down slightly and look into the camera.",order:4},
  {id:5,title:"Sitting on Steps",image_url:"",instructions:"Find a set of stairs and sit naturally — slightly leaning forward with elbows on your knees. Spread your gown out around you for visual impact. Great for outdoor campus steps or urban staircases.",order:5},
  {id:6,title:"Looking Away, Candid Profile",image_url:"",instructions:"Look off into the distance at a 45-degree angle from the camera. Think about something that makes you genuinely happy. This works best in golden hour light where the sun hits the side of your face.",order:6},
];

const MARQUEE = ["Pose Guide","Study Before Shoot","Natural Light","Real Moments","No Stiff Poses","Bay Area Grads","Pose Guide","Study Before Shoot","Natural Light","Real Moments","No Stiff Poses","Bay Area Grads"];

export default function PosingPage() {
  const [poses, setPoses] = useState<Pose[]>(DRAFT_POSES);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    async function fetchPoses(){
      try{
        const{data,error}=await supabase.from('grad_poses').select('*').order('order',{ascending:true})
        if(error)console.error(error)
        if(data&&data.length>0)setPoses(data)
      }catch(err){console.error(err)}
    }
    fetchPoses()
  },[])

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{GUIDE_STYLES}</style>

      <nav className="af sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]" style={{background:"rgba(255,255,255,0.9)"}}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight" style={C.text}>Chris.</Link>
          <Link href="/grad-guide" className="text-sm font-bold text-slate-700 hover:text-slate-400 transition-colors">← Grad Guide</Link>
        </div>
      </nav>

      <section className="relative overflow-hidden px-6 pt-14 pb-12 border-b border-black/[0.06]">
        <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.04)}/>
        <div className="absolute inset-0 pointer-events-none" style={{background:`radial-gradient(ellipse at 40% 50%,transparent 28%,white 74%)`}}/>
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p1_30}`,borderLeft:`2px solid ${C.p1_30}`}}/>
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p2_18}`,borderRight:`2px solid ${C.p2_18}`}}/>
        <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p2_18}`,borderLeft:`2px solid ${C.p2_18}`}}/>
        <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p1_30}`,borderRight:`2px solid ${C.p1_30}`}}/>
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{background:C.grad12}}/>
        <div className="pdot absolute bottom-7 left-7 w-1.5 h-1.5 rounded-full pointer-events-none" style={{background:C.p2,animationDelay:"1s"}}/>
        <div className="blob1 absolute rounded-full pointer-events-none" style={{width:460,height:460,top:-120,left:-100,background:C.blob1}}/>
        <div className="blob2 absolute rounded-full pointer-events-none" style={{width:340,height:340,top:-60,right:-70,background:C.blob2}}/>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{opacity:0.45,animation:"fadeIn 1s 0.6s ease both"}}>
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <defs><linearGradient id="psg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.p1}/><stop offset="100%" stopColor={C.p2}/></linearGradient></defs>
            <path className="sqp1" d="M50 6 C74 20,26 42,50 66 C74 90,26 112,50 136 C74 160,26 178,50 196" stroke="url(#psg)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path className="sqp2" d="M30 18 C54 32,6 54,30 78 C54 102,6 124,30 148 C54 172,6 188,30 198" stroke={C.p2} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3"/>
            <circle cx="50" cy="6"   r="2.5" fill={C.p1} opacity="0.8"/>
            <circle cx="50" cy="66"  r="2.5" fill={C.p2} opacity="0.8"/>
            <circle cx="50" cy="136" r="2.5" fill={C.p1} opacity="0.8"/>
            <circle cx="50" cy="196" r="2.5" fill={C.p2} opacity="0.8"/>
          </svg>
        </div>
        <div className="spin absolute -bottom-8 -left-8 pointer-events-none hidden sm:block" style={{opacity:0.08}}>
          <svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" stroke={C.p1} strokeWidth="1" fill="none" strokeDasharray="8 5"/></svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{background:C.p1_08,border:`1px solid ${C.p1_20}`}}>
            <div className="w-1.5 h-1.5 rounded-full" style={{background:C.p1}}/>
            <p className="text-xs font-bold tracking-[0.12em] uppercase" style={{color:C.p1}}>01 — Posing Guide</p>
          </div>
          <h1 className="afu2 text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-2 leading-tight">Poses that actually</h1>
          <p className="afu3 text-4xl sm:text-5xl font-light italic tracking-tight text-slate-900 mb-5">
            <span style={C.text12}>look good.</span>
            <span className="cblink inline-block w-[3px] h-[36px] sm:h-[44px] ml-1.5 rounded-sm align-middle" style={{background:C.grad12}}/>
          </p>
          <p className="afu4 text-base text-slate-600 font-light leading-relaxed max-w-xl">No stiff yearbook poses here. These are natural, flattering positions that work for real people — not just models. Study them before your shoot and we'll nail every single one.</p>
        </div>
      </section>

      <div className="overflow-hidden border-b border-black/[0.06] py-3">
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {MARQUEE.map((item,i)=>(
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-300">
              {item}<span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{background:C.grad12}}/>
            </span>
          ))}
        </div>
      </div>

      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto space-y-5">
          {loading ? (
            [...Array(4)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-56" style={{background:`linear-gradient(135deg,${C.p1_08},${C.p2_06})`}}/>)
          ) : (
            poses.map((pose,index)=>(
              <div key={pose.id} className="card-lift rounded-2xl overflow-hidden" style={{border:`1px solid ${C.p1_20}`,background:"#fff"}}>
                <div className="h-[3px]" style={{background:C.grad90}}/>
                {pose.image_url ? (
                  <div className="flex flex-col sm:grid sm:grid-cols-2">
                    <div className="w-full h-72 sm:h-auto overflow-hidden bg-slate-100 relative">
                      <img src={pose.image_url} alt={pose.title} className="w-full h-full object-cover"/>
                      <div className="absolute bottom-3 left-3 opacity-40 pointer-events-none"><svg width="30" height="44" viewBox="0 0 30 44" fill="none"><path d="M15 3 C22 10,8 18,15 26 C22 34,8 38,15 42" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
                    </div>
                    <div className="p-7 flex flex-col justify-center">
                      <div className="mb-3"><span className="text-xs font-bold tracking-widest px-2.5 py-1 rounded-full" style={{color:C.p1,background:C.p1_08}}>POSE {String(index+1).padStart(2,"0")}</span></div>
                      <h2 className="text-xl font-black text-slate-900 mb-3 leading-tight">{pose.title}</h2>
                      <p className="text-slate-600 text-sm leading-relaxed">{pose.instructions}</p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2">
                    <div className="hidden sm:flex items-center justify-center relative overflow-hidden" style={{minHeight:240,background:`linear-gradient(135deg,${C.p1_08},${C.p2_06})`}}>
                      <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.06)}/>
                      <div className="text-center relative z-10"><p className="text-4xl mb-2">📷</p><p className="text-xs font-semibold" style={{color:C.p1}}>Photo via Supabase</p></div>
                    </div>
                    <div className="p-7 flex flex-col justify-center">
                      <div className="mb-3"><span className="text-xs font-bold tracking-widest px-2.5 py-1 rounded-full" style={{color:C.p1,background:C.p1_08}}>POSE {String(index+1).padStart(2,"0")}</span></div>
                      <h2 className="text-xl font-black text-slate-900 mb-3 leading-tight">{pose.title}</h2>
                      <p className="text-slate-600 text-sm leading-relaxed">{pose.instructions}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-8 text-white text-center relative overflow-hidden" style={{background:C.grad12}}>
          <div className="absolute inset-0 pointer-events-none" style={C.ctaGrid}/>
          <div className="absolute top-4 right-5 opacity-15 pointer-events-none"><svg width="40" height="64" viewBox="0 0 40 64" fill="none"><path d="M20 4 C30 14,10 24,20 36 C30 48,10 56,20 62" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
          <h3 className="relative text-2xl font-black mb-2">Ready to shoot?</h3>
          <p className="relative text-white/75 mb-6 text-sm">Save these poses on your phone so you can reference them day-of.</p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <Link href="/grad-guide/what-to-wear" className="btn-lift px-5 py-2.5 rounded-full bg-white font-bold text-sm" style={{color:C.p1}}>Next: What to Wear →</Link>
            <a href="https://www.soloxsnaps.com/contact/" className="btn-lift px-5 py-2.5 rounded-full font-bold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors">Book a shoot</a>
          </div>
        </div>
      </section>

      <GuideNav />
      <footer className="border-t border-black/[0.06] bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={C.text}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}