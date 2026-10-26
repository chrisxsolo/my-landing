// Optional long-form guide sections for campuses whose graduates often shoot
// beyond campus (SF State): the off-campus places, each with its own photo
// section, and multi-location session plans with an inquiry prompt. Server
// components, no client JS.
import Link from "next/link";
import type { PagePhoto } from "@/lib/pagePhotos/publicPages";
import type { SchoolSpot } from "./SchoolLandingTemplate";
import type { SchoolSpotsGuideOffCampus, SchoolSpotsGuidePlans } from "./schoolSpotsGuideTypes";
import { SpotArticle } from "./SchoolSpotsGuideParts";

export const OFF_CAMPUS_ID = "off-campus";
export const PLANS_ID = "multiple-locations";

type OffCampusProps = {
  section: SchoolSpotsGuideOffCampus;
  photosFor: (spot: SchoolSpot) => PagePhoto[];
  notes: Record<string, string>;
};

export function OffCampusSection({ section, photosFor, notes }: OffCampusProps) {
  return (
    <section id={OFF_CAMPUS_ID} className="sp-list spg-band" aria-labelledby="spg-off-title">
      <div className="sp-shell">
        <p className="spg-eyebrow">Beyond campus</p>
        <h2 id="spg-off-title" className="spg-h2">{section.heading}</h2>
        {section.intro.map((p) => <p key={p} className="spg-copy">{p}</p>)}
        <div className="spg-off-list">
          {section.spots.map((spot, i) => (
            <SpotArticle
              key={spot.name} spot={spot} index={i} photos={photosFor(spot)}
              locationNote={spot.key ? notes[spot.key] : undefined}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function SessionPlansSection({ plans, contactHref }: { plans: SchoolSpotsGuidePlans; contactHref: string }) {
  return (
    <section id={PLANS_ID} className="spg-section" aria-labelledby="spg-plans-title">
      <div className="sp-shell">
        <h2 id="spg-plans-title" className="spg-h2">{plans.heading}</h2>
        {plans.intro.map((p) => <p key={p} className="spg-copy">{p}</p>)}
        <h3 className="spg-h3">{plans.optionsHeading}</h3>
        <ol className="spg-plans">
          {plans.options.map((option) => (
            <li key={option.label} className="spg-card spg-plan">
              <span className="spg-plan-label">{option.label}</span>
              <h4 className="spg-tip-title">{option.title}</h4>
              <p className="spg-copy">{option.body}</p>
            </li>
          ))}
        </ol>
        <div className="spg-card" style={{ marginTop: 18 }}>
          <p className="spg-ideas-label" style={{ marginTop: 0 }}>{plans.notesHeading}</p>
          <ul className="spg-list">
            {plans.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
          <p className="spg-fine" style={{ marginTop: 12 }}>
            <Link href="/pricing/grads" className="spg-source">See current graduation pricing →</Link>
          </p>
        </div>
        <div className="spg-plan-cta">
          <h3 className="spg-h3" style={{ marginTop: 0 }}>{plans.cta.heading}</h3>
          <p className="spg-copy">{plans.cta.body}</p>
          <Link href={contactHref} className="sp-btn sp-btn--primary">{plans.cta.label}</Link>
        </div>
      </div>
    </section>
  );
}
