// Long-form school photo location guide (/grads/<slug>/spots), used when the
// campus data file provides a spotsGuide. Photos come from the shared page
// photo pool: the school page's curated hero, photographer-tagged photos per
// spot (Admin → Page Photos → Guide spot), and the rest as a gallery. Every
// photo section renders nothing until it has an eligible photo.
import Link from "next/link";
import type { CSSProperties } from "react";
import { buildBreadcrumbJsonLd } from "@/lib/breadcrumbs";
import { buildBookingIntentParams } from "@/lib/bookingIntent";
import { C } from "@/lib/colors";
import { getSchoolSpotsGuidePhotos, type PagePhoto } from "@/lib/pagePhotos/publicPages";
import { getPublicSpotNotes } from "@/lib/pagePhotos/spotNoteStore";
import { getPublicSpotConditions } from "@/lib/pagePhotos/spotConditionStore";
import MasonryGallery from "@/app/components/photoGallery/MasonryGallery";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { getSchoolRelatedPosts, type SchoolLandingData, type SchoolSpot } from "./SchoolLandingTemplate";
import type { SchoolSpotsGuide } from "./schoolSpotsGuideTypes";
import SchoolSessionGuide from "./SchoolSessionGuide";
import { GuideSection, SpotArticle, spotId } from "./SchoolSpotsGuideParts";
import { OFF_CAMPUS_ID, OffCampusSection, PLANS_ID, SessionPlansSection } from "./SchoolSpotsGuideExtras";
import SchoolSunsetTimes from "./SchoolSunsetTimes";
import { SPOTS_BASE_CSS } from "./schoolSpotsBaseStyles";
import { SPOTS_GUIDE_CSS } from "./schoolSpotsGuideStyles";

const GALLERY_VARS = { "--mg-placeholder": C.proAccentSoft, "--mg-focus": C.proAccent } as CSSProperties;

type Props = { data: SchoolLandingData; guide: SchoolSpotsGuide };

function jsonLd(value: unknown) {
  return { __html: JSON.stringify(value).replace(/</g, "\\u003c") };
}

type MustHavesProps = { spots: SchoolSpot[]; bySpot: Record<string, PagePhoto[]>; lead: string; heading: string };

function MustHaves({ spots, bySpot, lead, heading }: MustHavesProps) {
  if (spots.length === 0) return null;
  return (
    <section className="spg-musts" aria-labelledby="spg-musts-title">
      <div className="sp-shell">
        <h2 id="spg-musts-title" className="sp-foot-title">{heading}</h2>
        <p className="spg-lead">{lead}</p>
        <div className="spg-must-grid">
          {spots.map((spot) => {
            const photo = spot.key ? bySpot[spot.key]?.[0] : undefined;
            return (
              <a key={spot.name} href={`#${spotId(spot)}`} className={`spg-must${photo ? " spg-must--photo" : ""}`}>
                {photo && (
                  <span className="spg-must-img" style={{ display: "block" }}>
                    <OptimizedPhoto src={photo.image_url} alt="" sizes="(max-width: 760px) 88px, 290px" loading="lazy" objectPosition="50% 35%" />
                  </span>
                )}
                <span className="spg-must-name">{spot.name} →</span>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Route({ guide, spots }: { guide: SchoolSpotsGuide; spots: SchoolSpot[] }) {
  const byKey = new Map(spots.filter((s) => s.key).map((s) => [s.key as string, s]));
  return (
    <section id="route" className="spg-section">
      <div className="sp-shell">
        <h2 className="spg-h2">{guide.route.heading}</h2>
        {guide.route.intro.map((p) => <p key={p} className="spg-copy">{p}</p>)}
        <ol className="spg-route">
          {guide.route.steps.map((step) => {
            const spot = byKey.get(step.spotKey);
            return (
              <li key={step.spotKey}>
                {step.text}{" "}
                {spot && <a href={`#${spotId(spot)}`}>About this spot</a>}
              </li>
            );
          })}
        </ol>
        {guide.route.notes.map((p) => <p key={p} className="spg-copy">{p}</p>)}
      </div>
    </section>
  );
}

function GuideHero({ data, guide, hero, contactHref }: Props & { hero: PagePhoto | null; contactHref: string }) {
  return (
    <section className={`sp-hero${hero ? " spg-hero--photo" : ""}`}>
      <div className="spg-wide spg-hero-grid">
        <div className="spg-hero-copy">
          <p className="sp-crumb">
            <Link href={data.canonicalPath}>{data.school} Graduation Photographer</Link>
            <span> / Photo Locations</span>
          </p>
          <h1 className="sp-h1" style={{ marginBottom: 20 }}>{guide.h1}</h1>
          {guide.intro.map((p) => <p key={p}>{p}</p>)}
          <div className="sp-actions">
            <Link href={contactHref} className="sp-btn sp-btn--primary">Book your {data.schoolShort} session</Link>
            <Link href={`/portfolio?category=grads&school=${data.slug}`} className="sp-btn sp-btn--ghost">Graduation portfolio</Link>
          </div>
        </div>
        {hero && (
          <figure className="spg-hero-frame" style={{ aspectRatio: `${hero.width} / ${hero.height}` }}>
            <OptimizedPhoto src={hero.image_url} alt={hero.alt} sizes="(max-width: 860px) 92vw, 440px" priority objectPosition="50% 35%" />
          </figure>
        )}
      </div>
    </section>
  );
}

function JumpNav({ spots, guide }: { spots: SchoolSpot[]; guide: SchoolSpotsGuide }) {
  return (
    <nav className="spg-jump" aria-label="On this page">
      <div className="sp-shell">
        <ul className="spg-jump-list">
          {spots.map((spot) => (
            <li key={spot.name}><a className="spg-jump-link" href={`#${spotId(spot)}`}>{spot.name}</a></li>
          ))}
          <li><a className="spg-jump-link" href="#best-time">Best time</a></li>
          <li><a className="spg-jump-link" href="#route">{guide.route.navLabel ?? "1-hour route"}</a></li>
          {guide.offCampus && <li><a className="spg-jump-link" href={`#${OFF_CAMPUS_ID}`}>{guide.offCampus.navLabel}</a></li>}
          {guide.plans && <li><a className="spg-jump-link" href={`#${PLANS_ID}`}>{guide.plans.navLabel}</a></li>}
          {(guide.sections ?? []).map((section) => (
            <li key={section.id}><a className="spg-jump-link" href={`#${section.id}`}>{section.navLabel}</a></li>
          ))}
          <li><a className="spg-jump-link" href="#tips">Tips</a></li>
        </ul>
      </div>
    </nav>
  );
}

function Cta({ schoolShort, contactHref }: { schoolShort: string; contactHref: string }) {
  return (
    <section className="sp-cta">
      <div className="sp-shell">
        <h2 className="sp-cta-title">Ready to shoot at {schoolShort}?</h2>
        <p className="sp-cta-sub">
          Send your date, the spots you have in mind, and your headcount. Most inquiries receive a response within 24 hours.
        </p>
        <Link href={contactHref} className="sp-btn sp-btn--primary">Inquire now</Link>
      </div>
    </section>
  );
}

function BestTime({ data, guide }: Props) {
  return (
    <section id="best-time" className="spg-section">
      <div className="sp-shell">
        <div className="spg-card">
          <h2 className="spg-h2">{guide.bestTime.heading}</h2>
          {guide.bestTime.paragraphs.map((p) => <p key={p} className="spg-copy">{p}</p>)}
          {guide.bestTime.lists && (
            <div className="spg-tips" style={{ margin: "18px 0 6px" }}>
              {guide.bestTime.lists.map((list) => (
                <div key={list.label}>
                  <p className="spg-ideas-label">{list.label}</p>
                  <ul className="spg-list">{list.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              ))}
            </div>
          )}
          <SchoolSunsetTimes city={data.city.replace(/, [A-Z]{2}$/, "")} coords={guide.bestTime.sunsetCoords} />
          <p className="spg-copy" style={{ marginTop: 16, marginBottom: 0 }}>{guide.bestTime.weather}</p>
        </div>
      </div>
    </section>
  );
}

function Tips({ schoolShort, tips }: { schoolShort: string; tips: SchoolSpotsGuide["tips"] }) {
  return (
    <section id="tips" className="spg-section">
      <div className="sp-shell">
        <h2 className="spg-h2">Tips for planning your {schoolShort} graduation session</h2>
        <div className="spg-tips">
          {tips.map((tip) => (
            <div key={tip.title} className="spg-card spg-tip">
              <h3 className="spg-tip-title">{tip.title}</h3>
              <p className="spg-copy">{tip.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GuideFooter({ data, relatedPosts }: { data: SchoolLandingData; relatedPosts: { slug: string; title: string }[] }) {
  return (
    <section className="sp-list" style={{ paddingTop: 40 }}>
      <div className="sp-shell">
        <div className="sp-foot" style={{ marginTop: 0 }}>
          <h2 className="sp-foot-title">Plan your {data.schoolShort} grad session</h2>
          {relatedPosts.length > 0 && (
            <>
              <p className="sp-foot-copy">Recent {data.schoolShort} sessions from the journal:</p>
              <ul className="spg-ideas" style={{ flexDirection: "column", marginBottom: 18 }}>
                {relatedPosts.map((post) => (
                  <li key={post.slug}><Link href={`/blog/${post.slug}`} style={{ color: C.proAccent, fontWeight: 700 }}>{post.title}</Link></li>
                ))}
              </ul>
            </>
          )}
          <div className="sp-foot-links">
            <Link href={data.canonicalPath} className="sp-pill">{data.schoolShort} graduation photographer <span aria-hidden>→</span></Link>
            <Link href={`/portfolio?category=grads&school=${data.slug}`} className="sp-pill">Graduation portfolio <span aria-hidden>→</span></Link>
            <Link href="/pricing/grads" className="sp-pill">Grad pricing <span aria-hidden>→</span></Link>
            <Link href="/grad-guide/what-to-wear" className="sp-pill">What to wear <span aria-hidden>→</span></Link>
            <Link href="/grad-guide/posing" className="sp-pill">Posing in cap &amp; gown <span aria-hidden>→</span></Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default async function SchoolSpotsGuidePage({ data, guide }: Props) {
  const spotsPath = `${data.canonicalPath}/spots`;
  const contactHref = `/contact?${buildBookingIntentParams({
    sourcePage: "school-spots-page", sessionType: "Graduation Portrait", school: data.school,
  })}`;
  const [photos, relatedPosts, spotNotes, spotConditions] = await Promise.all([
    getSchoolSpotsGuidePhotos(data.slug, data.schoolShort),
    getSchoolRelatedPosts(data.slug, 4),
    getPublicSpotNotes(data.slug),
    getPublicSpotConditions(data.slug),
  ]);
  const photosFor = (spot: SchoolSpot) => (spot.key ? photos.bySpot[spot.key] ?? [] : []);
  const mustHaves = guide.mustHaveKeys
    ? guide.mustHaveKeys.flatMap((key) => data.spots.filter((s) => s.key === key))
    : data.spots.filter((s) => s.priority === "must-have");

  const breadcrumbLd = buildBreadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: `${data.school} Graduation Photographer`, path: data.canonicalPath },
    { name: "Photo Locations", path: spotsPath },
  ]);
  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: guide.h1,
    itemListElement: [...data.spots, ...(guide.offCampus?.spots ?? [])].map((spot, i) => ({
      "@type": "ListItem", position: i + 1, name: spot.name,
      url: `https://www.soloxsnaps.com${spotsPath}#${spotId(spot)}`,
    })),
  };

  return (
    <main className="sp-page">
      <style>{SPOTS_BASE_CSS + SPOTS_GUIDE_CSS}</style>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(itemListLd)} />

      <GuideHero data={data} guide={guide} hero={photos.hero} contactHref={contactHref} />

      <JumpNav spots={data.spots} guide={guide} />

      <MustHaves
        spots={mustHaves} bySpot={photos.bySpot} lead={guide.mustHaveIntro}
        heading={guide.mustHaveHeading ?? "The three must-haves"}
      />

      <section className="sp-list" aria-labelledby="spg-spots-title">
        <div className="sp-shell">
          <h2 id="spg-spots-title" className="spg-h2">{guide.spotsHeading}</h2>
          {data.spots.map((spot, i) => (
            <SpotArticle
              key={spot.name} spot={spot} index={i} photos={photosFor(spot)}
              locationNote={spot.key ? spotNotes[spot.key] : undefined}
              conditions={spot.key ? spotConditions[spot.key] : undefined}
            />
          ))}
        </div>
      </section>

      <BestTime data={data} guide={guide} />

      <Route guide={guide} spots={data.spots} />

{guide.offCampus && <OffCampusSection section={guide.offCampus} photosFor={photosFor} notes={spotNotes} />}

      {guide.plans && <SessionPlansSection plans={guide.plans} contactHref={contactHref} />}

      {(guide.sections ?? []).map((section) => (
        <GuideSection
          key={section.id} section={section}
          photos={section.spotKey ? photos.bySpot[section.spotKey] ?? [] : []}
        />
      ))}

      <Tips schoolShort={data.schoolShort} tips={guide.tips} />

      {photos.gallery.length > 0 && (
        <section className="spg-section" aria-labelledby="spg-gallery-title" style={GALLERY_VARS}>
          <div className="spg-wide">
            <h2 id="spg-gallery-title" className="spg-h2">More from {data.schoolShort} graduation sessions</h2>
            <MasonryGallery photos={photos.gallery} />
          </div>
        </section>
      )}

      <SchoolSessionGuide schoolShort={data.schoolShort} faqs={guide.faqs} />

      <GuideFooter data={data} relatedPosts={relatedPosts} />

      <Cta schoolShort={data.schoolShort} contactHref={contactHref} />
    </main>
  );
}
