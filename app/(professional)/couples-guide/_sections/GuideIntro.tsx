// Couples guide hub — hero, table of contents, approach (section 1), and what to
// expect (section 2). Server component; copy lives in lib/couplesGuide/hubContent.

import Link from "next/link";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { APPROACH_POINTS, EXPECT_STEPS, GUIDE_SECTIONS } from "@/lib/couplesGuide/hubContent";
import { COUPLES_BOOKING_PATH, COUPLES_PORTFOLIO_PATH } from "@/lib/couplesRoutes";

export type GuidePhoto = { image_url: string; alt: string };

export function GuideHero() {
  return (
    <section className="fg-hero">
      <div className="fg-shell" style={{ position: "relative", zIndex: 1 }}>
        <p className="fg-kicker fg-afu1">
          <span className="fg-kicker-dot fg-dot" /> Bay Area Couples Photography Guide
        </p>
        <h1 className="fg-h1 fg-afu2">
          The Ultimate Bay Area <span className="fg-h1-accent">Couples Photography</span> Guide
        </h1>
        <p className="fg-sub fg-afu3">
          Everything you need to plan relaxed, natural couples photos in San Francisco and across the Bay Area — where to
          go, what to wear, when the light is best, how posing actually works, and what it costs. Whether it&rsquo;s an
          anniversary, an engagement, or just because, this is how I&rsquo;d plan it with you.
        </p>
        <div className="fg-actions fg-afu4">
          <Link href={COUPLES_BOOKING_PATH} className="fg-btn fg-btn--primary">Book a couples session →</Link>
          <Link href={COUPLES_PORTFOLIO_PATH} className="fg-btn fg-btn--ghost">See the couples portfolio</Link>
        </div>
        <nav aria-label="In this guide">
          <ol className="cg-toc">
            {GUIDE_SECTIONS.map((section) => (
              <li key={section.id}><a href={`#${section.id}`}>{section.label}</a></li>
            ))}
          </ol>
        </nav>
      </div>
    </section>
  );
}

export function ApproachSection({ photos }: { photos: GuidePhoto[] }) {
  return (
    <section id="approach" className="fg-section cg-section" aria-labelledby="approach-title">
      <div className="fg-shell">
        <p className="fg-sec-kicker" data-reveal>My approach</p>
        <h2 id="approach-title" className="cg-h2" data-reveal>Couples photos that feel like you, not a pose</h2>
        <p className="fg-prose-lead" data-reveal>
          You don&rsquo;t need any modeling experience. Most couples I photograph have never had professional photos
          together, and the first few minutes always feel a little funny — then it passes. I guide you through the whole
          session with simple prompts and movement, so you can focus on each other instead of on the camera.
        </p>
        <div className="cg-grid">
          {APPROACH_POINTS.map((point) => (
            <div key={point.title} className="cg-tile" data-reveal data-delay="1">
              <h3 className="cg-h3">{point.title}</h3>
              <p className="cg-text">{point.text}</p>
            </div>
          ))}
        </div>
        {photos.length > 0 && (
          <>
            <div className="cg-band">
              {photos.slice(0, 3).map((photo) => (
                <div key={photo.image_url} className="cg-band-item">
                  <OptimizedPhoto src={photo.image_url} alt={photo.alt} sizes="(max-width: 620px) 50vw, 320px" loading="lazy" quality={75} />
                </div>
              ))}
            </div>
            <p className="cg-more" style={{ marginTop: 34 }}>
              <Link href={COUPLES_PORTFOLIO_PATH} className="fg-inline-link">Browse the full Bay Area couples portfolio →</Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}

export function ExpectSection() {
  return (
    <section id="what-to-expect" className="fg-section fg-section--alt cg-section" aria-labelledby="expect-title">
      <div className="fg-shell">
        <p className="fg-sec-kicker" data-reveal>The session</p>
        <h2 id="expect-title" className="cg-h2" data-reveal>What to expect during your session</h2>
        <p className="fg-prose-lead" data-reveal>
          From the first message to your final gallery, here&rsquo;s how a couples session flows. Nothing about it is
          rushed or formal — it&rsquo;s closer to a guided walk together with a camera along.
        </p>
        <ol className="cg-steps">
          {EXPECT_STEPS.map((step) => (
            <li key={step.title} className="cg-step" data-reveal data-delay="1">
              <h3 className="cg-h3">{step.title}</h3>
              <p className="cg-text">{step.text}</p>
            </li>
          ))}
        </ol>
        <p className="cg-more">
          <Link href="/couples-guide/what-to-expect" className="fg-inline-link">Read the full what-to-expect guide →</Link>{" "}
          · <Link href="/couples-guide/how-to-prepare" className="fg-inline-link">How to prepare</Link>
        </p>
      </div>
    </section>
  );
}
