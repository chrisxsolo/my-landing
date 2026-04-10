"use client";
import { supabase } from '@/lib/supabase'
import Link from "next/link";
import { useEffect, useState } from "react";
import { GUIDE_STYLES } from "@/lib/guidestyles";
import { C } from "@/lib/colors";
import Nav from "@/app/components/Nav";

export const dynamic = 'force-dynamic'

type BlogPost = {
  id: number;
  title: string;
  body: string;
  published_at: string;
  slug: string;
  cover_image_url: string | null;
  extra_image_urls: string[];
};

const MARQUEE = ["Shoot Stories","Behind the Scenes","Bay Area","Real Sessions","What Worked","Golden Hour","Grad Season","Shoot Stories","Behind the Scenes","Bay Area","Real Sessions","What Worked","Golden Hour","Grad Season"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function excerpt(body: string, max = 120) {
  return body.length > max ? body.slice(0, max).trim() + "…" : body;
}

// Draft posts shown until Supabase has data
const DRAFT_POSTS: BlogPost[] = [
  {
    id: 1,
    title: "First post coming soon",
    body: "This is where your shoot stories will live. Add posts from the admin dashboard and they'll show up here automatically.",
    published_at: new Date().toISOString(),
    slug: "first-post",
    cover_image_url: null,
    extra_image_urls: [],
  },
];

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>(DRAFT_POSTS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPosts() {
      try {
        const { data, error } = await supabase
          .from('blog_posts')
          .select('*')
          .order('published_at', { ascending: false });
        if (error) console.error(error);
        if (data && data.length > 0) setPosts(data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    fetchPosts();
  }, []);

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: C.page }}>
      <style>{GUIDE_STYLES}</style>

      <Nav />

      {/* HERO */}
      <section className="relative overflow-hidden px-6 pt-16 pb-14 border-b" style={{ borderColor: C.borderSubtle }}>
        <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.04)} />
        <div className="absolute inset-0 pointer-events-none" style={C.vignette} />
        <div className="absolute top-5 left-5 w-5 h-5 pointer-events-none" style={{ borderTop: `2px solid ${C.p1_30}`, borderLeft: `2px solid ${C.p1_30}` }} />
        <div className="absolute top-5 right-5 w-5 h-5 pointer-events-none" style={{ borderTop: `2px solid ${C.p2_18}`, borderRight: `2px solid ${C.p2_18}` }} />
        <div className="absolute bottom-5 left-5 w-5 h-5 pointer-events-none" style={{ borderBottom: `2px solid ${C.p2_18}`, borderLeft: `2px solid ${C.p2_18}` }} />
        <div className="absolute bottom-5 right-5 w-5 h-5 pointer-events-none" style={{ borderBottom: `2px solid ${C.p3_15}`, borderRight: `2px solid ${C.p3_15}` }} />
        <div className="pdot absolute top-7 right-7 w-2 h-2 rounded-full pointer-events-none" style={{ background: C.grad12 }} />
        <div className="pdot absolute bottom-8 left-8 w-1.5 h-1.5 rounded-full pointer-events-none" style={{ background: C.grad23, animationDelay: "1s" }} />
        <div className="blob1 absolute rounded-full pointer-events-none" style={{ width: 520, height: 520, top: -130, left: -110, background: C.blob1 }} />
        <div className="blob2 absolute rounded-full pointer-events-none" style={{ width: 380, height: 380, top: -70, right: -90, background: C.blob2 }} />

        {/* Squiggle */}
        <div className="absolute right-8 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block" style={{ opacity: 0.4, animation: "fadeIn 1s 0.6s ease both" }}>
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <defs><linearGradient id="bsg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.p1} /><stop offset="50%" stopColor={C.p2} /><stop offset="100%" stopColor={C.p3} /></linearGradient></defs>
            <path className="sqp1" d="M50 6 C74 20,26 42,50 66 C74 90,26 112,50 136 C74 160,26 178,50 196" stroke="url(#bsg)" strokeWidth="1.5" fill="none" strokeLinecap="round" />
            <path className="sqp2" d="M30 20 C54 34,6 56,30 80 C54 104,6 126,30 150 C54 174,6 190,30 198" stroke={C.p2} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.3" />
            <circle cx="50" cy="6"   r="2.5" fill={C.p1} opacity="0.8" />
            <circle cx="50" cy="66"  r="2.5" fill={C.p2} opacity="0.8" />
            <circle cx="50" cy="136" r="2.5" fill={C.p3} opacity="0.8" />
            <circle cx="50" cy="196" r="2.5" fill={C.p1} opacity="0.8" />
          </svg>
        </div>
        <div className="spin absolute -bottom-10 -left-10 pointer-events-none hidden sm:block" style={{ opacity: 0.08 }}>
          <svg width="140" height="140" viewBox="0 0 140 140"><circle cx="70" cy="70" r="60" stroke={C.p1} strokeWidth="1" fill="none" strokeDasharray="8 6" /></svg>
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="afu1 inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-5" style={{ background: C.surfaceStrong, border: `1px solid ${C.borderSubtle}`, boxShadow: C.shadowWarmSm }}>
            <div className="pdot w-1.5 h-1.5 rounded-full" style={{ background: C.grad12 }} />
            <p className="text-xs font-bold tracking-[0.12em] uppercase" style={{ color: C.p1 }}>Shoot Stories</p>
          </div>
          <h1 className="afu2 text-5xl sm:text-6xl font-black tracking-tight leading-tight text-slate-900 mb-2">
            Behind the
          </h1>
          <p className="afu3 text-5xl sm:text-6xl font-light italic tracking-tight text-slate-900 mb-6">
            <span style={C.text}>lens.</span>
            <span className="cblink inline-block w-[3px] h-[44px] sm:h-[52px] ml-1.5 rounded-sm align-middle" style={{ background: C.grad12 }} />
          </p>
          <p className="afu4 text-lg text-slate-600 font-light leading-relaxed max-w-lg">
            Real sessions, honest reflections. What worked, what didn't, and what made each shoot worth doing.
          </p>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-b py-3" style={{ borderColor: C.borderSubtle, background: C.surfaceStrong }}>
        <div className="mtrack flex gap-12 whitespace-nowrap w-max">
          {MARQUEE.map((item, i) => (
            <span key={i} className="flex items-center gap-3 text-[11px] font-bold tracking-[0.14em] uppercase text-slate-300">
              {item}<span className="w-[4px] h-[4px] rounded-full flex-shrink-0" style={{ background: C.grad12 }} />
            </span>
          ))}
        </div>
      </div>

      {/* POSTS */}
      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="rounded-2xl animate-pulse" style={{ height: 280, background: `linear-gradient(135deg,${C.p1_08},${C.p2_06})` }} />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-4xl mb-4">✍️</p>
              <p className="text-slate-700 font-bold text-lg">No posts yet</p>
              <p className="text-slate-400 text-sm mt-1">Add your first shoot story from the admin dashboard.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {posts.map((post, i) => (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="card-lift group block rounded-2xl overflow-hidden"
                  style={{ border: `1px solid ${C.borderWarm}`, background: C.surfaceStrong, boxShadow: C.shadowWarmSm }}
                >
                  {/* Accent bar */}
                  <div className="h-[3px]" style={{ background: i % 3 === 0 ? C.grad12 : i % 3 === 1 ? C.grad23 : C.grad }} />

                  {/* Cover image */}
                  {post.cover_image_url && (
                    <div className="w-full h-64 overflow-hidden">
                      <img
                        src={post.cover_image_url}
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                  )}

                  {/* No cover — placeholder with grid */}
                  {!post.cover_image_url && (
                    <div className="w-full h-40 flex items-center justify-center relative overflow-hidden" style={{ background: `linear-gradient(135deg,${C.p1_06},${C.p2_06})` }}>
                      <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.06)} />
                      <span className="text-5xl relative z-10">📷</span>
                    </div>
                  )}

                  <div className="p-6">
                    {/* Date + time */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: C.p1_08, color: C.p1 }}>
                        {formatDate(post.published_at)}
                      </span>
                      <span className="text-xs text-slate-400 font-medium">{formatTime(post.published_at)}</span>
                      {post.extra_image_urls?.length > 0 && (
                        <span className="text-xs font-bold px-2 py-1 rounded-full" style={{ background: C.p2_08, color: C.p2 }}>
                          +{post.extra_image_urls.length} photo{post.extra_image_urls.length > 1 ? "s" : ""}
                        </span>
                      )}
                    </div>

                    <h2 className="text-xl font-black text-slate-900 mb-2 leading-tight group-hover:text-violet-700 transition-colors">
                      {post.title}
                    </h2>
                    <p className="text-slate-500 text-sm leading-relaxed">{excerpt(post.body)}</p>

                    <div className="mt-4 flex items-center gap-1.5 text-xs font-bold" style={{ color: C.p1 }}>
                      Read more <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <div className="px-6 pb-20">
        <div className="max-w-3xl mx-auto rounded-2xl p-10 text-center relative overflow-hidden" style={{ background: C.grad }}>
          <div className="absolute inset-0 pointer-events-none" style={C.ctaGridLg} />
          <div className="absolute top-4 right-6 opacity-15 pointer-events-none">
            <svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
          </div>
          <h3 className="relative text-3xl font-black text-white mb-2 tracking-tight">Want to be in the next one?</h3>
          <p className="relative text-white/75 mb-7 text-sm font-light">Book a shoot and let's make something worth writing about.</p>
          <a href="https://www.soloxsnaps.com/contact/" className="btn-lift relative inline-block px-8 py-3 rounded-full bg-white font-bold text-sm" style={{ color: C.p1 }}>Book your shoot →</a>
        </div>
      </div>

      <footer className="border-t py-8 px-6" style={{ borderColor: C.borderSubtle, background: C.surfaceStrong }}>
        <div className="max-w-3xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <span className="font-black text-lg" style={C.text}>Chris.</span>
          <span className="text-sm text-slate-400">© 2026 · Bay Area Grad Photography</span>
        </div>
      </footer>
    </div>
  );
}
