// Styles for the /grads/<slug> landing template (self-contained, reuses the
// site's design tokens via class names). Split out of SchoolLandingTemplate.tsx
// to keep the template readable.

export const SCHOOL_LANDING_CSS = `
  .school-page {
    background: #f5f6f4;
    color: #101412;
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  .school-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* Hero */
  .school-hero {
    padding: 110px 0 72px;
    background:
      radial-gradient(ellipse 65% 60% at 5% 15%, rgba(162,210,196,0.16) 0%, transparent 60%),
      radial-gradient(ellipse 55% 50% at 95% 85%, rgba(130,185,175,0.12) 0%, transparent 55%),
      linear-gradient(to bottom, #eaf0ec 0%, #f5f6f4 100%);
    border-bottom: 1px solid rgba(18,24,22,0.07);
  }
  .school-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .school-hero-title {
    margin: 0;
    color: #101412;
    font-size: clamp(2.2rem, 5vw, 4rem);
    font-weight: 880;
    letter-spacing: -0.025em;
    line-height: 0.96;
    text-wrap: balance;
    max-width: 800px;
  }
  .school-hero-sub {
    margin: 22px 0 32px;
    color: #4b5a55;
    font-size: 18px;
    line-height: 1.72;
    max-width: 600px;
    text-wrap: pretty;
  }
  .school-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .school-link {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .school-link--primary {
    border: 1px solid rgba(112,139,133,0.22);
    background: rgba(246,250,248,0.94);
    color: #4f6d67;
    box-shadow: 0 8px 24px rgba(112,139,133,0.05);
  }
  .school-link--primary:hover {
    transform: translateY(-1px);
    background: rgba(239,246,244,0.98);
    box-shadow: 0 12px 28px rgba(112,139,133,0.07);
  }
  .school-link--ghost {
    border: 1px solid rgba(18,24,22,0.12);
    background: rgba(255,255,255,0.72);
    color: #101412;
  }
  .school-link--ghost:hover {
    transform: translateY(-1px);
    background: #ffffff;
    box-shadow: 0 10px 22px rgba(18,24,22,0.06);
  }

  /* Body sections */
  .school-body {
    background: #ffffff;
    padding: 80px 0 88px;
    border-top: 1px solid rgba(18,24,22,0.06);
  }
  .school-body-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 64px;
    align-items: start;
  }
  .school-section-title {
    margin: 0 0 20px;
    color: #101412;
    font-size: clamp(1.6rem, 3vw, 2.4rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 1;
    text-wrap: balance;
  }
  .school-body-copy {
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.76;
    margin: 0 0 22px;
  }
  .school-body-copy:last-of-type { margin-bottom: 0; }

  /* Spots grid */
  .school-spots {
    background: #f5f6f4;
    padding: 80px 0 88px;
    border-top: 1px solid rgba(18,24,22,0.06);
  }
  .school-spots-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 14px;
    margin-top: 32px;
  }
  .school-spot-card {
    padding: 24px;
    border: 1px solid rgba(18,24,22,0.08);
    border-radius: 12px;
    background: #ffffff;
    box-shadow: 0 6px 20px rgba(18,24,22,0.05);
  }
  .school-spot-name {
    margin: 0 0 8px;
    color: #101412;
    font-size: 17px;
    font-weight: 860;
    letter-spacing: -0.01em;
  }
  .school-spot-desc {
    margin: 0;
    color: #4b5a55;
    font-size: 14px;
    line-height: 1.6;
  }

  /* Gallery */
  .school-gallery {
    background: #ffffff;
    padding: 80px 0 88px;
    border-top: 1px solid rgba(18,24,22,0.06);
  }

  /* Info row */
  .school-info {
    background: #ffffff;
    padding: 64px 0 72px;
    border-top: 1px solid rgba(18,24,22,0.06);
  }
  .school-info-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 24px;
  }
  .school-info-item {
    padding: 22px;
    border: 1px solid rgba(18,24,22,0.08);
    border-radius: 12px;
    background: rgba(247,250,248,0.9);
  }
  .school-info-label {
    margin: 0 0 6px;
    color: #667f79;
    font-size: 12px;
    font-weight: 820;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .school-info-value {
    margin: 0;
    color: #101412;
    font-size: 15px;
    font-weight: 700;
    line-height: 1.4;
  }

  /* Trust strip */
  .school-trust {
    display: flex;
    flex-wrap: wrap;
    gap: 12px 28px;
    justify-content: center;
    padding: 20px 28px;
    border: 1px solid rgba(18,24,22,0.08);
    border-radius: 12px;
    background: rgba(247,250,248,0.9);
    margin-top: 36px;
  }
  .school-trust-item {
    display: flex;
    align-items: center;
    gap: 7px;
    font-size: 14px;
    color: #4b5a55;
  }
  .school-trust-check { color: #4f6d67; font-weight: 700; }

  /* CTA */
  .school-cta {
    background: #f5f6f4;
    padding: 80px 0 100px;
    border-top: 1px solid rgba(18,24,22,0.06);
    text-align: center;
  }
  .school-cta-card {
    display: inline-block;
    padding: 48px 56px;
    border: 1px solid rgba(18,24,22,0.09);
    border-radius: 16px;
    background: #ffffff;
    box-shadow: 0 12px 40px rgba(18,24,22,0.07);
    max-width: 580px;
    width: 100%;
  }
  .school-cta-title {
    margin: 0 0 10px;
    color: #101412;
    font-size: clamp(1.6rem, 3.5vw, 2.4rem);
    font-weight: 880;
    letter-spacing: -0.02em;
    line-height: 1.05;
    text-wrap: balance;
  }
  .school-cta-sub {
    margin: 0 0 28px;
    color: #4b5a55;
    font-size: 16px;
    line-height: 1.65;
  }

  /* Responsive */
  @media (max-width: 900px) {
    .school-body-grid { grid-template-columns: 1fr; gap: 40px; }
  }
  @media (max-width: 760px) {
    .school-shell { width: min(1180px, calc(100% - 36px)); }
    .school-hero  { padding: 100px 0 56px; }
    .school-hero-sub { font-size: 16px; }
    .school-body, .school-spots, .school-info { padding: 62px 0 70px; }
    .school-cta-card { padding: 36px 24px; }
  }
`;
