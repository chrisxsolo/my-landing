// Content shape for a school's long-form photo location guide
// (/grads/<slug>/spots). Optional on SchoolLandingData: a school without one
// keeps the compact spots list. Pure types — no runtime code.
import type { SchoolFaq } from "./SchoolSessionGuide";

export interface SchoolSpotsGuideStep {
  /** A key from data.spots, so the step links to that spot's section. */
  spotKey: string;
  text: string;
}

export interface SchoolSpotsGuideTip {
  title: string;
  body: string;
}

/** A titled block after the route: crowds, celebration photos, campus rules. */
export interface SchoolSpotsGuideSection {
  /** Anchor id, also the jump-nav target. */
  id: string;
  navLabel: string;
  heading: string;
  paragraphs: string[];
  bulletsLabel?: string;
  bullets?: string[];
  /** Official sources, opened in a new tab. */
  links?: { label: string; href: string }[];
  /** A lib/schoolSpots key whose tagged photos show in this section. */
  spotKey?: string;
  /** An on-site action, e.g. an inquiry link with an add-on selected. */
  cta?: { label: string; href: string };
}

export interface SchoolSpotsGuide {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  h1: string;
  intro: string[];
  /** One sentence naming the must-have spots. */
  mustHaveIntro: string;
  /** Defaults to "The three must-haves". */
  mustHaveHeading?: string;
  /** Spots for the must-have cards; defaults to every "must-have" spot. */
  mustHaveKeys?: string[];
  spotsHeading: string;
  bestTime: {
    heading: string;
    paragraphs: string[];
    weather: string;
    /** City-center coordinates for computed sunset times (never published). */
    sunsetCoords: { latitude: number; longitude: number };
  };
  route: {
    /** Jump-nav label; defaults to "1-hour route". */
    navLabel?: string;
    heading: string;
    intro: string[];
    steps: SchoolSpotsGuideStep[];
    notes: string[];
  };
  sections?: SchoolSpotsGuideSection[];
  tips: SchoolSpotsGuideTip[];
  faqs: SchoolFaq[];
}
