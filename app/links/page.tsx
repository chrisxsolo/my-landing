import type { Metadata } from "next";
import NextLink from "next/link";
import { C } from "@/lib/colors";
import TrackedLink from "./TrackedLink";
import LinkIcon from "./LinkIcon";
import { eyebrowForLink } from "./linkEyebrow";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { ABOUT_PORTRAIT_ALT, ABOUT_PORTRAIT_SRC } from "@/lib/aboutFacts";
import LinksAnalytics from "./LinksAnalytics";
import { createSupabaseServerClient } from "@/lib/supabaseServer";

export const dynamic = 'force-dynamic'

// The Instagram link hub: its own title (the root layout appends " | SoloXSnaps")
// and noindex, since it is a utility page for followers, not a search landing page.
export const metadata: Metadata = {
  title: "Links",
  description:
    "Chris Solorzano's link hub: book a session, see graduation pricing and availability, and read the prep guides.",
  robots: { index: false, follow: true },
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE CONFIG — edit these values to update your profile
// ─────────────────────────────────────────────────────────────────────────────
const PROFILE = {
  name:      "@soloxsnaps",
  bio:       "Chris Solo · Bay Area Portrait Photographer",
  avatar:    ABOUT_PORTRAIT_SRC, // same portrait as /about
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

const PAGE_STYLES = `
  @keyframes fadeUp  { from{opacity:0;transform:translateY(16px);} to{opacity:1;transform:translateY(0);} }
  @keyframes marquee { from{transform:translateX(0);} to{transform:translateX(-50%);} }

  .fade-up { animation: fadeUp 0.45s ease both; }
  .mtrack  { animation: marquee 30s linear infinite; }

  .link-card {
    transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
    animation: fadeUp 0.45s ease both;
  }
  .link-card:hover  { transform: translateY(-2px); border-color: ${C.clayBorder} !important; box-shadow: ${C.shadowWarm}; }
  .link-card:active { transform: scale(0.99); }
  .link-arrow { transition: transform 0.18s ease; }
  .link-card:hover .link-arrow { transform: translateX(2px); }

  .ig-button { transition: border-color 0.18s ease, background 0.18s ease; }
  .ig-button:hover { border-color: ${C.clayBorder} !important; background: ${C.pageAlt} !important; }

  @media (prefers-reduced-motion: reduce) {
    .fade-up, .link-card, .mtrack { animation: none; }
    .link-card, .link-arrow { transition: none; }
  }
`;

const CARD_SURFACE = {
  background: C.white,
  border: `1px solid ${C.warmEdge}`,
} as const;

function ProfileHeader() {
  return (
    <>
      <div
        className="fade-up mb-6 inline-flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em]"
        style={{ ...CARD_SURFACE, color: C.clay }}
      >
        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: C.clay }} />
        {HERO.eyebrow}
      </div>

      <div className="fade-up mb-6" style={{ animationDelay: "0.04s" }}>
        <div
          className="rounded-full p-1.5"
          style={{ border: `1px solid ${C.warmEdge}`, background: C.white, boxShadow: C.shadowWarm }}
        >
          <div
            className="relative overflow-hidden rounded-full"
            style={{ width: 112, height: 112, background: C.pageAlt }}
          >
            <OptimizedPhoto
              src={PROFILE.avatar}
              alt={ABOUT_PORTRAIT_ALT}
              sizes="112px"
              priority
              objectPosition="50% 50%"
            />
          </div>
        </div>
      </div>

      <div className="fade-up text-center mb-8" style={{ animationDelay: "0.08s" }}>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: C.warmInk }}>{PROFILE.name}</h1>
        <p className="text-sm font-medium leading-snug" style={{ color: C.warmMuted }}>{PROFILE.bio}</p>
        <h2 className="mt-5 text-[2rem] font-bold leading-[1.06] tracking-tight" style={{ color: C.warmInk }}>
          {HERO.headline}
        </h2>
        <p className="mx-auto mt-3 max-w-[32ch] text-[0.98rem] leading-relaxed" style={{ color: C.warmBody }}>
          {HERO.subcopy}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {HERO.trust.map((item) => (
            <span
              key={item}
              className="rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]"
              style={{ ...CARD_SURFACE, color: C.warmBody }}
            >
              {item}
            </span>
          ))}
        </div>
        <a
          href={PROFILE.instagram}
          target="_blank" rel="noopener noreferrer"
          className="ig-button inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full text-xs font-bold"
          style={{ background: C.white, border: `1px solid ${C.warmInk}`, color: C.warmInk }}
        >
          <LinkIcon name="instagram" size={16} />
          Follow on Instagram
        </a>
      </div>
    </>
  );
}

function PageFooter() {
  return (
    <>
      <div className="mt-7 w-full rounded-2xl px-5 py-4" style={{ ...CARD_SURFACE, background: C.pageAlt }}>
        <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: C.clay }}>
          Quick note
        </p>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: C.warmBody }}>
          If you’re not sure where to begin, start with <span className="font-bold" style={{ color: C.warmInk }}>Book a Photoshoot</span> for the fastest path, or <span className="font-bold" style={{ color: C.warmInk }}>Graduation Guide</span> if you want to feel more prepared first.
        </p>
      </div>

      <div className="mt-12 w-full overflow-hidden rounded-2xl py-3" style={CARD_SURFACE}>
        <div className="mtrack flex whitespace-nowrap w-max" style={{ gap: "48px" }}>
          {MARQUEE_ITEMS.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-3 text-[11px] font-semibold tracking-[0.13em] uppercase" style={{ color: C.warmMuted }}>
              {item}
              <span className="rounded-full inline-block flex-shrink-0" style={{ width: 4, height: 4, background: C.clay }} />
            </span>
          ))}
        </div>
      </div>

      <div className="mt-8 text-center">
        <NextLink href="/" className="text-xs font-semibold" style={{ textDecoration: "none" }}>
          <span style={{ color: C.warmInk }}>Chris Solorzano</span>
          <span style={{ color: C.warmMuted }}> · Bay Area Photography</span>
        </NextLink>
      </div>
    </>
  );
}

export default async function LinksPage() {
  const links = await getLinks();

  return (
    <div className="min-h-screen font-sans" style={{ background: C.page }}>
      <LinksAnalytics />
      <style>{PAGE_STYLES}</style>

      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div
          className="absolute rounded-full"
          style={{ width: 760, height: 760, top: -420, left: "50%", marginLeft: -380, background: C.warmGlow }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center px-5 pt-10 pb-24 max-w-md mx-auto">
        <ProfileHeader />

        <div className="w-full space-y-3">
          {links.map((link, i) => (
            <TrackedLink
              key={link.id}
              id={link.id}
              label={link.label}
              url={link.url}
              emoji={link.emoji}
              description={link.description}
              animationDelay={`${0.1 + i * 0.06}s`}
              eyebrow={eyebrowForLink(link.url, i)}
              featured={i === 0}
            />
          ))}
        </div>

        <PageFooter />
      </div>
    </div>
  );
}
