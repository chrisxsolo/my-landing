"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type PrepTip = {
  id: number;
  title: string;
  description: string;
  icon: string;
  order: number;
};

const DRAFT_PREP_TIPS: PrepTip[] = [
  {
    id: 1,
    title: "Book at least 2 weeks out",
    description:
      "Good light and great locations fill up fast during grad season (May–June in the Bay). Booking early also gives you time to plan your outfit, location, and any family coordination without rushing. Last-minute shoots tend to be stressful — and stress shows in photos.",
    icon: "📅",
    order: 1,
  },
  {
    id: 2,
    title: "Scout your location beforehand",
    description:
      "If you have a specific spot in mind — Lands End, the Palace of Fine Arts, your campus — visit it before your shoot. Check what time the light hits best (golden hour, 1-2 hours before sunset, is almost always the answer). Look for interesting backgrounds, walls, and architectural details you want to use.",
    icon: "📍",
    order: 2,
  },
  {
    id: 3,
    title: "Get a full night's sleep",
    description:
      "Tired eyes and dull skin are the biggest killers of great photos. Your body shows up in your face — puffy eyes, uneven skin tone, low energy all come through on camera. Aim for 8 hours the night before. Skip the late celebration until after your shoot.",
    icon: "😴",
    order: 3,
  },
  {
    id: 4,
    title: "Eat before you shoot",
    description:
      "A hungry subject is a distracted, low-energy subject. Eat a proper meal 1-2 hours before your shoot — not right before (you don't want to feel bloated), but enough ahead that you have real energy. Avoid anything that makes you feel sluggish. Bring a snack and water to the shoot.",
    icon: "🥗",
    order: 4,
  },
  {
    id: 5,
    title: "Steam or iron your gown",
    description:
      "Your gown ships folded and usually arrives with visible creases. A steamer (or a shower — hang it in the bathroom with hot water running for 15 minutes) gets rid of most wrinkles. Wrinkled gowns are one of the most common things people wish they'd fixed before their shoot.",
    icon: "👗",
    order: 5,
  },
  {
    id: 6,
    title: "Practice your poses",
    description:
      "Stand in front of a full-length mirror and practice the poses from the posing guide. Find your good side, your natural smile, and the angles that feel most comfortable. The more familiar a pose feels before the shoot, the more natural it looks in photos. 10 minutes of practice makes a real difference.",
    icon: "🪞",
    order: 6,
  },
  {
    id: 7,
    title: "Charge your phone",
    description:
      "You'll want to reference poses, check the location, and obviously share photos after. Bring a portable charger if you tend to run low. Also — silence it for the shoot. Notifications mid-shoot break your focus and your expression.",
    icon: "🔋",
    order: 7,
  },
  {
    id: 8,
    title: "Communicate with your photographer",
    description:
      "Send your photographer your vision before the shoot — poses you love, locations you want to hit, any photos you've saved for inspiration. The more context they have going in, the more efficiently the shoot runs. Don't be shy about speaking up during the shoot either — if something doesn't feel right, say so.",
    icon: "💬",
    order: 8,
  },
];

export default function HowToPreparePage() {
  const [tips, setTips] = useState<PrepTip[]>(DRAFT_PREP_TIPS);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchTips() {
      try {
        // TODO: Replace with Supabase call:
        // const { data } = await supabase.from('grad_prep_tips').select('*').order('order')
        // if (data && data.length > 0) setTips(data)
        setLoading(false);
      } catch (err) {
        console.error(err);
      }
    }
    fetchTips();
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
          <div className="absolute rounded-full blur-[100px] opacity-20 w-[400px] h-[400px] -top-20 -left-10 bg-gradient-to-br from-indigo-400 to-blue-600" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto">
          <p className="text-xs font-semibold tracking-[0.15em] uppercase text-indigo-600 mb-3">
            03 — How to Prepare
          </p>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-slate-900 mb-4 leading-tight">
            Show up{" "}
            <span className="bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
              confident.
            </span>
          </h1>
          <p className="text-base text-slate-500 font-light leading-relaxed max-w-xl">
            The best grad photos come from people who show up relaxed and prepared. 
            Here's everything to do before shoot day so you can focus on having fun 
            and looking great.
          </p>
        </div>
      </section>

      {/* ── PREP TIPS ───────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl bg-slate-200 animate-pulse h-48" />
            ))
          ) : (
            tips.map((tip) => (
              <div
                key={tip.id}
                className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-200 hover:shadow-md transition-all duration-200"
              >
                <span className="text-3xl mb-4 block">{tip.icon}</span>
                <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight">
                  {tip.title}
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  {tip.description}
                </p>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl p-8 text-white text-center">
            <h3 className="text-2xl font-black mb-2">You're ready. Let's shoot.</h3>
            <p className="text-blue-100 mb-6 text-sm">
              You've got the poses, the outfit, and the prep checklist. Time to book.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <a
                href="mailto:you@email.com"
                className="px-6 py-3 rounded-full bg-white text-indigo-600 font-semibold text-sm hover:bg-indigo-50 transition-colors shadow-lg"
              >
                Book your shoot →
              </a>
              <Link
                href="/grad-guide"
                className="px-5 py-2.5 rounded-full bg-white/10 text-white font-semibold text-sm hover:bg-white/20 transition-colors border border-white/20"
              >
                ← Back to guide
              </Link>
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
