// Copy for the couples guide hub (/couples-guide) — "The Ultimate Bay Area
// Couples Photography Guide". Business facts are derived, never typed in:
// prices, session lengths, and image minimums come from PRICING_CATALOG.couples,
// the delivery window from PRICING_CATALOG.standardTurnaroundDays, and FAQ
// answers from couplesFaqData (the same source as /couples-guide/faq).

import { PRICING_CATALOG } from "@/lib/pricingCatalog";
import { formatCurrency } from "@/lib/pricing";
import { FAQS } from "@/app/(professional)/couples-guide/faq/couplesFaqData";

const couples = PRICING_CATALOG.couples;
export const TURNAROUND_WEEKS = PRICING_CATALOG.standardTurnaroundDays / 7;

export const GUIDE_SECTIONS = [
  { id: "approach", label: "My approach" },
  { id: "what-to-expect", label: "What to expect" },
  { id: "locations", label: "Best locations" },
  { id: "what-to-wear", label: "What to wear" },
  { id: "best-time", label: "Best time" },
  { id: "posing", label: "How I help you pose" },
  { id: "pricing", label: "Pricing" },
  { id: "faq", label: "FAQ" },
] as const;

export const APPROACH_POINTS = [
  { title: "Genuine interactions", text: "Real reactions to each other, not smiles held for the camera." },
  { title: "Natural movement", text: "Walking, spinning, and leaning in keep the photos loose and alive." },
  { title: "Playful moments", text: "Silly prompts that get you laughing — the laugh is the photo." },
  { title: "Relaxed posing", text: "Simple direction, so you always know what to do with your hands." },
  { title: "Authentic connection", text: "Quiet in-between moments that look like your relationship." },
  { title: "Bay Area scenery", text: "Coastline, gardens, and wooded paths chosen to fit the two of you." },
];

export const EXPECT_STEPS = [
  {
    title: "Planning the session",
    text: "You send a date idea and what you're celebrating. I reply with availability and help you pick the session length that fits.",
  },
  {
    title: "Choosing a location",
    text: "We pick a spot together based on the mood you want, how much privacy you'd like, and practical things like walking and parking.",
  },
  {
    title: "Picking outfits",
    text: "I help you coordinate colors and textures with the location, and I'm happy to look at outfit options before the day.",
  },
  {
    title: "Arriving on the day",
    text: "We meet a few minutes early, say hi, and walk the location together while you settle in. No pressure to be \"on\" right away.",
  },
  {
    title: "Guided posing and natural interaction",
    text: "I give clear, simple prompts — walk, lean in, whisper something — so you're never standing there wondering what to do.",
  },
  {
    title: "Candid moments",
    text: "Between prompts I keep shooting. The laughs, glances, and resets are often the favorite photos in a gallery.",
  },
  {
    title: "Your edited gallery",
    text: `Your professionally edited photos arrive in a private online gallery within ${TURNAROUND_WEEKS} weeks, ready to download, share, and print.`,
  },
];

export const WEAR_PRINCIPLES = [
  { title: "Coordinate, don't match", text: "Pick two or three colors that work together instead of identical outfits. One of you can carry a color while the other wears a neutral." },
  { title: "Neutral and complementary palettes", text: "Cream, camel, olive, denim, soft blues, and muted earth tones photograph beautifully and won't fight the scenery." },
  { title: "Clothes you can move in", text: "You'll walk, spin, and sit. Flowing dresses, relaxed trousers, and shoes you can actually walk in make the movement prompts work." },
  { title: "Dress for the location", text: "Formal looks shine in gardens and architecture; relaxed layers fit beaches and trails. Bring a layer — the Bay is often cooler and windier than you expect." },
  { title: "Skip busy patterns", text: "Small, high-contrast prints and big logos pull focus. Texture — knit, linen, satin — adds interest without distracting." },
  { title: "Let it look like you", text: "The best outfit is one you'd happily wear on a date together. If you feel like yourselves, it shows." },
];

export const WEAR_BY_SETTING = [
  { setting: "Beach", tips: "Light, flowing fabrics that catch the breeze; soft neutrals or whites; flats or bare feet for walking on sand." },
  { setting: "City", tips: "Tailored pieces, deeper tones, and a jacket or coat; shoes you can walk a few blocks in." },
  { setting: "Nature", tips: "Earthy greens, rust, and cream that sit naturally against trees; avoid long trains on dusty or muddy trails." },
];

export const LIGHT_POINTS = [
  { title: "Softer, directional light", text: "When the sun is low, light comes from the side and wraps around faces instead of beating down from above." },
  { title: "Warmer color", text: "Golden hour adds a natural warmth to skin tones and scenery that's hard to recreate in editing." },
  { title: "Fewer harsh shadows", text: "No squinting and no dark shadows under the eyes — just easy, flattering light." },
  { title: "Overcast days work too", text: "Bay Area clouds and fog act like a giant softbox: even, gentle light that's lovely for close, romantic photos." },
];

export const POSING_EXAMPLES = [
  "Walking together and swinging your joined hands",
  "Playfully chasing each other",
  "Big hugs — sometimes after a run toward each other",
  "Whispering something funny in each other's ear",
  "Spinning around together",
  "Small, quiet moments: foreheads together, a kiss on the temple",
];

export type GuidePackage = { key: string; label: string; detail: string; price: string };

export const GUIDE_PACKAGES: GuidePackage[] = Object.entries(couples.packages).map(([key, pkg]) => ({
  key,
  label: pkg.label,
  detail: `${pkg.durationLabel} · ${pkg.minimumImages}+ edited images`,
  price: key === "proposal" ? `from ${formatCurrency(pkg.price)}` : formatCurrency(pkg.price),
}));

export type GuideAddOn = { key: string; label: string; price: string };

export const GUIDE_ADD_ONS: GuideAddOn[] = Object.entries(couples.addOns).map(([key, addOn]) => ({
  key,
  label: addOn.label,
  price: "price" in addOn ? `+${formatCurrency(addOn.price)}` : addOn.displayPrice,
}));

// The questions the hub answers inline, by exact text in couplesFaqData.
const HUB_FAQ_QUESTIONS = [
  "What if we feel awkward in front of the camera?",
  "What should we wear?",
  "Can we bring our dog?",
  "What happens if it rains?",
  "How far in advance should we book?",
  "Can we choose the location?",
  "Can we bring a second outfit?",
  "When will we receive the gallery?",
  "How do we book?",
];

const ALL_FAQ_ITEMS = FAQS.flatMap((group) => group.items);

export const HUB_FAQS = HUB_FAQ_QUESTIONS.map((question) => {
  const item = ALL_FAQ_ITEMS.find((faq) => faq.q === question);
  if (!item) throw new Error(`Couples FAQ is missing: ${question}`);
  return item;
});
