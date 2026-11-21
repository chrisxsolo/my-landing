import type { Metadata } from "next";
import type { CSSProperties } from "react";
import NextLink from "next/link";
import { C } from "@/lib/colors";
import TrackedLink, { type LinkCardVariant } from "./TrackedLink";
import LinkIcon from "./LinkIcon";
import LinksAnalytics from "./LinksAnalytics";
import LinksFilmstrip from "./LinksFilmstrip";
import { eyebrowForLink } from "./linkEyebrow";
import styles from "./links.module.css";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { ABOUT_PORTRAIT_ALT, ABOUT_PORTRAIT_SRC } from "@/lib/aboutFacts";
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
  photo:     ABOUT_PORTRAIT_SRC, // same portrait as /about
  instagram: "https://www.instagram.com/soloxsnaps",
};

const HERO = {
  eyebrow: "Bay Area graduation + portrait photos",
  // Rendered as one sentence; the last word is set in the accent style.
  headlineLead: "Warm, natural photos that still feel like",
  headlineAccent: "you.",
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

// lib/colors.ts → CSS custom properties read by links.module.css.
const LINKS_THEME = {
  "--page": C.page,
  "--page-alt": C.pageAlt,
  "--white": C.white,
  "--edge": C.warmEdge,
  "--ink": C.warmInk,
  "--body": C.warmBody,
  "--muted": C.warmMuted,
  "--clay": C.clay,
  "--clay-deep": C.clayDeep,
  "--clay-soft": C.claySoft,
  "--clay-border": C.clayBorder,
  "--glass": C.white_82,
  "--sheen": C.white_22,
  "--glow-warm": C.warmGlow,
  "--glow-clay": C.clayGlow,
  "--shadow": C.shadowWarm,
  "--shadow-lg": C.shadowWarmLg,
} as CSSProperties;

const step = (i: number) => ({ "--i": i }) as CSSProperties;

function Hero() {
  return (
    <>
      <div className={styles.hero}>
        <OptimizedPhoto
          src={PROFILE.photo}
          alt={ABOUT_PORTRAIT_ALT}
          sizes="(max-width: 448px) 100vw, 448px"
          priority
          objectPosition="50% 44%"
        />
        <p className={styles.heroPill}>
          <span className={styles.pulseDot} />
          {HERO.eyebrow}
        </p>
      </div>

      <div className={`${styles.identity} ${styles.rise}`} style={step(1)}>
        <div className="min-w-0">
          <h1 className={styles.handle}>{PROFILE.name}</h1>
          <p className={styles.bio}>{PROFILE.bio}</p>
        </div>
        <a
          href={PROFILE.instagram}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Follow on Instagram"
          className={styles.igIcon}
        >
          <LinkIcon name="instagram" size={20} />
        </a>
      </div>

      <h2 className={styles.headline}>
        {HERO.headlineLead}{" "}
        <span className={styles.accent}>
          {HERO.headlineAccent}
          <svg className={styles.squiggle} viewBox="0 0 76 10" preserveAspectRatio="none" aria-hidden="true">
            <path d="M2 6c12-5 24 4 36 0s24-5 36 0" pathLength={1} />
          </svg>
        </span>
      </h2>
      <p className={`${styles.subcopy} ${styles.rise}`} style={step(4)}>{HERO.subcopy}</p>
      <ul className={`${styles.trust} ${styles.rise}`} style={step(5)}>
        {HERO.trust.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </>
  );
}

// First link is the filled primary card; the rest fill a two-column grid, and
// a leftover odd tile spans the full row.
function cardVariant(index: number, total: number): LinkCardVariant {
  if (index === 0) return "primary";
  const isLast = index === total - 1;
  const tileCountIsOdd = (total - 1) % 2 === 1;
  return isLast && tileCountIsOdd ? "tileWide" : "tile";
}

function Closing() {
  return (
    <>
      <div className={styles.note}>
        <p className={styles.eyebrow}>Quick note</p>
        <p className={styles.noteText}>
          If you’re not sure where to begin, start with <strong>Book a Photoshoot</strong> for the fastest path, or <strong>Graduation Guide</strong> if you want to feel more prepared first.
        </p>
      </div>

      <a href={PROFILE.instagram} target="_blank" rel="noopener noreferrer" className={styles.follow}>
        <LinkIcon name="instagram" size={18} />
        Follow on Instagram
      </a>

      <p className={styles.footer}>
        <NextLink href="/">
          <strong>Chris Solorzano</strong> · Bay Area Photography
        </NextLink>
      </p>
    </>
  );
}

export default async function LinksPage() {
  const links = await getLinks();

  return (
    <div className={`${styles.root} font-sans`} style={LINKS_THEME}>
      <LinksAnalytics />
      <div className={`${styles.glow} ${styles.glowWarm}`} />
      <div className={`${styles.glow} ${styles.glowClay}`} />

      <div className={styles.column}>
        <Hero />

        <div className={styles.links}>
          {links.map((link, i) => (
            <TrackedLink
              key={link.id}
              id={link.id}
              label={link.label}
              url={link.url}
              emoji={link.emoji}
              description={link.description}
              eyebrow={eyebrowForLink(link.url, i)}
              variant={cardVariant(i, links.length)}
              order={6 + i}
            />
          ))}
        </div>

        <LinksFilmstrip />
        <Closing />
      </div>
    </div>
  );
}
