import type { Metadata } from "next";
import Link from "next/link";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { buildBookingIntentParams } from "@/lib/bookingIntent";
import type { SchoolLandingData } from "./SchoolLandingTemplate";

// Dedicated "Best <School> Graduation Photo Spots" page. Targets the distinct
// search intent ("best <school> grad photo spots", "<landmark> graduation
// photos") that the commercial landing page ("<school> graduation photographer")
// doesn't. Reuses the campus's spots[] data — single source of truth in the
// colocated data.ts — and links back to the landing page (the cluster hub).

export function buildSpotsMetadata(data: SchoolLandingData): Metadata {
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

const CSS = `
  .sp-page {
    background: #f5f6f4; color: #101412;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  .sp-shell { width: min(900px, calc(100% - 48px)); margin: 0 auto; }

  .sp-hero {
    padding: 110px 0 60px;
    background:
      radial-gradient(ellipse 65% 60% at 5% 15%, rgba(162,210,196,0.16) 0%, transparent 60%),
      linear-gradient(to bottom, #eaf0ec 0%, #f5f6f4 100%);
    border-bottom: 1px solid rgba(18,24,22,0.07);
  }
  .sp-crumb { margin: 0 0 14px; font-size: 13.5px; }
  .sp-crumb a { color: #3d6b5e; font-weight: 760; text-decoration: none; }
  .sp-crumb a:hover { text-decoration: underline; }
  .sp-crumb span { color: #94a39d; }
  .sp-h1 {
    margin: 0; color: #101412;
    font-size: clamp(2.1rem, 4.6vw, 3.4rem); font-weight: 880;
    letter-spacing: -0.025em; line-height: 1; text-wrap: balance; max-width: 760px;
  }
  .sp-sub {
    margin: 20px 0 28px; color: #4b5a55;
    font-size: 18px; line-height: 1.7; max-width: 600px; text-wrap: pretty;
  }
  .sp-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .sp-btn {
    min-height: 46px; display: inline-flex; align-items: center; justify-content: center;
    padding: 0 20px; border-radius: 8px; font-size: 14px; font-weight: 820; text-decoration: none;
    transition: transform .18s ease, background .18s ease, box-shadow .18s ease, border-color .18s ease;
  }
  .sp-btn--primary {
    border: 1px solid rgba(112,139,133,0.22); background: rgba(246,250,248,0.94); color: #4f6d67;
    box-shadow: 0 8px 24px rgba(112,139,133,0.05);
  }
  .sp-btn--primary:hover { transform: translateY(-1px); background: rgba(239,246,244,0.98); box-shadow: 0 12px 28px rgba(112,139,133,0.07); }
  .sp-btn--ghost { border: 1px solid rgba(18,24,22,0.12); background: rgba(255,255,255,0.72); color: #101412; }
  .sp-btn--ghost:hover { transform: translateY(-1px); background: #fff; box-shadow: 0 10px 22px rgba(18,24,22,0.06); }

  .sp-list { padding: 64px 0 24px; }
  .sp-spot {
    display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 18px;
    padding: 26px 0; border-top: 1px solid rgba(18,24,22,0.09);
  }
  .sp-spot:first-child { border-top: none; padding-top: 0; }
  .sp-num {
    font-size: 30px; font-weight: 880; line-height: 1; letter-spacing: -0.02em;
    color: rgba(112,139,133,0.5);
  }
  .sp-spot-name { margin: 0 0 8px; color: #101412; font-size: 21px; font-weight: 860; letter-spacing: -0.015em; line-height: 1.2; }
  .sp-chip {
    display: inline-flex; align-items: center; gap: 6px; margin: 0 0 12px;
    padding: 4px 11px; border-radius: 999px;
    background: rgba(112,139,133,0.12); color: #3d6b5e;
    font-size: 12px; font-weight: 800; letter-spacing: 0.03em;
  }
  .sp-chip-label { color: #667f79; font-weight: 820; }
  .sp-desc { margin: 0; color: #4b5a55; font-size: 16px; line-height: 1.72; text-wrap: pretty; }

  .sp-foot {
    margin-top: 40px; padding: 30px; border-radius: 16px;
    background: #ffffff; border: 1px solid rgba(18,24,22,0.08); box-shadow: 0 8px 28px rgba(18,24,22,0.05);
  }
  .sp-foot-title { margin: 0 0 8px; color: #101412; font-size: 19px; font-weight: 860; letter-spacing: -0.01em; }
  .sp-foot-copy { margin: 0 0 16px; color: #4b5a55; font-size: 15px; line-height: 1.65; }
  .sp-foot-links { display: flex; flex-wrap: wrap; gap: 10px; }
  .sp-pill {
    display: inline-flex; align-items: center; gap: 6px; padding: 9px 15px; border-radius: 999px; text-decoration: none;
    background: rgba(247,250,248,0.9); border: 1px solid rgba(112,139,133,0.22); color: #3d6b5e; font-size: 13.5px; font-weight: 780;
    transition: background .18s ease, transform .18s ease, box-shadow .18s ease;
  }
  .sp-pill:hover { transform: translateY(-1px); background: #fff; box-shadow: 0 8px 20px rgba(18,24,22,0.07); }

  .sp-cta { padding: 48px 0 100px; text-align: center; }
  .sp-cta-title { margin: 0 0 10px; color: #101412; font-size: clamp(1.5rem, 3vw, 2.1rem); font-weight: 880; letter-spacing: -0.02em; }
  .sp-cta-sub { margin: 0 auto 22px; max-width: 440px; color: #4b5a55; font-size: 15px; line-height: 1.6; }

  @media (max-width: 760px) {
    .sp-hero { padding: 100px 0 48px; }
    .sp-sub { font-size: 16px; }
    .sp-list { padding: 52px 0 20px; }
    .sp-spot { grid-template-columns: 40px minmax(0, 1fr); gap: 14px; }
    .sp-num { font-size: 24px; }
  }
`;

export default function SchoolSpotsTemplate({ data }: { data: SchoolLandingData }) {
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
      <style>{CSS}</style>
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
            Send your date, the spots you have in mind, and your headcount. I&rsquo;ll reply within 24 hours.
          </p>
          <Link href={`/contact?${contactParams}`} className="sp-btn sp-btn--primary">
            Inquire now
          </Link>
        </div>
      </section>
    </main>
  );
}
