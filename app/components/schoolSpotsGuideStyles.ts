// Styles for the long-form school location guide (/grads/<slug>/spots). Builds
// on the .sp-* base in SchoolSpotsTemplate, so the guide and the compact spots
// pages share one look. Colors come from the shared palette.
import { C } from "@/lib/colors";

export const SPOTS_GUIDE_CSS = `
  /* The shared FAQ block sits in the guide's narrower reading column. */
  .sp-page .ssg-shell { width: min(900px, calc(100% - 48px)); }
  .spg-wide { width: min(1120px, calc(100% - 48px)); margin: 0 auto; }
  .spg-hero-grid { display: grid; gap: 44px; align-items: center; }
  .spg-hero--photo .spg-hero-grid { grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); }
  .spg-hero-copy p { margin: 0 0 14px; color: ${C.muted}; font-size: 17px; line-height: 1.72; max-width: 600px; text-wrap: pretty; }
  .spg-hero-copy p:last-of-type { margin-bottom: 26px; }
  .spg-hero-frame {
    position: relative; overflow: hidden; margin: 0; justify-self: end; width: min(100%, 440px);
    border-radius: 18px; background: ${C.proAccentSoft}; box-shadow: ${C.proShadow}; max-height: 620px;
  }

  .spg-jump { padding: 22px 0 0; }
  .spg-jump-list { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .spg-jump-link {
    display: inline-flex; align-items: center; min-height: 36px; padding: 0 13px; border-radius: 999px;
    background: ${C.white}; border: 1px solid ${C.proBorder}; color: ${C.proAccent};
    font-size: 13px; font-weight: 780; text-decoration: none;
  }
  .spg-jump-link:hover { border-color: ${C.proAccentBorder}; }

  .spg-musts { padding: 44px 0 8px; }
  .spg-lead { margin: 0 0 18px; color: ${C.inkSoft}; font-size: 17px; line-height: 1.65; font-weight: 640; }
  .spg-must-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .spg-must {
    display: block; overflow: hidden; border-radius: 14px; text-decoration: none;
    background: ${C.white}; border: 1px solid ${C.proBorder}; box-shadow: ${C.proShadow};
    transition: transform .18s ease;
  }
  .spg-must:hover { transform: translateY(-2px); }
  .spg-must-img { position: relative; aspect-ratio: 4 / 3; background: ${C.proAccentSoft}; }
  .spg-must-name { display: block; padding: 12px 14px; color: ${C.ink}; font-size: 15px; font-weight: 840; line-height: 1.3; }

  .spg-h2 {
    margin: 0 0 18px; color: ${C.ink}; font-size: clamp(1.6rem, 3.2vw, 2.3rem);
    font-weight: 880; letter-spacing: -0.02em; line-height: 1.08; text-wrap: balance;
  }
  .spg-copy { margin: 0 0 14px; color: ${C.muted}; font-size: 16px; line-height: 1.74; text-wrap: pretty; }
  .spg-section { padding: 56px 0 8px; scroll-margin-top: 90px; }
  .sp-spot { scroll-margin-top: 90px; }
  .spg-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
  .spg-chip--must { background: ${C.proAccent}; color: ${C.white}; }
  .spg-chip--light { background: ${C.proFilmEdge}1f; box-shadow: inset 0 0 0 1px ${C.proFilmEdge}59; color: ${C.inkSoft}; }
  .spg-chip--light::before { content: "☀"; color: ${C.proFilmEdge}; }

  .spg-photos { display: grid; gap: 10px; margin: 18px 0 16px; }
  .spg-photos--1 { grid-template-columns: minmax(0, 1fr); max-width: 520px; }
  .spg-photos--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); max-width: 680px; }
  .spg-photos--3 { grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; }
  .spg-photos--3 .spg-photo:first-child { grid-row: span 2; }
  .spg-photo { position: relative; overflow: hidden; border-radius: 12px; background: ${C.proAccentSoft}; aspect-ratio: 4 / 5; }
  .spg-photos--3 .spg-photo:not(:first-child) { aspect-ratio: auto; min-height: 140px; }

  .spg-ideas-label { margin: 6px 0 8px; color: ${C.ink}; font-size: 14px; font-weight: 820; }
  .spg-ideas { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0; padding: 0; list-style: none; }
  .spg-ideas li { color: ${C.muted}; font-size: 14.5px; line-height: 1.5; }
  .spg-ideas li::before { content: "✓ "; color: ${C.proAccent}; font-weight: 800; }

  .spg-card {
    padding: 26px; border-radius: 16px; background: ${C.white};
    border: 1px solid ${C.proBorder}; box-shadow: ${C.proShadow};
  }
  .spg-sunset { margin: 18px 0 6px; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
  .spg-sunset div { padding: 10px 6px; border-radius: 10px; background: ${C.proAccentSoft}; text-align: center; }
  .spg-sunset dt { color: ${C.muted}; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; text-transform: uppercase; }
  .spg-sunset dd { margin: 4px 0 0; color: ${C.ink}; font-size: 15px; font-weight: 840; }
  .spg-fine { margin: 8px 0 0; color: ${C.mutedSoft}; font-size: 13px; line-height: 1.6; }

  .spg-route { margin: 6px 0 18px; padding: 0; list-style: none; counter-reset: route; }
  .spg-route li {
    counter-increment: route; position: relative; padding: 12px 0 12px 46px;
    border-top: 1px solid ${C.proBorder}; color: ${C.inkSoft}; font-size: 16px; line-height: 1.55;
  }
  .spg-route li:first-child { border-top: none; }
  .spg-route li::before {
    content: counter(route); position: absolute; left: 0; top: 10px;
    width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center;
    background: ${C.proAccentSoft}; color: ${C.proAccent}; font-size: 14px; font-weight: 860;
  }
  .spg-route a { color: ${C.proAccent}; font-weight: 760; }

  .spg-where { margin: 0 0 14px; color: ${C.inkSoft}; font-size: 15.5px; line-height: 1.6; }
  .spg-where-label { color: ${C.ink}; font-weight: 820; }
  .spg-tip-callout {
    margin: 16px 0 0; padding: 14px 16px; border-radius: 12px; border-left: 3px solid ${C.proAccent};
    background: ${C.proAccentSoft}; color: ${C.inkSoft}; font-size: 15px; line-height: 1.65; text-wrap: pretty;
  }
  .spg-list { margin: 0; padding: 0 0 0 20px; list-style: disc; }
  .spg-list li::marker { color: ${C.proAccent}; }
  .spg-list li { margin: 0 0 8px; color: ${C.muted}; font-size: 15.5px; line-height: 1.6; }
  .spg-list li:last-child { margin-bottom: 0; }
  .spg-source { color: ${C.proAccent}; font-weight: 720; }

  .spg-tips { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .spg-tip-title { margin: 0 0 6px; color: ${C.ink}; font-size: 16.5px; font-weight: 840; }
  .spg-tip .spg-copy { margin: 0; font-size: 15px; }

  @media (max-width: 860px) {
    .spg-hero--photo .spg-hero-grid { grid-template-columns: 1fr; gap: 28px; }
    .spg-hero-frame { justify-self: center; width: min(100%, 520px); max-height: 70vh; }
    .spg-sunset { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 760px) {
    /* The site layout already pads every <section> 20px on phones; let the
       inner columns fill it so the whole guide shares one 20px gutter. */
    .sp-page .sp-shell, .sp-page .spg-wide, .sp-page .ssg-shell { width: 100%; }
    .spg-jump { padding: 22px 20px 0; }
    .spg-must-grid { grid-template-columns: 1fr; }
    .spg-must--photo { display: grid; grid-template-columns: 88px minmax(0, 1fr); align-items: center; }
    .spg-must-img { aspect-ratio: 1 / 1; }
    .spg-tips { grid-template-columns: 1fr; }
    .spg-photos--3 { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: none; }
    .spg-photos--3 .spg-photo:first-child { grid-column: span 2; grid-row: auto; }
    .spg-photos--3 .spg-photo:not(:first-child) { aspect-ratio: 4 / 5; min-height: 0; }
    .spg-card { padding: 20px; }
  }
`;
