import { C } from "@/lib/colors";
import TrackedLink from "./TrackedLink";
import LinksAnalytics from "./LinksAnalytics";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

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

const HERO = {
  eyebrow: "Bay Area graduation + portrait photos",
  headline: "Warm, natural photos that still feel like you.",
  subcopy:
    "Start with the link that fits where you're at right now — booking, pricing, availability, or prep.",
  trust: ["Bay Area based", "Calm posing help", "Fast replies"],
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
  { id:1, label:"Book a Photoshoot",     url:"https://www.soloxsnaps.com/contact/",      emoji:"📸", description:"Submit a contact form",               active:true, order:1 },
  { id:2, label:"Graduation Pricing",    url:"https://www.soloxsnaps.com/pricing/grads", emoji:"💰", description:"Packages and rates for grad sessions", active:true, order:2 },
  { id:3, label:"Check My Availability", url:"https://www.soloxsnaps.com/availability",  emoji:"📅", description:"See what dates I have open",           active:true, order:3 },
  { id:5, label:"Website",               url:"https://soloxsnaps.com",                   emoji:"🌐", description:"View more of my work",                 active:true, order:4 },
  { id:4, label:"Graduation Guide",      url:"https://www.soloxsnaps.com/grad-guide",    emoji:"🎓", description:"Poses, outfits, and prep",            active:true, order:5 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Rotating pastel gradient per card — cycles through these
// ─────────────────────────────────────────────────────────────────────────────
const CARD_BG = [
  { bg: `linear-gradient(135deg, rgba(255,244,239,0.98), ${C.p2_12}, ${C.p3_10})`, border: C.p2_18, accent: C.p2, eyebrow: "Start here" },
  { bg: `linear-gradient(135deg, rgba(255,250,242,0.98), ${C.p3_10}, ${C.p2_06})`, border: C.p3_15, accent: "#d97706", eyebrow: "Pricing" },
  { bg: `linear-gradient(135deg, rgba(255,249,243,0.98), ${C.p3_08}, ${C.p1_08})`, border: C.p3_15, accent: "#c0841a", eyebrow: "Calendar" },
  { bg: `linear-gradient(135deg, rgba(251,248,255,0.98), ${C.p1_10}, ${C.p2_08})`, border: C.p1_15, accent: C.p1, eyebrow: "Prep guide" },
  { bg: `linear-gradient(135deg, rgba(255,248,245,0.98), ${C.p2_08}, ${C.p3_08})`, border: C.p2_18, accent: C.p2, eyebrow: "Portfolio" },
];

const MARQUEE_ITEMS = [
  "Bay Area Photographer","Grad Shoots","Portrait Sessions",
  "Golden Hour","@soloxsnaps","Book Now","Bay Area Photographer",
  "Grad Shoots","Portrait Sessions","Golden Hour","@soloxsnaps","Book Now",
];

async function getLinks() {
  try {
    const supabase = createSupabaseServerClient();
    const { data } = await supabase
      .from("links")
      .select("*")
      .eq("active", true)
      .order("order", { ascending: true });

    if (data && data.length > 0) {
      return data as Link[];
    }
  } catch (error) {
    console.error("Failed to fetch links page data", error);
  }

  return DRAFT_LINKS;
}

export default async function LinksPage() {
  const links = await getLinks();

  return (
    <div className="min-h-screen font-sans" style={{ background: "#fffaf5" }}>
      <LinksAnalytics />
      <style>{`
        @keyframes blobFloat  { 0%,100%{transform:translate(0,0)scale(1);}   40%{transform:translate(16px,-12px)scale(1.03);}   70%{transform:translate(-10px,10px)scale(0.97);} }
        @keyframes blobFloat2 { 0%,100%{transform:translate(0,0)scale(1);}   35%{transform:translate(-14px,10px)scale(0.96);}   65%{transform:translate(12px,-8px)scale(1.04);} }
        @keyframes fadeUp     { from{opacity:0;transform:translateY(20px);}  to{opacity:1;transform:translateY(0);} }
        @keyframes pulseRing  { 0%,100%{opacity:0.6;transform:scale(1);}     50%{opacity:0.15;transform:scale(1.4);} }
        @keyframes marquee    { from{transform:translateX(0);}               to{transform:translateX(-50%);} }
        @keyframes spinSlow   { from{transform:rotate(0deg);}                to{transform:rotate(360deg);} }
        @keyframes shimmerWarm { 0%{transform:translateX(-120%);} 100%{transform:translateX(120%);} }

        .blob1 { animation: blobFloat  11s ease-in-out infinite; }
        .blob2 { animation: blobFloat2 14s ease-in-out infinite; }
        .pdot  { animation: pulseRing  2.8s ease-in-out infinite; }
        .spin  { animation: spinSlow   18s linear infinite; }
        .mtrack{ animation: marquee    26s linear infinite; }

        .link-card {
          position: relative;
          overflow: hidden;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          animation: fadeUp 0.45s ease both;
        }
        .link-card::after {
          content: "";
          position: absolute;
          inset: -20% auto -20% -40%;
          width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent);
          transform: skewX(-16deg);
          opacity: 0;
        }
        .link-card:hover::after { opacity: 1; animation: shimmerWarm 1.1s ease; }
        .link-card:hover  { transform: translateY(-4px); box-shadow: 0 18px 42px rgba(155, 91, 64, 0.10); }
        .link-card:active { transform: scale(0.98); }

        .avatar-glow { animation: pulseRing 3.5s ease-in-out infinite; }
      `}</style>

      {/* ── SOFT BACKGROUND ─────────────────────────────────────── */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div className="blob1 absolute rounded-full" style={{ width:720, height:720, top:-280, left:-220, background:`radial-gradient(circle, rgba(255,214,207,0.48), transparent 62%)` }}/>
        <div className="blob2 absolute rounded-full" style={{ width:620, height:620, top:-210, right:-220, background:`radial-gradient(circle, rgba(255,233,194,0.38), transparent 62%)` }}/>
        <div className="blob1 absolute rounded-full" style={{ width:540, height:540, bottom:-200, left:"18%", background:`radial-gradient(circle, rgba(243,223,255,0.34), transparent 62%)` }}/>
        {/* Spinning ring - well below content */}
        <div className="spin absolute opacity-[0.07]" style={{ width:360, height:360, bottom:-120, right:-80 }}>
          <svg width="360" height="360" viewBox="0 0 360 360">
            <circle cx="180" cy="180" r="160" stroke={C.p3} strokeWidth="1.2" fill="none" strokeDasharray="10 7"/>
          </svg>
        </div>
        {/* Pulse dots */}
        <div className="pdot absolute w-2.5 h-2.5 rounded-full" style={{ top:100, right:24, background:C.grad23 }}/>
        <div className="pdot absolute w-2 h-2 rounded-full" style={{ top:260, left:18, background:C.grad13, animationDelay:"1s" }}/>
        <div className="pdot absolute w-2 h-2 rounded-full" style={{ bottom:200, right:18, background:C.p3, animationDelay:"0.5s" }}/>
      </div>

      {/* ── CONTENT ─────────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center px-5 pt-10 pb-24 max-w-md mx-auto">
        <div
          className="mb-5 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em]"
          style={{
            color: C.p2,
            background: "rgba(255,255,255,0.82)",
            borderColor: C.p2_18,
            boxShadow: `0 10px 30px ${C.p2_08}`,
            animation: "fadeUp 0.4s 0s ease both",
          }}
        >
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: C.grad23 }} />
          {HERO.eyebrow}
        </div>

        {/* AVATAR */}
        <div className="mb-6" style={{ animation:"fadeUp 0.4s 0.04s ease both" }}>
          <div className="relative">
            <div className="avatar-glow absolute -inset-3 rounded-full" style={{ background:C.grad23, opacity:0.32, filter:"blur(12px)" }}/>
            <div
              className="relative rounded-full overflow-hidden border-[3px] border-white shadow-xl"
              style={{ width:122, height:122, background:`linear-gradient(135deg, rgba(255,247,240,0.98), ${C.p2_12}, ${C.p3_10})`, boxShadow:`0 18px 40px ${C.p2_10}` }}
            >
              {PROFILE.avatar
                ? <img src={PROFILE.avatar} alt={PROFILE.name} className="w-full h-full object-cover"/>
                : <div className="w-full h-full flex items-center justify-center text-5xl">📷</div>
              }
            </div>
          </div>
        </div>

        {/* NAME + BIO */}
        <div className="text-center mb-8" style={{ animation:"fadeUp 0.4s 0.08s ease both" }}>
          <h1 className="text-2xl font-black tracking-tight mb-1" style={C.text}>{PROFILE.name}</h1>
          <p className="text-sm font-medium leading-snug" style={{ color:"#64748b" }}>{PROFILE.bio}</p>
          <h2 className="mt-4 text-[2rem] font-black leading-[1.02] tracking-tight text-slate-900">
            {HERO.headline}
          </h2>
          <p className="mx-auto mt-3 max-w-[32ch] text-[0.98rem] font-medium leading-relaxed" style={{ color:"#6b7280" }}>
            {HERO.subcopy}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {HERO.trust.map((item, i) => (
              <span
                key={item}
                className="rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{
                  background: i === 1 ? "rgba(255,247,240,0.95)" : "rgba(255,255,255,0.82)",
                  border: `1px solid ${i === 1 ? C.p3_15 : C.p1_12}`,
                  color: i === 1 ? "#d97706" : i === 2 ? C.p2 : C.p1,
                }}
              >
                {item}
              </span>
            ))}
          </div>
          <a
            href={PROFILE.instagram}
            target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full text-xs font-bold transition-all hover:scale-105 active:scale-95"
            style={{ background:"rgba(255,255,255,0.9)", border:`1.5px solid ${C.p2_18}`, color:C.p2, boxShadow:`0 8px 20px ${C.p2_08}` }}
          >
            📷 Follow on Instagram
          </a>
        </div>

        {/* LINKS */}
        <div className="w-full space-y-4">
          {links.map((link, i) => {
            const style = CARD_BG[i % CARD_BG.length];

            return (
              <TrackedLink
                key={link.id}
                id={link.id}
                label={link.label}
                url={link.url}
                emoji={link.emoji}
                description={link.description}
                animationDelay={`${0.1 + i * 0.06}s`}
                background={style.bg}
                borderColor={style.border}
                accent={style.accent}
                eyebrow={style.eyebrow}
                featured={i === 0}
              />
            );
          })}
        </div>

        <div
          className="mt-7 w-full rounded-[1.8rem] border px-5 py-4"
          style={{
            background: "rgba(255,255,255,0.82)",
            borderColor: C.p2_12,
            boxShadow: `0 18px 42px ${C.p2_06}`,
          }}
        >
          <p className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: C.p2 }}>
            Quick note
          </p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">
            If you’re not sure where to begin, start with <span className="font-black text-slate-900">Book a Photoshoot</span> for the fastest path, or <span className="font-black text-slate-900">Graduation Guide</span> if you want to feel more prepared first.
          </p>
        </div>

        <div
          className="w-full overflow-hidden rounded-2xl py-3"
          style={{ marginTop: "48px", background:"rgba(255,255,255,0.82)", border:`1px solid ${C.p2_12}`, boxShadow:`0 6px 20px ${C.p2_06}` }}
        >
          <div className="mtrack flex whitespace-nowrap w-max" style={{ gap:"48px" }}>
            {MARQUEE_ITEMS.map((item, i) => (
              <span key={i} className="inline-flex items-center gap-3 text-[11px] font-bold tracking-[0.13em] uppercase" style={{ color:"#9ca3af" }}>
                {item}
                <span className="rounded-full inline-block flex-shrink-0" style={{ width:5, height:5, background:C.grad23 }}/>
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
