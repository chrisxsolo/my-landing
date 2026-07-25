// POSING GUIDE  →  soloxsnaps.com/grad-guide/posing
// Server component — exports metadata + Article/Breadcrumb JSON-LD.
// Content is server-rendered in PosingContent.tsx.

import type { Metadata } from "next";
import PosingContent from "./PosingContent";
import ContextualTestimonials from "@/app/components/ContextualTestimonials";
import { getContextualTestimonials } from "@/lib/testimonialsData";
import { getGradPoses } from "@/lib/gradGuideData";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";

// ISR: content now server-fetches (cached); refresh hourly, sooner on admin
// revalidate. Previously this page was frozen static + client-fetched.
export const revalidate = 3600;

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/grad-guide/posing";
const TITLE = "How to Pose for Graduation Photos — Bay Area Guide";
const DESCRIPTION =
  "Natural, flattering graduation photo poses that actually look good on camera — posing tips for caps, gowns, and campus portraits across the Bay Area.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    siteName: "soloxsnaps",
  },
};

export default async function PosingPage() {
  const [testimonials, poses] = await Promise.all([
    getContextualTestimonials({ category: "grads", tag: "nervous" }, 1),
    getGradPoses(),
  ]);
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: TITLE,
    description: DESCRIPTION,
    mainEntityOfPage: `${SITE_URL}${PATH}`,
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: { "@type": "Organization", name: "soloxsnaps" },
  };
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Graduation Photo Guide", path: "/grad-guide" },
    { name: "Posing Guide", path: PATH },
  ]);
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />
      <PosingContent poses={poses} />
      {/* Reassurance right where nerves show up — a nervous-tagged grad client,
          falling back to any featured grad testimonial. */}
      <ContextualTestimonials
        testimonials={testimonials}
        eyebrow="Feeling camera-shy?"
        heading="Most grads feel awkward at first"
        subheading="You don't need to know how to pose — I direct every shot. Here's how it felt for someone who was nervous too."
        tint
      />
    </>
  );
}
