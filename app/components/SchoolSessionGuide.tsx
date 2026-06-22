// Per-campus "deepening" content for the school landing pages: best time of day
// / light, campus-tuned wardrobe notes, and a campus-specific FAQ. All fields are
// optional so a page renders only the sections it has data for. The FAQ is a
// server-rendered <details> accordion (no client JS) so the Q&A ships in the
// initial HTML, and a FAQPage JSON-LD block backs it for rich results.

export type SchoolFaq = { q: string; a: string };

type Props = {
  schoolShort: string;
  bestTime?: string;
  whatToWear?: string;
  faqs?: SchoolFaq[];
};

const CSS = `
  .ssg {
    background: #f5f6f4;
    padding: 80px 0 88px;
    border-top: 1px solid rgba(18,24,22,0.06);
  }
  .ssg-shell { width: min(1180px, calc(100% - 48px)); margin: 0 auto; }
  .ssg-kicker {
    margin: 0 0 10px; color: #667f79;
    font-size: 12px; font-weight: 820; letter-spacing: 0.06em; text-transform: uppercase;
  }
  .ssg-title {
    margin: 0 0 14px; color: #101412;
    font-size: clamp(1.4rem, 2.6vw, 1.9rem); font-weight: 870;
    letter-spacing: -0.018em; line-height: 1.1; text-wrap: balance;
  }
  .ssg-copy { margin: 0; color: #4b5a55; font-size: 16px; line-height: 1.74; text-wrap: pretty; }

  /* Timing + wardrobe, side by side */
  .ssg-cols {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 48px;
  }
  .ssg-col {
    padding: 28px; border-radius: 14px;
    background: #ffffff; border: 1px solid rgba(18,24,22,0.08);
    box-shadow: 0 6px 20px rgba(18,24,22,0.04);
  }

  /* FAQ */
  .ssg-faq { margin-top: 44px; }
  .ssg-faq-title {
    margin: 0 0 18px; color: #101412;
    font-size: clamp(1.5rem, 2.8vw, 2.1rem); font-weight: 880;
    letter-spacing: -0.02em; line-height: 1.05; text-wrap: balance;
  }
  .ssg-q {
    border: 1px solid rgba(18,24,22,0.08); border-radius: 12px;
    background: #ffffff; box-shadow: 0 4px 16px rgba(18,24,22,0.04);
    margin-bottom: 10px; overflow: hidden;
  }
  .ssg-q > summary {
    list-style: none; cursor: pointer;
    display: flex; align-items: center; justify-content: space-between; gap: 16px;
    padding: 18px 22px; color: #101412; font-size: 16px; font-weight: 760; line-height: 1.4;
  }
  .ssg-q > summary::-webkit-details-marker { display: none; }
  .ssg-q > summary::after {
    content: "+"; flex-shrink: 0;
    color: #3d6b5e; font-size: 22px; font-weight: 600; line-height: 1;
    transition: transform .2s ease;
  }
  .ssg-q[open] > summary::after { transform: rotate(45deg); }
  .ssg-q-answer {
    margin: 0; padding: 0 22px 20px; color: #4b5a55; font-size: 15px; line-height: 1.7; text-wrap: pretty;
  }

  @media (max-width: 760px) {
    .ssg { padding: 62px 0 70px; }
    .ssg-shell { width: min(1180px, calc(100% - 36px)); }
    .ssg-cols { grid-template-columns: 1fr; gap: 14px; }
  }
`;

export default function SchoolSessionGuide({ schoolShort, bestTime, whatToWear, faqs }: Props) {
  const hasCols = Boolean(bestTime || whatToWear);
  const hasFaqs = Boolean(faqs && faqs.length > 0);
  if (!hasCols && !hasFaqs) return null;

  return (
    <section className="ssg">
      <style>{CSS}</style>

      {hasFaqs && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: faqs!.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      )}

      <div className="ssg-shell">
        {hasCols && (
          <div className="ssg-cols">
            {bestTime && (
              <div className="ssg-col">
                <p className="ssg-kicker">Timing &amp; light</p>
                <h2 className="ssg-title">Best time for {schoolShort} grad photos</h2>
                <p className="ssg-copy">{bestTime}</p>
              </div>
            )}
            {whatToWear && (
              <div className="ssg-col">
                <p className="ssg-kicker">Wardrobe</p>
                <h2 className="ssg-title">What to wear at {schoolShort}</h2>
                <p className="ssg-copy">{whatToWear}</p>
              </div>
            )}
          </div>
        )}

        {hasFaqs && (
          <div className="ssg-faq">
            <p className="ssg-kicker">Common questions</p>
            <h2 className="ssg-faq-title">{schoolShort} grad photo FAQ</h2>
            {faqs!.map((item) => (
              <details key={item.q} className="ssg-q">
                <summary>{item.q}</summary>
                <p className="ssg-q-answer">{item.a}</p>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
