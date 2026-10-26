import type { SchoolLandingData } from "@/app/components/SchoolLandingTemplate";
import { spotsGuide } from "./spotsGuide";

// Spots, order, timing, and wind advice come from Chris's own USF sessions.
// Spot keys match lib/schoolSpots.ts, which the photo tags are stored under;
// the church walkway and the Lone Mountain main-building background are child
// compositions shown inside their parent sections. Each spot's description and
// tip also feed the USF entries on /grad-guide/campus-spots.
//
// Not stated on purpose: walking times, parking, interior church or library
// photography, which building holds the glass hallway, and sun angles.
export const data: SchoolLandingData = {
  school: "USF",
  schoolShort: "USF",
  slug: "usf",
  city: "San Francisco, CA",
  metaTitle: "USF Graduation Photographer | University of San Francisco",
  metaDescription:
    "USF graduation portraits by Chris Solorzano at St. Ignatius Church, Gleeson Library, the wolf sculpture, and Lone Mountain at sunset. Guided sessions in San Francisco.",
  canonicalPath: "/grads/usf",
  heroTagline:
    "Graduation portraits at the University of San Francisco, from St. Ignatius Church and Gleeson Library to a sunset finish under the Lone Mountain palm trees.",
  bodyIntro:
    "USF gives us a lot of variety in one session: elegant architecture around St. Ignatius Church and Gleeson Library, the Los Lobos de Loyola wolf sculpture, a modern glass hallway, and the stairs and palm trees of Lone Mountain. I like to start on the main campus and finish at Lone Mountain around sunset.",
  spots: [
    {
      key: "st-ignatius-church",
      name: "St. Ignatius Church",
      priority: "must-have",
      role: "Where I like to start",
      bestTime: "Golden hour, or any time on overcast days",
      description:
        "Classic, elegant cap-and-gown portraits with the church architecture, plus relaxed walking photos along the walkway in front.",
      details: [
        "St. Ignatius Church is one of my favorite places to begin graduation photos at the University of San Francisco. Its beautiful architecture creates an elegant background for classic cap-and-gown portraits.",
        "I particularly like photographing around the front of the church and along the walkway in front of the building. These areas let us bring in the church architecture while capturing both traditional and natural graduation photos.",
        "The walkway is especially useful for movement-based portraits that feel relaxed rather than overly posed. We photograph the outside of the church only.",
      ],
      photoIdeas: [
        "Traditional cap-and-gown portraits",
        "Full-body photos with St. Ignatius Church",
        "Walking portraits along the church walkway",
        "Close-up smiling portraits",
        "Wider architectural photos",
        "Relaxed and candid images",
      ],
      tip: "I like starting around St. Ignatius Church because the architecture provides an excellent foundation for a graduation gallery. We can capture a mix of classic graduation photos and natural movement before continuing toward Gleeson Library.",
    },
    {
      key: "gleeson-library",
      name: "Gleeson Library",
      priority: "must-have",
      role: "Gleeson Library | Geschke Center",
      bestTime: "Golden hour, or any time on overcast days",
      description:
        "A recognizable university backdrop for traditional standing and close-up graduation portraits outside the library entrance.",
      details: [
        "Gleeson Library is another location I highly recommend for USF graduation pictures. The entrance and surrounding architecture provide a recognizable university backdrop that's great for traditional graduation portraits.",
        "I like photographing graduates in front of the library because it offers a different composition from St. Ignatius Church while keeping that classic campus atmosphere. It's a great place for both standing and closer portraits. We photograph the outside of the building.",
      ],
      photoIdeas: [
        "Classic standing graduation photos",
        "Full-body portraits",
        "Close-up cap-and-gown portraits",
        "Relaxed smiling images",
        "Architectural portraits with the entrance",
      ],
      tip: "Gleeson Library is one of the main locations I recommend including in a USF graduation session. It's also right by another of my favorite spots, the wolf sculpture outside the library.",
    },
    {
      key: "los-lobos-de-loyola",
      name: "Los Lobos de Loyola Wolf Sculpture",
      priority: "highly-recommended",
      role: "Outside Gleeson Library",
      bestTime: "Pairs with Gleeson Library",
      description:
        "The wolves-and-kettle sculpture outside Gleeson Library, a playful, distinctly USF backdrop for standing and sitting portraits.",
      details: [
        "One of the most recognizable photo spots outside Gleeson Library is the wolf sculpture. Officially called Los Lobos de Loyola, it features wolves and a kettle, a symbol from the university's Jesuit heritage, and was created by Mexican artist Pancho Cárdenas.",
        "It's one of my favorite locations for adding something distinctly USF to a graduation gallery. I like taking a mix of sitting and standing portraits here, depending on your preferences and the composition, and the sculpture gives a more playful background than the traditional architecture around the library.",
        "We treat the sculpture as the artwork it is: no climbing, standing, or sitting on it. Seated portraits use the surrounding surfaces where sitting is allowed.",
      ],
      photoIdeas: [
        "Standing beside the sculpture",
        "Seated portraits near the sculpture",
        "Full-body graduation photos",
        "Relaxed smiling portraits",
        "Candid images that interact visually with the artwork",
      ],
      tip: "I recommend photographing the wolf sculpture right after Gleeson Library because they're close together. It adds variety without needing another major stop.",
    },
    {
      key: "usf-glass-hallway",
      name: "USF Glass Hallway",
      priority: "highly-recommended",
      role: "Indoor · access-controlled",
      bestTime: "When access is authorized",
      description:
        "A modern, minimal glass hallway for clean, editorial gown portraits, included only when access and photography are authorized.",
      details: [
        "One of my favorite unique photo locations at USF is the modern glass hallway. It's completely different from the traditional architecture of St. Ignatius Church and Gleeson Library: the glass walls, clean lines, and modern design create a beautiful setting for graduation portraits.",
        "I especially like photographing graduates in their gowns here. The simple background draws attention to you while giving the photos a polished, editorial look, and the hallway is great for symmetrical compositions that feel more modern than traditional campus photography.",
      ],
      notice: {
        label: "Access",
        text: "This is an indoor, access-controlled hallway. In my experience a valid USF student ID is needed to get in, but a student ID doesn't by itself give a professional photographer permission to shoot inside. I include it only when access and photography are authorized for your session, and I never tailgate through controlled doors or borrow credentials. If it isn't available, we simply spend that time at the outdoor spots.",
      },
      photoIdeas: [
        "Standing graduation portraits",
        "Full-body gown photos",
        "Symmetrical compositions",
        "Clean editorial-style portraits",
        "Natural walking photos, where permitted",
        "Close-ups that show off the graduation outfit",
      ],
      campusTip: "Indoor and access-controlled: in my experience it needs a valid USF student ID, and photography must also be authorized. When it is, it's my favorite spot for clean gown portraits.",
      tip: "I particularly recommend this location for photos in your graduation gown. The contrast between the gown and the modern architecture creates a clean, distinctive look.",
    },
    {
      key: "lone-mountain-stairs",
      name: "Lone Mountain Stairs",
      priority: "must-have",
      role: "Start of the Lone Mountain portion",
      bestTime: "Late afternoon, on the way to sunset",
      description:
        "Natural leading lines for standing and seated portraits, and a great transition before the top of Lone Mountain.",
      details: [
        "After photographing around the main USF campus, I like making my way up to Lone Mountain, and one of my favorite places to start this part of the session is along the Lone Mountain stairs.",
        "The staircase provides natural leading lines and lets us create different compositions from the photos we captured earlier. I like taking a mix of standing and seated portraits around the steps, depending on your outfit and preferences.",
        "We keep the walkway clear for other people and never pose on railings or edges. If stairs aren't comfortable for you, tell me ahead of time and I'll plan an accessible route and alternative spots.",
      ],
      photoIdeas: [
        "Standing graduation photos on the stairs",
        "Seated portraits on suitable steps",
        "Wide staircase compositions",
        "Full-body cap-and-gown portraits",
        "Natural walking photos",
        "Candid images with the staircase as a background",
      ],
      campusTip: "I start the Lone Mountain portion here before the palm trees. Lone Mountain can be windy, so come with hair clips and a few clothing clips.",
      tip: "I usually start with the stairs before moving farther into Lone Mountain. It's a good way to add some different compositions before the final sunset portraits.",
    },
    {
      key: "lone-mountain-palm-walkway",
      name: "Lone Mountain Palm Trees & Main Building",
      priority: "must-have",
      role: "Final stop · sunset",
      bestTime: "Sunset",
      signature: true,
      description:
        "Palm trees framing the Lone Mountain building: my favorite place to finish a USF session, ideally around sunset.",
      details: [
        "Lone Mountain is one of my absolute favorite places to finish a USF graduation session. The palm trees and the architecture around the Lone Mountain building create an iconic San Francisco university backdrop.",
        "I especially love photographing here around sunset, when the lower sunlight can bring warmth and flattering light to the end of the session. One of my favorite compositions has the palm trees framing the image with the Lone Mountain building visible behind you.",
        "The surrounding greenery and architecture also give us room for a variety of classic graduation portraits.",
      ],
      notice: {
        label: "Wind warning",
        text: "Lone Mountain can get very windy. I strongly recommend bringing hair clips, hair ties, bobby pins, or other accessories to keep your hair in place, plus small clothing clips or safety pins to keep your gown and loose clothing from blowing around. A little preparation means fewer interruptions to fix hair or clothing.",
      },
      photoIdeas: [
        "Full-body graduation portraits with the palm trees",
        "Classic cap-and-gown photos",
        "Wide environmental photos of Lone Mountain",
        "Portraits with the building in the background",
        "Natural walking photos",
        "Celebratory graduation portraits",
        "Close-ups in softer sunset light",
      ],
      campusTip: "Save it for the end of the session, around sunset. It can get very windy, so bring hair ties, clips, bobby pins, and small clothing clips for your gown.",
      tip: "I recommend saving Lone Mountain for the end of your session, especially around sunset. It's one of my favorite places to use warm, natural light and finish the gallery with some of the strongest photos of the session.",
    },
  ],
  sessionNote:
    "USF commencement is typically in late May. Early inquiries are recommended for peak spring dates.",
  bestTime:
    "On sunny days, golden hour before sunset is my favorite, and I plan the session to finish at Lone Mountain around sunset. San Francisco's overcast days are excellent too: the clouds soften the light, so morning and afternoon sessions can look beautiful.",
  whatToWear:
    "Bring the outfit you love; USF's stone architecture and the Lone Mountain greenery suit both classic and richer colors. Lone Mountain can be very windy, so pack hair ties, clips, and bobby pins, a few small clothing clips or safety pins for your gown, and comfortable walking shoes.",
  faqs: [
    { q: "Is there a travel fee for a USF session?", a: "No. USF is in San Francisco, where travel is included. Adding a second location like Haight-Ashbury is a separate add-on." },
    { q: "What are the best photo spots at USF?", a: "St. Ignatius Church, Gleeson Library, the Los Lobos de Loyola wolf sculpture, the modern glass hallway when access is authorized, and the Lone Mountain stairs and palm trees. I like finishing at Lone Mountain around sunset." },
    { q: "What if it's foggy or overcast on our session day?", a: "Overcast skies are often excellent at USF. The clouds soften the light, which gives us more flexibility with the time of day. Very heavy cloud can make it darker, so we'll watch the forecast together." },
    { q: "When does USF hold commencement?", a: "USF commencement is typically in late May, which is peak season, so early inquiries are recommended for spring dates." },
  ],
  spotsGuide,
};
