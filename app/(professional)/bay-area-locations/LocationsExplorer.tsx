"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { GRAD_GUIDE_CSS, GG_SQUIGGLE_PATH } from "@/lib/gradGuide";
import type { PublicLocationCard } from "@/lib/locationLibrary/publicData";
import {
  EMPTY_FILTERS, applyFilters, facetOptions, type LocationFilters as Filters, type SortValue,
} from "@/lib/locationLibrary/publicFilters";
import LocationCard from "./LocationCard";
import LocationFilters from "./LocationFilters";
import { LOC_CSS } from "./locationsCss";

const MARQUEE = [
  "San Francisco", "South Bay", "East Bay", "Peninsula",
  "Beaches", "Golden Hour", "Gardens", "Clean Light",
];
const marquee = [...MARQUEE, ...MARQUEE];

// Cards beyond this load on "Show more" so a large library stays light on phones.
const PAGE_SIZE = 24;
const EAGER_CARDS = 2;

export default function LocationsExplorer({ locations }: { locations: PublicLocationCard[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortValue>("featured");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredQuery = useDeferredValue(filters.query);

  const facets = useMemo(() => facetOptions(locations), [locations]);
  const filtered = useMemo(
    () => applyFilters(locations, { ...filters, query: deferredQuery }, sort),
    [locations, filters, deferredQuery, sort],
  );
  const visible = filtered.slice(0, limit);

  const regionCount = new Set(locations.map((l) => l.region)).size;
  const beachCount = locations.filter((l) => l.environments.includes("beach") || l.tags.includes("beaches")).length;

  const change = (next: Filters) => {
    setFilters(next);
    setLimit(PAGE_SIZE);
  };
  const reset = () => change(EMPTY_FILTERS);

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
            Filter by region, setting, light, or the kind of session to narrow it down fast.
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
          <LocationFilters
            filters={filters}
            sort={sort}
            facets={facets}
            shown={filtered.length}
            onChange={change}
            onSort={setSort}
            onReset={reset}
          />
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

          {filtered.length === 0 ? (
            <div className="gg-empty" style={{ marginTop: 30 }} data-reveal>
              <p style={{ fontSize: 34, margin: "0 0 12px" }}>🧭</p>
              <h3 className="gg-sec-title" style={{ fontSize: "1.5rem" }}>No spots match that filter yet.</h3>
              <p className="gg-sec-sub" style={{ margin: "8px auto 0", maxWidth: 420 }}>
                Try a broader search, or clear the filters to see the full list again.
              </p>
              <button onClick={reset} className="gg-btn gg-btn--primary" style={{ marginTop: 22 }}>
                Reset filters
              </button>
            </div>
          ) : (
            <>
              <div className="loc-grid">
                {visible.map((location, i) => (
                  <LocationCard
                    key={location.id}
                    location={location}
                    eager={i < EAGER_CARDS}
                    onEnvironment={(environment) => change({ ...filters, environment })}
                    onLight={(light) => change({ ...filters, light })}
                  />
                ))}
              </div>
              {filtered.length > visible.length ? (
                <div className="loc-more">
                  <button type="button" className="gg-btn gg-btn--ghost" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                    Show more spots ({filtered.length - visible.length})
                  </button>
                </div>
              ) : null}
            </>
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
