"use client";
import { supabase } from '@/lib/supabase'
import { useEffect, useState } from "react";
import { C } from "@/lib/colors";

export const dynamic = 'force-dynamic'

type Link = {
  id: number;
  label: string;
  url: string;
  emoji: string | null;
  description: string | null;
  active: boolean;
  order: number;
};

// ── PROFILE CONFIG ─────────────────────────────────────────────────────────
// Edit these to update your profile without touching the rest of the code
const PROFILE = {
  name:     "@soloxsnaps",
  bio:      "Chris Solo · Bay Area Portrait Photographer",
  avatar:   "", // paste a Supabase Storage URL here once you upload a photo
  instagram:"https://www.instagram.com/soloxsnaps",
};

// ── DRAFT LINKS (shown until Supabase has data) ────────────────────────────
const DRAFT_LINKS: Link[] = [
  { id:1, label:"Graduation Pricing",  url:"https://soloxsnaps.com/gradpricing", emoji:"💰", description:"Packages and rates for grad sessions", active:true, order:1 },
  { id:2, label:"Check My Availability",url:"https://my-landing-ruddy.vercel.app/availability", emoji:"📅", description:"See what dates I have open", active:true, order:2 },
  { id:3, label:"Graduation Guide",     url:"https://my-landing-ruddy.vercel.app/grad-guide", emoji:"🎓", description:"Poses, outfits, and prep tips", active:true, order:3 },
  { id:4, label:"Book a Shoot!",        url:"https://soloxsnaps.com/contact", emoji:"📸", description:null, active:true, order:4 },
  { id:5, label:"Portfolio",            url:"https://soloxsnaps.com/portfolio", emoji:"🖼️", description:null, active:true, order:5 },
  { id:6, label:"Website",              url:"https://soloxsnaps.com", emoji:"🌐", description:null, active:true, order:6 },
];

const CARD_GRADIENTS = [
  `linear-gradient(135deg,${C.p1_10},${C.p2_08})`,
  `linear-gradient(135deg,${C.p2_08},${C.p3_08})`,
  `linear-gradient(135deg,${C.p3_08},${C.p1_10})`,
  `linear-gradient(135deg,${C.p1_08},${C.p3_08})`,
  `linear-gradient(135deg,${C.p2_10},${C.p1_08})`,
  `linear-gradient(135deg,${C.p3_10},${C.p2_08})`,
];

const CARD_BORDERS = [C.p1_20, C.p2_18, C.p3_18, C.p1_18, C.p2_20, C.p3_15];

const STYLES = `
  @keyframes fadeUp{from{opacity:0;transform:translateY(18px);}to{opacity:1;transform:translateY(0);}}
  @keyframes fadeIn{from{opacity:0;}to{opacity:1;}}
  @keyframes blobFloat{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(12px,-8px)scale(1.02);}66%{transform:translate(-8px,10px)scale(0.98);}}
  @keyframes blobFloat2{0%,100%{transform:translate(0,0)scale(1);}33%{transform:translate(-10px,8px)scale(0.97);}66%{transform:translate(10px,-6px)scale(1.03);}}
  @keyframes pulseRing{0%,100%{opacity:0.5;transform:scale(1);}50%{opacity:0.15;transform:scale(1.3);}}
  @keyframes spinSlow{from{transform:rotate(0deg);}to{transform:rotate(360deg);}}
  @keyframes marquee{from{transform:translateX(0);}to{transform:translateX(-50%);}}
  .blob1{animation:blobFloat 10s ease-in-out infinite;}
  .blob2{animation:blobFloat2 12s ease-in-out infinite;}
  .pdot{animation:pulseRing 2.5s ease-in-out infinite;}
  .spin{animation:spinSlow 14s linear infinite;}
  .mtrack{animation:marquee 28s linear infinite;}
  .link-card{
    transition:transform 0.2s ease,box-shadow 0.2s ease,border-color 0.2s ease;
    animation:fadeUp 0.5s ease both;
  }
  .link-card:hover{transform:translateY(-3px) scale(1.01);box-shadow:0 12px 32px rgba(0,0,0,0.1);}
  .link-card:active{transform:scale(0.98);}
  .avatar-ring{animation:pulseRing 3s ease-in-out infinite;}
`;

export default function LinksPage() {
  const [links, setLinks] = useState<Link[]>(DRAFT_LINKS);
  const [loading, setLoading] = useState(true);
  const [pressed, setPressed] = useState<number|null>(null);

  useEffect(() => {
    async function fetchLinks() {
      try {
        const { data, error } = await supabase
          .from('links')
          .select('*')
          .eq('active', true)
          .order('order', { ascending: true });
        if (error) console.error(error);
        if (data && data.length > 0) setLinks(data);
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    }
    fetchLinks();
  }, []);

  return (
    <div className="min-h-screen font-sans overflow-x-hidden" style={{ background: "#ffffff" }}>
      <style>{STYLES}</style>

      {/* BG BLOBS */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
        <div className="blob1 absolute rounded-full" style={{ width:700,height:700,top:-250,left:-200,background:`radial-gradient(circle,${C.p1_08},transparent 60%)` }}/>
        <div className="blob2 absolute rounded-full" style={{ width:600,height:600,top:-200,right:-200,background:`radial-gradient(circle,${C.p2_06},transparent 60%)` }}/>
        <div className="blob1 absolute rounded-full" style={{ width:500,height:500,bottom:-150,left:"25%",background:`radial-gradient(circle,${C.p3_06},transparent 60%)` }}/>
        {/* Spin ring */}
        <div className="spin absolute opacity-[0.06]" style={{ width:300,height:300,bottom:-60,right:-60 }}>
          <svg width="300" height="300" viewBox="0 0 300 300"><circle cx="150" cy="150" r="130" stroke={C.p1} strokeWidth="1" fill="none" strokeDasharray="8 6"/></svg>
        </div>
        {/* Pulse dots */}
        <div className="pdot absolute w-2 h-2 rounded-full" style={{ top:80,right:20,background:C.grad12 }}/>
        <div className="pdot absolute w-1.5 h-1.5 rounded-full" style={{ top:200,left:16,background:C.grad23,animationDelay:"1.2s" }}/>
        <div className="pdot absolute w-2 h-2 rounded-full" style={{ bottom:120,right:16,background:C.grad321,animationDelay:"0.6s" }}/>
      </div>

      {/* CONTENT */}
      <div className="relative z-10 flex flex-col items-center px-5 pt-14 pb-20 max-w-lg mx-auto">

        {/* AVATAR */}
        <div className="mb-5" style={{ animation:"fadeUp 0.5s 0s ease both" }}>
          <div className="relative">
            {/* Pulsing gradient ring */}
            <div className="avatar-ring absolute -inset-1 rounded-full" style={{ background:C.grad, opacity:0.4, filter:"blur(4px)" }}/>
            <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-white shadow-lg" style={{ background:`linear-gradient(135deg,${C.p1_15},${C.p2_10})` }}>
              {PROFILE.avatar ? (
                <img src={PROFILE.avatar} alt={PROFILE.name} className="w-full h-full object-cover"/>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl">📷</div>
              )}
            </div>
          </div>
        </div>

        {/* NAME + BIO */}
        <div className="text-center mb-8" style={{ animation:"fadeUp 0.5s 0.08s ease both" }}>
          <h1 className="text-2xl font-black tracking-tight mb-1" style={C.text}>{PROFILE.name}</h1>
          <p className="text-sm text-slate-500 font-medium leading-snug">{PROFILE.bio}</p>
          {/* Instagram pill */}
          <a href={PROFILE.instagram} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:scale-105"
            style={{ background:C.p1_08, border:`1px solid ${C.p1_20}`, color:C.p1 }}>
            <span>📷</span> Follow on Instagram
          </a>
        </div>

        {/* LINKS */}
        {loading ? (
          <div className="w-full space-y-4">
            {[...Array(5)].map((_,i) => (
              <div key={i} className="w-full h-16 rounded-2xl animate-pulse" style={{ background:`linear-gradient(135deg,${C.p1_08},${C.p2_06})` }}/>
            ))}
          </div>
        ) : (
          <div className="w-full space-y-4">
            {links.map((link, i) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="link-card block w-full rounded-[28px] px-6 py-6 relative overflow-hidden"
                style={{
                  animationDelay: `${0.1 + i * 0.07}s`,
                  background: CARD_GRADIENTS[i % CARD_GRADIENTS.length],
                  border: `1px solid ${CARD_BORDERS[i % CARD_BORDERS.length]}`,
                }}
                onMouseDown={() => setPressed(link.id)}
                onMouseUp={() => setPressed(null)}
                onTouchStart={() => setPressed(link.id)}
                onTouchEnd={() => setPressed(null)}
              >
                {/* Subtle grid overlay */}
                <div className="relative z-10 flex items-center gap-4">
                  {/* Emoji */}
                  {link.emoji && (
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-white shadow-sm flex-shrink-0" style={{minWidth:"56px",minHeight:"56px"}}>
                      {link.emoji}
                    </div>
                  )}
                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-900 text-lg leading-tight">{link.label}</p>
                    {link.description && (
                      <p className="text-sm text-slate-500 font-medium mt-1 leading-tight truncate">{link.description}</p>
                    )}
                  </div>
                  {/* Arrow */}
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/60 flex items-center justify-center shadow-sm" style={{ color:C.p1 }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6h8M6 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* MARQUEE TICKER */}
        <div className="w-full mt-14 overflow-hidden rounded-2xl py-3" style={{ background:`linear-gradient(135deg,${C.p1_06},${C.p2_04})`, border:`1px solid ${C.p1_12}` }}>
          <div className="mtrack flex gap-16 whitespace-nowrap w-max">
            {["Bay Area Photographer","Grad Shoots","Portrait Sessions","Golden Hour","@soloxsnaps","Book Now","Bay Area Photographer","Grad Shoots","Portrait Sessions","Golden Hour","@soloxsnaps","Book Now"].map((item,i)=>(
              <span key={i} className="flex items-center gap-2 text-[10px] font-bold tracking-[0.12em] uppercase text-slate-400">
                {item}<span className="w-[5px] h-[5px] rounded-full flex-shrink-0" style={{ background:C.grad12 }}/>
              </span>
            ))}
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-8 text-center">
          <a href="/" className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors" style={{ textDecoration:"none" }}>
            <span style={C.text12}>Chris Solorzano</span>
            <span className="text-slate-400"> · Bay Area Photography</span>
          </a>
        </div>
      </div>
    </div>
  );
}