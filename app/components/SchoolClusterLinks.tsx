import Link from "next/link";
import { GRAD_SCHOOL_LINKS } from "@/lib/portfolioCategoryContent";

// Recent campus session, resolved in SchoolLandingTemplate via the shared
// detectSchoolLink matcher so this list mirrors the in-article links exactly.
export type ClusterRelatedPost = { slug: string; title: string };

type Props = {
  slug: string;
  schoolShort: string;
  relatedPosts: ClusterRelatedPost[];
};

const CSS = `
  .scl {
    background: #ffffff;
    padding: 80px 0 88px;
    border-top: 1px solid rgba(18,24,22,0.06);
  }
  .scl-shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
  .scl-kicker {
    margin: 0 0 10px; color: #667f79;
    font-size: 12px; font-weight: 820; letter-spacing: 0.06em; text-transform: uppercase;
  }
  .scl-title {
    margin: 0 0 28px; color: #101412;
    font-size: clamp(1.6rem, 3vw, 2.3rem); font-weight: 880;
    letter-spacing: -0.02em; line-height: 1.04; text-wrap: balance; max-width: 640px;
  }

  /* Guide cards */
  .scl-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px;
  }
  .scl-card {
    position: relative; display: flex; flex-direction: column; gap: 7px;
    padding: 22px 44px 22px 22px; border-radius: 12px; text-decoration: none;
    background: rgba(247,250,248,0.9); border: 1px solid rgba(18,24,22,0.08);
    box-shadow: 0 6px 20px rgba(18,24,22,0.04);
    transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  }
  .scl-card:hover {
    transform: translateY(-3px); box-shadow: 0 14px 32px rgba(18,24,22,0.09);
    border-color: rgba(112,139,133,0.32);
  }
  .scl-card-title { color: #101412; font-size: 16px; font-weight: 860; letter-spacing: -0.01em; line-height: 1.25; }
  .scl-card-desc { color: #4b5a55; font-size: 14px; line-height: 1.6; }
  .scl-card-arrow {
    position: absolute; top: 20px; right: 20px; color: rgba(112,139,133,0.55);
    font-size: 16px; transition: color .2s ease, transform .2s ease;
  }
  .scl-card:hover .scl-card-arrow { color: #3d6b5e; transform: translate(2px, -2px); }

  /* Sub-blocks (recent sessions + sibling campuses) */
  .scl-block { margin-top: 44px; }
  .scl-subtitle {
    margin: 0 0 16px; color: #101412; font-size: 18px; font-weight: 860; letter-spacing: -0.01em;
  }

  .scl-posts { display: flex; flex-direction: column; gap: 2px; }
  .scl-post {
    display: flex; align-items: baseline; gap: 10px; padding: 11px 4px;
    border-bottom: 1px solid rgba(18,24,22,0.07); text-decoration: none;
    transition: padding-left .18s ease;
  }
  .scl-post:hover { padding-left: 10px; }
  .scl-post-arrow { color: #3d6b5e; font-weight: 800; flex-shrink: 0; }
  .scl-post-title { color: #2d3a36; font-size: 15px; font-weight: 640; line-height: 1.45; }
  .scl-post:hover .scl-post-title { color: #3d6b5e; }

  .scl-pills { display: flex; flex-wrap: wrap; gap: 10px; }
  .scl-pill {
    display: inline-flex; align-items: center; gap: 7px;
    padding: 9px 15px; border-radius: 999px; text-decoration: none;
    background: rgba(247,250,248,0.9); border: 1px solid rgba(112,139,133,0.22);
    color: #3d6b5e; font-size: 13.5px; font-weight: 780;
    transition: background .18s ease, transform .18s ease, box-shadow .18s ease;
  }
  .scl-pill:hover { transform: translateY(-1px); background: #ffffff; box-shadow: 0 8px 20px rgba(18,24,22,0.07); }
  .scl-pill span { color: rgba(112,139,133,0.7); }

  @media (max-width: 760px) {
    .scl { padding: 62px 0 70px; }
    .scl-shell { width: min(1180px, calc(100% - 36px)); }
  }
`;

const GUIDE_LINKS = [
  { href: "/grad-guide/campus-spots", title: "Best photo spots", desc: "Where we shoot on campus — and when each spot looks its best." },
  { href: "/grad-guide/what-to-wear", title: "What to wear", desc: "Colors, fits, and regalia tips that photograph cleanly." },
  { href: "/grad-guide/posing", title: "Posing in cap & gown", desc: "Natural, flattering direction — no awkward standing around." },
  { href: "/grad-guide/how-to-prepare", title: "How to prepare", desc: "Everything to sort before the session so it runs smoothly." },
  { href: "/faq/graduation", title: "Graduation photo FAQ", desc: "Timing, group shots, weather backups, and delivery." },
  { href: "/pricing/grads", title: "Grad session pricing", desc: "Rates, session lengths, and exactly what's included." },
] as const;

export default function SchoolClusterLinks({ slug, schoolShort, relatedPosts }: Props) {
  // Spot/wear guides read better with the campus name; the rest stay generic.
  const guides = GUIDE_LINKS.map((g) =>
    g.href === "/grad-guide/campus-spots"
      ? { ...g, title: `Best photo spots at ${schoolShort}` }
      : g.href === "/grad-guide/what-to-wear"
        ? { ...g, title: `What to wear for ${schoolShort} grad photos` }
        : g,
  );
  const siblings = GRAD_SCHOOL_LINKS.filter((s) => s.href !== `/grads/${slug}`);

  return (
    <section className="scl">
      <style>{CSS}</style>
      <div className="scl-shell">
        <p className="scl-kicker">Plan your session</p>
        <h2 className="scl-title">Everything for your {schoolShort} grad shoot</h2>

        <div className="scl-grid">
          {guides.map((g) => (
            <Link key={g.href} href={g.href} className="scl-card">
              <span className="scl-card-title">{g.title}</span>
              <span className="scl-card-desc">{g.desc}</span>
              <span className="scl-card-arrow" aria-hidden>→</span>
            </Link>
          ))}
        </div>

        {relatedPosts.length > 0 && (
          <div className="scl-block">
            <p className="scl-kicker">From the journal</p>
            <h3 className="scl-subtitle">Recent {schoolShort} sessions</h3>
            <div className="scl-posts">
              {relatedPosts.map((post) => (
                <Link key={post.slug} href={`/blog/${post.slug}`} className="scl-post">
                  <span className="scl-post-arrow" aria-hidden>→</span>
                  <span className="scl-post-title">{post.title}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="scl-block">
          <p className="scl-kicker">More Bay Area campuses</p>
          <h3 className="scl-subtitle">Other campuses I shoot</h3>
          <div className="scl-pills">
            {siblings.map((s) => (
              <Link key={s.href} href={s.href} className="scl-pill">
                {s.label} grad photos <span aria-hidden>→</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
