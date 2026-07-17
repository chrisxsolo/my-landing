// PORTRAIT LOCATIONS HUB  →  soloxsnaps.com/portrait-guide/locations
// Server component — metadata + CollectionPage/Breadcrumb JSON-LD. Summarizes each
// location and routes to the full, indexable location pages. Detailed copy lives on
// the individual pages, not here. Mirrors the couples locations hub.

import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { PORTRAIT_GUIDE_CSS } from "@/lib/portraitGuide/styles";
import { locationDisplayName } from "@/lib/portraitGuide/types";
import { getPortraitLocationSummaries } from "@/lib/portraitGuide/locations";

const SITE_URL = "https://www.soloxsnaps.com";
const PATH = "/portrait-guide/locations";
const PORTRAIT_CONTACT = "/contact?sessionType=Individual+Portrait";

const TITLE = "Best Portrait Photo Locations in San Francisco";
const DESCRIPTION =
  "Explore natural, urban, and iconic portrait photo locations in San Francisco, including Golden Gate Park, the Palace of Fine Arts, the Embarcadero, Baker Beach, and the Mission District murals.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  keywords: [
    "best portrait photo locations San Francisco",
    "portrait photography locations Bay Area",
    "photoshoot locations San Francisco",
    "San Francisco portrait photographer",
    "lifestyle photoshoot locations San Francisco",
  ],
  openGraph: { title: TITLE, description: DESCRIPTION, url: PATH, type: "website", siteName: "soloxsnaps" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

export default function PortraitLocationsHubPage() {
  const locations = getPortraitLocationSummaries();

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Portrait Guide", path: "/portrait-guide" },
    { name: "Portrait Photo Locations", path: PATH },
  ]);

  const collectionLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: TITLE,
    description: DESCRIPTION,
    isPartOf: { "@type": "WebSite", name: "soloxsnaps", url: SITE_URL },
    mainEntity: {
      "@type": "ItemList",
      name: "Portrait photo locations",
      numberOfItems: locations.length,
      itemListElement: locations.map((loc, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}${loc.canonicalPath}`,
        name: `${locationDisplayName(loc)} portrait photography`,
      })),
    },
  };

  return (
    <main className="fg-page">
      <style>{PORTRAIT_GUIDE_CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionLd).replace(/</g, "\\u003c") }} />

      {/* ── Breadcrumbs ──────────────────────────────────────────────────── */}
      <nav className="fg-crumbs fg-shell" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li><Link href="/portrait-guide">Portrait Guide</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li aria-current="page">Portrait Photo Locations</li>
        </ol>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="fg-hero" style={{ paddingTop: 28 }}>
        <div className="fg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="fg-kicker fg-afu1"><span className="fg-kicker-dot fg-dot" /> Portrait Photo Locations</p>
          <h1 className="fg-h1 fg-afu2">Best Portrait Photo Locations in San Francisco</h1>
          <p className="fg-sub fg-afu3">
            The right spot depends on you — the mood you want, nature versus architecture versus
            city color, how much privacy you&rsquo;d like, and the time of day. The best location
            comes from your personality and what the photos are for, not just the most famous
            landmark. Whether you want soft greenery, elegant columns, waterfront energy, iconic
            coast, or bold murals, there&rsquo;s a fit here. I guide the posing, movement, and
            pacing throughout, so the session stays natural and relaxed.
          </p>
          <div className="fg-actions fg-afu4">
            <Link href={PORTRAIT_CONTACT} className="fg-btn fg-btn--primary">Inquire about a session →</Link>
            <Link href="/portrait-guide" className="fg-btn fg-btn--ghost">Back to the portrait guide</Link>
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
                  <div className="fg-loc-ph"><span aria-hidden="true">🙋</span><p>Photos coming soon</p></div>
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
                  <span className="fg-loc-link">View {locationDisplayName(loc)} portrait photography →</span>
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
            <p className="fg-cta-sub">Tell me about yourself and the look you want — I&rsquo;ll help you choose the right spot, time, and pacing.</p>
            <div className="fg-cta-actions">
              <Link href={PORTRAIT_CONTACT} className="fg-btn fg-btn--ongreen">Inquire about a session →</Link>
              <Link href="/pricing" className="fg-btn fg-btn--onghost">See pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
