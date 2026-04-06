"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { theme } from "@/lib/theme";

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

export default function Home() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 4000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAVBAR ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className={`font-black text-lg tracking-tight bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
            Chris.
          </span>
          <div className="flex items-center gap-6 text-sm font-medium text-slate-500">
            <a href="#photography" className="hover:text-slate-900 transition-colors">Photography</a>
            <a href="https://www.instagram.com/soloxsnaps" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 transition-colors">
              Instagram
            </a>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-24 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute rounded-full blur-[120px] opacity-20 transition-all duration-[4000ms] ease-in-out"
            style={{
              width: 600, height: 600,
              top: tick % 2 === 0 ? "-120px" : "-80px",
              left: tick % 2 === 0 ? "-120px" : "-80px",
              background: theme.blob1,
            }}
          />
          <div
            className="absolute rounded-full blur-[140px] opacity-15 transition-all duration-[4000ms] ease-in-out"
            style={{
              width: 500, height: 500,
              top: tick % 2 === 0 ? "-80px" : "-40px",
              right: tick % 2 === 0 ? "-120px" : "-80px",
              background: theme.blob2,
            }}
          />
          <div
            className="absolute rounded-full blur-[160px] opacity-10 transition-all duration-[4000ms] ease-in-out"
            style={{
              width: 400, height: 400,
              bottom: tick % 2 === 0 ? "-80px" : "-40px",
              left: "50%",
              transform: "translateX(-50%)",
              background: theme.blob3,
            }}
          />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Identity pill */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white border border-black/[0.08] shadow-sm mb-8">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ background: theme.gradientStyle }}
            >
              CS
            </div>
            <span className="text-sm font-medium text-slate-700">Chris Solorzano</span>
            <span className="text-slate-300">·</span>
            <span className="text-sm text-slate-500">San Francisco</span>
          </div>

          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black tracking-tight leading-[1.05] text-slate-900 mb-6">
            Capturing{" "}
            <span className={`bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
              moments,
            </span>
            <br />
            one frame at a time.
          </h1>

          <p className="text-lg text-slate-500 font-light leading-relaxed max-w-xl mb-10">
            Bay Area photographer based in San Francisco. Specializing in graduation portraits, events, and creative shoots.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/grad-guide"
              className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-sm shadow-lg ${theme.gradientHover} hover:-translate-y-0.5 transition-all duration-200`}
              style={{ background: theme.gradientStyle }}
            >
              🎓 Graduation Guide
            </Link>
            <a
              href="https://www.instagram.com/soloxsnaps"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-black/[0.08] text-slate-700 font-semibold text-sm hover:border-black/[0.15] hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
            >
              📸 Instagram
            </a>
            <a
              href="https://www.soloxsnaps.com/contact/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white border border-black/[0.08] text-slate-700 font-semibold text-sm hover:border-black/[0.15] hover:-translate-y-0.5 transition-all duration-200 shadow-sm"
            >
              ✉️ Book a shoot
            </a>
          </div>
        </div>
      </section>

      {/* ── PHOTOGRAPHY SECTION ─────────────────────────────────── */}
      <section id="photography" className="py-16 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <p className={`text-xs font-semibold tracking-[0.15em] uppercase bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent mb-2`}>
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
                // @ts-ignore
                <Wrapper
                  key={card.title}
                  {...wrapperProps}
                  style={card.featured ? { background: theme.gradientStyle } : {}}
                  className={`
                    group relative rounded-2xl p-6 border transition-all duration-250 cursor-pointer block
                    ${card.featured
                      ? `border-transparent text-white shadow-xl ${theme.gradientHover} sm:col-span-2`
                      : "bg-white border-black/[0.08] hover:border-violet-200 hover:shadow-lg hover:shadow-violet-400/10 hover:-translate-y-1"
                    }
                  `}
                >
                  <span className="text-3xl mb-4 block">{card.emoji}</span>
                  <p className={`text-xs font-semibold tracking-[0.12em] uppercase mb-1 ${card.featured ? "text-white/70" : `bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}`}>
                    {card.tag}
                  </p>
                  <h3 className={`text-xl font-bold mb-2 tracking-tight ${card.featured ? "text-white" : "text-slate-900"}`}>
                    {card.title}
                  </h3>
                  <p className={`text-sm leading-relaxed ${card.featured ? "text-white/70" : "text-slate-500"}`}>
                    {card.desc}
                  </p>
                  <span className={`absolute bottom-5 right-5 text-lg transition-all duration-200 group-hover:translate-x-1 group-hover:-translate-y-1 ${card.featured ? "text-white/40 group-hover:text-white" : "text-slate-300 group-hover:text-violet-400"}`}>
                    ↗
                  </span>
                </Wrapper>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="mt-8 py-10 px-6 border-t border-black/[0.06] bg-white">
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className={`font-black text-lg bg-gradient-to-r ${theme.gradient} bg-clip-text text-transparent`}>
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