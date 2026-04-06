"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";

export const dynamic = 'force-dynamic'

type GradPhoto = {
  id: number;
  image_url: string;
  caption: string | null;
};

const sections = [
  {
    href: "/grad-guide/posing",
    number: "01",
    title: "Posing Guide",
    desc: "Natural, flattering poses that actually look good on camera — no stiff yearbook vibes.",
    emoji: "📸",
    bg: "linear-gradient(135deg,#7c3aed,#db2777)",
    accentBar: "linear-gradient(90deg,#a78bfa,#f9a8d4)",
    tagColor: "#7c3aed",
    tagBg: "rgba(167,139,250,0.12)",
  },
  {
    href: "/grad-guide/what-to-wear",
    number: "02",
    title: "What to Wear",
    desc: "Colors, fabrics, and outfit combos that photograph beautifully in any Bay Area location.",
    emoji: "👗",
    bg: "linear-gradient(135deg,#db2777,#f59e0b)",
    accentBar: "linear-gradient(90deg,#f9a8d4,#fcd34d)",
    tagColor: "#db2777",
    tagBg: "rgba(249,168,212,0.15)",
  },
  {
    href: "/grad-guide/how-to-prepare",
    number: "03",
    title: "How to Prepare",
    desc: "Everything to do before your shoot so you show up relaxed, confident, and ready.",
    emoji: "✅",
    bg: "linear-gradient(135deg,#f59e0b,#7c3aed)",
    accentBar: "linear-gradient(90deg,#fcd34d,#a78bfa)",
    tagColor: "#d97706",
    tagBg: "rgba(252,211,77,0.18)",
  },
];

const SHARED_STYLES = `
  @keyframes fadeUp { from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);} }
  @keyframes fadeIn { from{opacity:0;}to{opacity:1;} }
  @keyframes blobFloat { 0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(12px,-8px)scale(1.02);}66%{transform:translate(-8px,10px)scale(0.98);} }
  @keyframes blobFloat2 { 0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(-10px,8px)scale(0.97);}66%{transform:translate(10px,-6px)scale(1.03);} }
  @keyframes pulseRing { 0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:0.15;transform:scale(1.25);} }
  .afu1{animation:fadeUp 0.5s 0.05s ease both;}
  .afu2{animation:fadeUp 0.5s 0.12s ease both;}
  .afu3{animation:fadeUp 0.5s 0.19s ease both;}
  .blob1{animation:blobFloat 10s ease-in-out infinite;}
  .blob2{animation:blobFloat2 13s ease-in-out infinite;}
  .pdot{animation:pulseRing 2.5s ease-in-out infinite;}
  .card-lift{transition:transform 0.22s ease,box-shadow 0.22s ease;}
  .card-lift:hover{transform:translateY(-5px);box-shadow:0 20px 48px rgba(124,58,237,0.12);}
  .arr{transition:transform 0.2s ease,color 0.2s ease;}
  .card-lift:hover .arr{transform:translate(3px,-3px);}
  .btn-lift{transition:transform 0.18s ease,box-shadow 0.18s ease;}
  .btn-lift:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.14);}
  .tip-card{transition:transform 0.2s ease,box-shadow 0.2s ease,border-color 0.2s ease;}
  .tip-card:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(124,58,237,0.08);border-color:rgba(167,139,250,0.3)!important;}
`;

export default function GradGuidePage() {
  const [photos, setPhotos] = useState<GradPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPhotos() {
      try {
        const { data, error } = await supabase.from('grad_photos').select('*').order('created_at', { ascending: false })
        if (error) console.error(error)
        if (data) setPhotos(data)
      } catch (err) { console.error(err) }
      finally { setLoading(false) }
    }
    fetchPhotos()
  }, [])

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{SHARED_STYLES}</style>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]" style={{ background:"rgba(255,255,255,0.9)" }}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
            Chris.
          </Link>
          <Link href="/" className="text-sm font-bold text-slate-700 hover:text-slate-400 transition-colors">← Back to hub</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-16 pb-12 border-b border-black/[0.06]">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:`linear-gradient(rgba(167,139,250,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,0.04) 1px,transparent 1px)`, backgroundSize:"40px 40px" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background:"radial-gradient(ellipse at 50% 50%, transparent 30%, white 78%)" }} />
        <div className="absolute top-5 left-5 w-4 h-4 pointer-events-none" style={{ borderTop:"1.5px solid rgba(167,139,250,0.35)",borderLeft:"1.5px solid rgba(167,139,250,0.35)" }} />
        <div className="absolute top-5 right-5 w-4 h-4 pointer-events-none" style={{ borderTop:"1.5px solid rgba(167,139,250,0.35)",borderRight:"1.5px solid rgba(167,139,250,0.35)" }} />
        <div className="absolute bottom-5 left-5 w-4 h-4 pointer-events-none" style={{ borderBottom:"1.5px solid rgba(167,139,250,0.35)",borderLeft:"1.5px solid rgba(167,139,250,0.35)" }} />
        <div className="absolute bottom-5 right-5 w-4 h-4 pointer-events-none" style={{ borderBottom:"1.5px solid rgba(167,139,250,0.35)",borderRight:"1.5px solid rgba(167,139,250,0.35)" }} />
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4)" }} />
        <div className="blob1 absolute rounded-full pointer-events-none" style={{ width:480,height:480,top:-120,left:-100,background:"radial-gradient(circle,rgba(167,139,250,0.15),transparent 70%)" }} />
        <div className="blob2 absolute rounded-full pointer-events-none" style={{ width:360,height:360,top:-60,right:-80,background:"radial-gradient(circle,rgba(249,168,212,0.12),transparent 70%)" }} />

        <div className="relative z-10 max-w-3xl mx-auto text-center">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{ background:"rgba(167,139,250,0.1)",border:"1px solid rgba(167,139,250,0.2)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background:"linear-gradient(135deg,#7c3aed,#db2777)" }} />
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-violet-700">Bay Area Grad Photography</p>
          </div>
          <h1 className="afu2 text-5xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 mb-5">
            Your Complete{" "}
            <span style={{ background:"linear-gradient(135deg,#7c3aed,#db2777,#f59e0b)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              Graduation
            </span>
            <br />Photo Guide
          </h1>
          <p className="afu3 text-lg text-slate-600 font-light leading-relaxed max-w-lg mx-auto mb-8">
            Everything you need to know before, during, and after your graduation shoot.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/grad-guide/posing" className="btn-lift px-6 py-3 rounded-full font-bold text-sm text-white shadow-md" style={{ background:"linear-gradient(135deg,#7c3aed,#db2777)" }}>
              Start with posing →
            </Link>
            <a href="https://www.soloxsnaps.com/contact/" className="btn-lift px-6 py-3 rounded-full font-bold text-sm" style={{ background:"#fff",color:"#111827",border:"2px solid #111827" }}>
              Book a shoot
            </a>
          </div>
        </div>
      </section>

      {/* SECTION CARDS */}
      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="card-lift group relative rounded-2xl p-6 cursor-pointer block overflow-hidden text-white" style={{ background:s.bg }}>
              <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`, backgroundSize:"20px 20px" }} />
              <div className="relative z-10">
                <span className="text-3xl mb-3 block">{s.emoji}</span>
                <p className="text-xs font-bold tracking-widest opacity-60 mb-1 uppercase">{s.number}</p>
                <h3 className="text-lg font-black mb-2 leading-tight">{s.title}</h3>
                <p className="text-sm opacity-75 leading-relaxed">{s.desc}</p>
              </div>
              <span className="arr absolute bottom-5 right-5 text-lg text-white/40 group-hover:text-white">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* PHOTO GRID */}
      <section className="px-6 pb-20 border-t border-black/[0.06]">
        <div className="max-w-3xl mx-auto pt-14">
          <div className="mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3" style={{ background:"rgba(167,139,250,0.08)",border:"1px solid rgba(167,139,250,0.18)" }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background:"linear-gradient(135deg,#7c3aed,#db2777)" }} />
              <p className="text-xs font-bold tracking-[0.12em] uppercase text-violet-700">Portfolio</p>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recent grad shoots</h2>
            <p className="text-slate-500 mt-2 text-sm font-medium">Real sessions, real results.</p>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[...Array(6)].map((_, i) => <div key={i} className="aspect-square rounded-2xl animate-pulse" style={{ background:"linear-gradient(135deg,#ede9fe,#fce7f3)" }} />)}
            </div>
          ) : photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="group relative aspect-square rounded-2xl overflow-hidden bg-slate-100">
                  <img src={photo.image_url} alt={photo.caption || "Graduation photo"} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  {photo.caption && (
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-end">
                      <p className="text-white text-sm font-medium p-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">{photo.caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="border-2 border-dashed rounded-2xl p-16 text-center" style={{ borderColor:"rgba(167,139,250,0.25)" }}>
              <p className="text-4xl mb-4">📷</p>
              <p className="text-slate-700 font-bold">Photos load here from Supabase</p>
              <p className="text-slate-400 text-sm mt-1">Add rows to <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">grad_photos</code></p>
            </div>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-black/[0.06] bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}