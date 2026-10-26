// Base styles for the /blog index (hero, featured card, grid, empty state).
export const BLOG_INDEX_CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(24px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scaleIn {
    from { transform: scaleX(0); opacity: 0; }
    to   { transform: scaleX(1); opacity: 1; }
  }
  @keyframes pillFade {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── PAGE ─────────────────────────────────────────────────────────────────── */
  .blog-page {
    background: #f7faf8;
    color: var(--ink);
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif;
    padding-top: 90px;
  }
  .blog-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* ── HERO ─────────────────────────────────────────────────────────────────── */
  .blog-hero {
    padding: 88px 0 80px;
    background:
      radial-gradient(ellipse 65% 60% at 5% 10%, rgba(162, 210, 196, 0.17) 0%, transparent 60%),
      radial-gradient(ellipse 55% 50% at 95% 90%, rgba(130, 185, 175, 0.13) 0%, transparent 55%),
      radial-gradient(ellipse 40% 40% at 60% 0%,  rgba(200, 230, 220, 0.10) 0%, transparent 50%),
      linear-gradient(to bottom, #e8efec 0%, #f7faf8 100%);
    border-bottom: 1px solid rgba(18, 24, 22, 0.07);
    position: relative;
    overflow: hidden;
  }

  /* Decorative corner marks */
  .blog-hero::before,
  .blog-hero::after {
    content: "";
    position: absolute;
    width: 18px; height: 18px;
    opacity: 0.35;
  }
  .blog-hero::before {
    top: 28px; left: 28px;
    border-top: 1.5px solid #3d6b5e;
    border-left: 1.5px solid #3d6b5e;
  }
  .blog-hero::after {
    bottom: 28px; right: 28px;
    border-bottom: 1.5px solid #3d6b5e;
    border-right: 1.5px solid #3d6b5e;
  }

  .blog-hero-kicker {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 22px;
    padding: 7px 16px;
    border: 1px solid rgba(61, 107, 94, 0.18);
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.78);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
    box-shadow: 0 2px 12px rgba(61, 107, 94, 0.08);
    color: var(--ink-dim);
    font-size: 12px;
    font-weight: 820;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    animation: pillFade 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }
  .blog-hero-kicker-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #3d6b5e;
    flex-shrink: 0;
    box-shadow: 0 0 0 3px rgba(61,107,94,0.15);
  }
  .blog-hero-heading {
    margin: 0;
    animation: fadeUp 0.6s 0.08s cubic-bezier(0.22,1,0.36,1) both;
  }
  .blog-hero-title {
    display: block;
    font-size: clamp(3.8rem, 9.5vw, 8.5rem);
    font-weight: 900;
    letter-spacing: -0.045em;
    line-height: 0.87;
    color: var(--ink);
  }
  .blog-hero-title-light {
    display: block;
    font-size: clamp(3.8rem, 9.5vw, 8.5rem);
    font-weight: 280;
    font-style: italic;
    letter-spacing: -0.03em;
    line-height: 0.96;
    color: var(--ink-muted);
    padding-bottom: 4px;
  }
  .blog-hero-sub {
    margin: 24px 0 0;
    max-width: 420px;
    color: var(--ink-muted);
    font-size: 16px;
    line-height: 1.8;
    animation: fadeUp 0.6s 0.16s cubic-bezier(0.22,1,0.36,1) both;
  }
  .blog-hero-rule {
    display: block;
    width: 32px;
    height: 2px;
    background: #3d6b5e;
    margin: 28px 0 0;
    transform-origin: left center;
    animation: scaleIn 0.7s 0.3s cubic-bezier(0.22,1,0.36,1) both;
  }

  /* ── POST LIST SECTION ────────────────────────────────────────────────────── */
  .blog-list {
    padding: 72px 0 120px;
  }

  /* ── FEATURED CARD (first post, 2-col) ───────────────────────────────────── */
  .blog-featured {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    background: var(--bg-white);
    overflow: hidden;
    box-shadow: var(--glass-shadow);
    text-decoration: none;
    color: inherit;
    margin-bottom: 16px;
    transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  }
  .blog-featured:hover {
    transform: translateY(-5px);
    box-shadow: 0 20px 48px rgba(18, 24, 22, 0.1);
    border-color: rgba(18, 24, 22, 0.13);
  }

  .blog-featured-media {
    position: relative;
    overflow: hidden;
    background: #dfe8e4;
    min-height: 440px;
    max-height: 540px;
  }
  .blog-featured-media img {
    width: 100%; height: 100%;
    display: block; object-fit: cover;
    transition: transform 0.8s cubic-bezier(0.22,1,0.36,1);
  }
  .blog-featured:hover .blog-featured-media img { transform: scale(1.04); }

  .blog-featured-media-empty {
    width: 100%; height: 100%; min-height: 440px;
    background:
      radial-gradient(ellipse 70% 70% at 50% 50%, rgba(162,210,196,0.2) 0%, transparent 70%),
      #e8efec;
    display: flex; align-items: center; justify-content: center;
  }

  .blog-featured-body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 52px 52px 52px 48px;
    gap: 0;
  }

  .blog-featured-label {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 5px 13px;
    border: 1px solid rgba(61,107,94,0.2);
    border-radius: 100px;
    background: rgba(61,107,94,0.07);
    color: #3d6b5e;
    font-size: 11px;
    font-weight: 820;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    width: fit-content;
    margin-bottom: 20px;
  }
  .blog-featured-label-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: #3d6b5e;
    flex-shrink: 0;
  }

  .blog-featured-title {
    margin: 0 0 16px;
    font-size: clamp(1.45rem, 2.2vw, 2.1rem);
    font-weight: 860;
    letter-spacing: -0.025em;
    line-height: 1.1;
    color: var(--ink);
    text-wrap: balance;
  }
  .blog-featured-excerpt {
    margin: 0 0 28px;
    color: var(--ink-muted);
    font-size: 15px;
    line-height: 1.78;
  }
  .blog-featured-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--ink-dim);
    font-size: 12.5px;
    font-weight: 700;
    margin-bottom: 28px;
  }
  .blog-featured-meta-dot {
    width: 3px; height: 3px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.4;
    flex-shrink: 0;
  }
  .blog-featured-cta {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    min-height: 42px;
    padding: 0 20px;
    border: 1px solid rgba(18,24,22,0.1);
    border-radius: var(--radius-sm);
    background: rgba(255,255,255,0.85);
    color: var(--ink);
    font-size: 13px;
    font-weight: 820;
    width: fit-content;
    transition: background var(--transition), transform var(--transition), box-shadow var(--transition);
  }
  .blog-featured:hover .blog-featured-cta {
    background: #ffffff;
    transform: translateX(4px);
    box-shadow: 0 6px 20px rgba(18,24,22,0.07);
  }

  /* ── SECONDARY GRID ───────────────────────────────────────────────────────── */
  .blog-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 12px;
  }

  /* ── POST CARD ────────────────────────────────────────────────────────────── */
  .blog-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-md);
    background: var(--bg-white);
    overflow: hidden;
    box-shadow: var(--glass-shadow);
    text-decoration: none;
    color: inherit;
    transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
  }
  .blog-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 16px 40px rgba(18, 24, 22, 0.09);
    border-color: rgba(18, 24, 22, 0.12);
  }

  .blog-card-media {
    position: relative;
    overflow: hidden;
    background: #dfe8e4;
    aspect-ratio: 4 / 3;
  }
  .blog-card-media img {
    width: 100%; height: 100%;
    display: block; object-fit: cover;
    transition: transform 0.7s cubic-bezier(0.22,1,0.36,1);
  }
  .blog-card:hover .blog-card-media img { transform: scale(1.05); }

  .blog-card-media-empty {
    width: 100%; height: 100%;
    background:
      radial-gradient(ellipse 80% 80% at 50% 50%, rgba(162,210,196,0.15) 0%, transparent 70%),
      #e8efec;
    display: flex; align-items: center; justify-content: center;
  }

  .blog-card-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    padding: 22px 24px 26px;
  }
  .blog-card-date {
    margin: 0 0 10px;
    color: var(--ink-dim);
    font-size: 11.5px;
    font-weight: 820;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .blog-card-title {
    margin: 0 0 12px;
    font-size: clamp(1rem, 1.4vw, 1.13rem);
    font-weight: 860;
    letter-spacing: -0.015em;
    line-height: 1.2;
    color: var(--ink);
    text-wrap: balance;
    flex: 1;
  }
  .blog-card-excerpt {
    margin: 0 0 18px;
    color: var(--ink-muted);
    font-size: 13.5px;
    line-height: 1.7;
  }
  .blog-card-cta {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: #3d6b5e;
    font-size: 12.5px;
    font-weight: 820;
    margin-top: auto;
    transition: gap var(--transition);
  }
  .blog-card:hover .blog-card-cta { gap: 9px; }

  /* ── PHOTO COUNT CHIP ─────────────────────────────────────────────────────── */
  .blog-photo-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 9px;
    border-radius: 100px;
    background: rgba(18,24,22,0.05);
    color: var(--ink-dim);
    font-size: 11px;
    font-weight: 760;
    margin-left: 4px;
  }

  /* ── EMPTY STATE ──────────────────────────────────────────────────────────── */
  .blog-empty {
    padding: 100px 32px;
    text-align: center;
    border: 1px solid var(--glass-border);
    border-radius: var(--radius-lg);
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: var(--blur);
    -webkit-backdrop-filter: var(--blur);
  }
  .blog-empty-title {
    margin: 16px 0 8px;
    font-size: 1.2rem;
    font-weight: 860;
    color: var(--ink);
  }
  .blog-empty-copy {
    margin: 0;
    color: var(--ink-muted);
    font-size: 15px;
  }

  /* ── RESPONSIVE ───────────────────────────────────────────────────────────── */
  @media (max-width: 960px) {
    .blog-featured { grid-template-columns: 1fr; }
    .blog-featured-media { min-height: 300px; max-height: 360px; }
    .blog-featured-body { padding: 30px 32px 36px; justify-content: flex-start; }
    .blog-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 600px) {
    .blog-page { padding-top: 80px; }
    .blog-hero { padding: 60px 0 52px; }
    .blog-hero-title, .blog-hero-title-light { font-size: clamp(3rem, 14vw, 4.5rem); }
    .blog-list { padding: 48px 0 80px; }
    .blog-grid { grid-template-columns: 1fr; }
    .blog-featured-body { padding: 24px 22px 28px; }
  }
`;
