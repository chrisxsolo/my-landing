// Shared, server-rendered template for every individual couples-location page.
// Receives a typed CouplesLocationData config + server-fetched photos, and renders
// all sections (hero, why, variety, time, seasons, wardrobe, movement, parking,
// gallery, related links, CTA) plus Breadcrumb + ProfessionalService JSON-LD.
// Adding a location is a new config object — no new template code. Mirrors the
// family location template (shared fg-* design system).

import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { COUPLES_GUIDE_CSS } from "@/lib/couplesGuide/styles";
import { locationDisplayName, type CouplesLocationData } from "@/lib/couplesGuide/types";
import type { CouplesPhoto } from "@/lib/couplesGuide/photos";
import CouplesJournalStrip from "../../CouplesJournalStrip";
import ContentEventBeacon from "@/app/components/ContentEventBeacon";

const SITE_URL = "https://www.soloxsnaps.com";

function contactHref(name: string) {
  return `/contact?sessionType=Couples+Session&location=${encodeURIComponent(name)}`;
}

const relatedLinks = [
  { href: "/couples-guide", title: "Couples Photography Guide", desc: "Outfits, prep, light, and planning in one place." },
  { href: "/couples-guide/locations", title: "All Couples Photo Locations", desc: "Compare San Francisco couples spots." },
  { href: "/couples-guide/what-to-wear", title: "What to Wear", desc: "Coordinate without matching." },
  { href: "/couples-guide/how-to-prepare", title: "How to Prepare", desc: "Show up relaxed and ready." },
  { href: "/couples-guide/what-to-expect", title: "What to Expect", desc: "How a guided session flows." },
  { href: "/couples-guide/faq", title: "Couples FAQ", desc: "Booking, posing, delivery, and more." },
  { href: "/pricing/couples", title: "Couples Pricing", desc: "Session lengths and what's included." },
];

function Paragraphs({ items }: { items: string[] }) {
  return <>{items.map((p, i) => <p key={i}>{p}</p>)}</>;
}

export default function CouplesLocationTemplate({
  data,
  photos,
}: {
  data: CouplesLocationData;
  photos: CouplesPhoto[];
}) {
  const name = locationDisplayName(data);
  const hero = photos[0] ?? null;
  const inquireHref = contactHref(name);

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Couples Guide", path: "/couples-guide" },
    { name: "Couples Photo Locations", path: "/couples-guide/locations" },
    { name: name, path: data.canonicalPath },
  ]);

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "soloxsnaps",
    url: SITE_URL,
    founder: { "@type": "Person", name: "Chris Solorzano" },
    areaServed: [data.area, "San Francisco", "Bay Area"],
    serviceType: [`${data.name} couples photography`],
    description: data.metaDescription,
  };

  return (
    <main className="fg-page">
      <ContentEventBeacon contentType="guide_page" contentId={data.slug} />
      <style>{COUPLES_GUIDE_CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd).replace(/</g, "\\u003c") }} />

      {/* ── Breadcrumbs ──────────────────────────────────────────────────── */}
      <nav className="fg-crumbs fg-shell" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li><Link href="/couples-guide">Couples Guide</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li><Link href="/couples-guide/locations">Locations</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li aria-current="page">{name}</li>
        </ol>
      </nav>

      {/* ── 1. Hero ──────────────────────────────────────────────────────── */}
      <header className="fg-section fg-lhero">
        <div className="fg-shell">
          <p className="fg-kicker"><span className="fg-kicker-dot" /> {data.region} Couples Photography</p>
          <h1 className="fg-h1">{data.h1}</h1>
          <p className="fg-sub">{data.heroTagline}</p>
          <div className="fg-actions">
            <Link href={inquireHref} className="fg-btn fg-btn--primary">Inquire about a session →</Link>
            <Link href="/couples-guide/locations" className="fg-btn fg-btn--ghost">All couples locations</Link>
          </div>

          <div className="fg-lhero-media">
            {hero ? (
              <OptimizedPhoto src={hero.image_url} alt={hero.alt_text || data.heroAlt} sizes="(max-width: 960px) 92vw, 960px" priority quality={85} />
            ) : (
              <div className="fg-lhero-ph"><span aria-hidden="true">📷</span><p>A featured couples photo from this location appears here soon.</p></div>
            )}
          </div>

          <div className="fg-info">
            <div className="fg-info-item"><p className="fg-info-label">Where</p><p className="fg-info-value">{data.area}</p></div>
            <div className="fg-info-item"><p className="fg-info-label">Best for</p><p className="fg-info-value">{data.bestFor}</p></div>
            <div className="fg-info-item"><p className="fg-info-label">Light</p><p className="fg-info-value">{data.lightingChar}</p></div>
            <div className="fg-info-item"><p className="fg-info-label">Access</p><p className="fg-info-value">{data.accessNote}</p></div>
          </div>
        </div>
      </header>

      {/* ── Body sections ────────────────────────────────────────────────── */}
      <section className="fg-section fg-section--alt">
        <div className="fg-shell">
          <div className="fg-prose">
            <div className="fg-topic" data-reveal>
              <h2>Why {name} Works for Couples Photos</h2>
              <Paragraphs items={data.whyItWorks} />
            </div>

            <div className="fg-topic" data-reveal>
              <h2>What the Photos Can Look Like</h2>
              <Paragraphs items={data.photoVariety} />
              {data.photoVarietyList && (
                <ul className="fg-list">
                  {data.photoVarietyList.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              )}
            </div>

            <div className="fg-topic" data-reveal>
              <h2>Best Time of Day</h2>
              <Paragraphs items={data.bestTimeOfDay} />
            </div>

            <div className="fg-topic" data-reveal>
              <h2>Best Seasons</h2>
              <Paragraphs items={data.bestSeasons} />
            </div>

            <div className="fg-topic" data-reveal>
              <h2>What to Wear at {name}</h2>
              <Paragraphs items={data.whatToWear} />
              <p>
                For a head-to-toe approach, see the{" "}
                <Link href="/couples-guide/what-to-wear" className="fg-inline-link">what-to-wear guide</Link>.
              </p>
            </div>

            <div className="fg-topic" data-reveal>
              <h2>Movement and Interaction</h2>
              <Paragraphs items={data.movementInteraction} />
            </div>

            <div className="fg-topic" data-reveal>
              <h2>Parking and Arrival</h2>
              <Paragraphs items={data.parkingArrival} />
            </div>
          </div>
        </div>
      </section>

      {/* ── 9. Example gallery ───────────────────────────────────────────── */}
      <section className="fg-section">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>Gallery</p>
          <h2 className="fg-sec-title" data-reveal>{name} couples photos</h2>
          {photos.length > 0 ? (
            <div className="fg-gallery">
              {photos.map((photo) => (
                <div key={photo.id} className="fg-photo" data-reveal data-delay="1">
                  <OptimizedPhoto
                    src={photo.image_url}
                    alt={photo.alt_text || `${name} couples photography by soloxsnaps`}
                    sizes="(max-width: 620px) 50vw, 30vw"
                    quality={75}
                  />
                  {photo.caption && <div className="fg-photo-cap"><span>{photo.caption}</span></div>}
                </div>
              ))}
            </div>
          ) : (
            <div className="fg-empty" data-reveal>
              <p style={{ fontSize: 34, margin: "0 0 10px" }} aria-hidden="true">📷</p>
              <p style={{ fontWeight: 760, color: "var(--ink)" }}>
                {name} couples sessions will appear here as soon as Chris adds them.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ── 10. Related couples resources ────────────────────────────────── */}
      <section className="fg-section fg-section--alt">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>Keep planning</p>
          <h2 className="fg-sec-title" data-reveal>Related couples resources</h2>
          <div className="fg-related">
            {relatedLinks.map((l) => (
              <Link key={l.href} href={l.href} data-reveal data-delay="1">
                <span className="fg-related-title">{l.title}</span>
                <span className="fg-related-desc">{l.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Couples journal (renders only when couples posts exist) ───────── */}
      <CouplesJournalStrip />

      {/* ── 11. Final CTA ────────────────────────────────────────────────── */}
      <section className="fg-cta">
        <div className="fg-shell">
          <div className="fg-cta-card glass-shimmer" data-reveal>
            <h2 className="fg-cta-title">{data.ctaTitle}</h2>
            <p className="fg-cta-sub">{data.ctaBody}</p>
            <div className="fg-cta-actions">
              <Link href={inquireHref} className="fg-btn fg-btn--ongreen">Inquire about a session →</Link>
              <Link href="/pricing/couples" className="fg-btn fg-btn--onghost">See couples pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
