// Photography-journey timeline for /about ("The road here"). Server component —
// pure markup from ABOUT_TIMELINE, revealed on scroll via the site's existing
// data-reveal pattern. Depends on the About page's global classes (about-shell,
// about-section-kicker, about-section-title).

import { ABOUT_TIMELINE } from "@/lib/aboutFacts";

const CSS = `
  .atl-section {
    background: #ffffff;
    padding: 90px 0;
    border-top: 1px solid rgba(18, 24, 22, 0.07);
  }
  .atl-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.65fr) minmax(0, 1.35fr);
    gap: 72px;
    align-items: start;
  }
  .atl-label { position: sticky; top: 110px; }
  .atl-list {
    position: relative;
    margin: 0;
    padding: 0 0 0 28px;
    list-style: none;
    border-left: 2px solid rgba(18, 24, 22, 0.1);
  }
  .atl-item { position: relative; padding: 0 0 36px; }
  .atl-item:last-child { padding-bottom: 0; }
  .atl-item::before {
    content: "";
    position: absolute;
    left: -35px;
    top: 6px;
    width: 12px; height: 12px;
    border-radius: 50%;
    background: #4f6d67;
    border: 3px solid #ffffff;
    box-shadow: 0 0 0 1px rgba(18, 24, 22, 0.12);
  }
  .atl-year {
    margin: 0 0 6px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    font-variant-numeric: tabular-nums;
  }
  .atl-title {
    margin: 0 0 8px;
    color: #101412;
    font-size: 19px;
    font-weight: 860;
    letter-spacing: -0.01em;
    line-height: 1.1;
  }
  .atl-body {
    margin: 0;
    color: #4b5a55;
    font-size: 15.5px;
    line-height: 1.7;
    max-width: 58ch;
  }
  @media (max-width: 900px) {
    .atl-grid { grid-template-columns: 1fr; gap: 40px; }
    .atl-label { position: static; }
  }
  @media (max-width: 760px) {
    .atl-section { padding: 62px 0 70px; }
  }
`;

export default function AboutTimeline() {
  return (
    <section className="atl-section" aria-label="Photography journey timeline">
      <style>{CSS}</style>
      <div className="about-shell atl-grid">
        <div className="atl-label">
          <p className="about-section-kicker">The road here</p>
          <h2 className="about-section-title">From first camera to every-day seasons.</h2>
        </div>
        <ol className="atl-list">
          {ABOUT_TIMELINE.map((entry, i) => (
            <li key={entry.year} className="atl-item" data-reveal="" data-delay={String(Math.min(i + 1, 4))}>
              <p className="atl-year">{entry.year}</p>
              <h3 className="atl-title">{entry.title}</h3>
              <p className="atl-body">{entry.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
