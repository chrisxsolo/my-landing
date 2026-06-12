"use client";

// Rotating personal-facts card for /about ("Off the clock"). One fact at a time
// with next-arrow + dot navigation, crossfade between facts, and touch swipe.
// Fact text comes from lib/aboutFacts; photos (optional) come from the
// about_photos table via the page's server fetch. Renders text-only until a
// photo is uploaded for a fact. Depends on the About page's global classes
// (about-shell, about-section-kicker, about-section-title).

import { useRef, useState } from "react";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { ABOUT_FACTS, type AboutPhotoMap } from "@/lib/aboutFacts";

const SWIPE_THRESHOLD_PX = 40;

const CSS = `
  .afc-section {
    background: #f5f6f4;
    padding: 90px 0;
    border-top: 1px solid rgba(18, 24, 22, 0.07);
  }
  .afc-card {
    position: relative;
    margin-top: 36px;
    border: 1px solid rgba(18, 24, 22, 0.08);
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 12px 40px rgba(18, 24, 22, 0.07);
    overflow: hidden;
  }
  .afc-inner {
    display: grid;
    grid-template-columns: 1fr;
    gap: 36px;
    padding: 44px 48px;
    align-items: center;
  }
  .afc-inner[data-has-photo="true"] {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
  }
  @keyframes afcFade {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .afc-fact { animation: afcFade 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
  .afc-counter {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    font-variant-numeric: tabular-nums;
  }
  .afc-title {
    margin: 0 0 14px;
    color: #101412;
    font-size: clamp(1.5rem, 3vw, 2.2rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 1.02;
    text-wrap: balance;
  }
  .afc-body {
    margin: 0;
    color: #4b5a55;
    font-size: 16.5px;
    line-height: 1.74;
    max-width: 56ch;
  }
  .afc-photo-wrap {
    position: relative;
    overflow: hidden;
    aspect-ratio: 4 / 3;
    border-radius: 12px;
    background: #dfe8e4;
    width: 100%;
  }
  .afc-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 48px;
    border-top: 1px solid rgba(18, 24, 22, 0.07);
    background: rgba(246, 250, 248, 0.6);
  }
  .afc-dots { display: flex; gap: 8px; }
  .afc-dot {
    width: 8px; height: 8px;
    padding: 0;
    border: none;
    border-radius: 50%;
    background: rgba(18, 24, 22, 0.16);
    cursor: pointer;
    transition: background 0.18s ease, transform 0.18s ease;
  }
  .afc-dot[data-active="true"] { background: #4f6d67; transform: scale(1.25); }
  .afc-next {
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 0 18px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
    font-size: 14px;
    font-weight: 820;
    cursor: pointer;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease;
  }
  .afc-next:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
  }
  @media (max-width: 900px) {
    .afc-inner, .afc-inner[data-has-photo="true"] { grid-template-columns: 1fr; }
  }
  @media (max-width: 760px) {
    .afc-section { padding: 62px 0 70px; }
    .afc-inner { padding: 28px 24px; gap: 24px; }
    .afc-nav { padding: 14px 24px; }
    .afc-body { font-size: 15.5px; }
  }
`;

export default function AboutFactsCard({ photos }: { photos: AboutPhotoMap }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  const count = ABOUT_FACTS.length;
  const fact = ABOUT_FACTS[index];
  const photo = photos[fact.slug];

  function go(next: number) {
    setIndex(((next % count) + count) % count);
  }

  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0]?.clientX ?? null;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchX.current) - touchX.current;
    touchX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    go(delta < 0 ? index + 1 : index - 1);
  }

  return (
    <section className="afc-section" aria-label="Personal facts about Chris">
      <style>{CSS}</style>
      <div className="about-shell">
        <p className="about-section-kicker">Off the clock</p>
        <h2 className="about-section-title">A few things about me, beyond the camera.</h2>

        <div className="afc-card" data-reveal="" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          <div className="afc-inner" data-has-photo={photo ? "true" : "false"}>
            <div className="afc-fact" key={fact.slug}>
              <p className="afc-counter">
                Fact {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
              </p>
              <h3 className="afc-title">{fact.title}</h3>
              <p className="afc-body">{fact.body}</p>
            </div>
            {photo && (
              <div className="afc-photo-wrap" key={`photo-${fact.slug}`}>
                <OptimizedPhoto src={photo.url} alt={photo.alt} sizes="(max-width: 900px) 90vw, 38vw" quality={85} />
              </div>
            )}
          </div>
          <div className="afc-nav">
            <div className="afc-dots" role="tablist" aria-label="Choose a fact">
              {ABOUT_FACTS.map((f, i) => (
                <button
                  key={f.slug}
                  type="button"
                  className="afc-dot"
                  data-active={i === index ? "true" : "false"}
                  aria-label={`Fact ${i + 1}: ${f.title}`}
                  aria-current={i === index}
                  onClick={() => go(i)}
                />
              ))}
            </div>
            <button type="button" className="afc-next" onClick={() => go(index + 1)} aria-label="Next fact">
              Next fact <span aria-hidden>→</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
