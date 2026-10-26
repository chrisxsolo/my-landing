import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { PRICING_CATALOG, getGraduationTravelNote } from "@/lib/pricingCatalog";
import { buildBookingIntentParams } from "@/lib/bookingIntent";
import SchoolLandingDetails from "./SchoolLandingDetails";
import { SCHOOL_LANDING_CSS } from "./schoolLandingStyles";
import SchoolGallery from "./SchoolGallery";
import SchoolHero from "./SchoolHero";
import { getSchoolPagePhotos, type PagePhoto } from "@/lib/pagePhotos/publicPages";
import { DEFAULT_PHOTO_RATIO } from "@/lib/couplesPortfolio";
import SchoolSessionGuide, { type SchoolFaq } from "./SchoolSessionGuide";
import SchoolClusterLinks from "./SchoolClusterLinks";
import ContentEventBeacon from "@/app/components/ContentEventBeacon";
import ContextualTestimonials from "@/app/components/ContextualTestimonials";
import { getContextualTestimonials, testimonialMatchesSchool } from "@/lib/testimonialsData";
import { getBlogPostSummaries } from "@/lib/professionalData";
import { detectSchoolLink } from "@/lib/portfolioCategoryContent";
import type { SchoolSpotsGuide } from "./schoolSpotsGuideTypes";

// ── TYPES ─────────────────────────────────────────────────────────────────────

export interface SchoolSpot {
  name: string;
  description: string;
  bestTime?: string;             // short best-time phrase, surfaced on the /spots page
  key?: string;                  // lib/schoolSpots key — enables tagged photos on the guide
  priority?: "must-have" | "recommended";
  officialName?: string;         // official campus name, e.g. "Diaz Compean Student Union"
  details?: string[];            // long-form paragraphs for the location guide
  photoIdeas?: string[];         // suggested shots at this spot
}

export interface SchoolLandingData {
  school: string;                // "UC Berkeley"
  schoolShort: string;           // "Berkeley"
  slug: keyof typeof PRICING_CATALOG.graduation.travelFees;
  city: string;                  // "Berkeley, CA"
  metaTitle: string;
  metaDescription: string;
  canonicalPath: string;         // "/grads/uc-berkeley"
  heroTagline: string;           // sentence under the h1
  bodyIntro: string;             // 2-3 sentences about the school
  spots: SchoolSpot[];           // 3–4 notable campus spots
  sessionNote?: string;          // optional timing/season note
  heroImage?: string;            // optional Supabase image URL
  bestTime?: string;             // campus-specific best time of day / light
  whatToWear?: string;           // campus-tuned wardrobe guidance
  faqs?: SchoolFaq[];            // 3–4 campus-specific Q&A (drives FAQPage schema)
  spotsGuide?: SchoolSpotsGuide; // long-form /spots location guide (else the compact list)
}

/** Recent journal posts about this campus, via the same matcher the posts use. */
export async function getSchoolRelatedPosts(slug: string, limit = 3) {
  const campusPath = `/grads/${slug}`;
  return (await getBlogPostSummaries("professional"))
    .filter((post) => detectSchoolLink(`${post.title} ${post.slug}`)?.href === campusPath)
    .slice(0, limit)
    .map((post) => ({ slug: post.slug, title: post.title }));
}

export function buildSchoolMetadata(data: SchoolLandingData): Metadata {
  return {
    title: data.metaTitle,
    description: data.metaDescription,
    alternates: { canonical: data.canonicalPath },
    keywords: [
      `${data.school} graduation photographer`,
      `${data.schoolShort} grad photos`,
      `Bay Area graduation photographer`,
      `graduation photography ${data.city}`,
      "soloxsnaps",
    ],
    openGraph: {
      title: data.metaTitle,
      description: data.metaDescription,
      type: "website",
      siteName: "soloxsnaps",
    },
  };
}

// ── TEMPLATE COMPONENT ────────────────────────────────────────────────────────

export default async function SchoolLandingTemplate({ data }: { data: SchoolLandingData }) {
  const travelNote = getGraduationTravelNote(data.slug);
  const contactParams = buildBookingIntentParams({
    sourcePage: "school-page",
    sessionType: "Graduation Portrait",
    school: data.school,
  });
  const [matchedTestimonials, pagePhotos] = await Promise.all([
    getContextualTestimonials({ category: "grads", school: data.schoolShort }, 2),
    getSchoolPagePhotos(data.slug),
  ]);
  // Hero: the curated pool hero, else the optional static image in data.ts.
  const heroPhoto: PagePhoto | null = pagePhotos.hero ?? (data.heroImage
    ? { id: "static-hero", image_url: data.heroImage, alt: `${data.school} graduation portrait by soloxsnaps`, caption: null, ...DEFAULT_PHOTO_RATIO }
    : null);
  // Trust hierarchy: prefer this exact campus; otherwise fall back to the
  // regional grad pool. Only keep the school-specific heading when every card
  // shown is actually from this school — never put another campus's review
  // under "<School> grads". With no exact-school proof, the block degrades to
  // honest "Bay Area grads" copy instead.
  const schoolProof = matchedTestimonials.filter((testimonial) =>
    testimonialMatchesSchool(testimonial, data.schoolShort),
  );
  const isSchoolSpecific = schoolProof.length > 0;
  const testimonials = isSchoolSpecific ? schoolProof : matchedTestimonials;

  // Recent journal sessions for this campus. Reuses the same matcher that builds
  // the in-article link on /blog/[slug], so the campus↔post links stay symmetric.
  const relatedPosts = await getSchoolRelatedPosts(data.slug);

  return (
    <main className="school-page">
      <ContentEventBeacon contentType="school_page" contentId={data.slug} />
      <style>{SCHOOL_LANDING_CSS}</style>

      {/* JSON-LD for local SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ProfessionalService",
            name: "soloxsnaps",
            url: "https://www.soloxsnaps.com",
            founder: { "@type": "Person", name: "Chris Solorzano" },
            areaServed: [data.city, "Bay Area", "San Francisco"],
            serviceType: [`${data.school} graduation photography`],
            description: data.metaDescription,
            ...(heroPhoto ? { image: heroPhoto.image_url } : {}),
          }).replace(/</g, "\\u003c"),
        }}
      />

      {/* Breadcrumb JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            buildBreadcrumbJsonLd([
              { name: "Home", path: "/" },
              { name: `${data.school} Graduation Photographer`, path: data.canonicalPath },
            ])
          ).replace(/</g, "\\u003c"),
        }}
      />

      {/* ── HERO + GALLERY ── real photos from this campus come first, so
           visitors see the work before the planning details. */}
      <SchoolHero
        school={data.school}
        tagline={data.heroTagline}
        contactHref={`/contact?${contactParams}`}
        photo={heroPhoto}
      />
      <SchoolGallery
        slug={data.slug}
        schoolShort={data.schoolShort}
        photos={pagePhotos.gallery}
        matchedCount={pagePhotos.matchedCount}
      />

      <SchoolLandingDetails
        schoolShort={data.schoolShort}
        slug={data.slug}
        bodyIntro={data.bodyIntro}
        travelNote={travelNote}
        sessionNote={data.sessionNote}
        spots={data.spots}
      />

      {/* Per-campus depth: best time / light, campus-tuned wardrobe, and a
          campus FAQ (with FAQPage schema). One strong page beats thin per-topic
          pages — these render only when the campus data file provides them. */}
      <SchoolSessionGuide
        schoolShort={data.schoolShort}
        bestTime={data.bestTime}
        whatToWear={data.whatToWear}
        faqs={data.faqs}
      />

      {/* School-matched social proof — shows nothing until a matching, featured
          testimonial exists for this campus (or grads generally). The heading
          only claims this campus when the cards are actually from here. */}
      <ContextualTestimonials
        testimonials={testimonials}
        heading={
          isSchoolSpecific
            ? `${data.schoolShort} grads on working with me`
            : "What Bay Area grads say about working with me"
        }
        subheading={
          isSchoolSpecific
            ? `What recent ${data.school} graduates say about their session.`
            : "Recent graduates from across the Bay Area on their session with me."
        }
        tint
      />

      {/* Hub → spoke: route visitors (and link equity) from this campus money-page
          into the planning guides, FAQ, recent campus sessions, and sibling
          campuses. Spoke → hub already exists from the guides and journal posts. */}
      <SchoolClusterLinks
        slug={data.slug}
        schoolShort={data.schoolShort}
        relatedPosts={relatedPosts}
      />

      {/* ── CTA ───────────────────────────────────────────────────────────────── */}
      <section className="school-cta">
        <div className="school-shell">
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div className="school-cta-card">
              <h2 className="school-cta-title">
                Ready to book your {data.schoolShort} grad session?
              </h2>
              <p className="school-cta-sub">
                Send the date, campus, and headcount. Most inquiries receive a response within 24 hours, with availability and next steps.
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                <Link href={`/contact?${contactParams}`} className="school-link school-link--primary">
                  Inquire now
                </Link>
                <Link href="/pricing/grads" className="school-link school-link--ghost">
                  View full pricing
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
