// lib/familyGuide/styles.ts
// Self-contained CSS for the family photography guide (hub, locations hub, and
// individual location pages). Uses the professional site's design tokens
// (--accent, --ink, etc. from ProfessionalLayout) and the .glass-shimmer helper
// and ScrollReveal [data-reveal] animations, so it reads as a native extension
// of the site. Prefixed `fg-` and intentionally independent of GRAD_GUIDE_CSS so
// edits to one guide never affect the other.

export const FAMILY_GUIDE_CSS = `
  /* ── KEYFRAMES ───────────────────────────────────────────────────────────── */
  @keyframes fgFadeUp { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fgMarquee { from { transform:translateX(0); } to { transform:translateX(-50%); } }
  @keyframes fgPulse { 0%,100% { opacity:0.55; transform:scale(1); } 50% { opacity:0.15; transform:scale(1.35); } }
  @keyframes fgFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-7px); } }

  /* ── PAGE / LAYOUT ───────────────────────────────────────────────────────── */
  .fg-page { background:#f7faf8; color:var(--ink, #101412); }
  .fg-shell { width:min(960px, calc(100% - 44px)); margin:0 auto; }
  .fg-shell--wide { width:min(1120px, calc(100% - 44px)); margin:0 auto; }

  .fg-afu1 { animation:fgFadeUp 0.55s 0.05s ease both; }
  .fg-afu2 { animation:fgFadeUp 0.55s 0.13s ease both; }
  .fg-afu3 { animation:fgFadeUp 0.55s 0.21s ease both; }
  .fg-afu4 { animation:fgFadeUp 0.55s 0.29s ease both; }
  .fg-dot  { animation:fgPulse 2.6s ease-in-out infinite; }
  .fg-float { animation:fgFloat 4.5s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .fg-afu1,.fg-afu2,.fg-afu3,.fg-afu4,.fg-dot,.fg-float { animation:none; }
  }

  /* ── HERO ────────────────────────────────────────────────────────────────── */
  .fg-hero {
    position:relative; overflow:hidden; padding:128px 0 64px;
    border-bottom:1px solid rgba(18,24,22,0.07);
    background:
      radial-gradient(ellipse 60% 55% at 8% 12%, rgba(162,210,196,0.20) 0%, transparent 60%),
      radial-gradient(ellipse 55% 50% at 95% 90%, rgba(112,139,133,0.14) 0%, transparent 55%),
      linear-gradient(to bottom, #eaf2ee 0%, #f7faf8 100%);
  }
  .fg-kicker {
    display:inline-flex; align-items:center; gap:8px;
    padding:6px 13px; border-radius:999px; margin:0 0 18px;
    background:rgba(112,139,133,0.10); border:1px solid rgba(112,139,133,0.22);
    color:var(--accent, #3d6b5e);
    font-size:12px; font-weight:820; letter-spacing:0.10em; text-transform:uppercase;
  }
  .fg-kicker-dot { width:6px; height:6px; border-radius:999px; background:var(--accent, #3d6b5e); }
  .fg-h1 {
    margin:0; color:var(--ink, #101412);
    font-size:clamp(2.2rem, 5vw, 3.7rem); font-weight:880;
    letter-spacing:-0.025em; line-height:1.0; text-wrap:balance; max-width:780px;
  }
  .fg-h1-accent { color:var(--accent, #3d6b5e); font-style:italic; font-weight:520; }
  .fg-sub {
    margin:22px 0 30px; color:var(--ink-muted, #4b5a55);
    font-size:18px; line-height:1.72; max-width:640px; text-wrap:pretty;
  }

  /* ── BUTTONS ─────────────────────────────────────────────────────────────── */
  .fg-actions { display:flex; flex-wrap:wrap; gap:10px; }
  .fg-btn {
    min-height:46px; display:inline-flex; align-items:center; justify-content:center;
    padding:0 20px; border-radius:8px; font-size:14px; font-weight:820;
    text-decoration:none; transition:transform .18s ease, background .18s ease, border-color .18s ease, box-shadow .18s ease;
  }
  .fg-btn--primary {
    border:1px solid rgba(112,139,133,0.24); background:var(--accent, #3d6b5e); color:#f4f9f6;
    box-shadow:0 10px 24px rgba(61,107,94,0.18);
  }
  .fg-btn--primary:hover { transform:translateY(-1px); background:#345d52; box-shadow:0 14px 30px rgba(61,107,94,0.24); }
  .fg-btn--ghost { border:1px solid rgba(18,24,22,0.12); background:rgba(255,255,255,0.78); color:var(--ink, #101412); }
  .fg-btn--ghost:hover { transform:translateY(-1px); background:#fff; box-shadow:0 10px 22px rgba(18,24,22,0.07); }
  .fg-btn--ongreen { background:#fff; color:var(--accent, #3d6b5e); border:1px solid rgba(255,255,255,0.6); }
  .fg-btn--ongreen:hover { transform:translateY(-1px); box-shadow:0 12px 26px rgba(0,0,0,0.14); }
  .fg-btn--onghost { background:transparent; color:#eef5f1; border:1px solid rgba(255,255,255,0.35); }
  .fg-btn--onghost:hover { background:rgba(255,255,255,0.12); }
  .fg-btn:focus-visible { outline:3px solid rgba(61,107,94,0.45); outline-offset:2px; }

  /* ── BREADCRUMBS ─────────────────────────────────────────────────────────── */
  .fg-crumbs { padding:96px 0 0; }
  .fg-crumbs ol { list-style:none; display:flex; flex-wrap:wrap; gap:6px; margin:0; padding:0; font-size:13px; }
  .fg-crumbs li { display:flex; align-items:center; gap:6px; color:var(--ink-dim, #667f79); }
  .fg-crumbs a { color:var(--ink-dim, #667f79); text-decoration:none; font-weight:700; }
  .fg-crumbs a:hover { color:var(--accent, #3d6b5e); }
  .fg-crumbs li[aria-current="page"] { color:var(--ink, #101412); font-weight:800; }
  .fg-crumb-sep { color:rgba(112,139,133,0.5); }

  /* ── MARQUEE ─────────────────────────────────────────────────────────────── */
  .fg-marquee {
    overflow:hidden; padding:13px 0; border-bottom:1px solid rgba(18,24,22,0.07);
    background:rgba(255,255,255,0.7); backdrop-filter:blur(8px);
  }
  .fg-marquee-track { display:flex; gap:42px; width:max-content; white-space:nowrap; animation:fgMarquee 26s linear infinite; }
  @media (prefers-reduced-motion: reduce) { .fg-marquee-track { animation:none; } }
  .fg-marquee-item {
    display:inline-flex; align-items:center; gap:14px;
    color:var(--ink-dim, #667f79); font-size:11px; font-weight:800;
    letter-spacing:0.14em; text-transform:uppercase;
  }
  .fg-marquee-sep { width:4px; height:4px; border-radius:999px; background:var(--accent, #3d6b5e); flex-shrink:0; }

  /* ── SECTIONS ────────────────────────────────────────────────────────────── */
  .fg-section { padding:62px 0; }
  .fg-section--alt { background:#fff; border-top:1px solid rgba(18,24,22,0.06); border-bottom:1px solid rgba(18,24,22,0.06); }
  .fg-sec-kicker { margin:0 0 8px; color:var(--ink-dim, #667f79); font-size:12px; font-weight:820; letter-spacing:0.07em; text-transform:uppercase; }
  .fg-sec-title { margin:0; color:var(--ink, #101412); font-size:clamp(1.6rem, 3vw, 2.3rem); font-weight:880; letter-spacing:-0.02em; line-height:1.06; text-wrap:balance; }
  .fg-sec-sub { margin:10px 0 0; color:var(--ink-muted, #4b5a55); font-size:15px; line-height:1.6; }

  /* ── HUB CARDS ───────────────────────────────────────────────────────────── */
  .fg-cards { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:14px; margin-top:30px; }
  .fg-card {
    position:relative; display:block; overflow:hidden; padding:24px; border-radius:14px; text-decoration:none;
    background:var(--glass, rgba(255,255,255,0.86)); border:1px solid rgba(18,24,22,0.08);
    box-shadow:0 6px 20px rgba(18,24,22,0.05);
    transition:transform .22s cubic-bezier(.22,1,.36,1), box-shadow .22s ease, border-color .22s ease;
  }
  .fg-card:hover { transform:translateY(-5px); box-shadow:0 18px 40px rgba(18,24,22,0.10); border-color:rgba(112,139,133,0.32); }
  .fg-card:focus-visible { outline:3px solid rgba(61,107,94,0.45); outline-offset:2px; }
  .fg-card-bar { position:absolute; top:0; left:0; right:0; height:3px; background:linear-gradient(90deg, #5b8a7a, #82b9af); }
  .fg-card-emoji { display:block; font-size:30px; margin:6px 0 14px; }
  .fg-card-title { margin:0 0 7px; color:var(--ink, #101412); font-size:18px; font-weight:860; letter-spacing:-0.01em; line-height:1.15; }
  .fg-card-desc { margin:0; color:var(--ink-muted, #4b5a55); font-size:14px; line-height:1.6; }
  .fg-card-arrow { position:absolute; top:20px; right:20px; color:rgba(112,139,133,0.5); font-size:16px; transition:color .2s ease, transform .2s ease; }
  .fg-card:hover .fg-card-arrow { color:var(--accent, #3d6b5e); transform:translate(2px,-2px); }

  /* ── WRITTEN GUIDE (PROSE) ───────────────────────────────────────────────── */
  .fg-prose { margin-top:28px; }
  .fg-prose-lead { margin:0 0 30px; color:var(--ink-muted, #4b5a55); font-size:17px; line-height:1.74; max-width:700px; text-wrap:pretty; }
  .fg-topic { padding-top:26px; margin-top:26px; border-top:1px solid rgba(18,24,22,0.07); }
  .fg-topic:first-of-type { border-top:none; padding-top:0; margin-top:0; }
  .fg-topic h2 { margin:0 0 10px; color:var(--ink, #101412); font-size:clamp(1.3rem, 2.5vw, 1.65rem); font-weight:870; letter-spacing:-0.018em; line-height:1.14; }
  .fg-topic h3 { margin:0 0 8px; color:var(--ink, #101412); font-size:1.12rem; font-weight:840; }
  .fg-topic p { margin:0 0 12px; color:var(--ink-muted, #4b5a55); font-size:15.5px; line-height:1.72; max-width:700px; text-wrap:pretty; }
  .fg-topic p:last-child { margin-bottom:0; }
  .fg-list { margin:0 0 12px; padding-left:20px; color:var(--ink-muted, #4b5a55); font-size:15.5px; line-height:1.7; max-width:700px; }
  .fg-list li { margin-bottom:6px; }
  .fg-inline-link { color:var(--accent, #3d6b5e); font-weight:760; text-decoration:none; border-bottom:1px solid rgba(112,139,133,0.34); transition:border-color .18s ease, color .18s ease; }
  .fg-inline-link:hover { color:#345d52; border-bottom-color:var(--accent, #3d6b5e); }
  .fg-note { margin-top:16px; padding:14px 16px; border-radius:11px; background:rgba(112,139,133,0.08); border:1px solid rgba(112,139,133,0.18); color:var(--ink-muted, #4b5a55); font-size:13.5px; line-height:1.6; }

  /* ── LOCATION CARDS (locations hub) ──────────────────────────────────────── */
  .fg-locs { display:grid; grid-template-columns:repeat(auto-fit, minmax(300px, 1fr)); gap:18px; margin-top:30px; }
  .fg-loc {
    display:flex; flex-direction:column; overflow:hidden; border-radius:16px; text-decoration:none;
    background:var(--glass, rgba(255,255,255,0.9)); border:1px solid rgba(18,24,22,0.08);
    box-shadow:0 6px 20px rgba(18,24,22,0.05);
    transition:transform .22s ease, box-shadow .22s ease, border-color .22s ease;
  }
  .fg-loc:hover { transform:translateY(-4px); box-shadow:0 16px 38px rgba(18,24,22,0.10); border-color:rgba(112,139,133,0.32); }
  .fg-loc:focus-visible { outline:3px solid rgba(61,107,94,0.45); outline-offset:2px; }
  .fg-loc-media { position:relative; aspect-ratio:16/10; background:linear-gradient(135deg, rgba(112,139,133,0.12), rgba(162,210,196,0.14)); display:flex; align-items:center; justify-content:center; }
  .fg-loc-media img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .fg-loc-ph { text-align:center; color:var(--accent, #3d6b5e); }
  .fg-loc-ph span { display:block; font-size:30px; margin-bottom:4px; }
  .fg-loc-ph p { margin:0; font-size:12px; font-weight:720; }
  .fg-loc-body { padding:22px; display:flex; flex-direction:column; flex:1; }
  .fg-loc-region { align-self:flex-start; margin-bottom:10px; padding:4px 10px; border-radius:999px; background:rgba(112,139,133,0.12); color:var(--accent, #3d6b5e); font-size:11px; font-weight:820; letter-spacing:0.10em; text-transform:uppercase; }
  .fg-loc-title { margin:0 0 4px; color:var(--ink, #101412); font-size:19px; font-weight:860; letter-spacing:-0.01em; line-height:1.18; }
  .fg-loc-area { margin:0 0 12px; color:var(--ink-dim, #667f79); font-size:13px; font-weight:700; }
  .fg-loc-desc { margin:0 0 14px; color:var(--ink-muted, #4b5a55); font-size:14px; line-height:1.6; }
  .fg-loc-meta { margin:0 0 14px; display:flex; flex-direction:column; gap:7px; }
  .fg-loc-meta div { font-size:13px; line-height:1.45; color:var(--ink-muted, #4b5a55); }
  .fg-loc-meta b { color:var(--ink, #101412); font-weight:800; }
  .fg-loc-link { margin-top:auto; align-self:flex-start; color:var(--accent, #3d6b5e); font-size:13.5px; font-weight:820; }

  /* ── LOCATION PAGE HERO ──────────────────────────────────────────────────── */
  .fg-lhero { padding:0 0 56px; }
  .fg-lhero-media {
    position:relative; aspect-ratio:21/9; border-radius:18px; overflow:hidden; margin:22px 0 32px;
    background:linear-gradient(135deg, rgba(112,139,133,0.12), rgba(162,210,196,0.16));
    display:flex; align-items:center; justify-content:center;
  }
  .fg-lhero-media img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .fg-lhero-ph { text-align:center; color:var(--accent, #3d6b5e); }
  .fg-lhero-ph span { display:block; font-size:38px; margin-bottom:6px; }
  .fg-lhero-ph p { margin:0; font-size:13px; font-weight:720; }
  @media (max-width:640px) { .fg-lhero-media { aspect-ratio:4/3; } }

  /* ── INFO ROW ────────────────────────────────────────────────────────────── */
  .fg-info { display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:14px; margin-top:24px; }
  .fg-info-item { padding:18px; border:1px solid rgba(18,24,22,0.08); border-radius:12px; background:rgba(247,250,248,0.9); }
  .fg-info-label { margin:0 0 6px; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.07em; text-transform:uppercase; }
  .fg-info-value { margin:0; color:var(--ink, #101412); font-size:14.5px; font-weight:680; line-height:1.5; }

  /* ── GALLERY ─────────────────────────────────────────────────────────────── */
  .fg-gallery { display:grid; grid-template-columns:repeat(3, 1fr); gap:12px; margin-top:26px; }
  @media (max-width:620px) { .fg-gallery { grid-template-columns:repeat(2, 1fr); } }
  .fg-photo { position:relative; aspect-ratio:1; border-radius:12px; overflow:hidden; background:#e7ece9; }
  .fg-photo img { width:100%; height:100%; object-fit:cover; transition:transform .5s ease; }
  .fg-photo:hover img { transform:scale(1.04); }
  .fg-photo-cap { position:absolute; inset:0; display:flex; align-items:flex-end; padding:14px; background:rgba(16,24,22,0); transition:background .3s ease; }
  .fg-photo:hover .fg-photo-cap { background:rgba(16,24,22,0.42); }
  .fg-photo-cap span { color:#fff; font-size:13px; font-weight:600; opacity:0; transform:translateY(8px); transition:opacity .3s ease, transform .3s ease; }
  .fg-photo:hover .fg-photo-cap span { opacity:1; transform:translateY(0); }
  .fg-gallery-skel { aspect-ratio:1; border-radius:12px; background:linear-gradient(135deg, rgba(112,139,133,0.10), rgba(162,210,196,0.10)); }
  .fg-empty { border:2px dashed rgba(112,139,133,0.28); border-radius:14px; padding:48px 24px; text-align:center; }
  .fg-empty p { margin:0; }

  /* ── RELATED LINKS ───────────────────────────────────────────────────────── */
  .fg-related { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:26px; }
  .fg-related a {
    display:block; padding:16px 18px; border-radius:12px; text-decoration:none;
    background:var(--glass, rgba(255,255,255,0.86)); border:1px solid rgba(18,24,22,0.08);
    transition:transform .2s ease, box-shadow .2s ease, border-color .2s ease;
  }
  .fg-related a:hover { transform:translateY(-2px); box-shadow:0 12px 28px rgba(18,24,22,0.08); border-color:rgba(112,139,133,0.32); }
  .fg-related a:focus-visible { outline:3px solid rgba(61,107,94,0.45); outline-offset:2px; }
  .fg-related-title { display:block; color:var(--ink, #101412); font-size:15px; font-weight:840; margin-bottom:3px; }
  .fg-related-desc { display:block; color:var(--ink-muted, #4b5a55); font-size:13px; line-height:1.5; }

  /* ── CTA ─────────────────────────────────────────────────────────────────── */
  .fg-cta { padding:18px 0 84px; }
  .fg-cta-card {
    position:relative; overflow:hidden; padding:48px 40px; border-radius:18px; text-align:center;
    background:linear-gradient(135deg, #3d6b5e 0%, #345d52 100%);
    box-shadow:0 18px 48px rgba(36,60,52,0.24);
  }
  .fg-cta-title { position:relative; margin:0 0 10px; color:#fff; font-size:clamp(1.55rem, 3.2vw, 2.2rem); font-weight:880; letter-spacing:-0.02em; line-height:1.1; }
  .fg-cta-sub { position:relative; margin:0 auto 26px; max-width:460px; color:rgba(255,255,255,0.82); font-size:15px; line-height:1.6; }
  .fg-cta-actions { position:relative; display:flex; flex-wrap:wrap; gap:10px; justify-content:center; }

  /* ── RESPONSIVE ──────────────────────────────────────────────────────────── */
  @media (max-width:760px) {
    .fg-hero { padding:112px 0 52px; }
    .fg-sub { font-size:16px; }
    .fg-section { padding:50px 0; }
    .fg-cta-card { padding:38px 22px; }
  }
`;

// Marquee phrases for the family guide hero strips (family-specific).
export const FG_MARQUEE = [
  "Family Photography",
  "San Francisco & Bay Area",
  "Natural Light",
  "Outdoor Sessions",
  "Guided, Relaxed Pacing",
  "Fall Family Photos",
];
