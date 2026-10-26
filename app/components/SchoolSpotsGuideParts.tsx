// Pieces of the long-form school location guide (SchoolSpotsGuidePage): one
// campus spot's section and the titled sections after the route (crowds,
// celebration photos, campus rules). Server components, no client JS.
import type { PagePhoto } from "@/lib/pagePhotos/publicPages";
import type { SchoolSpot, SchoolSpotPriority } from "./SchoolLandingTemplate";
import type { SchoolSpotsGuideSection } from "./schoolSpotsGuideTypes";
import SchoolSpotPhotos from "./SchoolSpotPhotos";

const PRIORITY_LABELS: Record<SchoolSpotPriority, string> = {
  "must-have": "Must-have",
  "highly-recommended": "Highly recommended",
  recommended: "Recommended",
  seasonal: "Seasonal",
};

export const spotId = (spot: SchoolSpot) => spot.key ?? spot.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

type SpotProps = { spot: SchoolSpot; index: number; photos: PagePhoto[]; locationNote?: string };

export function SpotArticle({ spot, index, photos, locationNote }: SpotProps) {
  const mustHave = spot.priority === "must-have";
  return (
    <article id={spotId(spot)} className="sp-spot">
      <div className="sp-num">{String(index + 1).padStart(2, "0")}</div>
      <div>
        <h3 className="sp-spot-name">{spot.name}</h3>
        {(spot.priority || spot.role) && (
          <div className="spg-chips">
            {spot.priority && (
              <span className={`sp-chip${mustHave ? " spg-chip--must" : ""}`}>{PRIORITY_LABELS[spot.priority]}</span>
            )}
            {spot.role && <span className="sp-chip">{spot.role}</span>}
          </div>
        )}
        {locationNote && (
          <p className="spg-where"><span className="spg-where-label">Where to find it:</span> {locationNote}</p>
        )}
        {(spot.details ?? [spot.description]).map((paragraph) => (
          <p key={paragraph} className="spg-copy">{paragraph}</p>
        ))}
        <SchoolSpotPhotos photos={photos} />
        {spot.photoIdeas && spot.photoIdeas.length > 0 && (
          <>
            <p className="spg-ideas-label">Photo ideas here</p>
            <ul className="spg-ideas">
              {spot.photoIdeas.map((idea) => <li key={idea}>{idea}</li>)}
            </ul>
          </>
        )}
        {spot.tip && (
          <p className="spg-tip-callout"><span className="spg-where-label">Photographer&rsquo;s tip:</span> {spot.tip}</p>
        )}
      </div>
    </article>
  );
}

export function GuideSection({ section }: { section: SchoolSpotsGuideSection }) {
  return (
    <section id={section.id} className="spg-section">
      <div className="sp-shell">
        <h2 className="spg-h2">{section.heading}</h2>
        {section.paragraphs.map((p) => <p key={p} className="spg-copy">{p}</p>)}
        {section.bullets && section.bullets.length > 0 && (
          <div className="spg-card" style={{ marginTop: 18 }}>
            {section.bulletsLabel && <p className="spg-ideas-label" style={{ marginTop: 0 }}>{section.bulletsLabel}</p>}
            <ul className="spg-list">
              {section.bullets.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {section.links && section.links.length > 0 && (
          <p className="spg-fine" style={{ marginTop: 14 }}>
            Official source{section.links.length > 1 ? "s" : ""}:{" "}
            {section.links.map((link, i) => (
              <span key={link.href}>
                {i > 0 && " · "}
                <a href={link.href} target="_blank" rel="noopener noreferrer" className="spg-source">{link.label}</a>
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}
