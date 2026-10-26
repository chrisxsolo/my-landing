// Extra styles for the couples guide hub sections (table of contents, steps,
// pricing, FAQ, photo band). Layered on top of the shared fg-* guide design
// system (COUPLES_GUIDE_CSS) and its --accent/--ink tokens.

export const COUPLES_HUB_CSS = `
  .cg-toc { display:flex; flex-wrap:wrap; gap:8px; margin:26px 0 0; padding:0; list-style:none; }
  .cg-toc a {
    display:inline-flex; align-items:center; min-height:38px; padding:0 14px; border-radius:999px;
    background:rgba(255,255,255,0.8); border:1px solid rgba(18,24,22,0.10);
    color:var(--ink, #101412); font-size:13.5px; font-weight:720; text-decoration:none;
  }
  .cg-toc a:hover { border-color:rgba(61,107,94,0.4); color:var(--accent, #3d6b5e); }

  .cg-section { scroll-margin-top:96px; }
  .cg-h2 { margin:0 0 12px; color:var(--ink, #101412); font-size:clamp(1.6rem, 3.4vw, 2.3rem); font-weight:880; letter-spacing:-0.02em; line-height:1.1; text-wrap:balance; }
  .cg-h3 { margin:0 0 6px; color:var(--ink, #101412); font-size:1.05rem; font-weight:840; line-height:1.3; }
  .cg-text { margin:0; color:var(--ink-muted, #4b5a55); font-size:15px; line-height:1.68; }

  .cg-band { display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-top:28px; }
  .cg-band-item { position:relative; aspect-ratio:4/5; overflow:hidden; border-radius:14px; background:#e7ece9; }
  .cg-band-item:nth-child(2) { transform:translateY(18px); }
  @media (max-width:620px) { .cg-band { grid-template-columns:repeat(2, 1fr); } .cg-band-item:nth-child(3) { display:none; } .cg-band-item:nth-child(2) { transform:none; } }

  .cg-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(230px, 1fr)); gap:14px; margin-top:24px; }
  .cg-tile { padding:18px; border-radius:14px; background:rgba(255,255,255,0.88); border:1px solid rgba(18,24,22,0.08); }

  .cg-steps { counter-reset:cg-step; display:grid; gap:12px; margin:24px 0 0; padding:0; list-style:none; }
  .cg-step { counter-increment:cg-step; position:relative; padding:16px 18px 16px 62px; border-radius:14px; background:rgba(255,255,255,0.88); border:1px solid rgba(18,24,22,0.08); }
  .cg-step::before {
    content:counter(cg-step); position:absolute; left:16px; top:16px; display:grid; place-items:center;
    width:32px; height:32px; border-radius:999px; background:var(--accent, #3d6b5e); color:#fff; font-size:14px; font-weight:820;
  }

  .cg-settings { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-top:16px; }
  .cg-setting { padding:16px; border-radius:12px; background:rgba(112,139,133,0.08); border:1px solid rgba(112,139,133,0.18); }
  .cg-setting b { display:block; margin-bottom:4px; color:var(--ink, #101412); font-size:14px; font-weight:820; }

  .cg-chips { display:flex; flex-wrap:wrap; gap:8px; margin:18px 0 0; padding:0; list-style:none; }
  .cg-chips li { padding:8px 13px; border-radius:999px; background:rgba(112,139,133,0.10); color:var(--ink, #101412); font-size:14px; font-weight:650; }

  .cg-price-table { width:100%; margin-top:22px; border-collapse:collapse; background:rgba(255,255,255,0.9); border-radius:14px; overflow:hidden; border:1px solid rgba(18,24,22,0.08); }
  .cg-price-table th, .cg-price-table td { padding:14px 16px; text-align:left; border-bottom:1px solid rgba(18,24,22,0.07); font-size:14.5px; vertical-align:top; }
  .cg-price-table tr:last-child th, .cg-price-table tr:last-child td { border-bottom:none; }
  .cg-price-table th { color:var(--ink, #101412); font-weight:820; }
  .cg-price-table td { color:var(--ink-muted, #4b5a55); }
  .cg-price-table .cg-price { color:var(--ink, #101412); font-weight:860; white-space:nowrap; text-align:right; }
  .cg-price-detail { display:block; margin-top:2px; color:var(--ink-dim, #667f79); font-size:13px; font-weight:600; }
  .cg-highlight td, .cg-highlight th { background:rgba(162,210,196,0.16); }

  .cg-faq { margin-top:22px; display:grid; gap:10px; }
  .cg-faq details { border-radius:14px; background:rgba(255,255,255,0.9); border:1px solid rgba(18,24,22,0.08); }
  .cg-faq summary {
    list-style:none; cursor:pointer; display:flex; justify-content:space-between; gap:16px; align-items:center;
    padding:16px 18px; color:var(--ink, #101412); font-size:15.5px; font-weight:800; min-height:48px;
  }
  .cg-faq summary::-webkit-details-marker { display:none; }
  .cg-faq summary::after { content:"+"; flex-shrink:0; color:var(--accent, #3d6b5e); font-size:22px; font-weight:500; transition:transform .2s ease; }
  .cg-faq details[open] summary::after { transform:rotate(45deg); }
  .cg-faq summary:focus-visible { outline:3px solid rgba(61,107,94,0.45); outline-offset:2px; border-radius:14px; }
  .cg-faq details p { margin:0; padding:0 18px 18px; color:var(--ink-muted, #4b5a55); font-size:15px; line-height:1.7; }

  .cg-more { margin-top:18px; font-size:15px; }
`;
