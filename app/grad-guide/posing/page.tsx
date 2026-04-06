"use client";

import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";

export const dynamic = 'force-dynamic'

type Pose = {
  id: number;
  title: string;
  image_url: string;
  instructions: string;
  order: number;
};

const DRAFT_POSES: Pose[] = [
  { id:1, title:"Hand on Hip, Hand on Stool", image_url:"", instructions:"Place one hand on your hip and rest the other on a stool, ledge, or wall. This breaks up stiff posture and gives you something natural to do with your hands. Shift your weight to one leg slightly — it creates a relaxed S-curve that photographs beautifully. Keep your chin slightly forward and down to avoid looking stiff.", order:1 },
  { id:2, title:"Cap in the Air", image_url:"", instructions:"Hold your graduation cap above your head with both hands, arms extended, and look up at it with a genuine smile. This is one of the most iconic grad shots. The key is to actually laugh or think of something funny — forced smiles read flat on camera. Toss it slightly and catch it mid-air for a more dynamic version.", order:2 },
  { id:3, title:"Walking Toward Camera", image_url:"", instructions:"Walk naturally toward the camera with your cap and gown flowing. Look just slightly past the lens — not directly into it — and let your expression be relaxed. This shot works best in an open walkway, hallway, or path with leading lines. It creates movement and energy that static poses can't match.", order:3 },
  { id:4, title:"Leaning Against a Wall", image_url:"", instructions:"Stand with your back or shoulder against a wall, one foot flat against it. Cross your arms loosely or hold your diploma in one hand. Tilt your chin down slightly and look into the camera. This pose reads as confident and cool — great for textured walls, brick, or architectural backgrounds.", order:4 },
  { id:5, title:"Sitting on Steps", image_url:"", instructions:"Find a set of stairs and sit naturally — not perfectly upright, but slightly leaning forward with elbows on your knees. This is a relaxed, candid-feeling pose that works especially well for cap and gown shots. Spread your gown out around you for visual impact. Great for outdoor campus steps or urban staircases.", order:5 },
  { id:6, title:"Looking Away, Candid Profile", image_url:"", instructions:"Look off into the distance at a 45-degree angle from the camera. Think about something that makes you genuinely happy — your photographer will capture a real expression. This works best in golden hour light where the sun hits the side of your face. It's one of the most editorial-looking grad shots you can get.", order:6 },
];

const STYLES = `
  @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
  @keyframes blobFloat{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(12px,-8px)scale(1.02);}66%{transform:translate(-8px,10px)scale(0.98);}}
  @keyframes pulseRing{0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:0.15;transform:scale(1.25);}}
  .afu1{animation:fadeUp 0.5s 0.05s ease both;}
  .afu2{animation:fadeUp 0.5s 0.12s ease both;}
  .afu3{animation:fadeUp 0.5s 0.19s ease both;}
  .blob1{animation:blobFloat 10s ease-in-out infinite;}
  .pdot{animation:pulseRing 2.5s ease-in-out infinite;}
  .card-lift{transition:transform 0.22s ease,box-shadow 0.22s ease;}
  .card-lift:hover{transform:translateY(-4px);box-shadow:0 16px 40px rgba(124,58,237,0.1);}
  .btn-lift{transition:transform 0.18s ease,box-shadow 0.18s ease;}
  .btn-lift:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.12);}
`;

export default function PosingPage() {
  const [poses, setPoses] = useState<Pose[]>(DRAFT_POSES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchPoses() {
      try {
        const { data, error } = await supabase.from('grad_poses').select('*').order('order', { ascending: true })
        if (error) console.error(error)
        if (data && data.length > 0) setPoses(data)
      } catch (err) { console.error(err) }
    }
    fetchPoses()
  }, [])

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      <style>{STYLES}</style>

      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl border-b border-black/[0.06]" style={{ background:"rgba(255,255,255,0.9)" }}>
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight" style={{ background:"linear-gradient(135deg,#a78bfa,#f9a8d4,#fcd34d)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Chris.</Link>
          <Link href="/grad-guide" className="text-sm font-bold text-slate-700 hover:text-slate-400 transition-colors">← Grad Guide</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-14 pb-10 border-b border-black/[0.06]">
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:`linear-gradient(rgba(167,139,250,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(167,139,250,0.04) 1px,transparent 1px)`, backgroundSize:"40px 40px" }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background:"radial-gradient(ellipse at 40% 50%, transparent 30%, white 75%)" }} />
        <div className="absolute top-5 left-5 w-4 h-4 pointer-events-none" style={{ borderTop:"1.5px solid rgba(124,58,237,0.3)",borderLeft:"1.5px solid rgba(124,58,237,0.3)" }} />
        <div className="absolute bottom-5 right-5 w-4 h-4 pointer-events-none" style={{ borderBottom:"1.5px solid rgba(124,58,237,0.3)",borderRight:"1.5px solid rgba(124,58,237,0.3)" }} />
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{ background:"linear-gradient(135deg,#7c3aed,#db2777)" }} />
        <div className="blob1 absolute rounded-full pointer-events-none" style={{ width:440,height:440,top:-120,left:-100,background:"radial-gradient(circle,rgba(124,58,237,0.12),transparent 70%)" }} />

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4" style={{ background:"rgba(124,58,237,0.08)",border:"1px solid rgba(124,58,237,0.18)" }}>
            <div className="w-1.5 h-1.5 rounded-full bg-violet-600" />
            <p className="text-xs font-bold tracking-[0.12em] uppercase text-violet-700">01 — Posing Guide</p>
          </div>
          <h1 className="afu2 text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4 leading-tight">
            Poses that actually{" "}
            <span style={{ background:"linear-gradient(135deg,#7c3aed,#db2777)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>look good.</span>
          </h1>
          <p className="afu3 text-base text-slate-600 font-light leading-relaxed max-w-xl">
            No stiff yearbook poses here. These are natural, flattering positions that work for real people — not just models. Study them before your shoot and we'll nail every single one.
          </p>
        </div>
      </section>

      {/* POSE CARDS */}
      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto space-y-5">
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="rounded-2xl animate-pulse h-56" style={{ background:"linear-gradient(135deg,#ede9fe,#fce7f3)" }} />)
          ) : (
            poses.map((pose, index) => (
              <div key={pose.id} className="card-lift rounded-2xl overflow-hidden" style={{ border:"1px solid rgba(167,139,250,0.2)", background:"#fff" }}>
                {/* Accent bar */}
                <div className="h-[3px]" style={{ background:"linear-gradient(90deg,#7c3aed,#db2777,#f59e0b)" }} />
                <div className={`grid ${pose.image_url ? "sm:grid-cols-2" : "grid-cols-1"}`}>
                  {pose.image_url ? (
                    <div className="aspect-square sm:aspect-auto bg-slate-100 overflow-hidden">
                      <img src={pose.image_url} alt={pose.title} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="hidden sm:flex aspect-square sm:aspect-auto items-center justify-center" style={{ background:"linear-gradient(135deg,#ede9fe,#fce7f3)" }}>
                      <div className="text-center">
                        <p className="text-4xl mb-2">📷</p>
                        <p className="text-xs font-semibold text-violet-400">Photo via Supabase</p>
                      </div>
                    </div>
                  )}
                  <div className="p-7 flex flex-col justify-center">
                    <div className="mb-3">
                      <span className="text-xs font-bold tracking-widest px-2.5 py-1 rounded-full" style={{ color:"#7c3aed", background:"rgba(124,58,237,0.08)" }}>
                        POSE {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mb-3 leading-tight">{pose.title}</h2>
                    <p className="text-slate-600 text-sm leading-relaxed">{pose.instructions}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-8 text-white text-center relative overflow-hidden" style={{ background:"linear-gradient(135deg,#7c3aed,#db2777)" }}>
          <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage:`linear-gradient(rgba(255,255,255,0.06) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.06) 1px,transparent 1px)`, backgroundSize:"24px 24px" }} />
          <h3 className="relative text-2xl font-black mb-2">Ready to shoot?</h3>
          <p className="relative text-white/75 mb-6 text-sm">Save these poses on your phone so you can reference them day-of.</p>
          <div className="relative flex flex-wrap justify-center gap-3">
            <Link href="/grad-guide/what-to-wear" className="btn-lift px-5 py-2.5 rounded-full bg-white font-bold text-sm" style={{ color:"#7c3aed" }}>
              Next: What to Wear →
            </Link>
            <a href="https://www.soloxsnaps.com/contact/" className="btn-lift px-5 py-2.5 rounded-full font-bold text-sm border border-white/30 text-white hover:bg-white/10 transition-colors">
              Book a shoot
            </a>
          </div>
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