"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const photographyCards = [
  {
    href: "/grad-guide",
    emoji: "🎓",
    tag: "Free Guide",
    title: "Graduation Photo Guide",
    desc: "Poses, outfits, timing — everything Bay Area grads need before their shoot.",
    featured: true,
  },
  {
    href: "https://your-locations-site.vercel.app",
    emoji: "📍",
    tag: "Premium",
    title: "Bay Area Shot Locations",
    desc: "My curated map of the best shooting spots in the Bay, with photos and directions.",
    featured: false,
    external: true,
  },
  {
    href: "/blog",
    emoji: "✍️",
    tag: "Blog",
    title: "Shoot Stories",
    desc: "Behind-the-scenes from recent sessions — what worked and what didn't.",
    featured: false,
  },
];

// Non-featured cards: each gets its own color personality
const cardStyles = [
  {
    bg: "linear-gradient(135deg, #ede9fe, #fce7f3)",
    border: "rgba(167,139,250,0.25)",
    tagColor: "#7c3aed",
    tagBg: "rgba(167,139,250,0.12)",
    accentBar: "linear-gradient(90deg,#a78bfa,#f9a8d4)",
    arrowColor: "#a78bfa",
  },
  {
    bg: "linear-gradient(135deg, #fef3c7, #fce7f3)",
    border: "rgba(249,168,212,0.25)",
    tagColor: "#be185d",
    tagBg: "rgba(249,168,212,0.15)",
    accentBar: "linear-gradient(90deg,#f9a8d4,#fcd34d)",
    arrowColor: "#f472b6",
  },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes blobFloat {
          0%,100% { transform:translate(0,0) scale(1); }
          33%     { transform:translate(14px,-10px) scale(1.02); }
          66%     { transform:translate(-10px,12px) scale(0.98); }
        }
        @keyframes blobFloat2 {
          0%,100% { transform:translate(0,0) scale(1); }
          33%     { transform:translate(-12px,8px) scale(0.97); }
          66%     { transform:translate(10px,-8px) scale(1.03); }
        }
        @keyframes drawLine {
          from { stroke-dashoffset:320; }
          to   { stroke-dashoffset:0; }
        }
        @keyframes marquee {
          from { transform:translateX(0); }
          to   { transform:translateX(-50%); }
        }
        @keyframes pulseRing {
          0%,100% { opacity:0.5; transform:scale(1); }
          50%     { opacity:0.15; transform:scale(1.25); }
        }
        @keyframes cursorBlink {
          0%,100% { opacity:1; }
          50%     { opacity:0; }
        }
        .afu1 { animation:fadeUp 0.6s 0.05s ease both; }
        .afu2 { animation:fadeUp 0.6s 0.15s ease both; }
        .afu3 { animation:fadeUp 0.6s 0.25s ease both; }
        .afu4 { animation:fadeUp 0.6s 0.35s ease both; }
        .afu5 { animation:fadeUp 0.6s 0.45s ease both; }
        .af06 { animation:fadeIn 0.6s ease both; }
        .blob1 { animation:blobFloat 10s ease-in-out infinite; }
        .blob2 { animation:blobFloat2 13s ease-in-out infinite; }
        .blob3 { animation:blobFloat 15s ease-in-out infinite reverse; }
        .sqp1 { stroke-dasharray:320; stroke-dashoffset:320; animation:drawLine 2.2s 0.9s ease forwards; }
        .sqp2 { stroke-dasharray:300; stroke-dashoffset:300; animation:drawLine 2.4s 1.1s ease forwards; }
        .mtrack { animation:marquee 22s linear infinite; }
        .cblink { animation:cursorBlink 1.1s step-end infinite; }
        .pdot   { animation:pulseRing 2.5s ease-in-out infinite; }
        .card-lift {
          transition:transform 0.22s ease, box-shadow 0.22s ease;
        }
        .card-lift:hover { transform:translateY(-5px); box-shadow:0 20px 48px rgba(167,139,250,0.14); }
        .arr { transition:transform 0.2s ease, color 0.2s ease; }
        .card-lift:hover .arr { transform:translate(3px,-3px); }
        .btn-lift { transition:transform 0.18s ease, box-shadow 0.18s ease; }
        .btn-lift:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.14); }
        .stat-card {
          border-radius:18px;
          padding:22px 20px;
          text-align:center;
          border:1px solid rgba(0,0,0,0.06);
        }
      `}</style>

      {/* ── NAVBAR ──────────────────────────────────────────────── */}
      <nav
        className="af06 sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]"
        style={{ background:"rgba(255,255,255,0.9)" }}
      >
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <span
            className="font-black text-lg tracking-tight"
            style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}
          >
            Chris.
          </span>
          <div className="flex items-center gap-6 text-sm font-bold text-slate-800">
            <a href="#photography" className="hover:text-slate-500 transition-colors">Photography</a>
            <a href="https://www.instagram.com/soloxsnaps" target="_blank" rel="noopener noreferrer" className="hover:text-slate-500 transition-colors">
              Instagram
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6 border-b border-black/[0.06]">

        {/* Grid bg */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:`linear-gradient(rgba(167,139,250,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(167,139,250,0.045) 1px, transparent 1px)`,
          backgroundSize:"40px 40px",
        }} />
        <div className="absolute inset-0 pointer-events-none" style={{
          background:"radial-gradient(ellipse at 50% 50%, transparent 30%, white 78%)",
        }} />

        {/* Corner brackets */}
        {[
          "top-5 left-5 border-t-[1.5px] border-l-[1.5px]",
          "top-5 right-5 border-t-[1.5px] border-r-[1.5px]",
          "bottom-5 left-5 border-b-[1.5px] border-l-[1.5px]",
          "bottom-5 right-5 border-b-[1.5px] border-r-[1.5px]",
        ].map((cls, i) => (
          <div key={i} className={`absolute w-4 h-4 pointer-events-none border-violet-300/40 ${cls}`} />
        ))}

        {/* Pulse dot */}
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4)" }} />

        {/* Blobs */}
        <div className="blob1 absolute rounded-full pointer-events-none" style={{ width:520,height:520,top:-130,left:-110,background:"radial-gradient(circle,rgba(167,139,250,0.16),transparent 70%)" }} />
        <div className="blob2 absolute rounded-full pointer-events-none" style={{ width:400,height:400,top:-70,right:-90,background:"radial-gradient(circle,rgba(249,168,212,0.13),transparent 70%)" }} />
        <div className="blob3 absolute rounded-full pointer-events-none" style={{ width:300,height:300,bottom:-70,left:"48%",background:"radial-gradient(circle,rgba(252,211,77,0.1),transparent 70%)" }} />

        {/* Squiggle */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{ opacity:0.5,animation:"fadeIn 1s 0.8s ease both" }}>
          <svg width="140" height="260" viewBox="0 0 140 260" fill="none">
            <defs>
              <linearGradient id="sq1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa"/>
                <stop offset="50%" stopColor="#f9a8d4"/>
                <stop offset="100%" stopColor="#fcd34d"/>
              </linearGradient>
              <linearGradient id="sq2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa"/>
                <stop offset="100%" stopColor="#f9a8d4"/>
              </linearGradient>
            </defs>
            <path className="sqp1" d="M70 8 C 100 28,40 55,70 85 C 100 115,40 142,70 172 C 100 202,40 228,70 252" stroke="url(#sq1)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
            <path className="sqp2" d="M45 25 C 75 45,15 72,45 102 C 75 132,15 158,45 188 C 75 218,15 240,45 262" stroke="url(#sq2)" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.45"/>
            <circle cx="70" cy="8"   r="2.5" fill="#a78bfa" opacity="0.6"/>
            <circle cx="70" cy="85"  r="2.5" fill="#f9a8d4" opacity="0.6"/>
            <circle cx="70" cy="172" r="2.5" fill="#fcd34d" opacity="0.6"/>
            <circle cx="70" cy="252" r="2.5" fill="#a78bfa" opacity="0.6"/>
          </svg>
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-3xl mx-auto">

          {/* ID pill */}
          <div className="afu1 inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-black/[0.1] shadow-sm mb-8">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4)" }}>
              CS
            </div>
            <span className="text-sm font-semibold text-slate-800">Chris Solorzano</span>
            <span className="text-slate-300">·</span>
            <span className="text-sm font-medium text-slate-600">San Francisco</span>
          </div>

          {/* H1 */}
          <h1 className="afu2 text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] text-slate-900 mb-2">
            Capturing{" "}
            <span style={{ background:"linear-gradient(135deg,#a78bfa 0%,#f9a8d4 55%,#fcd34d 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              moments,
            </span>
            <span
              className="cblink inline-block w-[3px] h-[48px] sm:h-[56px] md:h-[68px] ml-1.5 rounded-sm align-middle"
              style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4)" }}
            />
          </h1>
          <p className="afu3 text-5xl sm:text-6xl md:text-7xl font-light italic tracking-tight leading-[1.05] text-slate-900 mb-7">
            one frame at a time.
          </p>

          <p className="afu4 text-lg text-slate-600 font-light leading-relaxed max-w-xl mb-10">
            Bay Area photographer based in San Francisco. Specializing in graduation portraits, events, and creative shoots.
          </p>

          {/* Buttons — all dark and readable */}
          <div className="afu5 flex flex-wrap gap-3">
            {/* Grad Guide — gradient bg, white text */}
            <Link
              href="/grad-guide"
              className="btn-lift inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white shadow-md"
              style={{ background:"linear-gradient(135deg,#7c3aed,#db2777)" }}
            >
              🎓 Graduation Guide
            </Link>
            {/* Instagram — solid dark */}
            <a
              href="https://www.instagram.com/soloxsnaps"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-lift inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white"
              style={{ background:"#111827" }}
            >
              📸 Instagram
            </a>
            {/* Book — dark border, dark text */}
            <a
              href="https://www.soloxsnaps.com/contact/"
              className="btn-lift inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm"
              style={{ background:"#fff", color:"#111827", border:"2px solid #111827" }}
            >
              ✉️ Book a shoot
            </a>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ─────────────────────────────────────────────── */}
      <div className="overflow-hidden border-b border-black/[0.06] py-3">
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {[
            "Graduation Photos","Bay Area","Golden Hour",
            "SJSU · Berkeley · Stanford","Natural Light","Real Moments",
            "Graduation Photos","Bay Area","Golden Hour",
            "SJSU · Berkeley · Stanford","Natural Light","Real Moments",
          ].map((item, i) => (
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-400">
              {item}
              <span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4)" }} />
            </span>
          ))}
        </div>
      </div>

      {/* ── PHOTOGRAPHY SECTION ─────────────────────────────────── */}
      <section id="photography" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <p className="text-xs font-bold tracking-[0.15em] uppercase mb-2 text-violet-600">
              Photography
            </p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Things you might find useful
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {photographyCards.map((card, i) => {
              const isExternal = "external" in card && card.external;
              const Wrapper = isExternal ? "a" : Link;
              const wrapperProps = isExternal
                ? { href: card.href, target: "_blank", rel: "noopener noreferrer" }
                : { href: card.href };

              if (card.featured) {
                return (
                  // @ts-ignore
                  <Wrapper
                    key={card.title}
                    {...wrapperProps}
                    className="card-lift group relative rounded-2xl p-7 cursor-pointer block sm:col-span-2 overflow-hidden"
                    style={{ background:"linear-gradient(135deg,#7c3aed,#db2777,#f59e0b)", border:"none" }}
                  >
                    {/* Grid on featured card */}
                    <div className="absolute inset-0 pointer-events-none" style={{
                      backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,
                      backgroundSize:"24px 24px",
                    }} />
                    <div className="relative z-10 flex items-start justify-between">
                      <div>
                        <span className="text-3xl mb-4 block">{card.emoji}</span>
                        <p className="text-xs font-bold tracking-[0.12em] uppercase mb-1 text-white/60">{card.tag}</p>
                        <h3 className="text-2xl font-black mb-2 tracking-tight text-white">{card.title}</h3>
                        <p className="text-sm leading-relaxed text-white/75 max-w-sm">{card.desc}</p>
                      </div>
                      <span className="arr text-2xl text-white/40 flex-shrink-0 mt-1">↗</span>
                    </div>
                  </Wrapper>
                );
              }

              const cs = cardStyles[i - 1] ?? cardStyles[0];
              return (
                // @ts-ignore
                <Wrapper
                  key={card.title}
                  {...wrapperProps}
                  className="card-lift group relative rounded-2xl p-6 cursor-pointer block overflow-hidden"
                  style={{ background:cs.bg, border:`1px solid ${cs.border}` }}
                >
                  {/* Accent top bar */}
                  <div className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl" style={{ background:cs.accentBar }} />

                  <span className="text-3xl mb-4 block">{card.emoji}</span>
                  <p
                    className="text-xs font-bold tracking-[0.12em] uppercase mb-1.5 px-2 py-0.5 rounded-full inline-block"
                    style={{ color:cs.tagColor, background:cs.tagBg }}
                  >
                    {card.tag}
                  </p>
                  <h3 className="text-xl font-black mb-2 tracking-tight text-slate-900">{card.title}</h3>
                  <p className="text-sm leading-relaxed text-slate-600 mb-4">{card.desc}</p>
                  <span className="arr text-lg" style={{ color:cs.arrowColor }}>↗</span>
                </Wrapper>
              );
            })}
          </div>

          {/* Stats — no 5 star, only 3 */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { n:"200+", l:"Grads shot",     bg:"linear-gradient(135deg,#ede9fe,#fce7f3)", nc:"#7c3aed" },
              { n:"12+",  l:"Bay Area spots",  bg:"linear-gradient(135deg,#fce7f3,#fef3c7)", nc:"#db2777" },
              { n:"48hr", l:"Turnaround",      bg:"linear-gradient(135deg,#fef3c7,#ede9fe)", nc:"#d97706" },
            ].map((s) => (
              <div key={s.l} className="stat-card" style={{ background:s.bg }}>
                <span className="block text-2xl font-black tracking-tight mb-0.5" style={{ color:s.nc }}>{s.n}</span>
                <span className="block text-xs font-semibold text-slate-500 tracking-wide">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BANNER ──────────────────────────────────────────── */}
      <div className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-10 text-center relative overflow-hidden" style={{ background:"linear-gradient(135deg,#7c3aed,#db2777,#f59e0b)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`,
            backgroundSize:"28px 28px",
          }} />
          <h3 className="relative text-3xl font-black text-white mb-2 tracking-tight">
            Lock in your date before it's gone.
          </h3>
          <p className="relative text-white/75 mb-7 text-sm font-light">
            Grad season books up fast. Reach out early and we'll make it happen.
          </p>
          <a
            href="https://www.soloxsnaps.com/contact/"
            className="btn-lift relative inline-block px-8 py-3 rounded-full bg-white font-bold text-sm"
            style={{ color:"#7c3aed" }}
          >
            Book your shoot →
          </a>
        </div>
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="py-10 px-6 border-t border-black/[0.06] bg-white">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Chris.
          </span>
          <span className="text-sm text-slate-400">© {new Date().getFullYear()} · San Francisco, CA</span>
        </div>
      </footer>

    </div>
  );
}