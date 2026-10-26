// Content shape for a school's long-form photo location guide
// (/grads/<slug>/spots). Optional on SchoolLandingData: a school without one
// keeps the compact spots list. Pure types — no runtime code.
import type { SchoolSpot } from "./SchoolLandingTemplate";
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
}

/**
 * Places beyond campus that graduates book, each with its own photo section.
 * Spot keys must be lib/schoolSpots keys with a placeKey, so photos from this
 * school's sessions shot at that place fill the section.
 */
export interface SchoolSpotsGuideOffCampus {
  navLabel: string;
  heading: string;
  intro: string[];
  spots: SchoolSpot[];
}

/** One example way to plan a session ("SF State + Palace of Fine Arts"). */
export interface SchoolSpotsGuidePlanOption {
  label: string;
  title: string;
  body: string;
}

/** Multi-location sessions: example plans, pricing notes, and an inquiry prompt. */
export interface SchoolSpotsGuidePlans {
  navLabel: string;
  heading: string;
  intro: string[];
  optionsHeading: string;
  options: SchoolSpotsGuidePlanOption[];
  notesHeading: string;
  /** Pricing and logistics, built from the pricing catalog (never typed by hand). */
  notes: string[];
  cta: { heading: string; body: string; label: string };
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
    /** Side-by-side condition lists ("Sunny days", "Cloudy days"). */
    lists?: { label: string; items: string[] }[];
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
  /** Rendered after the route, before the other sections. */
  offCampus?: SchoolSpotsGuideOffCampus;
  /** Rendered after offCampus. */
  plans?: SchoolSpotsGuidePlans;
  sections?: SchoolSpotsGuideSection[];
  tips: SchoolSpotsGuideTip[];
  faqs: SchoolFaq[];
}
