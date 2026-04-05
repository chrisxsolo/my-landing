"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// ── DATA ─────────────────────────────────────────────────────────────
// Everything here is data — if you want to add or remove a card,
// you just edit this array. The JSX below never needs to change.

const photographyCards = [
  {
    href: "/grad-guide",
    emoji: "🎓",
    tag: "Free Guide",
    title: "Graduation Photo Guide",
    desc: "Poses, outfits, timing — everything Bay Area grads need before their shoot.",
    featured: true, // renders with gradient background
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

const personalCards = [
  { href: "/weight-loss", emoji: "⚡", tag: "Journey",    title: "Weight Loss",   desc: "Data, frameworks, and what's actually working." },
  { href: "/stoicism",    emoji: "🏛️", tag: "Philosophy", title: "Stoicism",      desc: "Marcus Aurelius, Epictetus, and daily practice." },
  { href: "/running",     emoji: "🏃", tag: "Training",   title: "Running Log",   desc: "Routes, PRs, and the science of getting faster." },
  { href: "https://portfolio-nu-mocha-65.vercel.app", emoji: "💻", tag: "Dev", title: "Dev Portfolio", desc: "CS projects, tech stack, and code work.", external: true },
];

// ── COMPONENT ─────────────────────────────────────────────────────────
export default function Home() {
  // Controls the subtle animated gradient shift in the hero
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F9FF] font-sans">

      {/* ── NAVBAR ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-black text-lg tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Chris.
          </span>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
            <a href="#photography" className="hover:text-slate-900 transition-colors">Photography</a>
            <a href="#personal"     className="hover:text-slate-900 transition-colors">Personal</a>
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 transition-colors"
            >
              Instagram
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6">

        {/* 
          The gradient mesh background — three overlapping radial blobs
          that slowly breathe using CSS transitions triggered by state.
          This is the "Arian Grand" style gradient you saw in the reference.
        */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Top-left blob — blue */}
          <div
            className="absolute rounded-full blur-[100px] opacity-30 transition-all duration-[4000ms] ease-in-out"
            style={{
              width: 600,
              height: 600,
              top: tick % 2 === 0 ? "-100px" : "-60px",
              left: tick % 2 === 0 ? "-100px" : "-60px",
              background: "radial-gradient(circle, #6366f1, #3b82f6)",
            }}
          />
          {/* Top-right blob — purple */}
          <div
            className="absolute rounded-full blur-[120px] opacity-25 transition-all duration-[4000ms] ease-in-out"
            style={{
              width: 500,
              height: 500,
              top: tick % 2 === 0 ? "-80px" : "-40px",
              right: tick % 2 === 0 ? "-100px" : "-60px",
              background: "radial-gradient(circle, #a855f7, #6366f1)",
            }}
          />
          {/* Center-bottom blob — indigo */}
          <div
            className="absolute rounded-full blur-[140px] opacity-20 transition-all duration-[4000ms] ease-in-out"
            style={{
              width: 400,
              height: 400,
              bottom: tick % 2 === 0 ? "-80px" : "-40px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "radial-gradient(circle, #4f46e5, #7c3aed)",
            }}
          />
        </div>

        {/* Hero content */}
        <div className="relative z-10 max-w-3xl mx-auto">

          {/* Mini identity pill — clean and simple */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm mb-8">
            {/* Avatar placeholder — replace with <img src="/chris.JPG" ... /> */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              CS
            </div>
            <span className="text-sm font-medium text-slate-700">Chris Solorzano</span>
            <span className="text-slate-300">·</span>
            <span className="text-sm text-slate-500">San Francisco</span>
          </div>

          {/* Main headline */}
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] text-slate-900 mb-6">
            Capturing{" "}
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
              moments,
            </span>
            <br />
            building things.
          </h1>

          <p className="text-lg text-slate-500 font-light leading-relaxed max-w-xl mb-10">
            I'm Chris — I shoot photos, write code, and document what I'm
            learning. This is my little corner of the internet.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-wrap gap-3">
            {/* Primary — grad guide, the most important page */}
            <Link
              href="/grad-guide"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:-translate-y-0.5 transition-all duration-200"
            >
              🎓 Graduation Guide
            </Link>
            {/* Secondary — Instagram */}
            <a
              href="https://www.instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
            >
              📸 Instagram
            </a>
            <a
              href="mailto:you@email.com"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-slate-200 text-slate-700 font-semibold text-sm hover:border-slate-300 hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
            >
              ✉️ Say hello
            </a>
          </div>
        </div>
      </section>

      {/* ── PHOTOGRAPHY SECTION ─────────────────────────────────── */}
      <section id="photography" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">

          <div className="mb-8">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-blue-600 mb-2">
              Photography
            </p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Things you might find useful
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {photographyCards.map((card) => {
              const isExternal = "external" in card && card.external;
              const Wrapper = isExternal ? "a" : Link;
              const wrapperProps = isExternal
                ? { href: card.href, target: "_blank", rel: "noopener noreferrer" }
                : { href: card.href };

              return (
                // @ts-ignore — dynamic tag between Link and <a>
                <Wrapper
                  key={card.title}
                  {...wrapperProps}
                  className={`
                    group relative rounded-2xl p-6 border transition-all duration-250 cursor-pointer block
                    ${card.featured
                      ? "bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-600 border-transparent text-white shadow-xl shadow-blue-500/20 sm:col-span-2"
                      : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1"
                    }
                  `}
                >
                  <span className="text-3xl mb-4 block">{card.emoji}</span>
                  <p className={`text-xs font-semibold tracking-[0.12em] uppercase mb-1 ${card.featured ? "text-blue-200" : "text-blue-600"}`}>
                    {card.tag}
                  </p>
                  <h3 className={`text-xl font-bold mb-2 tracking-tight ${card.featured ? "text-white" : "text-slate-900"}`}>
                    {card.title}
                  </h3>
                  <p className={`text-sm leading-relaxed ${card.featured ? "text-blue-100" : "text-slate-500"}`}>
                    {card.desc}
                  </p>
                  {/* Arrow */}
                  <span className={`absolute bottom-5 right-5 text-lg transition-all duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 ${card.featured ? "text-blue-300 group-hover:text-white" : "text-slate-300 group-hover:text-blue-500"}`}>
                    ↗
                  </span>
                </Wrapper>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── PERSONAL SECTION ────────────────────────────────────── */}
      <section id="personal" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">

          <div className="mb-8">
            <p className="text-xs font-semibold tracking-[0.15em] uppercase text-purple-600 mb-2">
              Personal
            </p>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              Things I'm building for me
            </h2>
          </div>

          {/* About blurb */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-4">
            <p className="text-slate-500 font-light leading-relaxed">
              <span className="font-semibold text-slate-800">Hey, I'm Chris.</span>{" "}
              CS grad from SF who thinks too much about running pace, stoic philosophy,
              and what I'm eating. These pages are my living notes — I update them as I learn.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {personalCards.map((card) => {
              const isExternal = "external" in card && card.external;
              const Wrapper = isExternal ? "a" : Link;
              const wrapperProps = isExternal
                ? { href: card.href, target: "_blank", rel: "noopener noreferrer" }
                : { href: card.href };

              return (
                // @ts-ignore
                <Wrapper
                  key={card.title}
                  {...wrapperProps}
                  className="group relative bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-1 transition-all duration-200 cursor-pointer block"
                >
                  <span className="text-3xl mb-4 block">{card.emoji}</span>
                  <p className="text-xs font-semibold tracking-[0.12em] uppercase text-indigo-600 mb-1">
                    {card.tag}
                  </p>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">
                    {card.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    {card.desc}
                  </p>
                  <span className="absolute bottom-5 right-5 text-lg text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 group-hover:-translate-y-1 transition-all duration-200">
                    ↗
                  </span>
                </Wrapper>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="mt-8 py-10 px-6 border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Chris.
          </span>
          <span className="text-sm text-slate-400">
            © {new Date().getFullYear()} · San Francisco, CA
          </span>
        </div>
      </footer>

    </div>
  );
}
