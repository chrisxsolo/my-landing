import Link from "next/link";
import ExpandableText from "@/app/components/ExpandableText";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { PublicLocationCard } from "@/lib/locationLibrary/publicData";
import { environmentLabel, regionLabel, sessionKindLabel } from "@/lib/locationLibrary/taxonomy";
import { lightTagLabel } from "@/lib/photoConditions";

const REGION_EMOJI: Record<string, string> = {
  "south-bay": "🌇", "san-francisco": "🌉", "east-bay": "🌿", peninsula: "🌊", "north-bay": "🌲", coast: "🌊",
};
const ENV_EMOJI: Record<string, string> = {
  beach: "🌊", garden: "🌸", forest: "🌲", architecture: "🏛️", waterfront: "⚓", campus: "🎓", historic: "🏛️",
};

function placeholderEmoji(location: PublicLocationCard): string {
  const env = location.environments.find((e) => ENV_EMOJI[e]);
  return env ? ENV_EMOJI[env] : REGION_EMOJI[location.region] ?? "📍";
}

export default function LocationCard({
  location, eager, onEnvironment, onLight,
}: {
  location: PublicLocationCard;
  eager: boolean;
  onEnvironment: (env: string) => void;
  onLight: (light: string) => void;
}) {
  const region = regionLabel(location.region, true);
  return (
    <article id={location.slug} className="loc-card" data-reveal>
      <span className="loc-card-bar" />
      <div className="loc-card-media">
        {location.image_url ? (
          <>
            <OptimizedPhoto
              src={location.image_url}
              alt={location.image_alt}
              sizes="(max-width: 760px) 100vw, 50vw"
              loading={eager ? "eager" : "lazy"}
            />
            <div className="loc-card-overlay" />
            <div className="loc-card-toptags">
              <span className="loc-pill loc-pill--region">{region}</span>
              <span className="loc-pill loc-pill--city">{location.city}</span>
            </div>
          </>
        ) : (
          <div className="loc-card-ph" aria-hidden="true">
            <span>{placeholderEmoji(location)}</span>
            <p>Photos coming soon</p>
          </div>
        )}
      </div>

      <div className="loc-card-body">
        <div className="loc-card-head">
          <div className="loc-card-head-main">
            <p className="loc-card-place">
              {location.city}
              {location.neighborhood ? ` — ${location.neighborhood}` : ""}
            </p>
            <h3 className="loc-card-title">{location.title}</h3>
          </div>
          {location.best_time ? (
            <div className="loc-light">
              <p className="loc-light-label">Best light</p>
              <p className="loc-light-val">{location.best_time}</p>
            </div>
          ) : null}
        </div>

        <ExpandableText text={location.description} className="loc-desc" buttonColor="#3d6b5e" />

        {location.best_for || location.tip ? (
          <div className="loc-meta">
            {location.best_for ? (
              <div className="loc-meta-box">
                <p className="loc-meta-label">Best for</p>
                <p className="loc-meta-text">{location.best_for}</p>
              </div>
            ) : null}
            {location.tip ? (
              <div className="loc-meta-box loc-meta-box--tip">
                <p className="loc-meta-label">Pro tip</p>
                <p className="loc-meta-text">{location.tip}</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {location.crowd_note ? (
          <p className="loc-crowd"><strong>Gets busy</strong> {location.crowd_note}</p>
        ) : null}

        {location.kinds.length > 0 ? (
          <p className="loc-kinds">
            <strong>I&apos;ve photographed</strong>{" "}
            {location.kinds.map(sessionKindLabel).join(" · ")}
          </p>
        ) : null}

        <div className="loc-card-tags">
          <span className="loc-tag loc-tag--region">{region}</span>
          {location.environments.map((env) => (
            <button key={env} type="button" onClick={() => onEnvironment(env)} className="loc-tag">
              {environmentLabel(env, true)}
            </button>
          ))}
          {location.light_tags.map((light) => (
            <button key={light} type="button" onClick={() => onLight(light)} className="loc-tag loc-tag--light"
              aria-label={`Show spots good for ${lightTagLabel(light).toLowerCase()}`}>
              {lightTagLabel(light, true)}
            </button>
          ))}
        </div>

        {location.related.length > 0 ? (
          <nav className="loc-related" aria-label={`More about ${location.title}`}>
            {location.related.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.kind === "guide" ? `${location.title} ${link.label.toLowerCase()} →` : `${link.label} →`}
              </Link>
            ))}
          </nav>
        ) : null}
      </div>
    </article>
  );
}
