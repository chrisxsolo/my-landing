"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";
import { GUIDE_STYLES } from "@/lib/guidestyles";
import { C } from "@/lib/colors";
import GuideNav from "@/app/components/GuideNav";

export const dynamic = 'force-dynamic'

type GradPhoto = { id:number; image_url:string; caption:string|null; };

const sections = [
  { href:"/grad-guide/posing",         number:"01", title:"Posing Guide",    desc:"Natural, flattering poses that actually look good on camera.", emoji:"📸", bg:C.grad12 },
  { href:"/grad-guide/what-to-wear",   number:"02", title:"What to Wear",    desc:"Colors and fits that photograph beautifully in any Bay Area location.", emoji:"👗", bg:C.grad23 },
  { href:"/grad-guide/how-to-prepare", number:"03", title:"How to Prepare",  desc:"Everything to do before your shoot so you show up confident and ready.", emoji:"✅", bg:C.grad321 },
  { href:"/location-guide",            number:"04", title:"Location Guide",   desc:"Best spots at SJSU, Berkeley, SF State, CSUEB, and USF.", emoji:"📍", bg:`linear-gradient(135deg,#4f9e8a,${C.p1})` },
  { href:"/availability",              number:"05", title:"My Availability",  desc:"Check what dates I have open and reach out to lock one in.", emoji:"📅", bg:C.grad },
];

const MARQUEE = ["Graduation Photos","Bay Area","Golden Hour","SJSU · Berkeley · Stanford","Natural Light","Real Moments","Graduation Photos","Bay Area","Golden Hour","SJSU · Berkeley · Stanford","Natural Light","Real Moments"];

export default function GradGuidePage() {
  const [photos, setPhotos] = useState<GradPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    async function fetchPhotos(){
      try{
        const{data,error}=await supabase.from('grad_photos').select('*').order('created_at',{ascending:false})
        if(error)console.error(error)
        if(data)setPhotos(data)
      }catch(err){console.error(err)}
      finally{setLoading(false)}
    }
    fetchPhotos()
  },[])

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{GUIDE_STYLES}</style>

      <nav className="af sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]" style={{background:"rgba(255,255,255,0.9)"}}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight" style={C.text}>Chris.</Link>
          <Link href="/" className="text-sm font-bold text-slate-700 hover:text-slate-400 transition-colors">← Back to hub</Link>
        </div>
      </nav>

      <section className="relative overflow-hidden px-6 pt-16 pb-14 border-b border-black/[0.06]">
        <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.045)}/>
        <div className="absolute inset-0 pointer-events-none" style={C.vignette}/>
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p1_30}`,borderLeft:`2px solid ${C.p1_30}`}}/>
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p2_18}`,borderRight:`2px solid ${C.p2_18}`}}/>
        <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p2_18}`,borderLeft:`2px solid ${C.p2_18}`}}/>
        <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p3_15}`,borderRight:`2px solid ${C.p3_15}`}}/>
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{background:C.grad12}}/>
        <div className="pdot absolute bottom-8 left-8 w-1.5 h-1.5 rounded-full pointer-events-none" style={{background:C.grad23,animationDelay:"1s"}}/>
        <div className="blob1 absolute rounded-full pointer-events-none" style={{width:520,height:520,top:-130,left:-110,background:C.blob1}}/>
        <div className="blob2 absolute rounded-full pointer-events-none" style={{width:400,height:400,top:-70,right:-90,background:C.blob2}}/>
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{opacity:0.4,animation:"fadeIn 1s 0.6s ease both"}}>
          <svg width="110" height="220" viewBox="0 0 110 220" fill="none">
            <defs><linearGradient id="gsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.p1}/><stop offset="50%" stopColor={C.p2}/><stop offset="100%" stopColor={C.p3}/></linearGradient></defs>
            <path className="sqp1" d="M55 6 C80 22,30 46,55 72 C80 98,30 120,55 148 C80 176,30 196,55 216" stroke="url(#gsg)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path className="sqp2" d="M35 20 C60 36,10 60,35 86 C60 112,10 136,35 162 C60 188,10 206,35 218" stroke={C.p2} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3"/>
            <circle cx="55" cy="6"   r="2.5" fill={C.p1} opacity="0.8"/>
            <circle cx="55" cy="72"  r="2.5" fill={C.p2} opacity="0.8"/>
            <circle cx="55" cy="148" r="2.5" fill={C.p3} opacity="0.8"/>
            <circle cx="55" cy="216" r="2.5" fill={C.p1} opacity="0.8"/>
          </svg>
        </div>
        <div className="spin absolute -bottom-10 -left-10 pointer-events-none hidden sm:block" style={{opacity:0.08}}>
          <svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="60" stroke={C.p1} strokeWidth="1" fill="none" strokeDasharray="8 6"/></svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{background:C.p1_08,border:`1px solid ${C.p1_20}`}}>
            <div className="pdot w-1.5 h-1.5 rounded-full" style={{background:C.grad12}}/>
            <p className="text-xs font-bold tracking-[0.12em] uppercase" style={{color:C.p1}}>Bay Area Grad Photography</p>
          </div>
          <h1 className="afu2 text-5xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 mb-2">Your Complete <span style={C.text}>Graduation</span></h1>
          <p className="afu3 text-5xl sm:text-6xl font-light italic tracking-tight text-slate-900 mb-6">
            Photo Guide<span className="cblink inline-block w-[3px] h-[44px] sm:h-[52px] ml-1.5 rounded-sm align-middle" style={{background:C.grad12}}/>
          </p>
          <p className="afu4 text-lg text-slate-600 font-light leading-relaxed max-w-lg mx-auto mb-8">Everything you need before, during, and after your graduation shoot.</p>
          <div className="afu4 flex items-center justify-center gap-3 flex-wrap">
            <Link href="/grad-guide/posing" className="btn-lift px-6 py-3 rounded-full font-bold text-sm text-white shadow-md" style={{background:C.grad12}}>Start with posing →</Link>
            <a href="https://www.soloxsnaps.com/contact/" className="btn-lift px-6 py-3 rounded-full font-bold text-sm" style={{background:"#fff",color:"#111827",border:"2px solid #111827"}}>Book a shoot</a>
          </div>
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
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.15em] uppercase mb-2" style={{color:C.p1}}>The Guide</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Everything you need</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {sections.map(s=>(
              <Link key={s.href} href={s.href} className="card-lift group relative rounded-2xl p-6 cursor-pointer block overflow-hidden text-white" style={{background:s.bg}}>
                <div className="absolute inset-0 pointer-events-none" style={C.ctaGrid}/>
                <div className="absolute bottom-3 right-3 opacity-20 pointer-events-none"><svg width="36" height="56" viewBox="0 0 36 56" fill="none"><path d="M18 4 C28 14,8 22,18 34 C28 46,8 50,18 54" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
                <div className="relative z-10">
                  <span className="text-3xl mb-3 block">{s.emoji}</span>
                  <p className="text-xs font-bold tracking-widest opacity-60 mb-1 uppercase">{s.number}</p>
                  <h3 className="text-lg font-black mb-2 leading-tight">{s.title}</h3>
                  <p className="text-sm opacity-75 leading-relaxed">{s.desc}</p>
                </div>
                <span className="arr absolute top-5 right-5 text-white/30 text-lg group-hover:text-white">↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 pb-20 border-t border-black/[0.06]">
        <div className="max-w-3xl mx-auto pt-14">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3" style={{background:C.p1_08,border:`1px solid ${C.p1_18}`}}>
              <div className="pdot w-1.5 h-1.5 rounded-full" style={{background:C.grad12}}/>
              <p className="text-xs font-bold tracking-[0.12em] uppercase" style={{color:C.p1}}>Portfolio</p>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recent grad shoots</h2>
            <p className="text-slate-500 mt-2 text-sm font-medium">Real sessions, real results.</p>
          </div>
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{[...Array(6)].map((_,i)=><div key={i} className="aspect-square rounded-2xl animate-pulse" style={{background:`linear-gradient(135deg,${C.p1_08},${C.p2_06})`}}/>)}</div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map(photo=>(
                <div key={photo.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100">
                  <img src={photo.image_url} alt={photo.caption||"Graduation photo"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
                  {photo.caption&&<div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end"><p className="text-white text-sm font-medium p-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">{photo.caption}</p></div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-2xl p-16 text-center" style={{borderColor:C.p1_20}}>
              <p className="text-4xl mb-4">📷</p>
              <p className="text-slate-700 font-bold">Photos load here from Supabase</p>
              <p className="text-slate-400 text-sm mt-1">Add rows to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">grad_photos</code></p>
            </div>
          )}
        </div>
      </section>

      <div className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-10 text-center relative overflow-hidden" style={{background:C.grad}}>
          <div className="absolute inset-0 pointer-events-none" style={C.ctaGridLg}/>
          <div className="absolute top-4 right-6 opacity-15 pointer-events-none"><svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
          <h3 className="relative text-3xl font-black text-white mb-2 tracking-tight">Lock in your date.</h3>
          <p className="relative text-white/75 mb-7 text-sm font-light">Grad season books up fast. Reach out early and we'll make it happen.</p>
          <a href="https://www.soloxsnaps.com/contact/" className="btn-lift relative inline-block px-8 py-3 rounded-full bg-white font-bold text-sm" style={{color:C.p1}}>Book your shoot →</a>
        </div>
      </div>

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