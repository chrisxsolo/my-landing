"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";
import { GUIDE_STYLES } from "@/lib/guidestyles";
import { C } from "@/lib/colors";

export const dynamic = 'force-dynamic'

type OutfitTip = { id:number; title:string; tip:string; icon:string; order:number; };

const DRAFT_OUTFITS: OutfitTip[] = [
  {id:1,title:"Keep it simple — you're the focus",tip:"Your outfit should complement you, not compete with you. Solid colors, clean lines, and minimal patterns are always the right call. The more simple your outfit, the more timeless your photos will look.",icon:"✨",order:1},
  {id:2,title:"Go lighter to contrast your stole and gown",tip:"Graduation gowns and stoles tend to be dark and color-heavy. Wearing something lighter underneath — ivory, cream, soft white, blush, or light neutrals — creates a natural contrast that makes the whole look more balanced in photos.",icon:"🎨",order:2},
  {id:3,title:"Avoid busy prints entirely",tip:"Stripes, plaid, polka dots, florals, and anything with text or logos will fight for attention in your photos. The camera always finds the busiest thing in the frame — make sure that's you.",icon:"🚫",order:3},
  {id:4,title:"Steam and hang everything the night before",tip:"Your gown will have fold lines from the package — take it out at least the night before. Hang it in the bathroom while you shower to let the steam work out the creases.",icon:"👔",order:4},
  {id:5,title:"Try your full look together before the day",tip:"Put on your outfit, stole, gown, and shoes together at least once before your session. Make sure everything works as a complete look and nothing clashes.",icon:"🪞",order:5},
  {id:6,title:"Bring comfortable shoes for walking",tip:"We'll cover a lot of ground during the session. If you're wearing heels, bring a pair of flip-flops or flats as backup. Heels that sink into grass affect your posture and energy.",icon:"👠",order:6},
  {id:7,title:"Exaggerate your makeup slightly for camera",tip:"Outdoor light and camera sensors flatten features more than you'd expect. Add more definition to your brows, a bit more contour, and go with matte over glossy finishes.",icon:"💄",order:7},
  {id:8,title:"Go with a hairstyle you already know",tip:"This isn't the day to experiment with something new. Pick a style you've worn before and feel confident in. If you're booking a blowout, schedule it for the morning of your session.",icon:"💇",order:8},
  {id:10,title:"Get your haircut a few days before — not day of",tip:"A lot of guys don't love how they look immediately after a fresh cut. Get it done 2-3 days before your session so it has time to settle into its natural shape.",icon:"✂️",order:10},
  {id:11,title:"Groom your facial hair before the shoot",tip:"If your beard or mustache is part of your look, keep it — just make sure it's clean and shaped. Trim it up a few days before.",icon:"🪒",order:11},
  {id:12,title:"Jewelry works — smartwatches don't",tip:"Earrings, necklaces, rings, and bracelets all add to your look and photograph well. Leave the Apple Watch or Fitbit at home.",icon:"💍",order:12},
  {id:13,title:"Plan ahead if you wear glasses",tip:"Lenses catch outdoor light and create glare in photos. If possible, remove the lenses from the frames before your session — that's the cleanest fix.",icon:"👓",order:13},
];

const categories = [
  {label:"General",     ids:[1,2,3,4,5], bar:C.vert12},
  {label:"For Her",     ids:[6,7,8,9],   bar:C.vert23},
  {label:"For Him",     ids:[10,11],     bar:`linear-gradient(180deg,${C.p3},${C.p1})`},
  {label:"Accessories", ids:[12,13],     bar:C.vert12},
];

const MARQUEE = ["What to Wear","Outfit Tips","Colors That Pop","Fit Matters","Look Your Best","Bay Area Shoots","What to Wear","Outfit Tips","Colors That Pop","Fit Matters","Look Your Best","Bay Area Shoots"];

export default function WhatToWearPage() {
  const [outfits, setOutfits] = useState<OutfitTip[]>(DRAFT_OUTFITS);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{
    async function fetchOutfits(){
      try{
        const{data,error}=await supabase.from('grad_outfits').select('*').order('order',{ascending:true})
        if(error)console.error(error)
        if(data&&data.length>0)setOutfits(data)
      }catch(err){console.error(err)}
    }
    fetchOutfits()
  },[]);

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
        <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.035)}/>
        <div className="absolute inset-0 pointer-events-none" style={{background:`radial-gradient(ellipse at 60% 50%,transparent 28%,white 74%)`}}/>
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p2_30}`,borderLeft:`2px solid ${C.p2_30}`}}/>
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p3_18}`,borderRight:`2px solid ${C.p3_18}`}}/>
        <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p3_18}`,borderLeft:`2px solid ${C.p3_18}`}}/>
        <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p2_30}`,borderRight:`2px solid ${C.p2_30}`}}/>
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{background:C.grad23}}/>
        <div className="pdot absolute bottom-7 left-7 w-1.5 h-1.5 rounded-full pointer-events-none" style={{background:C.p3,animationDelay:"0.8s"}}/>
        <div className="blob1 absolute rounded-full pointer-events-none" style={{width:440,height:440,top:-100,right:-100,background:C.blob2}}/>
        <div className="blob2 absolute rounded-full pointer-events-none" style={{width:320,height:320,bottom:-80,left:-60,background:C.blob3}}/>
        <div className="absolute left-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{opacity:0.4,animation:"fadeIn 1s 0.6s ease both"}}>
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <defs><linearGradient id="wsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.p2}/><stop offset="100%" stopColor={C.p3}/></linearGradient></defs>
            <path className="sqp1" d="M50 6 C74 20,26 42,50 66 C74 90,26 112,50 136 C74 160,26 178,50 196" stroke="url(#wsg)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path className="sqp2" d="M70 18 C46 32,94 54,70 78 C46 102,94 124,70 148 C46 172,94 188,70 198" stroke={C.p3} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3"/>
            <circle cx="50" cy="6"   r="2.5" fill={C.p2} opacity="0.8"/>
            <circle cx="50" cy="66"  r="2.5" fill={C.p3} opacity="0.8"/>
            <circle cx="50" cy="136" r="2.5" fill={C.p2} opacity="0.8"/>
            <circle cx="50" cy="196" r="2.5" fill={C.p3} opacity="0.8"/>
          </svg>
        </div>
        <div className="spin absolute -bottom-8 -right-8 pointer-events-none hidden sm:block" style={{opacity:0.08}}>
          <svg width="120" height="120" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" stroke={C.p2} strokeWidth="1" fill="none" strokeDasharray="6 5"/></svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{background:C.p2_08,border:`1px solid ${C.p2_20}`}}>
            <div className="w-1.5 h-1.5 rounded-full" style={{background:C.p2}}/>
            <p className="text-xs font-bold tracking-[0.12em] uppercase" style={{color:C.p2}}>02 — What to Wear</p>
          </div>
          <h1 className="afu2 text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-2 leading-tight">Outfits that</h1>
          <p className="afu3 text-4xl sm:text-5xl font-light italic tracking-tight text-slate-900 mb-5">
            <span style={C.text23}>photograph.</span>
            <span className="cblink inline-block w-[3px] h-[36px] sm:h-[44px] ml-1.5 rounded-sm align-middle" style={{background:C.grad23}}/>
          </p>
          <p className="afu4 text-base text-slate-600 font-light leading-relaxed max-w-xl">What looks great in a mirror and what looks great on camera are often different things. Here's exactly what works — broken down by category.</p>
        </div>
      </section>

      <div className="overflow-hidden border-b border-black/[0.06] py-3">
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {MARQUEE.map((item,i)=>(
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-300">
              {item}<span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{background:C.grad23}}/>
            </span>
          ))}
        </div>
      </div>

      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto space-y-12">
          {loading ? (
            [...Array(4)].map((_,i)=><div key={i} className="rounded-2xl animate-pulse h-40" style={{background:`linear-gradient(135deg,${C.p2_08},${C.p3_08})`}}/>)
          ) : (
            categories.map(cat=>{
              const catTips = outfits.filter(o=>cat.ids.includes(o.id));
              if(catTips.length===0)return null;
              return (
                <div key={cat.label}>
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-xs font-black tracking-[0.15em] uppercase px-3 py-1 rounded-full" style={{color:C.p2,background:C.p2_08}}>{cat.label}</span>
                    <div className="flex-1 h-px" style={{background:`linear-gradient(90deg,${C.p2_08},transparent)`}}/>
                  </div>
                  <div className="space-y-3">
                    {catTips.map(tip=>(
                      <div key={tip.id} className="tip-card rounded-2xl p-5 relative overflow-hidden" style={{background:"#fff",border:"1px solid rgba(0,0,0,0.07)"}}>
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{background:cat.bar}}/>
                        <div className="flex items-start gap-4 pl-2">
                          <span className="text-2xl flex-shrink-0">{tip.icon}</span>
                          <div>
                            <h3 className="text-base font-black text-slate-900 mb-1.5 leading-tight">{tip.title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">{tip.tip}</p>
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
      </section>

      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-8 text-white text-center relative overflow-hidden" style={{background:C.grad23}}>
          <div className="absolute inset-0 pointer-events-none" style={C.ctaGrid}/>
          <div className="absolute bottom-4 right-5 opacity-15 pointer-events-none"><svg width="40" height="64" viewBox="0 0 40 64" fill="none"><path d="M20 4 C30 14,10 24,20 36 C30 48,10 56,20 62" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
          <h3 className="relative text-2xl font-black mb-2">Outfit locked in?</h3>
          <p className="relative text-white/75 mb-6 text-sm">Now let's make sure you show up ready on shoot day.</p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <Link href="/grad-guide/how-to-prepare" className="btn-lift px-5 py-2.5 rounded-full bg-white font-bold text-sm" style={{color:C.p2}}>Next: How to Prepare →</Link>
            <Link href="/grad-guide/posing" className="btn-lift px-5 py-2.5 rounded-full font-bold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors">← Back to Posing</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/[0.06] bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={C.text}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}