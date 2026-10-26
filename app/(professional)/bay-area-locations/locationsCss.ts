// Styles for the public location guide, using the sage/glass tokens the
// professional layout exposes (--ink, --accent, --glass).
import { C } from "@/lib/colors";

export const LOC_CSS = `
  /* ── STAT CARDS ──────────────────────────────────────────────────────────── */
  .loc-stats { display:grid; gap:14px; grid-template-columns:repeat(3,1fr); margin-top:36px; }
  @media (max-width:680px) { .loc-stats { grid-template-columns:1fr; } }
  .loc-stat {
    padding:22px; border-radius:14px; background:var(--glass, rgba(255,255,255,0.86));
    border:1px solid rgba(18,24,22,0.08); box-shadow:0 6px 20px rgba(18,24,22,0.05);
  }
  .loc-stat-label { margin:0 0 8px; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.16em; text-transform:uppercase; }
  .loc-stat-num { margin:0; color:var(--ink, #101412); font-size:34px; font-weight:880; letter-spacing:-0.02em; line-height:1; }
  .loc-stat-note { margin:8px 0 0; color:var(--ink-muted, #4b5a55); font-size:13px; line-height:1.5; }

  /* ── TOOLBAR (search + filters) ──────────────────────────────────────────── */
  .loc-toolbar {
    border-radius:16px; padding:22px; background:var(--glass, rgba(255,255,255,0.86));
    border:1px solid rgba(18,24,22,0.08); box-shadow:0 6px 20px rgba(18,24,22,0.05);
  }
  .loc-toolbar-grid { display:grid; gap:16px; grid-template-columns:minmax(0,1fr) auto; align-items:end; }
  @media (max-width:680px) { .loc-toolbar-grid { grid-template-columns:1fr; } }
  .loc-label { display:block; margin:0 0 8px; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.15em; text-transform:uppercase; }
  .loc-search { display:flex; align-items:center; gap:10px; border-radius:10px; padding:11px 14px; background:#fff; border:1px solid rgba(18,24,22,0.12); }
  .loc-search input { width:100%; border:none; outline:none; background:transparent; font-size:14px; font-weight:500; color:var(--ink, #101412); }
  .loc-search input::placeholder { color:#9aa7a2; }
  .loc-count { border-radius:10px; padding:11px 16px; background:rgba(112,139,133,0.10); }
  .loc-count-label { margin:0; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.14em; text-transform:uppercase; }
  .loc-count-num { margin:2px 0 0; color:var(--ink, #101412); font-size:22px; font-weight:880; line-height:1; }
  .loc-count-note { margin:2px 0 0; color:var(--ink-muted, #4b5a55); font-size:13px; }
  .loc-chips { display:flex; flex-wrap:wrap; gap:8px; margin-top:16px; }
  .loc-chip {
    border-radius:999px; padding:8px 15px; font-size:13px; font-weight:800; cursor:pointer;
    border:1px solid rgba(18,24,22,0.12); background:#fff; color:var(--ink-muted, #4b5a55);
    transition:transform .16s ease, background .16s ease;
  }
  .loc-chip:hover { transform:translateY(-1px); }
  .loc-chip--on { background:var(--accent, #3d6b5e); color:#f4f9f6; border-color:transparent; box-shadow:0 8px 20px rgba(61,107,94,0.2); }

  /* ── LOCATION CARDS ──────────────────────────────────────────────────────── */
  .loc-grid { display:grid; gap:16px; grid-template-columns:1fr 1fr; margin-top:30px; }
  @media (max-width:760px) { .loc-grid { grid-template-columns:1fr; } }
  .loc-card {
    overflow:hidden; border-radius:14px; background:var(--glass, rgba(255,255,255,0.86));
    border:1px solid rgba(18,24,22,0.08); box-shadow:0 6px 20px rgba(18,24,22,0.05);
    transition:transform .22s ease, box-shadow .22s ease;
  }
  .loc-card:hover { transform:translateY(-3px); box-shadow:0 16px 38px rgba(18,24,22,0.09); }
  .loc-card-bar { height:3px; background:linear-gradient(90deg, #5b8a7a, #82b9af); }
  .loc-card-media {
    position:relative; height:260px; overflow:hidden; display:flex; align-items:center; justify-content:center;
    background:linear-gradient(135deg, rgba(112,139,133,0.12), rgba(162,210,196,0.14));
  }
  .loc-card-media img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .loc-card-overlay { position:absolute; inset:0; background:linear-gradient(180deg, transparent 40%, rgba(16,24,22,0.42) 100%); }
  .loc-card-toptags { position:absolute; left:14px; top:14px; z-index:1; display:flex; flex-wrap:wrap; gap:8px; }
  .loc-pill { border-radius:999px; padding:4px 11px; font-size:11px; font-weight:820; letter-spacing:0.08em; text-transform:uppercase; }
  .loc-pill--region { background:rgba(255,255,255,0.92); color:var(--accent, #3d6b5e); }
  .loc-pill--city { background:rgba(255,255,255,0.85); color:var(--ink, #101412); }
  .loc-card-ph { text-align:center; color:var(--accent, #3d6b5e); }
  .loc-card-ph span { display:block; font-size:40px; margin-bottom:6px; }
  .loc-card-ph p { margin:0; font-size:12px; font-weight:720; }
  .loc-card-body { padding:24px; }
  .loc-card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:14px; }
  .loc-card-head-main { min-width:0; }
  .loc-card-place { margin:0 0 4px; color:var(--ink-dim, #667f79); font-size:11px; font-weight:820; letter-spacing:0.12em; text-transform:uppercase; }
  .loc-card-title { margin:0; color:var(--ink, #101412); font-size:21px; font-weight:870; letter-spacing:-0.01em; line-height:1.15; }
  .loc-light { flex-shrink:0; max-width:46%; text-align:right; border-radius:11px; padding:9px 13px; background:rgba(112,139,133,0.10); border:1px solid rgba(112,139,133,0.2); }
  .loc-light-label { margin:0; color:var(--accent, #3d6b5e); font-size:10px; font-weight:820; letter-spacing:0.12em; text-transform:uppercase; }
  .loc-light-val { margin:3px 0 0; color:var(--ink, #101412); font-size:13px; font-weight:700; line-height:1.35; overflow-wrap:anywhere; }
  .loc-desc { color:var(--ink-muted, #4b5a55); font-size:14px; line-height:1.66; }
  .loc-meta { display:grid; gap:12px; grid-template-columns:1fr 1fr; margin-top:18px; }
  @media (max-width:480px) { .loc-meta { grid-template-columns:1fr; } }
  .loc-meta-box { border-radius:11px; padding:13px 15px; background:rgba(112,139,133,0.07); }
  .loc-meta-box--tip { background:rgba(162,210,196,0.13); }
  .loc-meta-label { margin:0 0 5px; font-size:10px; font-weight:820; letter-spacing:0.12em; text-transform:uppercase; color:var(--accent, #3d6b5e); }
  .loc-meta-text { margin:0; color:var(--ink-muted, #4b5a55); font-size:13px; line-height:1.55; font-weight:500; }
  .loc-card-tags { display:flex; flex-wrap:wrap; gap:8px; margin-top:18px; }
  .loc-tag {
    border-radius:999px; padding:5px 12px; font-size:12px; font-weight:760; cursor:pointer;
    background:#fff; border:1px solid rgba(18,24,22,0.1); color:var(--ink-muted, #4b5a55); transition:transform .16s ease;
  }
  .loc-tag:hover { transform:translateY(-1px); }
  .loc-tag--light { background:${C.proFilmEdge}1f; border-color:${C.proFilmEdge}59; color:${C.inkSoft}; }
  .loc-tag--light::before { content:"☀"; margin-right:5px; color:${C.proFilmEdge}; }
  .loc-crowd { margin:14px 0 0; border-radius:11px; padding:10px 14px; background:${C.proFilmEdge}1a; border-left:3px solid ${C.proFilmEdge}; font-size:13px; line-height:1.5; color:var(--ink-muted, #4b5a55); }
  .loc-crowd strong { margin-right:6px; color:${C.inkSoft}; font-size:10.5px; font-weight:820; letter-spacing:0.1em; text-transform:uppercase; }
  .loc-tag--region { cursor:default; background:rgba(112,139,133,0.12); color:var(--accent, #3d6b5e); border-color:transparent; font-weight:820; letter-spacing:0.06em; text-transform:uppercase; }

  /* ── FILTER SELECTS (library) ────────────────────────────────────────────── */
  .loc-filters { display:grid; gap:12px; grid-template-columns:repeat(auto-fit, minmax(150px,1fr)); align-items:end; margin-top:16px; }
  @media (max-width:860px) { .loc-filters { grid-template-columns:1fr 1fr; } }
  .loc-select-wrap { min-width:0; }
  .loc-select {
    width:100%; appearance:none; border-radius:10px; padding:10px 34px 10px 13px; font-size:14px; font-weight:650;
    color:var(--ink, #101412); background:#fff; border:1px solid rgba(18,24,22,0.12); cursor:pointer;
    background-image:linear-gradient(45deg, transparent 50%, #667f79 50%), linear-gradient(135deg, #667f79 50%, transparent 50%);
    background-position:calc(100% - 17px) 52%, calc(100% - 12px) 52%; background-size:5px 5px; background-repeat:no-repeat;
  }
  .loc-select:focus-visible, .loc-search:focus-within { outline:2px solid var(--accent, #3d6b5e); outline-offset:2px; }
  .loc-filter-foot { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:10px; margin-top:14px; }
  .loc-reset { border:none; background:none; padding:4px 0; font-size:13px; font-weight:800; color:var(--accent, #3d6b5e); cursor:pointer; text-decoration:underline; text-underline-offset:3px; }
  .loc-active-note { margin:0; font-size:13px; color:var(--ink-muted, #4b5a55); }
  .loc-kinds { margin:14px 0 0; font-size:12.5px; color:var(--ink-muted, #4b5a55); line-height:1.5; }
  .loc-kinds strong { color:var(--accent, #3d6b5e); font-weight:820; letter-spacing:0.08em; text-transform:uppercase; font-size:10.5px; margin-right:6px; }
  .loc-related { display:flex; flex-wrap:wrap; gap:8px 14px; margin-top:16px; padding-top:14px; border-top:1px solid rgba(18,24,22,0.08); }
  .loc-related a { font-size:13px; font-weight:750; color:var(--accent, #3d6b5e); text-decoration:underline; text-underline-offset:3px; }
  .loc-more { display:flex; justify-content:center; margin-top:26px; }
  .loc-card { scroll-margin-top:96px; }
`;
