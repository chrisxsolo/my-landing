"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";
import { GUIDE_STYLES } from "@/lib/guidestyles";
import { C } from "@/lib/colors";

export const dynamic = 'force-dynamic'

type BlogPost = {
  id: number;
  title: string;
  body: string;
  published_at: string;
  slug: string;
  cover_image_url: string | null;
  extra_image_urls: string[];
  meta_description?: string | null;
  meta_keywords?: string | null;
  og_image_url?: string | null;
  category?: "professional" | "journal" | string | null;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export default function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const [slug, setSlug]       = useState<string | null>(null);
  const [post, setPost]       = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Unwrap params promise (Next.js 16)
  useEffect(() => {
    params.then(p => setSlug(p.slug));
  }, [params]);

  useEffect(() => {
    if (!slug) return;
    async function fetchPost() {
      try {
        let { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .eq('slug', slug)
          .eq('category', 'journal')
          .single();

        if (error && error.message?.toLowerCase().includes("category")) {
          const fallback = await supabase
            .from('blog_posts')
            .select('*')
            .eq('slug', slug)
            .single();
          data = fallback.data;
          error = fallback.error;
        }

        if (error || !data) { setNotFound(true); return; }
        setPost(data);
      } catch (err) {
        console.error(err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [slug]);

  // Close lightbox on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const allImages = post
    ? [post.cover_image_url, ...(post.extra_image_urls ?? [])].filter(Boolean) as string[]
    : [];

  const STYLES = `
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
    @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
    @keyframes blobFloat{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(12px,-8px)scale(1.02);}66%{transform:translate(-8px,10px)scale(0.98);}}
    @keyframes pulseRing{0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:0.15;transform:scale(1.25);}}
    @keyframes spinSlow{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
    .afu1{animation:fadeUp 0.5s 0.05s ease both;}
    .afu2{animation:fadeUp 0.5s 0.12s ease both;}
    .blob1{animation:blobFloat 10s ease-in-out infinite;}
    .pdot{animation:pulseRing 2.5s ease-in-out infinite;}
    .spin{animation:spinSlow 12s linear infinite;}
    .img-card{transition:transform 0.22s ease,box-shadow 0.22s ease;cursor:zoom-in;}
    .img-card:hover{transform:translateY(-3px);box-shadow:0 16px 40px ${C.p1_13};}
    .btn-lift{transition:transform 0.18s ease,box-shadow 0.18s ease;}
    .btn-lift:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,0.12);}
    .lightbox-bg{position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:999;display:flex;align-items:center;justify-content:center;padding:20px;}
    .lightbox-img{max-width:100%;max-height:90vh;object-fit:contain;border-radius:12px;}
  `;

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: C.page }}>
      <style>{STYLES}</style>

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="lightbox-bg" onClick={() => setLightbox(null)}>
          <img src={lightbox} className="lightbox-img" alt="Full size" onClick={e => e.stopPropagation()} />
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-5 right-5 w-10 h-10 rounded-full bg-white/10 text-white font-bold text-lg flex items-center justify-center hover:bg-white/20 transition-colors"
          >✕</button>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div className="max-w-3xl mx-auto px-6 py-20 space-y-4">
          <div className="rounded-2xl animate-pulse h-10 w-2/3" style={{ background: `linear-gradient(135deg,${C.p1_08},${C.p2_06})` }} />
          <div className="rounded-2xl animate-pulse h-72 w-full" style={{ background: `linear-gradient(135deg,${C.p1_06},${C.p2_06})` }} />
          <div className="space-y-2 pt-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-lg animate-pulse h-4" style={{ background: C.p1_06, width: i % 3 === 2 ? "70%" : "100%" }} />
            ))}
          </div>
        </div>
      )}

      {/* NOT FOUND */}
      {!loading && notFound && (
        <div className="max-w-3xl mx-auto px-6 py-32 text-center">
          <p className="text-6xl mb-4">📷</p>
          <h1 className="text-2xl font-black text-slate-900 mb-2">Post not found</h1>
          <p className="text-slate-500 mb-6 text-sm">This shoot story doesn't exist or may have moved.</p>
          <Link href="/journal" className="btn-lift inline-block px-6 py-3 rounded-full font-bold text-sm text-white" style={{ background: C.grad12 }}>← Back to all posts</Link>
        </div>
      )}

      {/* POST */}
      {!loading && post && (
        <>
          {/* ── COVER ────────────────────────────────────────────── */}
          {post.cover_image_url ? (
            <section className="relative w-full overflow-hidden border-b border-black/[0.06]">
              {/* Full-bleed image */}
              <div
                className="relative w-full cursor-zoom-in"
                style={{ height: "clamp(280px, 55vh, 600px)" }}
                onClick={() => setLightbox(post.cover_image_url!)}
              >
                <img
                  src={post.cover_image_url}
                  alt={post.title}
                  className="w-full h-full object-cover"
                />
                {/* Gradient scrim */}
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)" }}
                />
                {/* Title over image */}
                <div className="absolute bottom-0 left-0 right-0 px-6 pb-8 pt-16">
                  <div className="max-w-3xl mx-auto">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-white/20 text-white backdrop-blur-sm">
                        {formatDate(post.published_at)}
                      </span>
                      <span className="text-xs text-white/70 font-medium">{formatTime(post.published_at)}</span>
                    </div>
                    <h1 className="afu1 text-3xl sm:text-4xl md:text-5xl font-black text-white leading-tight tracking-tight">
                      {post.title}
                    </h1>
                  </div>
                </div>
                {/* Zoom hint */}
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full text-xs font-bold text-white bg-black/30 backdrop-blur-sm">
                  Click to enlarge
                </div>
              </div>
            </section>
          ) : (
            /* No cover — hero with gradient */
            <section className="relative overflow-hidden px-6 pt-16 pb-12 border-b" style={{ borderColor: C.borderSubtle }}>
              <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.04)} />
              <div className="absolute inset-0 pointer-events-none" style={C.vignette} />
              <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{ borderTop: `2px solid ${C.p1_30}`, borderLeft: `2px solid ${C.p1_30}` }} />
              <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{ borderTop: `2px solid ${C.p2_18}`, borderRight: `2px solid ${C.p2_18}` }} />
              <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{ background: C.grad12 }} />
              <div className="blob1 absolute rounded-full pointer-events-none" style={{ width: 400, height: 400, top: -100, left: -80, background: C.blob1 }} />
              <div className="relative z-10 max-w-3xl mx-auto">
                <div className="flex items-center gap-2 mb-5 flex-wrap">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: C.p1_08, color: C.p1 }}>
                    {formatDate(post.published_at)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">{formatTime(post.published_at)}</span>
                </div>
                <h1 className="afu1 text-4xl sm:text-5xl font-black tracking-tight leading-tight text-slate-900">
                  {post.title}
                </h1>
              </div>
            </section>
          )}

          {/* ── BODY ─────────────────────────────────────────────── */}
          <article className="px-6 py-12">
            <div className="max-w-3xl mx-auto">

              {/* Byline (only shown when cover exists — otherwise date is in hero) */}
              {post.cover_image_url && (
                <div className="mb-10 pb-8 border-b border-black/[0.06]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                      style={{ background: C.grad12 }}
                    >CS</div>
                    <span className="text-sm font-bold text-slate-700">Chris Solorzano</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-sm text-slate-500">{formatDate(post.published_at)}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-sm text-slate-500">{formatTime(post.published_at)}</span>
                    {(post.extra_image_urls?.length ?? 0) > 0 && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: C.p2_08, color: C.p2 }}>
                          {(post.extra_image_urls?.length ?? 0) + 1} photos
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Body — split by blank lines into paragraphs */}
              <div className="space-y-5">
                {post.body.split(/\n\n+/).filter(p => p.trim()).map((para, i) => (
                  <p key={i} className="text-slate-700 leading-relaxed" style={{ fontSize: "1.05rem" }}>
                    {para.trim()}
                  </p>
                ))}
              </div>

              {/* ── EXTRA PHOTOS ─────────────────────────────────── */}
              {post.extra_image_urls && post.extra_image_urls.length > 0 && (
                <div className="mt-14">
                  {/* Section divider */}
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-[2px] w-8 rounded" style={{ background: C.grad12 }} />
                    <p className="text-xs font-black uppercase tracking-widest" style={{ color: C.p1 }}>
                      Photos from this session
                    </p>
                    <div className="flex-1 h-px bg-black/[0.06]" />
                  </div>

                  {/* Grid — adapts to photo count */}
                  <div className={`grid gap-3 ${
                    post.extra_image_urls.length === 1
                      ? "grid-cols-1"
                      : post.extra_image_urls.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3"
                  }`}>
                    {post.extra_image_urls.map((url, i) => {
                      const isFirst = i === 0 && post.extra_image_urls.length > 3;
                      return (
                        <div
                          key={i}
                          className={`img-card rounded-2xl overflow-hidden ${
                            post.extra_image_urls.length === 1
                              ? "aspect-video"
                              : isFirst
                              ? "col-span-2 sm:col-span-1 aspect-square"
                              : "aspect-square"
                          }`}
                          style={{ border: `1px solid ${C.borderWarm}`, boxShadow: C.shadowWarmSm }}
                          onClick={() => setLightbox(url)}
                        >
                          <img
                            src={url}
                            alt={`Photo ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-400 font-medium text-center mt-3">Tap any photo to enlarge</p>
                </div>
              )}

              {/* ── BOTTOM NAV ───────────────────────────────────── */}
              <div className="mt-14 pt-8 border-t flex items-center justify-between flex-wrap gap-4" style={{ borderColor: C.borderSubtle }}>
                <Link href="/journal" className="btn-lift flex items-center gap-2 text-sm font-bold" style={{ color: C.p1 }}>
                  ← All posts
                </Link>
                <a
                  href="https://www.soloxsnaps.com/contact/"
                  className="btn-lift px-5 py-2.5 rounded-full font-bold text-sm text-white"
                  style={{ background: C.grad12 }}
                >
                  Book your shoot →
                </a>
              </div>
            </div>
          </article>
        </>
      )}

      <footer className="border-t py-8 px-6" style={{ borderColor: C.borderSubtle, background: C.surfaceStrong }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={C.text}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}
