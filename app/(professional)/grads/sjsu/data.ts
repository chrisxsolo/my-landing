import type { SchoolLandingData } from "@/app/components/SchoolLandingTemplate";

export const data: SchoolLandingData = {
  school: "San Jose State",
  schoolShort: "SJSU",
  slug: "sjsu",
  city: "San Jose, CA",
  metaTitle: "SJSU Graduation Photographer | San Jose State",
  metaDescription:
    "Graduation portraits at San Jose State by Chris Solorzano. Tower Hall, the Event Center, campus quad — guided sessions, fast turnaround, private gallery delivery.",
  canonicalPath: "/grads/sjsu",
  heroTagline:
    "Graduation portraits at San Jose State with clear direction, premium editing, and a straightforward experience from inquiry to gallery. I know the campus and I know how to keep the session moving.",
  bodyIntro:
    "San Jose State sits in the heart of downtown San Jose with a mix of historic buildings, open plazas, and architectural details that make for strong graduation portraits. I know the best spots for light at different times of day and how to plan the route so the session stays efficient even during busy ceremony weeks.",
  spots: [
    {
      name: "Tower Hall",
      description:
        "SJSU's landmark building. The brick facade, archways, and surrounding lawn are classic backdrops for both formal and relaxed portraits.",
      bestTime: "Late afternoon",
    },
    {
      name: "MLK Library Plaza",
      description:
        "Clean architecture with modern lines. Good for a different visual texture within the same session.",
      bestTime: "Midday",
    },
    {
      name: "Campus Quad",
      description:
        "Open central space with mature trees and shade — useful for group shots and relaxed individual frames.",
      bestTime: "Midday (shaded)",
    },
    {
      name: "Seventh Street",
      description:
        "Tree-lined campus boundary with good shade and quiet compared to the main quad. Works well for candid movement shots.",
      bestTime: "Afternoon (shaded)",
    },
  ],
  sessionNote:
    "May graduation week fills fast. If you have a specific date near your ceremony, send an inquiry early.",
  bestTime:
    "Tower Hall and the palm-lined paseo look their best in late afternoon, when the brick warms up and the downtown light softens. The Campus Quad and Seventh Street stay shaded through the day, so we can start with relaxed frames there and finish at Tower Hall as the light turns golden.",
  whatToWear:
    "SJSU's red-brick architecture and green quad pair well with neutral and jewel tones — very bright reds can compete with the brick, so cooler colors tend to stand out more. A clean, structured outfit under the gown reads sharp for the formal Tower Hall shots.",
  faqs: [
    { q: "What are the best photo spots at San Jose State?", a: "Tower Hall is the signature backdrop, along with the MLK Library plaza, the Campus Quad, and tree-lined Seventh Street. We usually combine the landmark building with one or two quieter, shaded spots." },
    { q: "When is the best light for SJSU grad photos?", a: "Late afternoon is the sweet spot — the brick and plazas glow, and downtown San Jose's harder midday light has softened." },
    { q: "Can we shoot during SJSU graduation week?", a: "Yes. May graduation week is the busiest stretch of the year, so if you want a date near your ceremony, send an inquiry early." },
    { q: "Can my family and friends be in some of the photos?", a: "Absolutely — group and family shots are part of most grad sessions, and I keep them quick and organized so no one's left standing around." },
  ],
};
