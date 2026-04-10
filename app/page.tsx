"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { C } from "@/lib/colors";
import Nav from "@/app/components/Nav";

export const dynamic = 'force-dynamic'

const photographyCards = [
  { href:"/grad-guide",      emoji:"🎓", tag:"Free Guide",  title:"Graduation Photo Guide",  desc:"Poses, outfits, timing — everything Bay Area grads need before their shoot.", featured:true },
  { href:"/booking-process", emoji:"📋", tag:"Process",     title:"Booking Process",         desc:"From inquiry to delivery — see exactly what happens at each step.", featured:false },
  { href:"/availability",    emoji:"📅", tag:"Availability",title:"Check My Schedule",       desc:"See what dates I have open for grad season and reach out to lock one in.", featured:false },
  { href:"/blog",            emoji:"✍️", tag:"Blog",        title:"Shoot Stories",            desc:"Behind-the-scenes from recent sessions — what worked and what didn't.", featured:false },
];

const cardStyles = [
  { bg:`linear-gradient(135deg, rgba(255,249,243,0.98), ${C.p1_10}, ${C.p2_08})`, border:C.borderWarm, tagColor:C.p1, tagBg:C.p1_10, accentBar:C.grad90_12, arrowColor:C.p1 },
  { bg:`linear-gradient(135deg, rgba(255,249,241,0.98), ${C.p3_10}, ${C.p2_08})`, border:C.borderWarm, tagColor:C.p2, tagBg:C.p2_10, accentBar:C.grad90_23, arrowColor:C.p2 },
  { bg:`linear-gradient(135deg, rgba(255,250,244,0.98), ${C.p2_10}, ${C.p3_08})`, border:C.borderWarmStrong, tagColor:C.p3, tagBg:C.p3_10, accentBar:C.grad90_23, arrowColor:C.p3 },
];

const STYLES = `
  @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes blobFloat{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(14px,-10px)scale(1.02);}66%{transform:translate(-10px,12px)scale(0.98);}}
  @keyframes blobFloat2{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(-12px,8px)scale(0.97);}66%{transform:translate(10px,-8px)scale(1.03);}}
  @keyframes drawLine{from{stroke-dashoffset:320;}to{stroke-dashoffset:0;}}
  @keyframes marquee{from{transform:translateX(0);}to{transform:translateX(-50%);}}
  @keyframes pulseRing{0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:0.15;transform:scale(1.25);}}
  @keyframes cursorBlink{0%,100%{opacity:1;}50%{opacity:0;}}
  .afu1{animation:fadeUp 0.6s 0.05s ease both;}
  .afu2{animation:fadeUp 0.6s 0.15s ease both;}
  .afu3{animation:fadeUp 0.6s 0.25s ease both;}
  .afu4{animation:fadeUp 0.6s 0.35s ease both;}
  .afu5{animation:fadeUp 0.6s 0.45s ease both;}
  .af{animation:fadeIn 0.6s ease both;}
  .blob1{animation:blobFloat 10s ease-in-out infinite;}
  .blob2{animation:blobFloat2 13s ease-in-out infinite;}
  .sqp1{stroke-dasharray:320;stroke-dashoffset:320;animation:drawLine 2.2s 0.9s ease forwards;}
  .sqp2{stroke-dasharray:300;stroke-dashoffset:300;animation:drawLine 2.4s 1.1s ease forwards;}
  .mtrack{animation:marquee 22s linear infinite;}
  .cblink{animation:cursorBlink 1.1s step-end infinite;}
  .pdot{animation:pulseRing 2.5s ease-in-out infinite;}
  .card-lift{transition:transform 0.22s ease,box-shadow 0.22s ease;}
  .card-lift:hover{transform:translateY(-5px);box-shadow:${C.shadowWarmLg};}
  .arr{transition:transform 0.2s ease,color 0.2s ease;}
  .card-lift:hover .arr{transform:translate(3px,-3px);}
  .btn-lift{transition:transform 0.18s ease,box-shadow 0.18s ease;}
  .btn-lift:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.14);}
`;

export default function Home() {
  const [tick, setTick] = useState(0);
  useEffect(() => { const id = setInterval(()=>setTick(t=>t+1),4000); return()=>clearInterval(id); }, []);

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: C.page }}>
      <style>{STYLES}</style>

      <Nav />

      {/* HERO */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6 border-b" style={{ borderColor: C.borderSubtle }}>
        <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.045)}/>
        <div className="absolute inset-0 pointer-events-none" style={C.vignette}/>
        {/* Corner brackets */}
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p1_30}`,borderLeft:`2px solid ${C.p1_30}`}}/>
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{borderTop:`2px solid ${C.p2_18}`,borderRight:`2px solid ${C.p2_18}`}}/>
        <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p2_18}`,borderLeft:`2px solid ${C.p2_18}`}}/>
        <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{borderBottom:`2px solid ${C.p3_15}`,borderRight:`2px solid ${C.p3_15}`}}/>
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{background:C.grad12}}/>
        <div className="pdot absolute bottom-8 left-8 w-1.5 h-1.5 rounded-full pointer-events-none" style={{background:C.grad23,animationDelay:"1s"}}/>
        {/* Blobs */}
        <div className="blob1 absolute rounded-full pointer-events-none" style={{width:520,height:520,top:tick%2===0?-130:-90,left:tick%2===0?-110:-70,background:C.blob1,transition:"all 4s ease"}}/>
        <div className="blob2 absolute rounded-full pointer-events-none" style={{width:400,height:400,top:tick%2===0?-70:-30,right:tick%2===0?-90:-50,background:C.blob2,transition:"all 4s ease"}}/>
        {/* Squiggle */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{opacity:0.45,animation:"fadeIn 1s 0.8s ease both"}}>
          <svg width="110" height="220" viewBox="0 0 110 220" fill="none">
            <defs>
              <linearGradient id="lsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.p1}/><stop offset="50%" stopColor={C.p2}/><stop offset="100%" stopColor={C.p3}/></linearGradient>
            </defs>
            <path className="sqp1" d="M55 6 C80 22,30 46,55 72 C80 98,30 120,55 148 C80 176,30 196,55 216" stroke="url(#lsg)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path className="sqp2" d="M35 20 C60 36,10 60,35 86 C60 112,10 136,35 162 C60 188,10 206,35 218" stroke={C.p2} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3"/>
            <circle cx="55" cy="6"   r="2.5" fill={C.p1} opacity="0.7"/>
            <circle cx="55" cy="72"  r="2.5" fill={C.p2} opacity="0.7"/>
            <circle cx="55" cy="148" r="2.5" fill={C.p3} opacity="0.7"/>
            <circle cx="55" cy="216" r="2.5" fill={C.p1} opacity="0.7"/>
          </svg>
        </div>
        <div className="absolute -bottom-10 -left-10 pointer-events-none hidden sm:block" style={{opacity:0.08,animation:"spinSlow 12s linear infinite"}}>
          <svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="60" stroke={C.p1} strokeWidth="1" fill="none" strokeDasharray="8 6"/></svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="afu1 inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8" style={{ background: C.surfaceStrong, border: `1px solid ${C.borderSubtle}`, boxShadow: C.shadowWarmSm }}>
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:C.grad12}}>CS</div>
            <span className="text-sm font-semibold text-slate-700">Chris Solorzano</span>
            <span className="text-slate-300">·</span>
            <span className="text-sm font-medium text-slate-500">San Francisco</span>
          </div>
          <h1 className="afu2 text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] text-slate-900 mb-2">
            Capturing <span style={C.text}>moments,</span>
            <span className="cblink inline-block w-[3px] h-[48px] sm:h-[56px] md:h-[68px] ml-1.5 rounded-sm align-middle" style={{background:C.grad12}}/>
          </h1>
          <p className="afu3 text-5xl sm:text-6xl md:text-7xl font-light italic tracking-tight leading-[1.05] text-slate-900 mb-7">one frame at a time.</p>
          <p className="afu4 text-lg text-slate-500 font-light leading-relaxed max-w-xl mb-10">
            Bay Area photographer based in San Francisco. Specializing in graduation portraits, events, and creative shoots.
          </p>
          <div className="afu5 flex flex-wrap gap-3">
            <Link href="/grad-guide" className="btn-lift inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white shadow-md" style={{background:C.grad12}}>🎓 Graduation Guide</Link>
            <a href="https://www.instagram.com/soloxsnaps" target="_blank" rel="noopener noreferrer" className="btn-lift inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white" style={{background:"#111827"}}>📸 Instagram</a>
            <a href="https://www.soloxsnaps.com/contact/" className="btn-lift inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm" style={{background:C.surfaceStrong,color:"#111827",border:`1.5px solid ${C.borderWarm}`}}>✉️ Book a shoot</a>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-b py-3" style={{ borderColor: C.borderSubtle, background: C.surfaceStrong }}>
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {["Graduation Photos","Bay Area","Golden Hour","SJSU · Berkeley · Stanford","Natural Light","Real Moments","Graduation Photos","Bay Area","Golden Hour","SJSU · Berkeley · Stanford","Natural Light","Real Moments"].map((item,i)=>(
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-300">
              {item}<span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{background:C.grad12}}/>
            </span>
          ))}
        </div>
      </div>

      {/* CARDS */}
      <section id="photography" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold tracking-[0.15em] uppercase mb-2" style={C.text12}>Photography</p>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-8">Things you might find useful</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {photographyCards.map((card,i)=>{
              const isExternal = "external" in card && card.external;
              const Wrapper = isExternal ? "a" : Link;
              const wrapperProps = isExternal ? {href:card.href,target:"_blank",rel:"noopener noreferrer"} : {href:card.href};
              const cs = cardStyles[i-1] ?? cardStyles[0];
              return (
                // @ts-ignore
                <Wrapper key={card.title} {...wrapperProps}
                  className={`card-lift group relative rounded-2xl p-6 cursor-pointer block ${card.featured?"sm:col-span-2":""}`}
                  style={card.featured?{background:C.grad,border:"none"}:{background:cs.bg,border:`1px solid ${cs.border}`}}>
                  {card.featured && <div className="absolute inset-0 rounded-2xl pointer-events-none" style={C.ctaGridLg}/>}
                  {!card.featured && <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{background:cs.accentBar}}/>}
                  <div className="relative z-10">
                    <span className="text-3xl mb-4 block">{card.emoji}</span>
                    <p className="text-xs font-bold tracking-[0.12em] uppercase mb-1" style={card.featured?{color:"rgba(255,255,255,0.65)"}:{color:cs.tagColor,background:cs.tagBg,display:"inline-block",padding:"2px 8px",borderRadius:"100px"}}>{card.tag}</p>
                    <h3 className="text-xl font-black mb-2 tracking-tight mt-1" style={{color:card.featured?"#fff":"#0f0f0f"}}>{card.title}</h3>
                    <p className="text-sm leading-relaxed" style={{color:card.featured?"rgba(255,255,255,0.75)":"#888"}}>{card.desc}</p>
                  </div>
                  <span className="arr absolute bottom-5 right-5 text-lg" style={{color:card.featured?"rgba(255,255,255,0.4)":cs.arrowColor}}>↗</span>
                </Wrapper>
              );
            })}
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[{n:"200+",l:"Grads shot"},{n:"12+",l:"Bay Area spots"},{n:"48hr",l:"Turnaround"}].map(s=>(
              <div key={s.l} className="rounded-2xl p-5 text-center" style={{background:C.surfaceWarm,border:`1px solid ${C.borderSubtle}`, boxShadow: C.shadowWarmSm}}>
                <span className="block text-2xl font-black tracking-tight mb-0.5" style={C.text12}>{s.n}</span>
                <span className="block text-xs font-semibold text-slate-500">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-10 text-center relative overflow-hidden" style={{background:C.grad}}>
          <div className="absolute inset-0 pointer-events-none" style={C.ctaGridLg}/>
          <div className="absolute top-4 right-6 opacity-15 pointer-events-none"><svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg></div>
          <h3 className="relative text-3xl font-black text-white mb-2 tracking-tight">Lock in your date before it's gone.</h3>
          <p className="relative text-white/75 mb-7 text-sm font-light">Grad season books up fast. Reach out early and we'll make it happen.</p>
          <a href="https://www.soloxsnaps.com/contact/" className="btn-lift relative inline-block px-8 py-3 rounded-full bg-white font-bold text-sm" style={{color:C.p1}}>Book your shoot →</a>
        </div>
      </div>

      <footer className="py-10 px-6 border-t" style={{ borderColor: C.borderSubtle, background: C.surfaceStrong }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={C.text}>Chris.</span>
          <span className="text-sm text-slate-400">© {new Date().getFullYear()} · San Francisco, CA</span>
        </div>
      </footer>
    </div>
  );
}
