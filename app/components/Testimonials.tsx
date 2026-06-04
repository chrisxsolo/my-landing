// ─────────────────────────────────────────────────────────────────────────────
// Testimonials — reusable client social-proof section
// ─────────────────────────────────────────────────────────────────────────────
// Data lives in lib/testimonials.ts. Renders nothing while that array is empty,
// so no placeholder testimonials ever ship live.
//
// REUSE: drop <Testimonials /> on any (professional) page (homepage, grads,
// pricing, contact). Override copy with props:
//   <Testimonials kicker="..." title="..." items={someSubset} />
//
// Matches the homepage green/sage frosted-glass visual language.
// ─────────────────────────────────────────────────────────────────────────────

import { TESTIMONIALS, type Testimonial } from "@/lib/testimonials";

type Props = {
  items?: Testimonial[];
  kicker?: string;
  title?: string;
};

const CSS = `
  .tm {
    background: #ffffff;
    padding: 76px 0 84px;
    border-top: 1px solid rgba(18, 24, 22, 0.06);
    border-bottom: 1px solid rgba(18, 24, 22, 0.06);
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }
  .tm-shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
  .tm-header { max-width: 640px; margin: 0 auto 38px; text-align: center; }
  .tm-kicker { margin: 0 0 12px; color: #667f79; font-size: 13px; font-weight: 820; }
  .tm-title {
    margin: 0;
    color: #101412;
    font-size: clamp(1.8rem, 4vw, 3rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 1;
    text-wrap: balance;
  }

  .tm-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }
  .tm-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 26px 24px;
    border: 1px solid rgba(18, 24, 22, 0.09);
    border-radius: 14px;
    background: rgba(247, 250, 248, 0.7);
    box-shadow: 0 8px 28px rgba(18, 24, 22, 0.04);
    transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.2s ease;
  }
  .tm-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 16px 40px rgba(18, 24, 22, 0.08);
  }
  .tm-stars { color: #e0a33c; font-size: 14px; letter-spacing: 2px; line-height: 1; }
  .tm-quote {
    margin: 0;
    flex: 1;
    color: #2f3835;
    font-size: 15.5px;
    line-height: 1.72;
    text-wrap: pretty;
  }
  .tm-cite { display: flex; flex-direction: column; gap: 2px; }
  .tm-name { color: #101412; font-size: 14px; font-weight: 820; }
  .tm-context { color: #7b8884; font-size: 12.5px; font-weight: 700; }

  @media (max-width: 920px) {
    .tm-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 760px) {
    .tm { padding: 60px 0 68px; }
    .tm-shell { width: min(1180px, calc(100% - 36px)); }
  }
  @media (max-width: 600px) {
    .tm-grid { grid-template-columns: 1fr; }
  }
`;

export default function Testimonials({
  items = TESTIMONIALS,
  kicker = "What clients say",
  title = "Real sessions, real people, zero awkwardness.",
}: Props) {
  if (items.length === 0) return null;

  return (
    <section className="tm" aria-label="Client testimonials">
      <style>{CSS}</style>
      <div className="tm-shell">
        <div className="tm-header" data-reveal>
          <p className="tm-kicker">{kicker}</p>
          <h2 className="tm-title">{title}</h2>
        </div>
        <div className="tm-grid">
          {items.map((t, i) => (
            <figure key={`${t.name}-${i}`} className="tm-card" data-reveal data-delay={String((i % 3) + 1)}>
              <div className="tm-stars" aria-hidden="true">★★★★★</div>
              <blockquote className="tm-quote">{`“${t.quote}”`}</blockquote>
              <figcaption className="tm-cite">
                <span className="tm-name">{t.name}</span>
                <span className="tm-context">
                  {t.context}
                  {t.location ? ` · ${t.location}` : ""}
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
