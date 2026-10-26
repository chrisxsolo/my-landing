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

export interface SchoolSpotsGuide {
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  h1: string;
  intro: string[];
  /** One sentence naming the must-have spots. */
  mustHaveIntro: string;
  spotsHeading: string;
  bestTime: {
    heading: string;
    paragraphs: string[];
    weather: string;
    /** City-center coordinates for computed sunset times (never published). */
    sunsetCoords: { latitude: number; longitude: number };
  };
  route: {
    heading: string;
    intro: string[];
    steps: SchoolSpotsGuideStep[];
    notes: string[];
  };
  tips: SchoolSpotsGuideTip[];
  faqs: SchoolFaq[];
}
