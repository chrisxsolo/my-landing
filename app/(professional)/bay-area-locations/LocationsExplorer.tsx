"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import ExpandableText from "@/app/components/ExpandableText";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { GRAD_GUIDE_CSS, GG_SQUIGGLE_PATH } from "@/lib/gradGuide";
import {
  BAY_AREA_FILTER_CHIPS,
  getLocationChipLabel,
  type BayAreaLocationEntry,
} from "@/lib/bayAreaLocations";

// Supplementary controls + cards, styled with the same sage/glass tokens the
// professional layout exposes (--ink, --accent, --glass). Keeps GRAD_GUIDE_CSS
// for the shared hero / marquee / section / CTA furniture.
const LOC_CSS = `
  /* ── STAT CARDS ──────────────────────────────────────────────────────────── */
  .loc-stats { display:grid; gap:14px; grid-template-columns:repeat(3,1fr); margin-top:36px; }
  @media (max-width:680px) { .loc-stats { grid-template-columns:1fr; } }
  .loc-stat {
    padding:22px; border-radius:14px; background:var(--glass, rgba(255,255,255,0.86));
    border:1px solid rgba(18,24,22,0.08); box-shadow:0 6px 20px rgba(18,24,22,0.05);
  }
  .loc-stat-label { margin:0 0 8px; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.16em; text-transform:uppercase; }
  .loc-stat-num { margin:0; color:var(--ink, #101412); font-size:34px; font-weight:880; letter-spacing:-0.02em; line-height:1; }
  .loc-stat-note { margin:8px 0 0; color:var(--ink-muted, #4b5a55); font-size:13px; line-height:1.5; }

  /* ── TOOLBAR (search + filters) ──────────────────────────────────────────── */
  .loc-toolbar {
    border-radius:16px; padding:22px; background:var(--glass, rgba(255,255,255,0.86));
    border:1px solid rgba(18,24,22,0.08); box-shadow:0 6px 20px rgba(18,24,22,0.05);
  }
  .loc-toolbar-grid { display:grid; gap:16px; grid-template-columns:minmax(0,1fr) auto; align-items:end; }
  @media (max-width:680px) { .loc-toolbar-grid { grid-template-columns:1fr; } }
  .loc-label { display:block; margin:0 0 8px; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.15em; text-transform:uppercase; }
  .loc-search { display:flex; align-items:center; gap:10px; border-radius:10px; padding:11px 14px; background:#fff; border:1px solid rgba(18,24,22,0.12); }
  .loc-search input { width:100%; border:none; outline:none; background:transparent; font-size:14px; font-weight:500; color:var(--ink, #101412); }
  .loc-search input::placeholder { color:#9aa7a2; }
  .loc-count { border-radius:10px; padding:11px 16px; background:rgba(112,139,133,0.10); }
  .loc-count-label { margin:0; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.14em; text-transform:uppercase; }
  .loc-count-num { margin:2px 0 0; color:var(--ink, #101412); font-size:22px; font-weight:880; line-height:1; }
  .loc-count-note { margin:2px 0 0; color:var(--ink-muted, #4b5a55); font-size:13px; }
  .loc-chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
  .loc-chip {
    border-radius:999px; padding:8px 15px; font-size:13px; font-weight:800; cursor:pointer;
    border:1px solid rgba(18,24,22,0.12); background:#fff; color:var(--ink-muted, #4b5a55);
    transition:transform .16s ease, background .16s ease;
  }
  .loc-chip:hover { transform:translateY(-1px); }
  .loc-chip--on { background:var(--accent, #3d6b5e); color:#f4f9f6; border-color:transparent; box-shadow:0 8px 20px rgba(61,107,94,0.2); }

  /* ── LOCATION CARDS ──────────────────────────────────────────────────────── */
  .loc-grid { display:grid; gap:16px; grid-template-columns:1fr 1fr; margin-top:30px; }
  @media (max-width:760px) { .loc-grid { grid-template-columns:1fr; } }
  .loc-card {
    overflow:hidden; border-radius:14px; background:var(--glass, rgba(255,255,255,0.86));
    border:1px solid rgba(18,24,22,0.08); box-shadow:0 6px 20px rgba(18,24,22,0.05);
    transition:transform .22s ease, box-shadow .22s ease;
  }
  .loc-card:hover { transform:translateY(-3px); box-shadow:0 16px 38px rgba(18,24,22,0.09); }
  .loc-card-bar { height:3px; background:linear-gradient(90deg, #5b8a7a, #82b9af); }
  .loc-card-media {
    position:relative; height:260px; overflow:hidden; display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg, rgba(112,139,133,0.12), rgba(162,210,196,0.14));
  }
  .loc-card-media img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .loc-card-overlay { position:absolute; inset:0; background:linear-gradient(180deg, transparent 40%, rgba(16,24,22,0.42) 100%); }
  .loc-card-toptags { position:absolute; left:14px; top:14px; z-index:1; display:flex; flex-wrap:wrap; gap:8px; }
  .loc-pill { border-radius:999px; padding:4px 11px; font-size:11px; font-weight:820; letter-spacing:0.08em; text-transform:uppercase; }
  .loc-pill--region { background:rgba(255,255,255,0.92); color:var(--accent, #3d6b5e); }
  .loc-pill--city { background:rgba(255,255,255,0.85); color:var(--ink, #101412); }
  .loc-card-ph { text-align:center; color:var(--accent, #3d6b5e); }
  .loc-card-ph span { display:block; font-size:40px; margin-bottom:6px; }
  .loc-card-ph p { margin:0; font-size:12px; font-weight:720; }
  .loc-card-body { padding:24px; }
  .loc-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
  .loc-card-head-main { min-width:0; }
  .loc-card-place { margin:0 0 4px; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.12em; text-transform:uppercase; }
  .loc-card-title { margin:0; color:var(--ink, #101412); font-size:21px; font-weight:870; letter-spacing:-0.01em; line-height:1.15; }
  .loc-light { flex-shrink:0; max-width:46%; text-align:right; border-radius:11px; padding:9px 13px; background:rgba(112,139,133,0.10); border:1px solid rgba(112,139,133,0.2); }
  .loc-light-label { margin:0; color:var(--accent, #3d6b5e); font-size:10px; font-weight:820; letter-spacing:0.12em; text-transform:uppercase; }
  .loc-light-val { margin:3px 0 0; color:var(--ink, #101412); font-size:13px; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
  .loc-desc { color:var(--ink-muted, #4b5a55); font-size:14px; line-height:1.66; }
  .loc-meta { display:grid; gap:12px; grid-template-columns:1fr 1fr; margin-top:18px; }
  @media (max-width:480px) { .loc-meta { grid-template-columns:1fr; } }
  .loc-meta-box { border-radius:11px; padding:13px 15px; background:rgba(112,139,133,0.07); }
  .loc-meta-box--tip { background:rgba(162,210,196,0.13); }
  .loc-meta-label { margin:0 0 5px; font-size:10px; font-weight:820; letter-spacing:0.12em; text-transform:uppercase; color:var(--accent, #3d6b5e); }
  .loc-meta-text { margin:0; color:var(--ink-muted, #4b5a55); font-size:13px; line-height:1.55; font-weight:500; }
  .loc-card-tags { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; }
  .loc-tag {
    border-radius:999px; padding:5px 12px; font-size:12px; font-weight:760; cursor:pointer;
    background:#fff; border:1px solid rgba(18,24,22,0.1); color:var(--ink-muted, #4b5a55); transition:transform .16s ease;
  }
  .loc-tag:hover { transform:translateY(-1px); }
  .loc-tag--region { cursor:default; background:rgba(112,139,133,0.12); color:var(--accent, #3d6b5e); border-color:transparent; font-weight:820; letter-spacing:0.06em; text-transform:uppercase; }
`;

const MARQUEE = [
  "San Francisco", "South Bay", "East Bay", "Peninsula",
  "Beaches", "Golden Hour", "Gardens", "Clean Light",
];
const marquee = [...MARQUEE, ...MARQUEE];

const REGION_EMOJI: Record<string, string> = {
  "south-bay": "🌇",
  "san-francisco": "🌉",
  "east-bay": "🌿",
  peninsula: "🌊",
  "north-bay": "🌲",
};

function matchesSearch(location: BayAreaLocationEntry, query: string) {
  if (!query) return true;

  const haystack = [
    location.title,
    location.city,
    location.neighborhood ?? "",
    location.description,
    location.best_for,
    location.best_time,
    location.tip,
    location.region,
    location.tags.join(" "),
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(query.toLowerCase());
}

function matchesChip(location: BayAreaLocationEntry, chip: string) {
  if (chip === "all") return true;
  return location.region === chip || location.tags.includes(chip);
}

function getLocationEmoji(location: BayAreaLocationEntry) {
  if (location.tags.includes("beaches")) return "🌊";
  if (location.tags.includes("gardens")) return "🌸";
  if (location.tags.includes("redwoods")) return "🌲";
  if (location.tags.includes("architecture")) return "🏛️";
  if (location.tags.includes("waterfront")) return "⚓";
  return REGION_EMOJI[location.region] ?? "📍";
}

export default function LocationsExplorer({
  locations,
}: {
  locations: BayAreaLocationEntry[];
}) {
  const [query, setQuery] = useState("");
  const [activeChip, setActiveChip] = useState<(typeof BAY_AREA_FILTER_CHIPS)[number]["value"]>("all");
  const deferredQuery = useDeferredValue(query);

  const filteredLocations = locations.filter(
    (location) =>
      location.active &&
      matchesChip(location, activeChip) &&
      matchesSearch(location, deferredQuery)
  );

  const regionCount = new Set(locations.map((location) => location.region)).size;
  const beachCount = locations.filter((location) => location.tags.includes("beaches")).length;

  return (
    <main className="gg-page">
      <style>{GRAD_GUIDE_CSS}</style>
      <style>{LOC_CSS}</style>

      {/* ── HERO ───────────────────────────────────────────────────────────── */}
      <section className="gg-hero">
        <span className="gg-hero-corner" style={{ top: 18, left: 18, borderTop: "2px solid rgba(112,139,133,0.32)", borderLeft: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-hero-corner" style={{ bottom: 18, right: 18, borderBottom: "2px solid rgba(112,139,133,0.32)", borderRight: "2px solid rgba(112,139,133,0.32)" }} />
        <span className="gg-dot" style={{ position: "absolute", top: 28, right: 30, width: 8, height: 8, borderRadius: 999, background: "#5b8a7a" }} />
        <div className="gg-hero-squiggle gg-float">
          <svg width="100" height="200" viewBox="0 0 100 200" fill="none">
            <path className="gg-sq" d={GG_SQUIGGLE_PATH} stroke="#5b8a7a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
          </svg>
        </div>
        <div className="gg-shell" style={{ position: "relative", zIndex: 1 }}>
          <p className="gg-kicker gg-afu1"><span className="gg-kicker-dot gg-dot" /> Bay Area Photo Locations</p>
          <h1 className="gg-h1 gg-afu2">Warm spots with</h1>
          <p className="gg-h1-script gg-afu3"><span className="gg-h1-accent">clean light.</span><span className="gg-cursor gg-blink" /></p>
          <p className="gg-sub gg-afu4">
            My favorite Bay Area locations for portraits, couples, and creative shoots.
            Search by vibe, or tap a tag like South Bay, SF, East Bay, or Beaches to narrow it down fast.
          </p>
          <div className="gg-actions gg-afu4">
            <a href="https://www.soloxsnaps.com/contact/" className="gg-btn gg-btn--primary">Book a shoot →</a>
            <Link href="/availability" className="gg-btn gg-btn--ghost">Check availability</Link>
          </div>

          <div className="loc-stats gg-afu4">
            <div className="loc-stat">
              <p className="loc-stat-label">Spots saved</p>
              <p className="loc-stat-num">{locations.length}</p>
              <p className="loc-stat-note">A living list of places I actually like shooting at.</p>
            </div>
            <div className="loc-stat">
              <p className="loc-stat-label">Regions covered</p>
              <p className="loc-stat-num">{regionCount}</p>
              <p className="loc-stat-note">From city architecture to softer open-air spots.</p>
            </div>
            <div className="loc-stat">
              <p className="loc-stat-label">Beach options</p>
              <p className="loc-stat-num">{beachCount}</p>
              <p className="loc-stat-note">For people who want a little wind and a lot of space.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARQUEE ────────────────────────────────────────────────────────── */}
      <div className="gg-marquee">
        <div className="gg-marquee-track">
          {marquee.map((item, i) => (
            <span key={i} className="gg-marquee-item">{item}<span className="gg-marquee-sep" /></span>
          ))}
        </div>
      </div>

      {/* ── SEARCH + FILTERS ───────────────────────────────────────────────── */}
      <section className="gg-section gg-section--alt">
        <div className="gg-shell">
          <div className="loc-toolbar" data-reveal>
            <div className="loc-toolbar-grid">
              <div>
                <label className="loc-label">Search locations</label>
                <div className="loc-search">
                  <span>🔎</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search Baker, beach, redwoods, SF, San Jose..."
                  />
                </div>
              </div>
              <div className="loc-count">
                <p className="loc-count-label">Showing</p>
                <p className="loc-count-num">{filteredLocations.length}</p>
                <p className="loc-count-note">
                  {activeChip === "all" ? "matches" : `${getLocationChipLabel(activeChip)} matches`}
                </p>
              </div>
            </div>

            <div className="loc-chips">
              {BAY_AREA_FILTER_CHIPS.map((chip) => {
                const active = chip.value === activeChip;
                return (
                  <button
                    key={chip.value}
                    onClick={() => setActiveChip(chip.value)}
                    className={`loc-chip${active ? " loc-chip--on" : ""}`}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── LOCATION LIBRARY ───────────────────────────────────────────────── */}
      <section className="gg-section">
        <div className="gg-shell">
          <p className="gg-sec-kicker" data-reveal>Location Library</p>
          <h2 className="gg-sec-title" data-reveal>Places I keep coming back to</h2>
          <p className="gg-sec-sub" data-reveal>
            Each card has the vibe, the best light, and the little practical note I would actually tell a client before we head there.
          </p>

          {filteredLocations.length === 0 ? (
            <div className="gg-empty" style={{ marginTop: 30 }} data-reveal>
              <p style={{ fontSize: 34, margin: "0 0 12px" }}>🧭</p>
              <h3 className="gg-sec-title" style={{ fontSize: "1.5rem" }}>No spots match that filter yet.</h3>
              <p className="gg-sec-sub" style={{ margin: "8px auto 0", maxWidth: 420 }}>
                Try a broader search, or switch back to All Spots to see the full list again.
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setActiveChip("all");
                }}
                className="gg-btn gg-btn--primary"
                style={{ marginTop: 22 }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="loc-grid">
              {filteredLocations.map((location) => (
                <article key={location.id} className="loc-card" data-reveal>
                  <span className="loc-card-bar" />
                  <div className="loc-card-media">
                    {location.image_url ? (
                      <>
                        <OptimizedPhoto
                          src={location.image_url}
                          alt={location.title}
                          sizes="(max-width: 760px) 100vw, 50vw"
                        />
                        <div className="loc-card-overlay" />
                        <div className="loc-card-toptags">
                          <span className="loc-pill loc-pill--region">{getLocationChipLabel(location.region)}</span>
                          <span className="loc-pill loc-pill--city">{location.city}</span>
                        </div>
                      </>
                    ) : (
                      <div className="loc-card-ph">
                        <span>{getLocationEmoji(location)}</span>
                        <p>Add a Supabase photo when you are ready</p>
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
                      <div className="loc-light">
                        <p className="loc-light-label">Best light</p>
                        <p className="loc-light-val">{location.best_time}</p>
                      </div>
                    </div>

                    <ExpandableText
                      text={location.description}
                      className="loc-desc"
                      buttonColor="#3d6b5e"
                    />

                    <div className="loc-meta">
                      <div className="loc-meta-box">
                        <p className="loc-meta-label">Best for</p>
                        <p className="loc-meta-text">{location.best_for}</p>
                      </div>
                      <div className="loc-meta-box loc-meta-box--tip">
                        <p className="loc-meta-label">Pro tip</p>
                        <p className="loc-meta-text">{location.tip}</p>
                      </div>
                    </div>

                    <div className="loc-card-tags">
                      <span className="loc-tag loc-tag--region">{getLocationChipLabel(location.region)}</span>
                      {location.tags
                        .filter((tag) => tag !== location.region)
                        .map((tag) => (
                          <button
                            key={tag}
                            onClick={() => setActiveChip(tag as (typeof BAY_AREA_FILTER_CHIPS)[number]["value"])}
                            className="loc-tag"
                          >
                            {getLocationChipLabel(tag)}
                          </button>
                        ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="gg-cta">
        <div className="gg-shell">
          <div className="gg-cta-card glass-shimmer" data-reveal>
            <div className="gg-cta-squiggle">
              <svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
            </div>
            <h2 className="gg-cta-title">Found the vibe you want?</h2>
            <p className="gg-cta-sub">
              Send me the spots you are drawn to and I can help narrow them down based on light, traffic, outfits, and the energy you want the photos to have.
            </p>
            <div className="gg-cta-actions">
              <a href="https://www.soloxsnaps.com/contact/" className="gg-btn gg-btn--ongreen">Start planning →</a>
              <Link href="/links" className="gg-btn gg-btn--onghost">More links</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
