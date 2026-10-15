#!/usr/bin/env node
// Measure a verified round trip for lib/travelFee.ts VERIFIED_ROUTES.
//
//   node scripts/travel-route.mjs "Filoli, 86 Canada Road, Woodside, CA"
//
// Geocodes the destination with OpenStreetMap Nominatim and routes it out and
// back separately with the public OSRM server. Both are free and keyless; this
// is a one-off measuring tool, never called at request time. Prints an entry
// to paste into VERIFIED_ROUTES after you check the matched place is right.
//
// Bridges are found from the route's geometry (OSRM step names do not name
// them): the path passing through a small box on the span, with the heading
// read from the order it crosses. A bridge whose toll is not verified in
// lib/travelFee.ts is reported for you to confirm, never priced.

// The business travel origin. Kept here, in a dev-only script, so it never
// ships in a client bundle or reaches the AI prompt.
const ORIGIN = { lat: 37.7327482, lon: -122.5023923 };

const USER_AGENT = "soloxsnaps-travel-route/1.0";
const METERS_PER_MILE = 1609.344;

// Box on each span, plus the axis the heading is read along.
const BRIDGES = [
  { key: "bayBridge", name: "Bay Bridge", box: [37.805, 37.818, -122.375, -122.355], axis: "lon", verified: true },
  { key: "sanMateoBridge", name: "San Mateo-Hayward Bridge", box: [37.57, 37.63, -122.22, -122.16], axis: "lon", verified: true },
  { key: "dumbartonBridge", name: "Dumbarton Bridge", box: [37.49, 37.52, -122.13, -122.10], axis: "lon", verified: true },
  { key: "carquinezBridge", name: "Carquinez Bridge", box: [38.05, 38.07, -122.235, -122.215], axis: "lat", verified: true },
  { key: "beniciaBridge", name: "Benicia-Martinez Bridge", box: [38.025, 38.045, -122.13, -122.11], axis: "lat", verified: true },
  { key: "goldenGateBridge", name: "Golden Gate Bridge", box: [37.81, 37.83, -122.482, -122.475], axis: "lat", verified: false },
  { key: "richmondBridge", name: "Richmond-San Rafael Bridge", box: [37.92, 37.95, -122.46, -122.40], axis: "lon", verified: false },
];

async function geocode(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q: query, format: "json", limit: "1", countrycodes: "us" }).toString();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const [hit] = await res.json();
  if (!hit) throw new Error(`No match for "${query}". Try the full street address.`);
  return { lat: Number(hit.lat), lon: Number(hit.lon), name: hit.display_name };
}

async function route(from, to) {
  const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const body = await res.json();
  if (body.code !== "Ok" || !body.routes?.length) throw new Error(`OSRM: ${body.code}`);
  const [best] = body.routes;
  return { miles: best.distance / METERS_PER_MILE, points: best.geometry.coordinates };
}

// A segment crosses the span when it straddles the box's midline (a
// meridian for an east-west bridge, a parallel for a north-south one) at a
// point inside the box. Segments, not points: a long straight span can have
// no vertex on it at all.
function crossingHeading([lon1, lat1], [lon2, lat2], { box: [south, north, west, east], axis }) {
  const [a1, a2, mid] = axis === "lon" ? [lon1, lon2, (west + east) / 2] : [lat1, lat2, (south + north) / 2];
  if ((a1 - mid) * (a2 - mid) > 0 || a1 === a2) return null;
  const t = (mid - a1) / (a2 - a1);
  const [lon, lat] = [lon1 + t * (lon2 - lon1), lat1 + t * (lat2 - lat1)];
  if (lat < south || lat > north || lon < west || lon > east) return null;
  if (axis === "lon") return a2 > a1 ? "eastbound" : "westbound";
  return a2 > a1 ? "northbound" : "southbound";
}

function crossingsOf(points) {
  const found = [];
  for (let i = 1; i < points.length; i++) {
    for (const bridge of BRIDGES) {
      const h = crossingHeading(points[i - 1], points[i], bridge);
      if (h) found.push({ bridge, heading: h });
    }
  }
  return found;
}

function slugOf(text) {
  return text.toLowerCase().split(",")[0].trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function printEntry(query, place, outbound, back, crossings) {
  const today = new Date().toISOString().slice(0, 10);
  const lines = crossings.map(({ bridge, heading: h }) => `      { bridge: "${bridge.key}", heading: "${h}" },`);
  console.log(`Matched: ${place.name}\n`);
  console.log(`  "${slugOf(query)}": {
    label: "${query.split(",")[0].trim()}",
    address: "${query}",
    outboundMiles: ${outbound.miles.toFixed(2)},
    returnMiles: ${back.miles.toFixed(2)},
    crossings: [${lines.length ? `\n${lines.join("\n")}\n    ` : ""}],
    verifiedOn: "${today}",
  },`);
}

async function main() {
  const query = process.argv.slice(2).join(" ").trim();
  if (!query) {
    console.error('Usage: node scripts/travel-route.mjs "<destination address>"');
    process.exit(1);
  }
  const place = await geocode(query);
  const outbound = await route(ORIGIN, place);
  const back = await route(place, ORIGIN);
  const crossings = [...crossingsOf(outbound.points), ...crossingsOf(back.points)];

  printEntry(query, place, outbound, back, crossings);
  const unverified = crossings.filter(({ bridge }) => !bridge.verified);
  for (const { bridge, heading: h } of unverified) {
    console.warn(`\n! Crosses ${bridge.name} ${h}: its toll is not in lib/travelFee.ts TOLL_BRIDGES. Verify the amount and direction before adding this route.`);
  }
  const known = new Set(["bayBridge", "sanMateoBridge"]);
  for (const { bridge } of crossings.filter((c) => c.bridge.verified && !known.has(c.bridge.key))) {
    console.warn(`\n! Add ${bridge.key} to TOLL_BRIDGES first (state-owned bridge; check the current toll on bayareafastrak.org).`);
  }
}

main().catch((error) => {
  console.error(`travel-route: ${error.message}`);
  process.exit(1);
});
