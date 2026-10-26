import type { SchoolLandingData } from "@/app/components/SchoolLandingTemplate";
import { spotsGuide } from "./spotsGuide";

// Spots, timing, and session length come from Chris's own SJSU sessions.
// Spot keys match lib/schoolSpots.ts, which the photo tags are stored under.
export const data: SchoolLandingData = {
  school: "San Jose State",
  schoolShort: "SJSU",
  slug: "sjsu",
  city: "San Jose, CA",
  metaTitle: "SJSU Graduation Photographer | San Jose State",
  metaDescription:
    "SJSU graduation portraits by Chris Solorzano at the SJSU sign, Tower Hall Lawn, and the Student Union. Guided sessions, sunrise or golden-hour light, private gallery.",
  canonicalPath: "/grads/sjsu",
  heroTagline:
    "Graduation portraits at San Jose State with clear direction, premium editing, and a straightforward experience from inquiry to gallery. I know the campus and I know how to keep the session moving.",
  bodyIntro:
    "San Jose State sits in the heart of downtown San Jose, with palm-lined walkways and the historic architecture around Tower Hall. I know which spots consistently photograph well and how to plan the route so a one-hour session covers the essentials.",
  spots: [
    {
      key: "sjsu-sign",
      name: "SJSU Sign",
      priority: "must-have",
      description:
        "A must-have stop. The university sign instantly connects your photos to SJSU, for classic cap-and-gown portraits and relaxed celebration shots.",
      details: [
        "The SJSU sign is one of my must-have stops when photographing graduates at San Jose State. It's a recognizable landmark that immediately connects your photos to the university and gives you a classic graduation portrait.",
        "I like to capture a mix of traditional portraits and more relaxed images here, always keeping the sign visible in the frame. It's an especially meaningful stop if you want photos that clearly commemorate your time at SJSU.",
      ],
      photoIdeas: [
        "Traditional cap-and-gown portraits",
        "Full-length graduation photos",
        "Smiling portraits with the university sign",
        "Candid celebration shots",
      ],
    },
    {
      key: "tower-hall-lawn",
      name: "Tower Hall Lawn",
      priority: "must-have",
      description:
        "A classic SJSU backdrop. Historic Tower Hall behind you and open lawn in front give room for wide portraits and close-ups alike.",
      details: [
        "Tower Hall Lawn is one of my favorite locations for SJSU graduation photography. The historic Tower Hall building creates a distinctive architectural background, and the lawn gives us room for a variety of portraits.",
        "It works especially well for photos that show both you and the recognizable campus around you. I mix wider compositions that showcase Tower Hall with closer portraits that keep you as the main focus.",
      ],
      photoIdeas: [
        "Wide environmental portraits with Tower Hall",
        "Classic standing cap-and-gown photos",
        "Natural walking portraits",
        "Seated portraits on the lawn, where appropriate",
        "Celebratory and candid moments",
      ],
    },
    {
      key: "student-union",
      name: "Student Union on 7th Street",
      priority: "must-have",
      description:
        "One of my essential stops. The front of the Student Union along 7th Street gives a completely different look from Tower Hall in the same session.",
      details: [
        "The area in front of the Student Union along 7th Street is another location I highly recommend for SJSU graduation pictures. It gives you a different campus backdrop from Tower Hall, which adds real variety to a single session.",
        "This is where I like to mix classic portraits with natural movement and more relaxed expressions.",
      ],
      photoIdeas: [
        "Classic portraits in front of the Student Union",
        "Natural movement and walking shots",
        "Relaxed, candid expressions",
      ],
    },
    {
      key: "seventh-street-palms",
      name: "7th Street Palm Trees",
      priority: "recommended",
      description:
        "The palm-lined stretch of 7th Street brings a California campus feel, natural framing, and depth, which makes it great for walking shots.",
      details: [
        "The palm-lined section of 7th Street is a great location for graduation photos with a recognizable California campus atmosphere. The palms add natural framing and depth, so they work for both wider environmental shots and close-up portraits.",
        "I especially like this stretch for movement: walking naturally toward the camera, or glancing back over your shoulder as you walk.",
      ],
      photoIdeas: [
        "Walking graduation portraits",
        "Candid smiling photos",
        "Full-length cap-and-gown images",
        "Environmental portraits with the palm trees",
      ],
    },
    {
      key: "tower-hall-steps",
      name: "Steps near Tower Hall Lawn",
      priority: "recommended",
      description:
        "The steps around Tower Hall Lawn add seated portraits and classic poses framed by campus architecture, with no extra walking.",
      details: [
        "The steps around Tower Hall Lawn give us another composition option without adding another major stop to the route.",
        "Steps work particularly well for seated portraits, classic graduation poses, and frames where you're set against the surrounding campus architecture.",
      ],
      photoIdeas: [
        "Seated portraits on the steps",
        "Classic graduation poses",
        "Portraits framed by campus architecture",
      ],
    },
  ],
  sessionNote:
    "Graduation week is the busiest stretch on campus, and the landmarks get crowded. If your schedule is flexible, a date before the celebrations makes it easier to get clean backgrounds. If you need a date near your ceremony, send an inquiry early.",
  bestTime:
    "My favorite times at SJSU are golden hour, shortly before sunset, and sunrise. The lower sun gives softer, warmer, more flattering light. I avoid midday when possible because direct overhead sun creates harsh shadows on the face. Actual light always depends on the season, the weather, and shade.",
  whatToWear:
    "SJSU's red-brick architecture and green quad pair well with neutral and jewel tones — very bright reds can compete with the brick, so cooler colors tend to stand out more. A clean, structured outfit under the gown reads sharp for the formal Tower Hall shots.",
  faqs: [
    { q: "What are the must-have photo spots at SJSU?", a: "The SJSU sign, Tower Hall Lawn, and the front of the Student Union on 7th Street. My SJSU photo location guide covers all five spots I recommend, plus the best time of day and a one-hour route." },
    { q: "Can we shoot during SJSU graduation week?", a: "Yes, but I recommend avoiding the busiest days when you can, because the popular landmarks get crowded. If you need a date near your ceremony, send an inquiry early." },
    { q: "Can my family and friends be in some of the photos?", a: "Absolutely — group and family shots are part of most grad sessions, and I keep them quick and organized so no one's left standing around." },
  ],
  spotsGuide,
};
