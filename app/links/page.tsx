"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from "react";
import { C } from "@/lib/colors";

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE CONFIG — edit these values to update your profile
// ─────────────────────────────────────────────────────────────────────────────
const PROFILE = {
  name:      "@soloxsnaps",
  bio:       "Chris Solo · Bay Area Portrait Photographer",
  avatar:    "", // paste Supabase Storage URL here after uploading your photo
  instagram: "https://www.instagram.com/soloxsnaps",
};

// ─────────────────────────────────────────────────────────────────────────────
// DRAFT LINKS — shown until Supabase table has data
// ─────────────────────────────────────────────────────────────────────────────
type Link = {
  id: number;
  label: string;
  url: string;
  emoji: string | null;
  description: string | null;
  active: boolean;
  order: number;
};

const DRAFT_LINKS: Link[] = [
  { id:1, label:"Book a Photoshoot",    url:"https://soloxsnaps.com/contact",      emoji:"📸", description:"Submit a contact form",               active:true, order:1 },
  { id:2, label:"Graduation Pricing",   url:"https://soloxsnaps.com/gradpricing",  emoji:"💰", description:"Packages and rates for grad sessions", active:true, order:2 },
  { id:3, label:"Check My Availability",url:"https://chrissolo.dev/availability",  emoji:"📅", description:"See what dates I have open",           active:true, order:3 },
  { id:4, label:"Graduation Guide",     url:"https://chrissolo.dev/grad-guide",    emoji:"🎓", description:"Poses, outfits, and prep tips",        active:true, order:4 },
  { id:5, label:"Website",              url:"https://soloxsnaps.com",              emoji:"🌐", description:"View more of my work",                 active:true, order:5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Rotating pastel gradient per card — cycles through these
// ─────────────────────────────────────────────────────────────────────────────
const CARD_BG = [
  { bg: `linear-gradient(135deg, ${C.p1_10}, ${C.p2_08})`, border: C.p1_20 },
  { bg: `linear-gradient(135deg, ${C.p2_08}, ${C.p3_10})`, border: C.p2_18 },
  { bg: `linear-gradient(135deg, ${C.p3_08}, ${C.p1_08})`, border: C.p3_15 },
  { bg: `linear-gradient(135deg, ${C.p1_08}, ${C.p2_10})`, border: C.p1_15 },
  { bg: `linear-gradient(135deg, ${C.p2_10}, ${C.p3_08})`, border: C.p2_20 },
];

const MARQUEE_ITEMS = [
  "Bay Area Photographer","Grad Shoots","Portrait Sessions",
  "Golden Hour","@soloxsnaps","Book Now","Bay Area Photographer",
  "Grad Shoots","Portrait Sessions","Golden Hour","@soloxsnaps","Book Now",
];

export default function LinksPage() {
  const [links, setLinks]   = useState<Link[]>(DRAFT_LINKS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLinks() {
      try {
        const { data } = await supabase
          .from('links')
          .select('*')
          .eq('active', true)
          .order('order', { ascending: true });
        if (data && data.length > 0) setLinks(data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    fetchLinks();
    
    // Track page view
    trackPageView();
  }, []);

  async function trackPageView() {
    try {
      await supabase.from('link_views').insert({});
    } catch (err) {
      console.error('Failed to track page view:', err);
    }
  }

  async function trackClick(linkId: number, url: string, e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    try {
      await supabase.from('link_clicks').insert({ link_id: linkId });
    } catch (err) {
      console.error('Failed to track click:', err);
    }
    // Use location.href for better mobile browser compatibility (Instagram, Facebook, etc.)
    window.location.href = url;
  }

  return (
    <div className="min-h-screen font-sans" style={{ background: "#f7f6ff" }}>
      <style>{`
        @keyframes blobFloat  { 0%,100%{transform:translate(0,0)scale(1);}   40%{transform:translate(16px,-12px)scale(1.03);}   70%{transform:translate(-10px,10px)scale(0.97);} }
        @keyframes blobFloat2 { 0%,100%{transform:translate(0,0)scale(1);}   35%{transform:translate(-14px,10px)scale(0.96);}   65%{transform:translate(12px,-8px)scale(1.04);} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(20px);}  to{opacity:1;transform:translateY(0);} }
        @keyframes pulseRing  { 0%,100%{opacity:0.6;transform:scale(1);}     50%{opacity:0.15;transform:scale(1.4);} }
        @keyframes marquee    { from{transform:translateX(0);}               to{transform:translateX(-50%);} }
        @keyframes spinSlow   { from{transform:rotate(0deg);}                to{transform:rotate(360deg);} }

        .blob1 { animation: blobFloat  11s ease-in-out infinite; }
        .blob2 { animation: blobFloat2 14s ease-in-out infinite; }
        .pdot  { animation: pulseRing  2.8s ease-in-out infinite; }
        .spin  { animation: spinSlow   18s linear infinite; }
        .mtrack{ animation: marquee    26s linear infinite; }

        .link-card {
          transition: transform 0.18s ease, box-shadow 0.18s ease;
          animation: fadeUp 0.45s ease both;
        }
        .link-card:hover  { transform: translateY(-4px); box-shadow: 0 14px 36px rgba(0,0,0,0.09); }
        .link-card:active { transform: scale(0.98); }

        .avatar-glow { animation: pulseRing 3.5s ease-in-out infinite; }
      `}</style>

      {/* ── SOFT BACKGROUND ─────────────────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="blob1 absolute rounded-full" style={{ width:700, height:700, top:-280, left:-200, background:`radial-gradient(circle, ${C.p1_08}, transparent 62%)` }}/>
        <div className="blob2 absolute rounded-full" style={{ width:600, height:600, top:-220, right:-200, background:`radial-gradient(circle, ${C.p2_06}, transparent 62%)` }}/>
        <div className="blob1 absolute rounded-full" style={{ width:500, height:500, bottom:-180, left:"20%", background:`radial-gradient(circle, ${C.p3_08}, transparent 62%)` }}/>
        {/* Spinning ring - well below content */}
        <div className="spin absolute opacity-[0.07]" style={{ width:360, height:360, bottom:-120, right:-80 }}>
          <svg width="360" height="360" viewBox="0 0 360 360">
            <circle cx="180" cy="180" r="160" stroke={C.p1} strokeWidth="1.2" fill="none" strokeDasharray="10 7"/>
          </svg>
        </div>
        {/* Pulse dots */}
        <div className="pdot absolute w-2.5 h-2.5 rounded-full" style={{ top:100, right:24, background:C.grad12 }}/>
        <div className="pdot absolute w-2 h-2 rounded-full" style={{ top:260, left:18, background:C.grad23, animationDelay:"1s" }}/>
        <div className="pdot absolute w-2 h-2 rounded-full" style={{ bottom:200, right:18, background:C.p3, animationDelay:"0.5s" }}/>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center px-5 pt-16 pb-24 max-w-md mx-auto">

        {/* AVATAR */}
        <div className="mb-6" style={{ animation:"fadeUp 0.4s 0s ease both" }}>
          <div className="relative">
            <div className="avatar-glow absolute -inset-2 rounded-full" style={{ background:C.grad, opacity:0.25, filter:"blur(8px)" }}/>
            <div
              className="relative rounded-full overflow-hidden border-[3px] border-white shadow-xl"
              style={{ width:120, height:120, background:`linear-gradient(135deg,${C.p1_12},${C.p2_10},${C.p3_08})` }}
            >
              {PROFILE.avatar
                ? <img src={PROFILE.avatar} alt={PROFILE.name} className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-5xl">📷</div>
              }
            </div>
          </div>
        </div>

        {/* NAME + BIO */}
        <div className="text-center mb-10" style={{ animation:"fadeUp 0.4s 0.07s ease both" }}>
          <h1 className="text-2xl font-black tracking-tight mb-1" style={C.text}>{PROFILE.name}</h1>
          <p className="text-sm font-medium leading-snug" style={{ color:"#64748b" }}>{PROFILE.bio}</p>
          <a
            href={PROFILE.instagram}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95"
            style={{ background:"white", border:`1.5px solid ${C.p1_20}`, color:C.p1, boxShadow:`0 2px 12px ${C.p1_10}` }}
          >
            📷 Follow on Instagram
          </a>
        </div>

        {/* LINKS */}
        <div className="w-full space-y-4">
          {loading
            ? [...Array(5)].map((_,i) => (
                <div key={i} className="w-full rounded-2xl animate-pulse" style={{ height:76, background:`linear-gradient(135deg,${C.p1_08},${C.p2_06})` }}/>
              ))
            : links.map((link, i) => {
                const style = CARD_BG[i % CARD_BG.length];
                return (
                  <a
                    key={link.id}
                    href={link.url}
                    target="_blank" rel="noopener noreferrer"
                    onClick={(e) => trackClick(link.id, link.url, e)}
                    className="link-card flex items-center gap-4 w-full rounded-2xl px-5 py-5"
                    style={{ animationDelay:`${0.1 + i * 0.06}s`, background:style.bg, border:`1.5px solid ${style.border}` }}
                  >
                    {/* Emoji icon */}
                    <div
                      className="rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ width:52, height:52, minWidth:52, minHeight:52 }}
                    >
                      {link.emoji ?? "🔗"}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-slate-900 text-base leading-tight">{link.label}</p>
                      {link.description && (
                        <p className="text-sm text-slate-500 font-medium mt-0.5 leading-tight truncate">{link.description}</p>
                      )}
                    </div>

                    {/* Arrow */}
                    <div
                      className="rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ width:34, height:34, minWidth:34, background:"white", boxShadow:`0 2px 8px ${style.border}`, color:C.p1 }}
                    >
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                        <path d="M2.5 6.5h8M6.5 2.5l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </a>
                );
              })
          }
        </div>

        {/* MARQUEE - 240px spacing */}
        <div
          className="w-full overflow-hidden rounded-2xl py-3"
          style={{ marginTop: "12px", background:"white", border:`1px solid ${C.p1_12}`, boxShadow:`0 2px 16px ${C.p1_08}` }}
        >
          <div className="mtrack flex whitespace-nowrap w-max" style={{ gap:"48px" }}>
            {MARQUEE_ITEMS.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-3 text-[11px] font-bold tracking-[0.13em] uppercase" style={{ color:"#94a3b8" }}>
                {item}
                <span className="rounded-full inline-block flex-shrink-0" style={{ width:5, height:5, background:C.grad12 }}/>
              </span>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-8 text-center">
          <a href="/" className="text-xs font-semibold" style={{ color:"#94a3b8", textDecoration:"none" }}>
            <span style={C.text12}>Chris Solorzano</span>
            <span style={{ color:"#94a3b8" }}> · Bay Area Photography</span>
          </a>
        </div>
      </div>
    </div>
  );
}