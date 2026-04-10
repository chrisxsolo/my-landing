"use client";
import Link from "next/link";
import Nav from "@/app/components/Nav";
import { C } from "@/lib/colors";

const PROFILE = {
  name: "Chris Solorzano",
  title: "Bay Area Portrait Photographer",
  location: "San Francisco, CA",
  avatar: "https://dmtslzwglpezympptqls.supabase.co/storage/v1/object/public/grad-photos/DSC02593_(2).jpg",
  intro: "I create photos that feel current, clean, and alive — never overly posed, just the most confident version of you.",
};

const BIO = [
  "I started taking photography seriously because I loved the mix of technical problem-solving and human connection. Light, framing, timing — they all matter, but the real win is getting someone comfortable enough to forget the camera exists.",
  "Most of my work is graduation shoots and creative portraits around the Bay. I care about making sessions feel easy, collaborative, and genuinely fun. The goal is a polished gallery that still feels authentic.",
  "When I'm not shooting, I'm refining edits, collecting visual references, and figuring out how to make every part of the experience better.",
];

const HIGHLIGHTS = [
  { icon: "✨", label: "Style", title: "Clean & Modern", desc: "Natural direction with sharp composition and soft color grading", grad: C.grad12 },
  { icon: "🎯", label: "Approach", title: "Calm & Intentional", desc: "Relaxed sessions with constant attention to light and detail", grad: C.grad23 },
  { icon: "⚡", label: "Energy", title: "Fresh & Editorial", desc: "Crisp visuals that feel current without being overdesigned", grad: C.grad13 },
];

const PROCESS = [
  { step: "01", title: "Inquiry", desc: "Reach out via contact form or Instagram DM" },
  { step: "02", title: "Planning", desc: "Discuss locations, timing, and vision for the shoot" },
  { step: "03", title: "Session", desc: "60-90 minute shoot at your chosen Bay Area location" },
  { step: "04", title: "Delivery", desc: "Edited gallery delivered within 2 weeks" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: C.page }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes blobFloat{0%,100%{transform:translate(0,0)scale(1)}33%{transform:translate(14px,-10px)scale(1.02)}66%{transform:translate(-10px,12px)scale(0.98)}}
        @keyframes blobFloat2{0%,100%{transform:translate(0,0)scale(1)}33%{transform:translate(-12px,8px)scale(0.97)}66%{transform:translate(10px,-8px)scale(1.03)}}
        @keyframes drawLine{from{stroke-dashoffset:320}to{stroke-dashoffset:0}}
        @keyframes pulseRing{0%,100%{opacity:0.5;transform:scale(1)}50%{opacity:0.15;transform:scale(1.25)}}
        .afu1{animation:fadeUp 0.6s 0.05s ease both}
        .afu2{animation:fadeUp 0.6s 0.15s ease both}
        .afu3{animation:fadeUp 0.6s 0.25s ease both}
        .afu4{animation:fadeUp 0.6s 0.35s ease both}
        .afu{animation:fadeUp .6s ease both}
        .af{animation:fadeIn .8s ease both}
        .mtrack{animation:marquee 24s linear infinite}
        .float{animation:float 4s ease-in-out infinite}
        .blob1{animation:blobFloat 10s ease-in-out infinite}
        .blob2{animation:blobFloat2 13s ease-in-out infinite}
        .sqp1{stroke-dasharray:320;stroke-dashoffset:320;animation:drawLine 2.2s 0.9s ease forwards}
        .sqp2{stroke-dasharray:300;stroke-dashoffset:300;animation:drawLine 2.4s 1.1s ease forwards}
        .pdot{animation:pulseRing 2.5s ease-in-out infinite}
        .card-hover{transition:all .3s ease}
        .card-hover:hover{transform:translateY(-4px);box-shadow:${C.shadowWarmLg}}
      `}</style>

      <Nav />

      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none opacity-30">
        <div className="absolute inset-0" style={{background:`radial-gradient(circle at 20% 20%, rgba(255,221,212,0.36), transparent 50%)`}}/>
        <div className="absolute inset-0" style={{background:`radial-gradient(circle at 80% 60%, rgba(245,208,227,0.28), transparent 50%)`}}/>
        <div className="absolute inset-0" style={{background:`radial-gradient(circle at 50% 90%, rgba(255,233,188,0.22), transparent 40%)`}}/>
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-24 px-6 border-b" style={{borderColor:C.borderSubtle}}>
          {/* Grid + vignette */}
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
          <div className="blob1 absolute rounded-full pointer-events-none" style={{width:520,height:520,top:-130,left:-110,background:C.blob1}}/>
          <div className="blob2 absolute rounded-full pointer-events-none" style={{width:400,height:400,top:-70,right:-90,background:C.blob2}}/>
          {/* Squiggle */}
          <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{opacity:0.45,animation:"fadeIn 1s 0.8s ease both"}}>
            <svg width="110" height="220" viewBox="0 0 110 220" fill="none">
              <defs>
                <linearGradient id="lsg-about" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.p1}/><stop offset="50%" stopColor={C.p2}/><stop offset="100%" stopColor={C.p3}/>
                </linearGradient>
              </defs>
              <path className="sqp1" d="M55 6 C80 22,30 46,55 72 C80 98,30 120,55 148 C80 176,30 196,55 216" stroke="url(#lsg-about)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              <path className="sqp2" d="M35 20 C60 36,10 60,35 86 C60 112,10 136,35 162 C60 188,10 206,35 218" stroke={C.p2} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3"/>
              <circle cx="55" cy="6"   r="2.5" fill={C.p1} opacity="0.7"/>
              <circle cx="55" cy="72"  r="2.5" fill={C.p2} opacity="0.7"/>
              <circle cx="55" cy="148" r="2.5" fill={C.p3} opacity="0.7"/>
              <circle cx="55" cy="216" r="2.5" fill={C.p1} opacity="0.7"/>
            </svg>
          </div>

          <div className="relative z-10 max-w-6xl mx-auto">
            <div className="grid md:grid-cols-2 gap-16 items-center">
            {/* Left - Text */}
            <div>
              {/* Identity pill */}
              <div className="afu1 inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-8" style={{background:C.surfaceStrong,border:`1px solid ${C.borderSubtle}`,boxShadow:C.shadowWarmSm}}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{background:C.grad12}}>CS</div>
                <span className="text-sm font-semibold text-slate-700">Chris Solorzano</span>
                <span className="text-slate-300">·</span>
                <span className="text-sm font-medium text-slate-500">San Francisco</span>
              </div>

              <h1 className="afu2 text-5xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[1.05] text-slate-900 mb-3">
                Behind the <span style={C.text}>camera.</span>
              </h1>
              <p className="afu3 text-4xl md:text-5xl font-light italic tracking-tight leading-[1.1] text-slate-900 mb-7">
                the person behind it.
              </p>

              <p className="afu3 text-lg text-slate-500 font-light leading-relaxed max-w-xl mb-8">
                {PROFILE.intro}
              </p>

              {/* Stats row */}
              <div className="afu3 flex gap-6 mb-8">
                {[["100+","Shoots"],["2wk","Delivery"],["Bay","Area"]].map(([val,lbl])=>(
                  <div key={lbl}>
                    <div className="text-2xl font-black" style={C.text12}>{val}</div>
                    <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{lbl}</div>
                  </div>
                ))}
              </div>

              <div className="afu4 flex flex-wrap gap-3">
                <a
                  href="https://soloxsnaps.com/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white transition-all hover:opacity-90 hover:scale-105"
                  style={{background:C.grad12,boxShadow:`0 8px 20px ${C.p1_20}`}}
                >
                  📸 Book a Shoot
                </a>
                <Link
                  href="/blog"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-slate-900 bg-white border-2 transition-all hover:scale-105"
                  style={{background:C.surfaceStrong,borderColor:C.borderWarm}}
                >
                  ✍️ Read Blog
                </Link>
              </div>
            </div>

            {/* Right - Smaller Profile Card */}
            <div className="flex flex-col items-center afu pt-16 gap-6" style={{animationDelay:"0.2s"}}>
              <div className="relative">
                {/* Decorative ring */}
                <div className="absolute -inset-3 rounded-3xl opacity-40" style={{background:C.grad12,filter:"blur(16px)"}}/>
                <div
                  className="relative card-hover rounded-3xl overflow-hidden"
                  style={{
                    width:"280px",
                    background:C.surfaceStrong,
                    border:`2px solid ${C.borderWarm}`,
                    boxShadow:C.shadowWarmLg
                  }}
                >
                  <div className="relative overflow-hidden" style={{height:"320px",background:`linear-gradient(135deg,${C.p1_10},${C.p2_08})`}}>
                    <img
                      src={PROFILE.avatar}
                      alt={PROFILE.name}
                      className="w-full h-full object-cover"
                      style={{objectPosition:"center 18%"}}
                    />
                    <div className="absolute bottom-0 left-0 right-0 h-16" style={{background:"linear-gradient(to top, white, transparent)"}}/>
                  </div>
                  <div className="px-5 pb-5 pt-3">
                    <h2 className="text-xl font-black text-slate-900 mb-0.5">{PROFILE.name}</h2>
                    <p className="text-xs font-bold mb-1" style={{color:C.p1}}>{PROFILE.title}</p>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs">📍</span>
                      <p className="text-xs text-slate-500">{PROFILE.location}</p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Badge sits below the card with natural spacing */}
              <div
                className="float px-4 py-2 rounded-2xl text-xs font-black text-white"
                style={{background:C.grad12,boxShadow:`0 6px 20px ${C.p1_25}`}}
              >
                📸 Available
              </div>
            </div>
          </div>
          </div>
        </section>

        {/* Marquee */}
        <div className="border-y py-4 overflow-hidden" style={{borderColor:C.borderSubtle,background:C.surfaceStrong}}>
          <div className="mtrack flex gap-12 whitespace-nowrap">
            {["Portrait Photography","Bay Area","Creative Direction","Natural Light","Clean Edits","Graduation Shoots","Portrait Photography","Bay Area","Creative Direction","Natural Light","Clean Edits","Graduation Shoots"].map((item,i)=>(
              <span key={i} className="text-xs font-bold tracking-wider uppercase" style={{color:C.p1}}>
                {item} <span className="mx-3" style={{color:C.p2}}>·</span>
              </span>
            ))}
          </div>
        </div>

        {/* Bio Section — decorative */}
        <section className="max-w-6xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-5 gap-12">
            <div className="md:col-span-2">
              <div className="sticky top-24">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{background:C.p2_08,border:`1px solid ${C.p2_15}`}}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{color:C.p2}}>My Approach</span>
                </div>
                <h3 className="text-3xl font-black leading-tight mb-4" style={C.text12}>
                  The way I<br/>see it
                </h3>
                <div className="flex gap-2">
                  <div className="h-1 w-8 rounded-full" style={{background:C.grad12}}/>
                  <div className="h-1 w-3 rounded-full" style={{background:C.p2_25}}/>
                </div>
              </div>
            </div>
            <div className="md:col-span-3 space-y-8">
              {BIO.map((paragraph,i)=>(
                <div key={i} className="relative pl-7">
                  <div
                    className="absolute left-0 top-1 bottom-1 w-1 rounded-full"
                    style={{background: i===0 ? C.grad12 : i===1 ? C.grad23 : C.grad13}}
                  />
                  <p className="text-lg leading-relaxed text-slate-700">
                    {paragraph}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Highlights */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="flex items-center gap-4 mb-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-2" style={{background:C.p3_10,border:`1px solid ${C.p3_15}`}}>
                <span className="text-xs font-bold uppercase tracking-wider" style={{color:"#d97706"}}>What I Bring</span>
              </div>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {HIGHLIGHTS.map((item,i)=>(
              <div
                key={item.title}
                className="card-hover p-7 rounded-2xl relative overflow-hidden"
                style={{
                  background:C.surfaceStrong,
                  border:`1px solid ${C.borderSubtle}`,
                  animationDelay:`${i*0.1}s`
                }}
              >
                {/* Top accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{background:item.grad}}/>
                <div className="text-3xl mb-4">{item.icon}</div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">{item.label}</p>
                <h4 className="text-xl font-black mb-3" style={C.text12}>{item.title}</h4>
                <p className="text-sm leading-relaxed text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Process Timeline */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-10" style={{background:C.surfaceStrong,border:`1px solid ${C.borderSubtle}`,boxShadow:C.shadowWarmSm}}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{color:C.p1}}>How It Works</span>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {PROCESS.map((item,i)=>(
              <div
                key={item.step}
                className="card-hover relative rounded-2xl p-6 overflow-hidden"
                style={{background:C.surfaceStrong,border:`1px solid ${C.borderSubtle}`,boxShadow:C.shadowWarmSm}}
              >
                {/* Accent top bar */}
                <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{background:C.grad12}}/>
                {/* Step number — large background watermark */}
                <div
                  className="absolute -right-2 -bottom-4 text-8xl font-black select-none pointer-events-none leading-none"
                  style={{color:`rgba(157,111,232,0.06)`}}
                >
                  {item.step}
                </div>
                {/* Step pill */}
                <div
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full text-sm font-black text-white mb-5"
                  style={{background:C.grad12,boxShadow:`0 4px 12px ${C.p1_20}`}}
                >
                  {i + 1}
                </div>
                <h4 className="text-lg font-black text-slate-900 mb-2">{item.title}</h4>
                <p className="text-sm text-slate-500 leading-relaxed relative z-10">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-6xl mx-auto px-6 py-16">
          <div
            className="rounded-3xl relative overflow-hidden"
            style={{
              background:`linear-gradient(135deg, rgba(255,252,248,0.96), ${C.p1_10}, ${C.p2_08}, ${C.p3_08})`,
              border:`1px solid ${C.borderWarm}`
            }}
          >
            {/* Grid overlay */}
            <div className="absolute inset-0 opacity-40" style={C.gridBg(0.05)}/>
            {/* Blobs */}
            <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full opacity-30" style={{background:`radial-gradient(circle, ${C.p1_25}, transparent 70%)`}}/>
            <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full opacity-30" style={{background:`radial-gradient(circle, ${C.p2_25}, transparent 70%)`}}/>

            <div className="relative z-10 px-12 py-16 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6" style={{background:C.surfaceStrong,border:`1px solid ${C.borderSubtle}`,boxShadow:C.shadowWarmSm}}>
                <div className="w-2 h-2 rounded-full" style={{background:C.p1}}/>
                <span className="text-xs font-bold tracking-wider uppercase" style={{color:C.p1}}>Let's Connect</span>
              </div>

              <h2 className="text-4xl md:text-5xl font-black mb-6" style={C.text}>
                Ready to work together?
              </h2>
              <p className="text-xl text-slate-600 mb-10 max-w-xl mx-auto leading-relaxed">
                Let's capture your graduation, portrait session, or creative project — in a way that actually feels like you.
              </p>

              <div className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-4">
                <a
                  href="https://soloxsnaps.com/contact"
                  className="inline-flex items-center justify-center rounded-full font-bold text-white transition-all hover:scale-[1.02] hover:opacity-90"
                  style={{
                    minHeight: 50,
                    padding: "0 28px",
                    fontSize: "0.95rem",
                    lineHeight: 1,
                    background: C.grad12,
                    boxShadow: `0 8px 28px ${C.p1_25}`,
                  }}
                >
                  Get in Touch →
                </a>
                <Link
                  href="/availability"
                  className="inline-flex items-center justify-center rounded-full font-bold text-slate-800 transition-all hover:scale-[1.02] whitespace-nowrap"
                  style={{
                    minHeight: 50,
                    padding: "0 28px",
                    fontSize: "0.95rem",
                    lineHeight: 1,
                    background: C.surfaceStrong,
                    border: `1.5px solid ${C.borderWarm}`,
                    boxShadow: C.shadowWarmSm,
                  }}
                >
                  Check Availability
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t py-8 px-6" style={{borderColor:C.borderSubtle, background:C.surfaceStrong}}>
          <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
            <span className="font-black text-lg" style={C.text}>Chris.</span>
            <span className="text-sm text-slate-400">© 2026 · Bay Area Photography</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
