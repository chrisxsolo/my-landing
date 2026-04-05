"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// ── TYPES ─────────────────────────────────────────────────────────────
type Pose = {
  id: number;
  title: string;
  image_url: string;
  instructions: string;
  order: number;
};

// ── FALLBACK DRAFT CONTENT ─────────────────────────────────────────────
// This shows while Supabase isn't connected yet.
// Once connected, real data from the DB replaces this.
const DRAFT_POSES: Pose[] = [
  {
    id: 1,
    title: "Hand on Hip, Hand on Stool",
    image_url: "",
    instructions:
      "Place one hand on your hip and rest the other on a stool, ledge, or wall. This breaks up stiff posture and gives you something natural to do with your hands. Shift your weight to one leg slightly — it creates a relaxed S-curve that photographs beautifully. Keep your chin slightly forward and down to avoid looking stiff.",
    order: 1,
  },
  {
    id: 2,
    title: "Cap in the Air",
    image_url: "",
    instructions:
      "Hold your graduation cap above your head with both hands, arms extended, and look up at it with a genuine smile. This is one of the most iconic grad shots. The key is to actually laugh or think of something funny — forced smiles read flat on camera. Toss it slightly and catch it mid-air for a more dynamic version.",
    order: 2,
  },
  {
    id: 3,
    title: "Walking Toward Camera",
    image_url: "",
    instructions:
      "Walk naturally toward the camera with your cap and gown flowing. Look just slightly past the lens — not directly into it — and let your expression be relaxed. This shot works best in an open walkway, hallway, or path with leading lines. It creates movement and energy that static poses can't match.",
    order: 3,
  },
  {
    id: 4,
    title: "Leaning Against a Wall",
    image_url: "",
    instructions:
      "Stand with your back or shoulder against a wall, one foot flat against it. Cross your arms loosely or hold your diploma in one hand. Tilt your chin down slightly and look into the camera. This pose reads as confident and cool — great for textured walls, brick, or architectural backgrounds.",
    order: 4,
  },
  {
    id: 5,
    title: "Sitting on Steps",
    image_url: "",
    instructions:
      "Find a set of stairs and sit naturally — not perfectly upright, but slightly leaning forward with elbows on your knees. This is a relaxed, candid-feeling pose that works especially well for cap and gown shots. Spread your gown out around you for visual impact. Great for outdoor campus steps or urban staircases.",
    order: 5,
  },
  {
    id: 6,
    title: "Looking Away, Candid Profile",
    image_url: "",
    instructions:
      "Look off into the distance at a 45-degree angle from the camera. Think about something that makes you genuinely happy — your photographer will capture a real expression. This works best in golden hour light where the sun hits the side of your face. It's one of the most editorial-looking grad shots you can get.",
    order: 6,
  },
];

export default function PosingPage() {
  const [poses, setPoses] = useState<Pose[]>(DRAFT_POSES);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchPoses() {
      try {
        // TODO: Replace with real Supabase call:
        // const { data } = await supabase.from('grad_poses').select('*').order('order')
        // if (data && data.length > 0) setPoses(data)
        setLoading(false);
      } catch (err) {
        console.error(err);
        setLoading(false);
      }
    }
    fetchPoses();
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FF]">

      {/* ── NAVBAR ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Chris.
          </Link>
          <Link href="/grad-guide" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            ← Grad Guide
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-14 pb-10">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute rounded-full blur-[100px] opacity-20 w-[400px] h-[400px] -top-20 -left-10 bg-gradient-to-br from-blue-400 to-indigo-500" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-blue-600 mb-3">
            01 — Posing Guide
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4 leading-tight">
            Poses that actually{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              look good.
            </span>
          </h1>
          <p className="text-base text-slate-500 font-light leading-relaxed max-w-xl">
            No stiff yearbook poses here. These are natural, flattering positions 
            that work for real people — not just models. Study them before your shoot 
            and we'll nail every single one.
          </p>
        </div>
      </section>

      {/* ── POSE CARDS ──────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto space-y-6">
          {loading ? (
            [...Array(4)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-200 animate-pulse h-64" />
            ))
          ) : (
            poses.map((pose, index) => (
              <div
                key={pose.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden"
              >
                <div className={`grid ${pose.image_url ? "sm:grid-cols-2" : "grid-cols-1"}`}>

                  {/* Image — only renders if image_url exists */}
                  {pose.image_url && (
                    <div className="aspect-square sm:aspect-auto bg-slate-100 overflow-hidden">
                      <img
                        src={pose.image_url}
                        alt={pose.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* No image placeholder — shows until photos are added to Supabase */}
                  {!pose.image_url && (
                    <div className="hidden sm:flex aspect-square sm:aspect-auto bg-gradient-to-br from-slate-100 to-slate-200 items-center justify-center">
                      <div className="text-center">
                        <p className="text-4xl mb-2">📷</p>
                        <p className="text-xs text-slate-400 font-medium">Photo via Supabase</p>
                      </div>
                    </div>
                  )}

                  {/* Text content */}
                  <div className="p-7 flex flex-col justify-center">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold tracking-widest text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                        POSE {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-3 leading-tight">
                      {pose.title}
                    </h2>
                    <p className="text-slate-500 text-sm leading-relaxed">
                      {pose.instructions}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-8 text-white text-center">
            <h3 className="text-2xl font-black mb-2">Ready to shoot?</h3>
            <p className="text-blue-100 mb-6 text-sm">
              Save these poses on your phone so you can reference them day-of.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/grad-guide/what-to-wear"
                className="px-5 py-2.5 rounded-full bg-white text-blue-600 font-semibold text-sm hover:bg-blue-50 transition-colors"
              >
                Next: What to Wear →
              </Link>
              <a
                href="mailto:you@email.com"
                className="px-5 py-2.5 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors border border-white/20"
              >
                Book a shoot
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 bg-white py-8 px-6">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>

    </div>
  );
}
