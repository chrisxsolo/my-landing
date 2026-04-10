"use client";

import Link from "next/link";
import { useDeferredValue, useState } from "react";
import { C } from "@/lib/colors";
import {
  BAY_AREA_FILTER_CHIPS,
  BAY_AREA_REGION_OPTIONS,
  getLocationChipLabel,
  type BayAreaLocationEntry,
} from "@/lib/bayAreaLocations";

const REGION_STYLES: Record<
  string,
  {
    badge: string;
    accent: string;
    soft: string;
    border: string;
    text: string;
    emoji: string;
  }
> = {
  "south-bay": {
    badge: "linear-gradient(135deg, #f59e0b, #f97316)",
    accent: "linear-gradient(135deg, #fb923c, #f472b6)",
    soft: "rgba(251, 146, 60, 0.10)",
    border: "rgba(249, 115, 22, 0.18)",
    text: "#c2410c",
    emoji: "🌇",
  },
  "san-francisco": {
    badge: "linear-gradient(135deg, #9d6fe8, #e879a0)",
    accent: "linear-gradient(135deg, #7c3aed, #ec4899)",
    soft: "rgba(157, 111, 232, 0.10)",
    border: "rgba(157, 111, 232, 0.18)",
    text: "#7c3aed",
    emoji: "🌉",
  },
  "east-bay": {
    badge: "linear-gradient(135deg, #14b8a6, #60a5fa)",
    accent: "linear-gradient(135deg, #0f766e, #60a5fa)",
    soft: "rgba(20, 184, 166, 0.10)",
    border: "rgba(59, 130, 246, 0.18)",
    text: "#0f766e",
    emoji: "🌿",
  },
  peninsula: {
    badge: "linear-gradient(135deg, #f97316, #fbbf24)",
    accent: "linear-gradient(135deg, #fb7185, #f59e0b)",
    soft: "rgba(251, 146, 60, 0.11)",
    border: "rgba(251, 146, 60, 0.18)",
    text: "#b45309",
    emoji: "🌊",
  },
  "north-bay": {
    badge: "linear-gradient(135deg, #22c55e, #14b8a6)",
    accent: "linear-gradient(135deg, #16a34a, #0ea5e9)",
    soft: "rgba(34, 197, 94, 0.10)",
    border: "rgba(34, 197, 94, 0.16)",
    text: "#15803d",
    emoji: "🌲",
  },
};

function getRegionStyle(region: string) {
  return REGION_STYLES[region] ?? {
    badge: C.grad12,
    accent: C.grad,
    soft: C.p1_08,
    border: C.borderWarm,
    text: C.p1,
    emoji: "📍",
  };
}

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
  return getRegionStyle(location.region).emoji;
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
    <>
      <section
        className="relative overflow-hidden border-b px-6 pb-14 pt-16"
        style={{ borderColor: C.borderSubtle }}
      >
        <div className="absolute inset-0 pointer-events-none" style={C.gridBg(0.045)} />
        <div className="absolute inset-0 pointer-events-none" style={C.vignette} />
        <div className="absolute left-5 top-5 h-5 w-5 pointer-events-none" style={{ borderLeft: `2px solid ${C.p1_30}`, borderTop: `2px solid ${C.p1_30}` }} />
        <div className="absolute right-5 top-5 h-5 w-5 pointer-events-none" style={{ borderRight: `2px solid ${C.p2_18}`, borderTop: `2px solid ${C.p2_18}` }} />
        <div className="absolute bottom-5 left-5 h-5 w-5 pointer-events-none" style={{ borderBottom: `2px solid ${C.p2_18}`, borderLeft: `2px solid ${C.p2_18}` }} />
        <div className="absolute bottom-5 right-5 h-5 w-5 pointer-events-none" style={{ borderBottom: `2px solid ${C.p3_15}`, borderRight: `2px solid ${C.p3_15}` }} />
        <div className="blob1 absolute -left-24 -top-24 rounded-full pointer-events-none" style={{ width: 460, height: 460, background: C.blob1 }} />
        <div className="blob2 absolute -right-24 top-0 rounded-full pointer-events-none" style={{ width: 340, height: 340, background: C.blob2 }} />

        <div className="relative z-10 mx-auto max-w-5xl">
          <div className="mx-auto max-w-3xl text-center">
            <div
              className="afu1 mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1.5"
              style={{ background: C.surfaceStrong, border: `1px solid ${C.borderWarm}`, boxShadow: C.shadowWarmSm }}
            >
              <div className="pdot h-1.5 w-1.5 rounded-full" style={{ background: C.grad12 }} />
              <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: C.p1 }}>
                Bay Area Photo Locations
              </p>
            </div>

            <h1 className="afu2 mb-2 text-5xl font-black tracking-tight text-slate-900 sm:text-6xl">
              Warm spots with
            </h1>
            <p className="afu3 mb-6 text-5xl font-light italic tracking-tight text-slate-900 sm:text-6xl">
              clean light.
              <span
                className="cblink ml-1.5 inline-block h-[44px] w-[3px] rounded-sm align-middle sm:h-[52px]"
                style={{ background: C.grad12 }}
              />
            </p>

            <p className="afu4 mx-auto mb-8 max-w-2xl text-lg font-light leading-relaxed text-slate-600">
              My favorite Bay Area locations for portraits, couples, and creative shoots.
              Search by vibe, or tap a tag like South Bay, SF, East Bay, or Beaches to narrow it down fast.
            </p>

            <div className="afu4 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://www.soloxsnaps.com/contact/"
                className="btn-lift rounded-full px-6 py-3 text-sm font-bold text-white"
                style={{ background: C.grad12, boxShadow: C.shadowWarmSm }}
              >
                Book a shoot -&gt;
              </a>
              <Link
                href="/availability"
                className="btn-lift rounded-full px-6 py-3 text-sm font-bold text-slate-900"
                style={{ background: C.surfaceStrong, border: `1px solid ${C.borderSubtle}`, boxShadow: C.shadowWarmSm }}
              >
                Check availability
              </Link>
            </div>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div
              className="card-lift rounded-[28px] border p-5"
              style={{ background: C.surfaceWarmAlt, borderColor: C.borderSubtle, boxShadow: C.shadowWarmSm }}
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Spots saved</p>
              <p className="text-4xl font-black text-slate-900">{locations.length}</p>
              <p className="mt-1 text-sm text-slate-500">A living list of places I actually like shooting at.</p>
            </div>
            <div
              className="card-lift rounded-[28px] border p-5"
              style={{ background: C.surfaceWarm, borderColor: C.borderWarm, boxShadow: C.shadowWarmSm }}
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Regions covered</p>
              <p className="text-4xl font-black text-slate-900">{regionCount}</p>
              <p className="mt-1 text-sm text-slate-500">From city architecture to softer open-air spots.</p>
            </div>
            <div
              className="card-lift rounded-[28px] border p-5"
              style={{ background: C.surfaceStrong, borderColor: C.borderWarmStrong, boxShadow: C.shadowWarmSm }}
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Beach options</p>
              <p className="text-4xl font-black text-slate-900">{beachCount}</p>
              <p className="mt-1 text-sm text-slate-500">For people who want a little wind and a lot of space.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b px-6 py-6" style={{ borderColor: C.borderSubtle, background: C.surfaceStrong }}>
        <div className="mx-auto max-w-5xl">
          <div
            className="rounded-[30px] border p-5 sm:p-6"
            style={{ background: C.surfaceStrong, borderColor: C.borderWarm, boxShadow: C.shadowWarm }}
          >
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                  Search locations
                </label>
                <div
                  className="flex items-center gap-3 rounded-2xl border px-4 py-3"
                  style={{ background: C.page, borderColor: C.borderSubtle }}
                >
                  <span className="text-lg">🔎</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search Baker, beach, redwoods, SF, San Jose..."
                    className="w-full bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="rounded-2xl px-4 py-3" style={{ background: C.surfaceWarmAlt }}>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">Showing</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{filteredLocations.length}</p>
                <p className="text-sm text-slate-500">
                  {activeChip === "all" ? "matches" : `${getLocationChipLabel(activeChip)} matches`}
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {BAY_AREA_FILTER_CHIPS.map((chip) => {
                const active = chip.value === activeChip;
                return (
                  <button
                    key={chip.value}
                    onClick={() => setActiveChip(chip.value)}
                    className="rounded-full px-4 py-2 text-sm font-bold transition-all"
                    style={{
                      background: active ? C.grad12 : C.surfaceWarm,
                      color: active ? "#fff" : "#334155",
                      border: active ? "none" : `1px solid ${C.borderSubtle}`,
                      boxShadow: active ? C.shadowWarmSm : "none",
                    }}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-6 py-14">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em]" style={{ color: C.p1 }}>
                Location Library
              </p>
              <h2 className="text-3xl font-black tracking-tight text-slate-900">
                Places I keep coming back to
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-relaxed text-slate-500">
              Each card has the vibe, the best light, and the little practical note I would actually tell a client before we head there.
            </p>
          </div>

          {filteredLocations.length === 0 ? (
            <div
              className="rounded-[30px] border px-6 py-14 text-center"
              style={{ background: C.surfaceStrong, borderColor: C.borderWarm, boxShadow: C.shadowWarmSm }}
            >
              <p className="mb-3 text-4xl">🧭</p>
              <h3 className="text-2xl font-black text-slate-900">No spots match that filter yet.</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-500">
                Try a broader search, or switch back to All Spots to see the full list again.
              </p>
              <button
                onClick={() => {
                  setQuery("");
                  setActiveChip("all");
                }}
                className="btn-lift mt-6 rounded-full px-5 py-2.5 text-sm font-bold text-white"
                style={{ background: C.grad12 }}
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-2">
              {filteredLocations.map((location) => {
                const region = getRegionStyle(location.region);
                return (
                  <article
                    key={location.id}
                    className="card-lift overflow-hidden rounded-[30px] border"
                    style={{ background: C.surfaceStrong, borderColor: region.border, boxShadow: C.shadowWarmSm }}
                  >
                    <div className="h-[4px]" style={{ background: region.accent }} />

                    <div className="relative">
                      {location.image_url ? (
                        <div className="relative h-72 overflow-hidden">
                          <img
                            src={location.image_url}
                            alt={location.title}
                            className="h-full w-full object-cover"
                          />
                          <div
                            className="absolute inset-0"
                            style={{ background: "linear-gradient(180deg, transparent 30%, rgba(15,23,42,0.38) 100%)" }}
                          />
                          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                            <span
                              className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white"
                              style={{ background: region.badge }}
                            >
                              {getLocationChipLabel(location.region)}
                            </span>
                            <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-slate-700">
                              {location.city}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="relative flex h-64 items-center justify-center overflow-hidden"
                          style={{ background: region.accent }}
                        >
                          <div className="absolute inset-0 pointer-events-none" style={C.ctaGridLg} />
                          <div className="text-center text-white">
                            <p className="mb-3 text-5xl">{getLocationEmoji(location)}</p>
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/70">
                              Add a Supabase photo when you are ready
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="mb-1 text-xs font-bold uppercase tracking-[0.15em]" style={{ color: region.text }}>
                            {location.city}
                            {location.neighborhood ? ` - ${location.neighborhood}` : ""}
                          </p>
                          <h3 className="text-2xl font-black tracking-tight text-slate-900">
                            {location.title}
                          </h3>
                        </div>
                        <div
                          className="rounded-2xl px-3 py-2 text-right"
                          style={{ background: region.soft, border: `1px solid ${region.border}` }}
                        >
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: region.text }}>
                            Best light
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-700">{location.best_time}</p>
                        </div>
                      </div>

                      <p className="text-sm leading-relaxed text-slate-600">{location.description}</p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl px-4 py-3" style={{ background: C.surfaceWarmAlt }}>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
                            Best for
                          </p>
                          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">
                            {location.best_for}
                          </p>
                        </div>
                        <div className="rounded-2xl px-4 py-3" style={{ background: C.surfaceWarm }}>
                          <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: C.p2 }}>
                            Pro tip
                          </p>
                          <p className="mt-1 text-sm font-medium leading-relaxed text-slate-700">
                            {location.tip}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-2">
                        <span
                          className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white"
                          style={{ background: region.badge }}
                        >
                          {getLocationChipLabel(location.region)}
                        </span>
                        {location.tags
                          .filter((tag) => tag !== location.region)
                          .map((tag) => (
                            <button
                              key={tag}
                              onClick={() => setActiveChip(tag as (typeof BAY_AREA_FILTER_CHIPS)[number]["value"])}
                              className="rounded-full px-3 py-1 text-xs font-bold text-slate-600 transition-all hover:-translate-y-0.5"
                              style={{ background: C.surfaceWarmAlt, border: `1px solid ${C.borderSubtle}` }}
                            >
                              {getLocationChipLabel(tag)}
                            </button>
                          ))}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <div className="px-6 pb-20">
        <div
          className="relative mx-auto max-w-4xl overflow-hidden rounded-[34px] p-10 text-center"
          style={{ background: C.grad }}
        >
          <div className="absolute inset-0 pointer-events-none" style={C.ctaGridLg} />
          <div className="relative">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-white/65">
              Build the whole session around the right setting
            </p>
            <h3 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              Found the vibe you want?
            </h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-light leading-relaxed text-white/80">
              Send me the spots you are drawn to and I can help narrow them down based on light, traffic, outfits, and what kind of energy you want the photos to have.
            </p>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <a
                href="https://www.soloxsnaps.com/contact/"
                className="btn-lift rounded-full bg-white px-6 py-3 text-sm font-bold"
                style={{ color: C.p1 }}
              >
                Start planning -&gt;
              </a>
              <Link
                href="/links"
                className="btn-lift rounded-full border px-6 py-3 text-sm font-bold text-white"
                style={{ borderColor: "rgba(255,255,255,0.35)" }}
              >
                More links
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
