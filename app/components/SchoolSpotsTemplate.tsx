import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { buildBookingIntentParams } from "@/lib/bookingIntent";
import type { SchoolLandingData } from "./SchoolLandingTemplate";
import SchoolSpotsGuidePage from "./SchoolSpotsGuidePage";
import { SPOTS_BASE_CSS } from "./schoolSpotsBaseStyles";

// Dedicated "Best <School> Graduation Photo Spots" page. Targets the distinct
// search intent ("best <school> grad photo spots", "<landmark> graduation
// photos") that the commercial landing page ("<school> graduation photographer")
// doesn't. Reuses the campus's spots[] data — single source of truth in the
// colocated data.ts — and links back to the landing page (the cluster hub).
// When data.ts also provides a spotsGuide, the long-form guide renders instead.

export function buildSpotsMetadata(data: SchoolLandingData): Metadata {
  const guide = data.spotsGuide;
  if (guide) {
    return {
      title: guide.metaTitle,
      description: guide.metaDescription,
      alternates: { canonical: `${data.canonicalPath}/spots` },
      keywords: [...guide.keywords, "soloxsnaps"],
      openGraph: { title: guide.metaTitle, description: guide.metaDescription, type: "website", siteName: "soloxsnaps" },
    };
  }
  const title = `Best ${data.school} Graduation Photo Spots`;
  const topSpots = data.spots.slice(0, 3).map((s) => s.name).join(", ");
  const description = `The best places for graduation photos at ${data.school}${
    topSpots ? ` — ${topSpots} and more` : ""
  }, with the best time of day for each. Guided grad sessions by Chris Solorzano.`;
  return {
    title,
    description,
    alternates: { canonical: `${data.canonicalPath}/spots` },
    keywords: [
      `best ${data.school} graduation photo spots`,
      `${data.schoolShort} graduation photo locations`,
      `where to take grad photos at ${data.school}`,
      `${data.school} graduation photographer`,
      "soloxsnaps",
    ],
    openGraph: { title, description, type: "website", siteName: "soloxsnaps" },
  };
}


export default function SchoolSpotsTemplate({ data }: { data: SchoolLandingData }) {
  // A campus with a long-form location guide renders it at the same URL.
  if (data.spotsGuide) return <SchoolSpotsGuidePage data={data} guide={data.spotsGuide} />;
  const spotsPath = `${data.canonicalPath}/spots`;
  const contactParams = buildBookingIntentParams({
    sourcePage: "school-spots-page",
    sessionType: "Graduation Portrait",
    school: data.school,
  });

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: `${data.school} Graduation Photographer`, path: data.canonicalPath },
    { name: "Photo Spots", path: spotsPath },
  ]);
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Best ${data.school} graduation photo spots`,
    itemListElement: data.spots.map((spot, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: spot.name,
    })),
  };

  return (
    <main className="sp-page">
      <style>{SPOTS_BASE_CSS}</style>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c") }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListLd).replace(/</g, "\\u003c") }}
      />

      <section className="sp-hero">
        <div className="sp-shell">
          <p className="sp-crumb">
            <Link href={data.canonicalPath}>{data.school} Graduation Photographer</Link>
            <span> / Photo Spots</span>
          </p>
          <h1 className="sp-h1">Best {data.school} Graduation Photo Spots</h1>
          <p className="sp-sub">
            My favorite places to shoot grad portraits at {data.schoolShort}, with the best
            time of day for each. In a session we usually cover two or three of these, routed
            so the light and crowds work in your favor.
          </p>
          <div className="sp-actions">
            <Link href={`/contact?${contactParams}`} className="sp-btn sp-btn--primary">
              Book your {data.schoolShort} session
            </Link>
            <Link href={data.canonicalPath} className="sp-btn sp-btn--ghost">
              {data.schoolShort} grad photography
            </Link>
          </div>
        </div>
      </section>

      <section className="sp-list">
        <div className="sp-shell">
          {data.spots.map((spot, i) => (
            <article key={spot.name} className="sp-spot">
              <div className="sp-num">{String(i + 1).padStart(2, "0")}</div>
              <div>
                <h2 className="sp-spot-name">{spot.name}</h2>
                {spot.bestTime && (
                  <span className="sp-chip">
                    <span className="sp-chip-label">Best time:</span> {spot.bestTime}
                  </span>
                )}
                <p className="sp-desc">{spot.description}</p>
              </div>
            </article>
          ))}

          <div className="sp-foot">
            <h2 className="sp-foot-title">Planning your {data.schoolShort} grad session</h2>
            <p className="sp-foot-copy">
              I guide every session, so you don&rsquo;t need to memorize a shot list — just show up
              and I&rsquo;ll route us through the best spots for the day.
            </p>
            <div className="sp-foot-links">
              <Link href={data.canonicalPath} className="sp-pill">
                {data.schoolShort} grad photography <span aria-hidden>→</span>
              </Link>
              <Link href="/grad-guide/what-to-wear" className="sp-pill">
                What to wear <span aria-hidden>→</span>
              </Link>
              <Link href="/pricing/grads" className="sp-pill">
                Grad pricing <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="sp-cta">
        <div className="sp-shell">
          <h2 className="sp-cta-title">Ready to shoot at {data.schoolShort}?</h2>
          <p className="sp-cta-sub">
            Send your date, the spots you have in mind, and your headcount. Most inquiries receive a response within 24 hours.
          </p>
          <Link href={`/contact?${contactParams}`} className="sp-btn sp-btn--primary">
            Inquire now
          </Link>
        </div>
      </section>
    </main>
  );
}
