"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";
import { GUIDE_STYLES } from "@/lib/guidestyles";

export const dynamic = 'force-dynamic'

type PrepTip = { id:number; title:string; description:string; icon:string; order:number; };

const DRAFT_PREP_TIPS: PrepTip[] = [
  {id:1,title:"Get a good night's sleep",description:"This sounds obvious but it matters more than people think. Tired eyes, dull skin, and low energy all show up on camera. Skip the late night before your shoot and get at least 7-8 hours. Drink water the morning of. You'll look and feel sharper.",icon:"😴",order:1},
  {id:2,title:"Don't rush — give yourself extra time",description:"Prep your outfit, stole, and cap the night before. Don't leave anything to the morning of. Factor in drive time, parking, and getting to the location — arriving stressed shows up in your first few shots. Get there 10-15 minutes early.",icon:"⏰",order:2},
  {id:3,title:"Eat something before we shoot",description:"A hungry subject is a distracted subject. Eat a real meal 1-2 hours before your session — not right before, but enough ahead that you have real energy. Bring a small snack and water to the shoot too.",icon:"🥗",order:3},
  {id:4,title:"Keep your outfit simple",description:"You are the focus — not what you're wearing. Solid colors photograph far better than busy prints, stripes, or logos. Since your gown and stole tend to be rich and bold, lighter colors underneath create a nice contrast.",icon:"👗",order:4},
  {id:5,title:"Iron or steam everything the night before",description:"Your gown comes folded and will have visible crease lines. Take it out of the package the night before. Hang it in the bathroom while you shower and the steam will smooth most of it out.",icon:"👔",order:5},
  {id:6,title:"Wear your stole with your outfit before the shoot",description:"Try your full look together at least once before the day of — stole, gown, outfit, shoes. You want to make sure everything works together and nothing clashes.",icon:"🎓",order:6},
  {id:7,title:"Bring comfortable shoes for walking",description:"If you're wearing heels, bring flip-flops or flats as a backup. We'll be walking across campus and standing for extended stretches. Comfort translates on camera.",icon:"👠",order:7},
  {id:8,title:"Go slightly bolder with makeup than usual",description:"Outdoor light and camera settings tend to flatten features. Your everyday makeup look will read as too subtle in photos. Add a bit more contour, define your brows slightly more, and opt for matte finishes over glossy.",icon:"💄",order:8},
  {id:9,title:"Stick with a hairstyle you know",description:"Grad shoot day is not the time to try something new. Go with a style you've worn before and feel confident in. If you're booking a blowout, schedule it the morning of your shoot.",icon:"💇",order:9},
  {id:10,title:"Jewelry is great — lose the smartwatch",description:"Earrings, necklaces, rings, and bracelets all add to the look. But leave the Apple Watch or Fitbit at home — it reads as out of place in grad photos.",icon:"💍",order:10},
  {id:11,title:"Glasses will glare — plan ahead",description:"If you wear glasses, the lenses will catch light and create glare in outdoor shots. If you can remove the lenses beforehand, that's the cleanest fix.",icon:"👓",order:11},
  {id:12,title:"Props that actually work",description:"Bring all your stoles and honor cords, a bouquet of flowers, champagne if you want that shot, or a calligraphy board. Skip smoke bombs, sparklers, balloons, and confetti.",icon:"🌸",order:12},
  {id:13,title:"Bring a small towel and stay hydrated",description:"We're going to be moving around a lot. You will sweat. A small handkerchief or face towel goes a long way between shots. Keep water on you.",icon:"💧",order:13},
  {id:14,title:"Communicate your vision before the shoot",description:"Send me any poses, locations, or photos you love before we meet. The more I know going in, the more efficiently we can move through the session.",icon:"💬",order:14},
];

const categories = [
  {label:"Preparation",      ids:[1,2,3],      accent:"#7c3aed", accentBg:"rgba(124,58,237,0.08)",  bar:"linear-gradient(180deg,#7c3aed,#db2777)"},
  {label:"Clothing",         ids:[4,5,6],      accent:"#db2777", accentBg:"rgba(219,39,119,0.08)",  bar:"linear-gradient(180deg,#db2777,#f59e0b)"},
  {label:"Hair & Makeup",    ids:[7,8,9],      accent:"#d97706", accentBg:"rgba(217,119,6,0.08)",   bar:"linear-gradient(180deg,#f59e0b,#7c3aed)"},
  {label:"Accessories & Props",ids:[10,11,12], accent:"#7c3aed", accentBg:"rgba(124,58,237,0.08)",  bar:"linear-gradient(180deg,#7c3aed,#db2777)"},
  {label:"Day Of",           ids:[13,14],      accent:"#db2777", accentBg:"rgba(219,39,119,0.08)",  bar:"linear-gradient(180deg,#db2777,#f59e0b)"},
];

const MARQUEE = ["Show Up Ready","Sleep Well","Eat First","Steam Your Gown","Golden Hour","Bay Area Grads","Show Up Ready","Sleep Well","Eat First","Steam Your Gown","Golden Hour","Bay Area Grads"];

export default function HowToPreparePage() {
  const [tips, setTips] = useState<PrepTip[]>(DRAFT_PREP_TIPS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchTips() {
      try {
        const {data,error} = await supabase.from('grad_prep_tips').select('*').order('order',{ascending:true})
        if (error) console.error(error)
        if (data && data.length > 0) setTips(data)
      } catch(err){console.error(err)}
    }
    fetchTips()
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{GUIDE_STYLES}</style>

      {/* NAVBAR */}
      <nav className="af sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]" style={{background:"rgba(255,255,255,0.9)"}}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Chris.</Link>
          <Link href="/grad-guide" className="text-sm font-bold text-slate-700 hover:text-slate-400 transition-colors">← Grad Guide</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-14 pb-12 border-b border-black/[0.06]">
        <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(245,158,11,0.035) 1px,transparent 1px),linear-gradient(90deg,rgba(245,158,11,0.035) 1px,transparent 1px)`,backgroundSize:"40px 40px"}}/>
        <div className="absolute inset-0 pointer-events-none" style={{background:"radial-gradient(ellipse at 40% 50%,transparent 28%,white 74%)"}}/>
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{borderTop:"2px solid rgba(245,158,11,0.35)",borderLeft:"2px solid rgba(245,158,11,0.35)"}}/>
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{borderTop:"2px solid rgba(124,58,237,0.25)",borderRight:"2px solid rgba(124,58,237,0.25)"}}/>
        <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{borderBottom:"2px solid rgba(124,58,237,0.25)",borderLeft:"2px solid rgba(124,58,237,0.25)"}}/>
        <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{borderBottom:"2px solid rgba(245,158,11,0.35)",borderRight:"2px solid rgba(245,158,11,0.35)"}}/>
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{background:"linear-gradient(135deg,#f59e0b,#db2777)"}}/>
        <div className="pdot absolute bottom-7 left-7 w-1.5 h-1.5 rounded-full pointer-events-none" style={{background:"#7c3aed",animationDelay:"0.9s"}}/>
        <div className="blob1 absolute rounded-full pointer-events-none" style={{width:440,height:440,top:-110,left:-90,background:"radial-gradient(circle,rgba(245,158,11,0.1),transparent 70%)"}}/>
        <div className="blob2 absolute rounded-full pointer-events-none" style={{width:340,height:340,bottom:-80,right:-60,background:"radial-gradient(circle,rgba(124,58,237,0.08),transparent 70%)"}}/>

        {/* Squiggle right */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{opacity:0.4,animation:"fadeIn 1s 0.6s ease both"}}>
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <defs><linearGradient id="prsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f59e0b"/><stop offset="50%" stopColor="#db2777"/><stop offset="100%" stopColor="#7c3aed"/></linearGradient></defs>
            <path className="sqp1" d="M50 6 C74 20,26 42,50 66 C74 90,26 112,50 136 C74 160,26 178,50 196" stroke="url(#prsg)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path className="sqp3" d="M28 20 C52 34,4 56,28 80 C52 104,4 126,28 150 C52 174,4 190,28 198" stroke="#7c3aed" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3"/>
            <circle cx="50" cy="6"   r="2.5" fill="#f59e0b" opacity="0.8"/>
            <circle cx="50" cy="66"  r="2.5" fill="#db2777" opacity="0.8"/>
            <circle cx="50" cy="136" r="2.5" fill="#7c3aed" opacity="0.8"/>
            <circle cx="50" cy="196" r="2.5" fill="#f59e0b" opacity="0.8"/>
          </svg>
        </div>
        {/* Spinning ring amber */}
        <div className="spin absolute -bottom-8 -left-8 pointer-events-none hidden sm:block" style={{opacity:0.08}}>
          <svg width="130" height="130" viewBox="0 0 130 130"><circle cx="65" cy="65" r="56" stroke="#f59e0b" strokeWidth="1" fill="none" strokeDasharray="7 5"/></svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.25)"}}>
            <div className="pdot w-1.5 h-1.5 rounded-full bg-amber-500"/>
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-amber-700">03 — How to Prepare</p>
          </div>
          <h1 className="afu2 text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-2 leading-tight">Show up</h1>
          <p className="afu3 text-4xl sm:text-5xl font-light italic tracking-tight text-slate-900 mb-5">
            <span style={{background:"linear-gradient(135deg,#f59e0b,#db2777,#7c3aed)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>ready.</span>
            <span className="cblink inline-block w-[3px] h-[36px] sm:h-[44px] ml-1.5 rounded-sm align-middle" style={{background:"linear-gradient(135deg,#f59e0b,#db2777)"}}/>
          </p>
          <p className="afu4 text-base text-slate-600 font-light leading-relaxed max-w-xl">
            The difference between a good session and a great one usually comes down to preparation. Here's everything you need to know before shoot day — broken down by category.
          </p>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-b border-black/[0.06] py-3">
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {MARQUEE.map((item,i) => (
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-300">
              {item}<span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{background:"linear-gradient(135deg,#f59e0b,#db2777)"}}/>
            </span>
          ))}
        </div>
      </div>

      {/* TIPS */}
      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto space-y-12">
          {loading ? (
            [...Array(4)].map((_,i) => <div key={i} className="rounded-2xl animate-pulse h-40" style={{background:"linear-gradient(135deg,#fef3c7,#ede9fe)"}}/>)
          ) : (
            categories.map((cat) => {
              const catTips = tips.filter((t) => cat.ids.includes(t.id));
              if (catTips.length === 0) return null;
              return (
                <div key={cat.label}>
                  <div className="flex items-center gap-3 mb-5">
                    <span className="text-xs font-black tracking-[0.15em] uppercase px-3 py-1 rounded-full" style={{color:cat.accent,background:cat.accentBg}}>{cat.label}</span>
                    <div className="flex-1 h-px" style={{background:`linear-gradient(90deg,${cat.accentBg},transparent)`}}/>
                  </div>
                  <div className="space-y-3">
                    {catTips.map((tip) => (
                      <div key={tip.id} className="tip-card rounded-2xl p-5 relative overflow-hidden" style={{background:"#fff",border:"1px solid rgba(0,0,0,0.07)"}}>
                        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{background:cat.bar}}/>
                        <div className="flex items-start gap-4 pl-2">
                          <span className="text-2xl flex-shrink-0">{tip.icon}</span>
                          <div>
                            <h3 className="text-base font-black text-slate-900 mb-1.5 leading-tight">{tip.title}</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">{tip.description}</p>
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

      {/* CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-8 text-white text-center relative overflow-hidden" style={{background:"linear-gradient(135deg,#f59e0b,#db2777,#7c3aed)"}}>
          <div className="absolute inset-0 pointer-events-none" style={{backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,backgroundSize:"24px 24px"}}/>
          <div className="absolute top-4 left-5 opacity-15 pointer-events-none"><svg width="40" height="64" viewBox="0 0 40 64" fill="none"><path d="M20 4 C30 14,10 24,20 36 C30 48,10 56,20 62" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
          <h3 className="relative text-2xl font-black mb-2">You're ready. Let's shoot.</h3>
          <p className="relative text-white/75 mb-6 text-sm">You've got the poses, the outfit, and the prep list. Time to book.</p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <a href="https://www.soloxsnaps.com/contact/" className="btn-lift px-6 py-3 rounded-full bg-white font-bold text-sm shadow-lg" style={{color:"#7c3aed"}}>Book your shoot →</a>
            <Link href="/grad-guide/what-to-wear" className="btn-lift px-5 py-2.5 rounded-full font-bold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors">← Back to Outfits</Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-black/[0.06] bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={{background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}