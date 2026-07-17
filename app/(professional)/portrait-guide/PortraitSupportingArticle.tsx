// Shared server-rendered template for the portrait-guide supporting article pages.
// Driven entirely by a SupportingTopic config, it renders breadcrumbs, hero, H2
// sections (paragraphs + optional ordered/unordered lists), a related-resources
// grid, an inquiry CTA, and Article + Breadcrumb JSON-LD. Adding a topic = a new
// config entry + a thin page.tsx; no template changes. Mirrors the couples guide.

import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { PORTRAIT_GUIDE_CSS } from "@/lib/portraitGuide/styles";
import { SUPPORTING_TOPICS, type SupportingTopic } from "@/lib/portraitGuide/supporting";

const SITE_URL = "https://www.soloxsnaps.com";
const PORTRAIT_CONTACT = "/contact?sessionType=Individual+Portrait";

export function buildSupportingMetadata(topic: SupportingTopic): Metadata {
  const path = `/portrait-guide/${topic.slug}`;
  return {
    title: topic.metaTitle,
    description: topic.metaDescription,
    alternates: { canonical: path },
    openGraph: { title: `${topic.metaTitle} | SoloXSnaps`, description: topic.metaDescription, url: path, type: "article", siteName: "soloxsnaps" },
    twitter: { card: "summary_large_image", title: `${topic.metaTitle} | SoloXSnaps`, description: topic.metaDescription },
  };
}

// Cross-links shown on every supporting page: the other supporting topics plus
// the core hub/locations/faq/pricing resources.
function relatedFor(slug: string) {
  const others = Object.values(SUPPORTING_TOPICS)
    .filter((t) => t.slug !== slug)
    .map((t) => ({ href: `/portrait-guide/${t.slug}`, title: t.h1, desc: t.hubPreview }));
  return [
    { href: "/portrait-guide", title: "Lifestyle Portrait Guide", desc: "The full planning hub." },
    { href: "/portrait-guide/locations", title: "Portrait Photo Locations", desc: "San Francisco & Bay Area spots." },
    ...others,
    { href: "/portrait-guide/faq", title: "Portrait FAQ", desc: "Booking, posing nerves, delivery, and more." },
    { href: "/pricing", title: "Pricing", desc: "Session options and what's included." },
  ];
}

export default function PortraitSupportingArticle({ topic }: { topic: SupportingTopic }) {
  const path = `/portrait-guide/${topic.slug}`;
  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Portrait Guide", path: "/portrait-guide" },
    { name: topic.h1, path },
  ]);
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: topic.h1,
    description: topic.metaDescription,
    mainEntityOfPage: `${SITE_URL}${path}`,
    image: `${SITE_URL}/portrait-guide/opengraph-image`,
    author: { "@type": "Person", name: "Chris Solorzano" },
    publisher: { "@type": "Organization", name: "SoloXSnaps Photography", url: SITE_URL },
    dateModified: new Date().toISOString().slice(0, 10),
  };

  return (
    <main className="fg-page">
      <style>{PORTRAIT_GUIDE_CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd).replace(/</g, "\\u003c") }} />

      <nav className="fg-crumbs fg-shell" aria-label="Breadcrumb">
        <ol>
          <li><Link href="/">Home</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li><Link href="/portrait-guide">Portrait Guide</Link><span className="fg-crumb-sep" aria-hidden="true">/</span></li>
          <li aria-current="page">{topic.h1}</li>
        </ol>
      </nav>

      <section className="fg-hero" style={{ paddingTop: 28 }}>
        <div className="fg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="fg-kicker"><span className="fg-kicker-dot" /> {topic.kicker}</p>
          <h1 className="fg-h1">{topic.h1}</h1>
          <p className="fg-sub">{topic.intro}</p>
          <div className="fg-actions">
            <Link href={PORTRAIT_CONTACT} className="fg-btn fg-btn--primary">Inquire about a session →</Link>
            <Link href="/portrait-guide" className="fg-btn fg-btn--ghost">Back to the portrait guide</Link>
          </div>
        </div>
      </section>

      <section className="fg-section fg-section--alt">
        <div className="fg-shell">
          <div className="fg-prose">
            {topic.sections.map((s) => (
              <div key={s.h2} className="fg-topic" data-reveal>
                <h2>{s.h2}</h2>
                {s.paras?.map((p, i) => <p key={i}>{p}</p>)}
                {s.list && (
                  s.ordered
                    ? <ol className="fg-list">{s.list.map((it, i) => <li key={i}>{it}</li>)}</ol>
                    : <ul className="fg-list">{s.list.map((it, i) => <li key={i}>{it}</li>)}</ul>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="fg-section">
        <div className="fg-shell">
          <p className="fg-sec-kicker" data-reveal>Keep planning</p>
          <h2 className="fg-sec-title" data-reveal>Related portrait resources</h2>
          <div className="fg-related">
            {relatedFor(topic.slug).map((l) => (
              <Link key={l.href} href={l.href} data-reveal data-delay="1">
                <span className="fg-related-title">{l.title}</span>
                <span className="fg-related-desc">{l.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="fg-cta">
        <div className="fg-shell">
          <div className="fg-cta-card glass-shimmer" data-reveal>
            <h2 className="fg-cta-title">Ready to plan your portraits?</h2>
            <p className="fg-cta-sub">Send your date, what the photos are for, and the look you have in mind — I&rsquo;ll guide the rest.</p>
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
