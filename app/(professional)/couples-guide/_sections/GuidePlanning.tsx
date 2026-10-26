// Couples guide hub — best locations (section 3), what to wear (4), best time
// (5), and how I help couples pose (6). Server component. Locations are only
// published guides (lib/couplesGuide/featuredLocations), so no link here can
// point at a noindex page or a guide that doesn't exist.

import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import type { FeaturedCouplesLocation } from "@/lib/couplesGuide/featuredLocations";
import {
  LIGHT_POINTS,
  POSING_EXAMPLES,
  WEAR_BY_SETTING,
  WEAR_PRINCIPLES,
} from "@/lib/couplesGuide/hubContent";

export function LocationsSection({ locations }: { locations: FeaturedCouplesLocation[] }) {
  return (
    <section id="locations" className="fg-section cg-section" aria-labelledby="locations-title">
      <div className="fg-shell">
        <p className="fg-sec-kicker" data-reveal>Locations</p>
        <h2 id="locations-title" className="cg-h2" data-reveal>Best locations for couples photography</h2>
        <p className="fg-prose-lead" data-reveal>
          The right spot depends on the two of you: the mood you want, how much privacy you&rsquo;d like, and whether
          you&rsquo;re drawn to coastline, gardens, or trees. These are the couples locations with full guides — light,
          crowds, what to wear, and where I like to shoot at each.
        </p>
        {locations.length > 0 && (
          <div className="fg-locs">
            {locations.map((location) => (
              <Link key={location.slug} href={location.href} className="fg-loc" data-reveal data-delay="1">
                <div className="fg-loc-media">
                  {location.cover ? (
                    <OptimizedPhoto src={location.cover.image_url} alt={location.cover.alt} sizes="(max-width: 700px) 100vw, 460px" loading="lazy" quality={75} />
                  ) : (
                    <div className="fg-loc-ph"><span aria-hidden="true">💞</span><p>{location.name}</p></div>
                  )}
                </div>
                <div className="fg-loc-body">
                  <span className="fg-loc-region">{location.area}</span>
                  <h3 className="fg-loc-title">{location.name}</h3>
                  <p className="fg-loc-desc">{location.summary}</p>
                  <div className="fg-loc-meta"><div><b>Best for:</b> {location.bestFor}</div></div>
                  <span className="fg-loc-link">Read the {location.name} couples guide →</span>
                </div>
              </Link>
            ))}
          </div>
        )}
        <p className="cg-more">
          <Link href="/couples-guide/locations" className="fg-inline-link">See every Bay Area couples location →</Link>
        </p>
      </div>
    </section>
  );
}

export function WearSection() {
  return (
    <section id="what-to-wear" className="fg-section fg-section--alt cg-section" aria-labelledby="wear-title">
      <div className="fg-shell">
        <p className="fg-sec-kicker" data-reveal>Styling</p>
        <h2 id="wear-title" className="cg-h2" data-reveal>What to wear for couples photos</h2>
        <p className="fg-prose-lead" data-reveal>
          You don&rsquo;t need new outfits — you need two that look good next to each other and let you move.
        </p>
        <div className="cg-grid">
          {WEAR_PRINCIPLES.map((tip) => (
            <div key={tip.title} className="cg-tile" data-reveal data-delay="1">
              <h3 className="cg-h3">{tip.title}</h3>
              <p className="cg-text">{tip.text}</p>
            </div>
          ))}
        </div>
        <h3 className="cg-h3" style={{ marginTop: 28 }}>By setting</h3>
        <div className="cg-settings">
          {WEAR_BY_SETTING.map((item) => (
            <div key={item.setting} className="cg-setting">
              <b>{item.setting} sessions</b>
              <span className="cg-text">{item.tips}</span>
            </div>
          ))}
        </div>
        <p className="cg-more">
          <Link href="/couples-guide/what-to-wear" className="fg-inline-link">Read the full couples outfit guide →</Link>
        </p>
      </div>
    </section>
  );
}

export function BestTimeSection() {
  return (
    <section id="best-time" className="fg-section cg-section" aria-labelledby="time-title">
      <div className="fg-shell">
        <p className="fg-sec-kicker" data-reveal>Light</p>
        <h2 id="time-title" className="cg-h2" data-reveal>The best time for couples photos</h2>
        <p className="fg-prose-lead" data-reveal>
          For most outdoor sessions I suggest starting about an hour before sunset. That&rsquo;s golden hour — the
          window when the sun sits low and the light turns soft and warm. It&rsquo;s a great default, not the only
          option.
        </p>
        <div className="cg-grid">
          {LIGHT_POINTS.map((point) => (
            <div key={point.title} className="cg-tile" data-reveal data-delay="1">
              <h3 className="cg-h3">{point.title}</h3>
              <p className="cg-text">{point.text}</p>
            </div>
          ))}
        </div>
        <p className="fg-note">
          Every location lights differently. Wooded paths get dark sooner under the trees, so those sessions often start a
          little earlier; open beaches and west-facing coastline hold the light right up to sunset. Sunset times shift a
          lot through the year, so I set your start time once we&rsquo;ve picked a date and spot.
        </p>
        <p className="cg-more">
          <Link href="/couples-guide/best-time-for-couples-photos" className="fg-inline-link">Read the full guide to timing and light →</Link>
        </p>
      </div>
    </section>
  );
}

export function PosingSection() {
  return (
    <section id="posing" className="fg-section fg-section--alt cg-section" aria-labelledby="posing-title">
      <div className="fg-shell">
        <p className="fg-sec-kicker" data-reveal>Posing</p>
        <h2 id="posing-title" className="cg-h2" data-reveal>How I help couples pose</h2>
        <p className="fg-prose-lead" data-reveal>
          My posing is built on movement, not holding still. Instead of &ldquo;stand here, tilt your chin,&rdquo; I give
          you something to do together, then photograph what happens. You get clear direction the whole time, and room
          to react to each other naturally.
        </p>
        <p className="cg-text" data-reveal>A few things I might ask you to do:</p>
        <ul className="cg-chips">
          {POSING_EXAMPLES.map((example) => <li key={example}>{example}</li>)}
        </ul>
        <p className="fg-note">
          If something feels awkward, we skip it — I always have another idea. Nervous? That&rsquo;s normal, and
          movement-based prompts are the fastest way past it.
        </p>
        <p className="cg-more">
          <Link href="/couples-posing-guide" className="fg-inline-link">See my couples posing approach →</Link>
        </p>
      </div>
    </section>
  );
}
