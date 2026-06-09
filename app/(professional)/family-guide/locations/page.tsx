// FAMILY LOCATIONS HUB  →  soloxsnaps.com/family-guide/locations
// Server component — metadata + CollectionPage/Breadcrumb JSON-LD. Summarizes
// each location and routes to the full, indexable location pages. Detailed copy
// lives on the individual pages, not here.

import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { FAMILY_GUIDE_CSS } from "@/lib/familyGuide/styles";
import { locationDisplayName } from "@/lib/familyGuide/types";
import { getFamilyLocationSummaries } from "@/lib/familyGuide/locations";

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/family-guide/locations";
const FAMILY_CONTACT = "/contact?sessionType=Family+Session";

const TITLE = "Best Family Photo Locations in San Francisco and the Bay Area";
const DESCRIPTION =
  "Explore beautiful family photo locations in San Francisco and the Bay Area, including the Palace of Fine Arts, Crissy Field, Lovers' Lane, and Redwood Grove.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  keywords: [
    "best family photo locations in San Francisco",
    "family photography locations Bay Area",
    "family photo locations San Francisco",
    "San Francisco family photographer",
    "Bay Area family photographer",
  ],
  openGraph: { title: TITLE, description: DESCRIPTION, url: PATH, type: "website", siteName: "soloxsnaps" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function FamilyLocationsHubPage() {
  const locations = getFamilyLocationSummaries();

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Family Guide", path: "/family-guide" },
    { name: "Family Photo Locations", path: PATH },
  ]);

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: TITLE,
    description: DESCRIPTION,
    isPartOf: { "@type": "WebSite", name: "soloxsnaps", url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      name: "Family photo locations",
      numberOfItems: locations.length,
      itemListElement: locations.map((loc, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}${loc.canonicalPath}`,
        name: `${locationDisplayName(loc)} family photography`,
      })),
    },
  };

  return (
    <main className="fg-page">
      <style>{FAMILY_GUIDE_CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />

      {/* ── Breadcrumbs ──────────────────────────────────────────────────── */}
      <nav className="fg-crumbs fg-shell" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li><Link href="/family-guide">Family Guide</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li aria-current="page">Family Photo Locations</li>
        </ol>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="fg-hero" style={{ paddingTop: 28 }}>
        <div className="fg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="fg-kicker fg-afu1"><span className="fg-kicker-dot fg-dot" /> Family Photo Locations</p>
          <h1 className="fg-h1 fg-afu2">Best Family Photo Locations in San Francisco and the Bay Area</h1>
          <p className="fg-sub fg-afu3">
            The right spot depends on your family — the ages of your kids, how much walking feels
            comfortable, any accessibility needs, the scenery you love, and the time of year. Weather,
            wind, and light shift things too. Whether you want recognizable architecture, open beach,
            quiet greenery, or redwoods, there&rsquo;s a fit here. I provide posing and activity
            guidance throughout while keeping the session natural, candid, and lifestyle-focused.
          </p>
          <div className="fg-actions fg-afu4">
            <Link href={FAMILY_CONTACT} className="fg-btn fg-btn--primary">Inquire about a session →</Link>
            <Link href="/family-guide" className="fg-btn fg-btn--ghost">Back to the family guide</Link>
          </div>
        </div>
      </section>

      {/* ── Location cards ───────────────────────────────────────────────── */}
      <section className="fg-section">
        <div className="fg-shell--wide">
          <div className="fg-locs">
            {locations.map((loc) => (
              <Link key={loc.slug} href={loc.canonicalPath} className="fg-loc" data-reveal data-delay="1">
                <div className="fg-loc-media">
                  <div className="fg-loc-ph"><span aria-hidden="true">🌿</span><p>Photos coming soon</p></div>
                </div>
                <div className="fg-loc-body">
                  <span className="fg-loc-region">{loc.region}</span>
                  <h2 className="fg-loc-title">{locationDisplayName(loc)}</h2>
                  <p className="fg-loc-area">{loc.area}</p>
                  <p className="fg-loc-desc">{loc.cardSummary}</p>
                  <div className="fg-loc-meta">
                    <div><b>Best for:</b> {loc.bestFor}</div>
                    <div><b>Light:</b> {loc.lightingChar}</div>
                    <div><b>Access:</b> {loc.accessNote}</div>
                  </div>
                  <span className="fg-loc-link">View {locationDisplayName(loc)} family photography →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="fg-cta">
        <div className="fg-shell">
          <div className="fg-cta-card glass-shimmer" data-reveal>
            <h2 className="fg-cta-title">Not sure which location fits?</h2>
            <p className="fg-cta-sub">Tell me about your family and the look you want — I&rsquo;ll help you choose the right spot, time, and pacing.</p>
            <div className="fg-cta-actions">
              <Link href={FAMILY_CONTACT} className="fg-btn fg-btn--ongreen">Inquire about a session →</Link>
              <Link href="/pricing/families" className="fg-btn fg-btn--onghost">See family pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
