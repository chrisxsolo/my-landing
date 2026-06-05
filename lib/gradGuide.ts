// lib/gradGuide.ts
// Shared professional-styled CSS for the graduation guide pages under
// app/(professional)/grad-guide/*. These pages render inside ProfessionalLayout,
// so they inherit its :root design tokens (--accent, --ink, etc.), the
// .glass-shimmer helper, and the ScrollReveal [data-reveal] animations.
//
// This keeps the playful energy of the original guide — emojis, a marquee strip,
// pulsing dots, a slow-spinning ring, a blinking cursor — but recolors everything
// to the sage/green professional palette and swaps the purple gradients for clean
// frosted-glass cards so it matches the rest of the professional site.

export const GRAD_GUIDE_CSS = `
  /* ── KEYFRAMES ───────────────────────────────────────────────────────────── */
  @keyframes ggFadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes ggMarquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  @keyframes ggPulse { 0%,100% { opacity:0.55; transform:scale(1); } 50% { opacity:0.15; transform:scale(1.35); } }
  @keyframes ggSpin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  @keyframes ggBlink { 0%,100% { opacity:1; } 50% { opacity:0; } }
  @keyframes ggFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }
  @keyframes ggDraw { from { stroke-dashoffset:320; } to { stroke-dashoffset:0; } }

  /* ── PAGE / LAYOUT ───────────────────────────────────────────────────────── */
  .gg-page { background:#f7faf8; color:var(--ink, #101412); }
  .gg-shell { width:min(940px, calc(100% - 44px)); margin:0 auto; }
  .gg-shell--wide { width:min(1100px, calc(100% - 44px)); margin:0 auto; }

  .gg-afu1 { animation:ggFadeUp 0.55s 0.05s ease both; }
  .gg-afu2 { animation:ggFadeUp 0.55s 0.13s ease both; }
  .gg-afu3 { animation:ggFadeUp 0.55s 0.21s ease both; }
  .gg-afu4 { animation:ggFadeUp 0.55s 0.29s ease both; }
  .gg-dot   { animation:ggPulse 2.6s ease-in-out infinite; }
  .gg-spin  { animation:ggSpin 16s linear infinite; }
  .gg-blink { animation:ggBlink 1.1s step-end infinite; }
  .gg-float { animation:ggFloat 4.5s ease-in-out infinite; }
  .gg-sq    { stroke-dasharray:320; stroke-dashoffset:320; animation:ggDraw 2.4s 0.6s ease forwards; }

  /* ── HERO ────────────────────────────────────────────────────────────────── */
  .gg-hero {
    position:relative; overflow:hidden;
    padding:128px 0 64px;
    border-bottom:1px solid rgba(18,24,22,0.07);
    background:
      radial-gradient(ellipse 60% 55% at 8% 12%, rgba(162,210,196,0.20) 0%, transparent 60%),
      radial-gradient(ellipse 55% 50% at 95% 90%, rgba(112,139,133,0.14) 0%, transparent 55%),
      linear-gradient(to bottom, #eaf2ee 0%, #f7faf8 100%);
  }
  .gg-hero-corner { position:absolute; width:22px; height:22px; pointer-events:none; }
  .gg-hero-ring { position:absolute; bottom:-26px; left:-26px; opacity:0.12; pointer-events:none; }
  .gg-hero-squiggle { position:absolute; right:32px; top:50%; transform:translateY(-50%); opacity:0.4; pointer-events:none; }
  @media (max-width:760px) { .gg-hero-squiggle { display:none; } }

  .gg-kicker {
    display:inline-flex; align-items:center; gap:8px;
    padding:6px 13px; border-radius:999px; margin:0 0 18px;
    background:rgba(112,139,133,0.10); border:1px solid rgba(112,139,133,0.22);
    color:var(--accent, #3d6b5e);
    font-size:12px; font-weight:820; letter-spacing:0.10em; text-transform:uppercase;
  }
  .gg-kicker-dot { width:6px; height:6px; border-radius:999px; background:var(--accent, #3d6b5e); }

  .gg-h1 {
    margin:0; color:var(--ink, #101412);
    font-size:clamp(2.3rem, 5.2vw, 3.9rem); font-weight:880;
    letter-spacing:-0.025em; line-height:0.98; text-wrap:balance; max-width:760px;
  }
  .gg-h1-script {
    margin:6px 0 0; color:var(--ink, #101412);
    font-size:clamp(2.3rem, 5.2vw, 3.9rem); font-weight:340; font-style:italic;
    letter-spacing:-0.02em; line-height:1; text-wrap:balance;
  }
  .gg-h1-accent { color:var(--accent, #3d6b5e); font-style:italic; font-weight:520; }
  .gg-cursor {
    display:inline-block; width:3px; height:0.82em; margin-left:6px; border-radius:2px;
    background:var(--accent, #3d6b5e); vertical-align:middle;
  }
  .gg-sub {
    margin:22px 0 30px; color:var(--ink-muted, #4b5a55);
    font-size:18px; line-height:1.72; max-width:620px; text-wrap:pretty;
  }

  /* ── BUTTONS ─────────────────────────────────────────────────────────────── */
  .gg-actions { display:flex; flex-wrap:wrap; gap:10px; }
  .gg-btn {
    min-height:46px; display:inline-flex; align-items:center; justify-content:center;
    padding:0 20px; border-radius:8px; font-size:14px; font-weight:820;
    text-decoration:none; transition:transform .18s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease;
  }
  .gg-btn--primary {
    border:1px solid rgba(112,139,133,0.24); background:var(--accent, #3d6b5e); color:#f4f9f6;
    box-shadow:0 10px 24px rgba(61,107,94,0.18);
  }
  .gg-btn--primary:hover { transform:translateY(-1px); background:#345d52; box-shadow:0 14px 30px rgba(61,107,94,0.24); }
  .gg-btn--ghost { border:1px solid rgba(18,24,22,0.12); background:rgba(255,255,255,0.78); color:var(--ink, #101412); }
  .gg-btn--ghost:hover { transform:translateY(-1px); background:#fff; box-shadow:0 10px 22px rgba(18,24,22,0.07); }
  .gg-btn--ongreen { background:#fff; color:var(--accent, #3d6b5e); border:1px solid rgba(255,255,255,0.6); }
  .gg-btn--ongreen:hover { transform:translateY(-1px); box-shadow:0 12px 26px rgba(0,0,0,0.14); }
  .gg-btn--onghost { background:transparent; color:#eef5f1; border:1px solid rgba(255,255,255,0.35); }
  .gg-btn--onghost:hover { background:rgba(255,255,255,0.12); }

  /* ── MARQUEE ─────────────────────────────────────────────────────────────── */
  .gg-marquee {
    overflow:hidden; padding:13px 0;
    border-bottom:1px solid rgba(18,24,22,0.07);
    background:rgba(255,255,255,0.7); backdrop-filter:blur(8px);
  }
  .gg-marquee-track { display:flex; gap:42px; width:max-content; white-space:nowrap; animation:ggMarquee 24s linear infinite; }
  .gg-marquee-item {
    display:inline-flex; align-items:center; gap:14px;
    color:var(--ink-dim, #667f79); font-size:11px; font-weight:800;
    letter-spacing:0.14em; text-transform:uppercase;
  }
  .gg-marquee-sep { width:4px; height:4px; border-radius:999px; background:var(--accent, #3d6b5e); flex-shrink:0; }

  /* ── SECTION HEADINGS ────────────────────────────────────────────────────── */
  .gg-section { padding:62px 0; }
  .gg-section--alt { background:#fff; border-top:1px solid rgba(18,24,22,0.06); border-bottom:1px solid rgba(18,24,22,0.06); }
  .gg-sec-kicker { margin:0 0 8px; color:var(--ink-dim, #667f79); font-size:12px; font-weight:820; letter-spacing:0.07em; text-transform:uppercase; }
  .gg-sec-title { margin:0; color:var(--ink, #101412); font-size:clamp(1.7rem, 3.2vw, 2.4rem); font-weight:880; letter-spacing:-0.02em; line-height:1.04; text-wrap:balance; }
  .gg-sec-sub { margin:10px 0 0; color:var(--ink-muted, #4b5a55); font-size:15px; line-height:1.6; }

  /* ── HUB CARDS ───────────────────────────────────────────────────────────── */
  .gg-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:14px; margin-top:30px; }
  .gg-card {
    position:relative; display:block; overflow:hidden;
    padding:24px; border-radius:14px; text-decoration:none;
    background:var(--glass, rgba(255,255,255,0.86)); border:1px solid rgba(18,24,22,0.08);
    box-shadow:0 6px 20px rgba(18,24,22,0.05);
    transition:transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s ease, border-color .22s ease;
  }
  .gg-card:hover { transform:translateY(-5px); box-shadow:0 18px 40px rgba(18,24,22,0.10); border-color:rgba(112,139,133,0.32); }
  .gg-card-bar { position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg, #5b8a7a, #82b9af); }
  .gg-card-emoji { display:block; font-size:30px; margin:6px 0 14px; }
  .gg-card-num { margin:0 0 4px; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.14em; }
  .gg-card-title { margin:0 0 7px; color:var(--ink, #101412); font-size:18px; font-weight:860; letter-spacing:-0.01em; line-height:1.15; }
  .gg-card-desc { margin:0; color:var(--ink-muted, #4b5a55); font-size:14px; line-height:1.6; }
  .gg-card-arrow { position:absolute; top:20px; right:20px; color:rgba(112,139,133,0.5); font-size:16px; transition:color .2s ease, transform .2s ease; }
  .gg-card:hover .gg-card-arrow { color:var(--accent, #3d6b5e); transform:translate(2px,-2px); }

  /* ── PHOTO GALLERY ───────────────────────────────────────────────────────── */
  .gg-gallery { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-top:30px; }
  @media (max-width:620px) { .gg-gallery { grid-template-columns:repeat(2, 1fr); } }
  .gg-photo { position:relative; aspect-ratio:1; border-radius:12px; overflow:hidden; background:#e7ece9; }
  .gg-photo img { width:100%; height:100%; object-fit:cover; transition:transform .5s ease; }
  .gg-photo:hover img { transform:scale(1.05); }
  .gg-photo-cap { position:absolute; inset:0; display:flex; align-items:flex-end; padding:14px; background:rgba(16,24,22,0); transition:background .3s ease; }
  .gg-photo:hover .gg-photo-cap { background:rgba(16,24,22,0.42); }
  .gg-photo-cap span { color:#fff; font-size:13px; font-weight:600; opacity:0; transform:translateY(8px); transition:opacity .3s ease, transform .3s ease; }
  .gg-photo:hover .gg-photo-cap span { opacity:1; transform:translateY(0); }
  .gg-gallery-skel { aspect-ratio:1; border-radius:12px; background:linear-gradient(135deg, rgba(112,139,133,0.10), rgba(162,210,196,0.10)); animation:ggBlink 1.4s ease-in-out infinite; }
  .gg-empty { border:2px dashed rgba(112,139,133,0.28); border-radius:14px; padding:56px 24px; text-align:center; }

  /* ── POSE CARDS ──────────────────────────────────────────────────────────── */
  .gg-poses { display:flex; flex-direction:column; gap:16px; margin-top:30px; }
  .gg-pose {
    overflow:hidden; border-radius:14px; background:var(--glass, rgba(255,255,255,0.86));
    border:1px solid rgba(18,24,22,0.08); box-shadow:0 6px 20px rgba(18,24,22,0.05);
    transition:transform .22s ease, box-shadow .22s ease;
  }
  .gg-pose:hover { transform:translateY(-3px); box-shadow:0 16px 38px rgba(18,24,22,0.09); }
  .gg-pose-bar { height:3px; background:linear-gradient(90deg, #5b8a7a, #82b9af); }
  .gg-pose-grid { display:grid; grid-template-columns:1fr 1fr; }
  @media (max-width:680px) { .gg-pose-grid { grid-template-columns:1fr; } }
  .gg-pose-media { position:relative; min-height:240px; background:linear-gradient(135deg, rgba(112,139,133,0.10), rgba(162,210,196,0.12)); display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .gg-pose-media img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .gg-pose-placeholder { text-align:center; color:var(--accent, #3d6b5e); }
  .gg-pose-placeholder span { display:block; font-size:34px; margin-bottom:6px; }
  .gg-pose-placeholder p { margin:0; font-size:12px; font-weight:720; }
  .gg-pose-body { padding:26px; display:flex; flex-direction:column; justify-content:center; }
  .gg-badge {
    align-self:flex-start; margin-bottom:12px; padding:4px 10px; border-radius:999px;
    background:rgba(112,139,133,0.12); color:var(--accent, #3d6b5e);
    font-size:11px; font-weight:820; letter-spacing:0.12em;
  }
  .gg-pose-title { margin:0 0 10px; color:var(--ink, #101412); font-size:20px; font-weight:860; letter-spacing:-0.01em; line-height:1.15; }
  .gg-pose-text { margin:0; color:var(--ink-muted, #4b5a55); font-size:14px; line-height:1.66; }

  /* ── TIP CATEGORIES ──────────────────────────────────────────────────────── */
  .gg-cats { display:flex; flex-direction:column; gap:40px; margin-top:30px; }
  .gg-cat-head { display:flex; align-items:center; gap:12px; margin-bottom:16px; }
  .gg-cat-label { padding:5px 12px; border-radius:999px; background:rgba(112,139,133,0.12); color:var(--accent, #3d6b5e); font-size:11px; font-weight:840; letter-spacing:0.13em; text-transform:uppercase; }
  .gg-cat-line { flex:1; height:1px; background:linear-gradient(90deg, rgba(112,139,133,0.28), transparent); }
  .gg-tips { display:flex; flex-direction:column; gap:12px; }
  .gg-tip {
    position:relative; overflow:hidden; padding:18px 18px 18px 22px; border-radius:13px;
    background:var(--glass, rgba(255,255,255,0.86)); border:1px solid rgba(18,24,22,0.07);
    box-shadow:0 4px 16px rgba(18,24,22,0.04);
    transition:transform .2s ease, box-shadow .2s ease;
  }
  .gg-tip:hover { transform:translateY(-2px); box-shadow:0 10px 26px rgba(18,24,22,0.08); }
  .gg-tip-bar { position:absolute; left:0; top:0; bottom:0; width:3px; background:linear-gradient(180deg, #5b8a7a, #82b9af); }
  .gg-tip-row { display:flex; align-items:flex-start; gap:14px; }
  .gg-tip-emoji { font-size:24px; flex-shrink:0; line-height:1.2; }
  .gg-tip-title { margin:0 0 5px; color:var(--ink, #101412); font-size:15px; font-weight:860; line-height:1.25; }
  .gg-tip-text { margin:0; color:var(--ink-muted, #4b5a55); font-size:14px; line-height:1.62; }

  /* ── WRITTEN GUIDE (PROSE) ───────────────────────────────────────────────── */
  .gg-prose { margin-top:28px; }
  .gg-prose-lead { margin:0 0 30px; color:var(--ink-muted, #4b5a55); font-size:17px; line-height:1.74; max-width:680px; text-wrap:pretty; }
  .gg-topic { padding-top:26px; margin-top:26px; border-top:1px solid rgba(18,24,22,0.07); }
  .gg-topic:first-of-type { border-top:none; padding-top:0; margin-top:0; }
  .gg-topic h2 { margin:0 0 10px; color:var(--ink, #101412); font-size:clamp(1.35rem, 2.6vw, 1.7rem); font-weight:870; letter-spacing:-0.018em; line-height:1.12; }
  .gg-topic p { margin:0 0 12px; color:var(--ink-muted, #4b5a55); font-size:15.5px; line-height:1.72; max-width:680px; text-wrap:pretty; }
  .gg-topic p:last-child { margin-bottom:0; }
  .gg-inline-link { color:var(--accent, #3d6b5e); font-weight:760; text-decoration:none; border-bottom:1px solid rgba(112,139,133,0.34); transition:border-color .18s ease, color .18s ease; }
  .gg-inline-link:hover { color:#345d52; border-bottom-color:var(--accent, #3d6b5e); }

  /* ── BY-CAMPUS SECTIONS ──────────────────────────────────────────────────── */
  .gg-schools { display:grid; grid-template-columns:repeat(auto-fit, minmax(280px, 1fr)); gap:16px; margin-top:30px; }
  .gg-school {
    display:flex; flex-direction:column; padding:24px; border-radius:14px;
    background:var(--glass, rgba(255,255,255,0.86)); border:1px solid rgba(18,24,22,0.08);
    box-shadow:0 6px 20px rgba(18,24,22,0.05);
    transition:transform .22s ease, box-shadow .22s ease, border-color .22s ease;
  }
  .gg-school:hover { transform:translateY(-4px); box-shadow:0 16px 38px rgba(18,24,22,0.10); border-color:rgba(112,139,133,0.32); }
  .gg-school h2 { margin:0 0 9px; color:var(--ink, #101412); font-size:18px; font-weight:860; letter-spacing:-0.01em; line-height:1.18; }
  .gg-school p { margin:0 0 16px; color:var(--ink-muted, #4b5a55); font-size:14px; line-height:1.64; flex:1; }
  .gg-school-link { align-self:flex-start; color:var(--accent, #3d6b5e); font-size:13.5px; font-weight:820; text-decoration:none; }
  .gg-school-link:hover { color:#345d52; }

  /* ── CTA ─────────────────────────────────────────────────────────────────── */
  .gg-cta { padding:18px 0 84px; }
  .gg-cta-card {
    position:relative; overflow:hidden; padding:48px 40px; border-radius:18px; text-align:center;
    background:linear-gradient(135deg, #3d6b5e 0%, #345d52 100%);
    box-shadow:0 18px 48px rgba(36,60,52,0.24);
  }
  .gg-cta-squiggle { position:absolute; top:18px; right:26px; opacity:0.18; pointer-events:none; }
  .gg-cta-title { position:relative; margin:0 0 10px; color:#fff; font-size:clamp(1.6rem, 3.4vw, 2.3rem); font-weight:880; letter-spacing:-0.02em; line-height:1.08; }
  .gg-cta-sub { position:relative; margin:0 auto 26px; max-width:440px; color:rgba(255,255,255,0.82); font-size:15px; line-height:1.6; }
  .gg-cta-actions { position:relative; display:flex; flex-wrap:wrap; gap:10px; justify-content:center; }

  /* ── RESPONSIVE ──────────────────────────────────────────────────────────── */
  @media (max-width:760px) {
    .gg-hero { padding:112px 0 52px; }
    .gg-sub { font-size:16px; }
    .gg-section { padding:50px 0; }
    .gg-cta-card { padding:38px 22px; }
  }
`;

// Marquee phrases shared across guide hero strips.
export const GG_MARQUEE = [
  "Graduation Photos", "Bay Area", "Golden Hour",
  "SJSU · Berkeley · SF State", "Natural Light", "Real Moments",
];

// Small decorative squiggle used in heroes and CTA cards.
export const GG_SQUIGGLE_PATH =
  "M50 6 C74 20,26 42,50 66 C74 90,26 112,50 136 C74 160,26 178,50 196";
