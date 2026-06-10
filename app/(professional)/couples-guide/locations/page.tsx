// COUPLES LOCATIONS HUB  →  soloxsnaps.com/couples-guide/locations
// Server component — metadata + CollectionPage/Breadcrumb JSON-LD. Summarizes each
// location and routes to the full, indexable location pages. Detailed copy lives on
// the individual pages, not here. Mirrors the family locations hub.

import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { COUPLES_GUIDE_CSS } from "@/lib/couplesGuide/styles";
import { locationDisplayName } from "@/lib/couplesGuide/types";
import { getCouplesLocationSummaries } from "@/lib/couplesGuide/locations";

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/couples-guide/locations";
const COUPLES_CONTACT = "/contact?sessionType=Couples+Session";

const TITLE = "Best Couples Photo Locations in San Francisco";
const DESCRIPTION =
  "Explore romantic and natural couples photo locations in San Francisco, including the Palace of Fine Arts, Crissy Field, Lovers' Lane, the Legion of Honor, and Ocean Beach.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  keywords: [
    "best couples photo locations San Francisco",
    "couples photography locations Bay Area",
    "couples photo locations San Francisco",
    "San Francisco couples photographer",
    "engagement photo locations San Francisco",
  ],
  openGraph: { title: TITLE, description: DESCRIPTION, url: PATH, type: "website", siteName: "soloxsnaps" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function CouplesLocationsHubPage() {
  const locations = getCouplesLocationSummaries();

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Couples Guide", path: "/couples-guide" },
    { name: "Couples Photo Locations", path: PATH },
  ]);

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: TITLE,
    description: DESCRIPTION,
    isPartOf: { "@type": "WebSite", name: "soloxsnaps", url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      name: "Couples photo locations",
      numberOfItems: locations.length,
      itemListElement: locations.map((loc, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}${loc.canonicalPath}`,
        name: `${locationDisplayName(loc)} couples photography`,
      })),
    },
  };

  return (
    <main className="fg-page">
      <style>{COUPLES_GUIDE_CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />

      {/* ── Breadcrumbs ──────────────────────────────────────────────────── */}
      <nav className="fg-crumbs fg-shell" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li><Link href="/couples-guide">Couples Guide</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li aria-current="page">Couples Photo Locations</li>
        </ol>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="fg-hero" style={{ paddingTop: 28 }}>
        <div className="fg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="fg-kicker fg-afu1"><span className="fg-kicker-dot fg-dot" /> Couples Photo Locations</p>
          <h1 className="fg-h1 fg-afu2">Best Couples Photo Locations in San Francisco</h1>
          <p className="fg-sub fg-afu3">
            The right spot depends on the two of you — the atmosphere you want, architecture
            versus nature, how much privacy you&rsquo;d like, how far you want to walk, and the
            time of day. The best location comes from your personalities and visual goals, not
            just the most famous landmark. Whether you want elegant architecture, open beach,
            quiet greenery, or a waterfront view, there&rsquo;s a fit here. I guide the posing,
            movement, and pacing throughout, so the session stays natural and relaxed.
          </p>
          <div className="fg-actions fg-afu4">
            <Link href={COUPLES_CONTACT} className="fg-btn fg-btn--primary">Inquire about a session →</Link>
            <Link href="/couples-guide" className="fg-btn fg-btn--ghost">Back to the couples guide</Link>
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
                  <div className="fg-loc-ph"><span aria-hidden="true">💞</span><p>Photos coming soon</p></div>
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
                  <span className="fg-loc-link">View {locationDisplayName(loc)} couples photography →</span>
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
            <p className="fg-cta-sub">Tell me about the two of you and the look you want — I&rsquo;ll help you choose the right spot, time, and pacing.</p>
            <div className="fg-cta-actions">
              <Link href={COUPLES_CONTACT} className="fg-btn fg-btn--ongreen">Inquire about a session →</Link>
              <Link href="/pricing/couples" className="fg-btn fg-btn--onghost">See couples pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
