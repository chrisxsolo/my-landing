"use client";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useEffect, useState } from "react";
import OptimizedPhoto from "@/app/components/OptimizedPhoto";
import { GRAD_GUIDE_CSS, GG_SQUIGGLE_PATH } from "@/lib/gradGuide";

type LocationSpot = { id: number; school_id: string; school_name: string; school_short: string; name: string; description: string; tip: string; icon: string; image_url: string | null; order: number };

const SCHOOL_ORDER = ["sjsu", "berkeley", "sfsu", "csueb", "usf"];

const SCHOOL_META: Record<string, { emoji: string; tagline: string }> = {
  sjsu:     { emoji: "🏫", tagline: "Downtown energy, iconic architecture" },
  berkeley: { emoji: "🐻", tagline: "Iconic arches, Sather Gate, golden hillsides" },
  sfsu:     { emoji: "🌉", tagline: "Modern campus meets San Francisco backdrops" },
  csueb:    { emoji: "🦅", tagline: "Bay views, hillside campus, hidden gems" },
  usf:      { emoji: "⛪", tagline: "Hilltop campus, Golden Gate Park nearby, city views" },
};

// Maps this guide's internal school_id to the live /grads/<slug> route segment
// (note: school_id keys differ from URL slugs — berkeley→uc-berkeley, sfsu→sf-state).
const SCHOOL_SLUGS: Record<string, string> = {
  sjsu: "sjsu",
  berkeley: "uc-berkeley",
  sfsu: "sf-state",
  csueb: "csueb",
  usf: "usf",
};

const DRAFT_SPOTS: LocationSpot[] = [
  { id: 1, school_id: "sjsu", school_name: "San Jose State University", school_short: "SJSU", name: "The SJSU Sign Wall", description: "The big blue SJSU block letters on the side of the building on 7th St. Clean, bold, instantly recognizable. Best in the morning before it gets crowded.", tip: "Arrive before 9am on weekdays for an empty wall.", icon: "🏫", image_url: null, order: 1 },
  { id: 2, school_id: "sjsu", school_name: "San Jose State University", school_short: "SJSU", name: "Tower Hall Steps", description: "The old red-brick Tower Hall is the most architectural building on campus. The front steps and archways give you a classic collegiate look that never goes out of style.", tip: "Overcast days work great here — no harsh shadows on the brick.", icon: "🏛️", image_url: null, order: 2 },
  { id: 3, school_id: "sjsu", school_name: "San Jose State University", school_short: "SJSU", name: "Event Center Plaza", description: "Wide open concrete plaza with palm trees and clean sight lines. Great for walking shots, cap throws, and full-length gown photos.", tip: "The palm trees make great framing for backlit golden hour shots.", icon: "🌴", image_url: null, order: 3 },
  { id: 4, school_id: "sjsu", school_name: "San Jose State University", school_short: "SJSU", name: "MLK Library Steps", description: "The joint SJSU/San Jose Public Library has great steps and glass architecture out front. Modern aesthetic, clean lines, good for editorial-style portraits.", tip: "Late afternoon light hits the glass facade perfectly.", icon: "📚", image_url: null, order: 4 },
  { id: 5, school_id: "sjsu", school_name: "San Jose State University", school_short: "SJSU", name: "Campus Flower Beds & Gardens", description: "Scattered throughout campus near Clark Hall and the quad. Seasonal blooms add color and softness to photos.", tip: "Spring semester has the best blooms — check before your shoot.", icon: "🌸", image_url: null, order: 5 },
  { id: 6, school_id: "berkeley", school_name: "UC Berkeley", school_short: "UC Berkeley", name: "Sather Gate", description: "The most iconic spot on campus. The bronze gate with the campanile in the background is immediately recognizable as Berkeley.", tip: "7–9am on weekdays = nearly empty. Weekends get busy by 10am.", icon: "🚪", image_url: null, order: 1 },
  { id: 7, school_id: "berkeley", school_name: "UC Berkeley", school_short: "UC Berkeley", name: "Doe Memorial Library Steps", description: "Massive stone steps with classical columns. Gives you that timeless university photo. Great for groups and solo shots in full gown.", tip: "Shoot facing west in the late afternoon for beautiful front lighting.", icon: "🏛️", image_url: null, order: 2 },
  { id: 8, school_id: "berkeley", school_name: "UC Berkeley", school_short: "UC Berkeley", name: "Sproul Plaza", description: "The heart of campus. Open space, palm trees, and the Sather Tower in the background. Great for candid walking shots and cap throws.", tip: "The fountain area makes a great foreground element for wide shots.", icon: "🌳", image_url: null, order: 3 },
  { id: 9, school_id: "berkeley", school_name: "UC Berkeley", school_short: "UC Berkeley", name: "The Campanile (Sather Tower)", description: "Shoot at the base looking up, or find a spot where you can frame the full tower behind you. One of the most striking backdrops on any campus.", tip: "Golden hour from the west side of the tower is stunning.", icon: "🗼", image_url: null, order: 4 },
  { id: 10, school_id: "berkeley", school_name: "UC Berkeley", school_short: "UC Berkeley", name: "Faculty Glade", description: "A hidden gem — grassy open field surrounded by redwood trees and a small creek. Natural, serene, completely different vibe from the stone architecture nearby.", tip: "Great for a second look if you want something more natural and editorial.", icon: "🌿", image_url: null, order: 5 },
  { id: 11, school_id: "berkeley", school_name: "UC Berkeley", school_short: "UC Berkeley", name: "Strawberry Creek Path", description: "Wooded path running through campus with dappled light through the trees. Best for candid walking shots and profile portraits in natural shade.", tip: "Midday shade here is perfect when the sun is too harsh elsewhere.", icon: "🌊", image_url: null, order: 6 },
  { id: 12, school_id: "sfsu", school_name: "San Francisco State University", school_short: "SF State", name: "SFSU Sign & Main Entrance", description: "The main campus entrance on 19th Ave has clean signage and a modern feel. Simple, direct, and immediately identifiable as SF State.", tip: "Morning light from the east hits the sign perfectly on clear days.", icon: "🏫", image_url: null, order: 1 },
  { id: 13, school_id: "sfsu", school_name: "San Francisco State University", school_short: "SF State", name: "Cesar Chavez Student Center Steps", description: "The student center has wide concrete steps and an elevated plaza with great sight lines across campus. Good for full-length gown shots.", tip: "The steps face south — great for midday light without squinting.", icon: "🏢", image_url: null, order: 2 },
  { id: 14, school_id: "sfsu", school_name: "San Francisco State University", school_short: "SF State", name: "Campus Green & Open Quad", description: "The central grassy area near the administration building gives you open sky and greenery. Good for movement shots and cap throws.", tip: "Afternoon light from the west gives you long golden shadows across the grass.", icon: "🌿", image_url: null, order: 3 },
  { id: 15, school_id: "sfsu", school_name: "San Francisco State University", school_short: "SF State", name: "Lake Merced (5 min from campus)", description: "A short drive from campus and completely different energy. The lake trail with eucalyptus trees and open water makes for stunning editorial portraits.", tip: "Sunset here is unreal. Plan a second location shoot if you have time.", icon: "🌅", image_url: null, order: 4 },
  { id: 16, school_id: "sfsu", school_name: "San Francisco State University", school_short: "SF State", name: "Twin Peaks Overlook (nearby)", description: "A short drive for an iconic San Francisco skyline backdrop. Cap and gown with the whole city behind you.", tip: "Go 30 min before golden hour. Fog can roll in fast so check the forecast.", icon: "🌁", image_url: null, order: 5 },
  { id: 17, school_id: "csueb", school_name: "Cal State East Bay", school_short: "CSUEB", name: "CSUEB Sign at Main Entrance", description: "The main entrance sign off Carlos Bee Blvd gives you a clean, identifiable campus shot. Simple and works great for the classic 'I graduated here' photo.", tip: "Morning light from the east is ideal before it gets harsh.", icon: "🏫", image_url: null, order: 1 },
  { id: 18, school_id: "csueb", school_name: "Cal State East Bay", school_short: "CSUEB", name: "Central Quad & Open Areas", description: "The open central area gives you wide open sky and the Hayward Hills as a backdrop. Spacious and great for big group shots.", tip: "Best in the late afternoon when the hills glow golden.", icon: "🏔️", image_url: null, order: 2 },
  { id: 19, school_id: "csueb", school_name: "Cal State East Bay", school_short: "CSUEB", name: "Library Terrace & Steps", description: "The library has a multi-level terrace with panoramic views of the Bay and the SF skyline on clear days.", tip: "On clear days you can see SF in the background — check air quality first.", icon: "📚", image_url: null, order: 3 },
  { id: 20, school_id: "csueb", school_name: "Cal State East Bay", school_short: "CSUEB", name: "University Drive Pathway", description: "The main pedestrian pathway through campus lined with trees and light poles. Great for walking shots and candid-style portraits.", tip: "Golden hour from the west end of the path is excellent.", icon: "🌳", image_url: null, order: 4 },
  { id: 21, school_id: "csueb", school_name: "Cal State East Bay", school_short: "CSUEB", name: "Meiklejohn Hall Archway", description: "One of the older buildings on campus with an archway entrance and red brick detail. Classic collegiate feel, good for portrait-style shots.", tip: "Overcast days work well here — consistent soft light through the archway.", icon: "🏛️", image_url: null, order: 5 },
  { id: 22, school_id: "usf", school_name: "University of San Francisco", school_short: "USF", name: "St. Ignatius Church Steps", description: "The massive twin-towered church is USF's most iconic landmark. The wide stone steps and grand facade give you an immediately recognizable backdrop.", tip: "Shoot facing east in the morning for clean front light on the steps.", icon: "⛪", image_url: null, order: 1 },
  { id: 23, school_id: "usf", school_name: "University of San Francisco", school_short: "USF", name: "Lone Mountain Summit", description: "The hilltop behind the Lone Mountain building has one of the best 360-degree views in San Francisco — the city skyline, the Bay, and the Golden Gate on clear days.", tip: "Clear mornings in fall and spring are best. Fog usually burns off by 10am.", icon: "🌁", image_url: null, order: 2 },
  { id: 24, school_id: "usf", school_name: "University of San Francisco", school_short: "USF", name: "Kalmanovitz Hall Archway", description: "The main academic building has a beautiful arched entrance with red brick and ivy detail. Classic collegiate feel — similar energy to Berkeley's Doe Library but far less crowded.", tip: "This spot is shaded most of the day so it works well even at harsh midday sun.", icon: "🏛️", image_url: null, order: 3 },
  { id: 25, school_id: "usf", school_name: "University of San Francisco", school_short: "USF", name: "Golden Gate Park (5 min away)", description: "A short walk or rideshare from campus. The Panhandle entrance, the rose garden, and the Japanese Tea Garden area all make incredible backdrops.", tip: "The rose garden peaks in April–May. Japanese Tea Garden is best on weekdays.", icon: "🌿", image_url: null, order: 4 },
  { id: 26, school_id: "usf", school_name: "University of San Francisco", school_short: "USF", name: "The Main Quad & Lawn", description: "The central grassy quad surrounded by the main academic buildings gives you a clean, open shot with classic university architecture on all sides.", tip: "Golden hour from the west catches the brick buildings perfectly.", icon: "🌳", image_url: null, order: 5 },
];

const MARQUEE = ["San Jose State", "UC Berkeley", "SF State", "Cal State East Bay", "USF", "Best Spots", "Golden Hour", "Campus Shoots"];
const marquee = [...MARQUEE, ...MARQUEE];

export default function CampusSpotsClient() {
  const [spots, setSpots] = useState<LocationSpot[]>(DRAFT_SPOTS);

  useEffect(() => {
    async function fetchSpots() {
      try {
        const { data, error } = await supabase.from("location_spots").select("*").order("school_id").order("order", { ascending: true });
        if (error) console.error(error);
        if (data && data.length > 0) {
          const supabaseIds = new Set(data.map((s) => s.school_id));
          const draftFallback = DRAFT_SPOTS.filter((s) => !supabaseIds.has(s.school_id));
          setSpots([...data, ...draftFallback]);
        }
      } catch (err) {
        console.error(err);
      }
    }
    fetchSpots();
  }, []);

  const schools = SCHOOL_ORDER.map((id) => {
    const schoolSpots = spots.filter((s) => s.school_id === id);
    const first = schoolSpots[0];
    if (!first) return null;
    return { id, name: first.school_name, short: first.school_short, spots: schoolSpots };
  }).filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <main className="gg-page">
      <style>{GRAD_GUIDE_CSS}</style>

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
          <p className="gg-kicker gg-afu1"><span className="gg-kicker-dot gg-dot" /> 04 — Campus Spots</p>
          <h1 className="gg-h1 gg-afu2">The best places to</h1>
          <p className="gg-h1-script gg-afu3"><span className="gg-h1-accent">shoot at.</span><span className="gg-cursor gg-blink" /></p>
          <p className="gg-sub gg-afu4">Five Bay Area campuses, broken down spot by spot — where to go, what to expect, and the best time to show up. Pick your favorites and we&rsquo;ll plan the whole session around them.</p>
          <div className="gg-actions gg-afu4">
            {schools.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="gg-btn gg-btn--ghost" style={{ minHeight: 38, padding: "0 14px", fontSize: 13 }}>{s.short}</a>
            ))}
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

      {/* ── SCHOOLS ────────────────────────────────────────────────────────── */}
      {schools.map((school, si) => {
        const meta = SCHOOL_META[school.id];
        return (
          <section key={school.id} id={school.id} className="gg-section" style={{ scrollMarginTop: 80 }}>
            <div className="gg-shell">
              <div className="gg-cat-head" data-reveal>
                <span className="gg-cat-label">{String(si + 1).padStart(2, "0")} — {school.spots.length} spots</span>
                <span className="gg-cat-line" />
              </div>
              <p className="gg-sec-kicker" data-reveal>{meta?.emoji} {meta?.tagline}</p>
              <h2 className="gg-sec-title" data-reveal>{school.name}</h2>
              {SCHOOL_SLUGS[school.id] && (
                <p className="gg-sec-sub" data-reveal>
                  <Link href={`/grads/${SCHOOL_SLUGS[school.id]}`} className="gg-inline-link">
                    {school.short} graduation photographer
                  </Link>
                  {" · "}
                  <Link href={`/grads/${SCHOOL_SLUGS[school.id]}/spots`} className="gg-inline-link">
                    best {school.short} photo spots &amp; timing
                  </Link>
                </p>
              )}

              <div className="gg-poses">
                {school.spots.map((spot, i) => (
                  <article key={spot.id} className="gg-pose" data-reveal>
                    <span className="gg-pose-bar" />
                    <div className="gg-pose-grid">
                      <div className="gg-pose-media">
                        {spot.image_url ? (
                          <OptimizedPhoto
                            src={spot.image_url}
                            alt={spot.name}
                            sizes="(max-width: 760px) 100vw, 36vw"
                          />
                        ) : (
                          <div className="gg-pose-placeholder"><span>{spot.icon}</span><p>Photo via Supabase</p></div>
                        )}
                      </div>
                      <div className="gg-pose-body">
                        <span className="gg-badge">SPOT {String(i + 1).padStart(2, "0")}</span>
                        <h3 className="gg-pose-title">{spot.name}</h3>
                        <p className="gg-pose-text">{spot.description}</p>
                        <div className="gg-tip" style={{ marginTop: 16, padding: "12px 14px" }}>
                          <span className="gg-pose-bar" />
                          <div className="gg-tip-row">
                            <span className="gg-tip-emoji" style={{ fontSize: 18 }}>💡</span>
                            <p className="gg-tip-text">{spot.tip}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>
        );
      })}

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="gg-cta">
        <div className="gg-shell">
          <div className="gg-cta-card glass-shimmer" data-reveal>
            <div className="gg-cta-squiggle">
              <svg width="50" height="80" viewBox="0 0 50 80" fill="none"><path d="M25 4 C38 16,12 28,25 44 C38 60,12 70,25 78" stroke="#fff" strokeWidth="1.5" fill="none" strokeLinecap="round" /></svg>
            </div>
            <h2 className="gg-cta-title">Know your spots. Now book the shoot.</h2>
            <p className="gg-cta-sub">Tell me which locations you want and we&rsquo;ll plan the whole session around them.</p>
            <div className="gg-cta-actions">
              <Link href="/contact?school=Graduation" className="gg-btn gg-btn--ongreen">Book your shoot →</Link>
              <Link href="/pricing/grads" className="gg-btn gg-btn--onghost">See grad pricing</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
