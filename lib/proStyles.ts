// ─────────────────────────────────────────────────────────────────────────────
// lib/proStyles.ts
// Shared CSS factory for all professional pricing pages (grads, families, etc.)
//
// HOW TO USE:
//   import { pricingCSS, anim } from "@/lib/proStyles"
//   const CSS = pricingCSS({ mediaMinHeight: 620, mediaObjectPosition: "center top" })
//
// HOW TO CHANGE GLOBAL STYLES (affects BOTH pricing pages):
//   - Colors:      search for hex codes like #101412 (dark text), #667f79 (green-gray), #4b5a55 (body text)
//   - Font sizes:  search for font-size: inside the return string below
//   - Card radius: search for border-radius: 8px — change 8px everywhere to adjust all cards/panels
//   - Shadows:     search for box-shadow
// ─────────────────────────────────────────────────────────────────────────────

type PricingCSSOptions = {
  /** Min-height for the package photo column on desktop.
   *  Grads uses 620, families uses 560. Increase to make images taller. */
  mediaMinHeight?: number;
  /** Min-height for the package photo on mobile.
   *  Grads uses 420, families uses 390. */
  mediaMinHeightMobile?: number;
  /** CSS object-position for package photos — controls which part of the image shows.
   *  "center top" keeps faces visible. "center" centers the image. */
  mediaObjectPosition?: string;
  /** Set to true if the hero section has a side panel (e.g. families "Starting from $350").
   *  False = full-width hero (grads style). */
  heroPanel?: boolean;
};

export function pricingCSS({
  mediaMinHeight = 600,
  mediaMinHeightMobile = 420,
  mediaObjectPosition = "center",
  heroPanel = false,
}: PricingCSSOptions = {}): string {
  return `
  /* ── ENTRANCE ANIMATIONS ───────────────────────────────────────────────────
     Used via the anim.fadeUp() and anim.slideRight() helpers below.
     Adjust the translateY/X values to change how far elements slide in. */
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideRight {
    from { opacity: 0; transform: translateX(-14px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  /* ── PAGE WRAPPER ──────────────────────────────────────────────────────────
     padding-top pushes content below the fixed nav bar.
     If nav height changes, update 98px (desktop) and 78px (mobile). */
  .pricing-modern {
    padding-top: 98px;
    background: transparent;
    color: #101412; /* main dark text color */
  }

  /* ── MAX-WIDTH CONTAINER ───────────────────────────────────────────────────
     Change 1180px to make content wider or narrower.
     calc(100% - 48px) is the left+right padding on desktop. */
  .pricing-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }

  /* ── HERO SECTION (top of page) ────────────────────────────────────────────
     heroPanel: true  → 2-column grid (text left, price panel right)
     heroPanel: false → full-width single column (grads style)
     padding: 70px top, 34px bottom — adjust to move section up/down. */
  .pricing-hero {
    ${heroPanel
      ? `display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
    gap: 28px;
    align-items: end;`
      : ``}
    padding: 70px 0 34px;
  }

  /* ── FONT RESET for all small text elements ─────────────────────────────── */
  .pricing-kicker,
  .pricing-chip,
  .pricing-link,
  .pricing-meta,
  .pricing-detail-label,
  .pricing-row,
  .pricing-note {
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
  }

  /* ── KICKER (small label above headings, e.g. "Graduation pricing") ────────
     To change color: update #667f79
     To change size: update font-size: 13px */
  .pricing-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
  }

  /* ── PAGE TITLE (big heading) ───────────────────────────────────────────────
     font-size: 58px on desktop, shrinks to 40px on mobile (see media query below)
     text-wrap: balance keeps multi-line headings from having one orphan word */
  .pricing-title {
    max-width: 760px;
    margin: 0;
    color: #101412;
    font-size: 58px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }

  /* ── BODY COPY (paragraph text under headings) ──────────────────────────── */
  .pricing-copy {
    max-width: 620px;
    margin: 22px 0 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.72;
    text-wrap: pretty;
  }

  /* ── SHARED CARD STYLE (hero panel, info cards, packages, CTA panel) ───────
     border, background, and shadow are all set here once.
     rgba(18, 24, 22, 0.1) = very subtle dark border
     rgba(255, 255, 255, 0.76) = slightly transparent white background */
  .pricing-hero-panel,
  .pricing-info-card,
  .pricing-package,
  .pricing-cta-panel {
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.76);
    box-shadow: 0 14px 34px rgba(18, 24, 22, 0.07);
  }

  /* ── HERO SIDE PANEL (families page — the "$350 starting from" box) ─────── */
  .pricing-hero-panel {
    padding: 16px;
  }

  /* ── PRICE DISPLAY ($350, $500, etc.) ───────────────────────────────────────
     font-size: 62px on desktop, shrinks to 48px on mobile */
  .pricing-price {
    margin: 0;
    color: #101412;
    font-size: 62px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.92;
  }

  /* ── PRICE META ("per hour", "starting from") ──────────────────────────── */
  .pricing-meta {
    margin: 10px 0 0;
    color: #60706a;
    font-size: 14px;
    font-weight: 720;
  }

  /* ── CHIP ROW (row of small tag pills) ─────────────────────────────────── */
  .pricing-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }

  /* ── CHIP (individual pill tag, e.g. "50+ edited images") ─────────────────
     To change chip appearance: update background, border, color */
  .pricing-chip {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    padding: 0 11px;
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.82);
    color: #26312d;
    font-size: 13px;
    font-weight: 760;
  }

  /* ── INFO GRID (Booking / Session flow / Travel cards) ──────────────────────
     repeat(3, ...) = 3 equal columns. Change 3 to 2 for two columns.
     gap: 12px is the space between cards.
     padding-bottom: 68px is the space below this section. */
  .pricing-info-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    padding: 24px 0 68px;
  }

  /* ── INFO CARD (each of the Booking/Session/Travel cards) ───────────────────
     transition makes the hover lift smooth.
     hover: lifts card up 4px and deepens shadow. */
  .pricing-info-card {
    padding: 22px;
    transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease, border-color 0.22s ease;
  }
  .pricing-info-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 20px 44px rgba(18, 24, 22, 0.1);
    border-color: rgba(18, 24, 22, 0.16);
  }
  .pricing-info-card h2 {
    margin: 0 0 14px;
    color: #101412;
    font-size: 19px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1.12;
  }
  .pricing-info-card p {
    margin: 0 0 10px;
    color: #55635e;
    font-size: 15px;
    line-height: 1.62;
  }

  /* ── PACKAGE SECTION (the big text+photo blocks) ────────────────────────────
     grid-template-columns: text column (wider) | photo column (narrower)
     To flip photo to the right: use data-reverse="true" on the element */
  .pricing-package {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(320px, 0.82fr);
    gap: 12px;
    padding: 12px;
    margin-bottom: 18px;
  }
  .pricing-package[data-reverse="true"] {
    grid-template-columns: minmax(320px, 0.82fr) minmax(0, 1fr);
  }

  /* ── PACKAGE CONTENT (left side text block) ─────────────────────────────── */
  .pricing-package-content {
    padding: 34px;
    align-self: center;
  }

  /* ── PACKAGE PHOTO (right side image) ───────────────────────────────────────
     min-height comes from the pricingCSS() options: mediaMinHeight
     To make image taller: increase mediaMinHeight in the page's pricingCSS() call */
  .pricing-package-media {
    min-height: ${mediaMinHeight}px;
    overflow: hidden;
    border-radius: 8px;
    background: #dfe8e4; /* placeholder color shown while image loads */
  }
  .pricing-package-media img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    /* mediaObjectPosition controls which part of the photo shows (e.g. "center top" keeps faces in frame) */
    object-position: ${mediaObjectPosition};
  }

  /* ── PACKAGE HEADING (e.g. "Graduation Package") ────────────────────────── */
  .pricing-package h2 {
    margin: 0;
    color: #101412;
    font-size: 42px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }

  /* ── PACKAGE LIST (bullet points of what's included) ────────────────────── */
  .pricing-package ul {
    display: grid;
    gap: 10px;
    margin: 28px 0 0;
    padding: 0;
    list-style: none;
  }
  .pricing-package li {
    position: relative;
    padding-left: 20px;
    color: #4d5a55;
    font-size: 16px;
    line-height: 1.62;
  }
  /* The dot before each bullet point — change background to change dot color */
  .pricing-package li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.72em;
    width: 8px;
    height: 8px;
    border-radius: 99px;
    background: #9ab9b2; /* dot color */
  }

  /* ── ADD-ONS SECTION (below the bullet list) ────────────────────────────── */
  .pricing-addons {
    margin-top: 30px;
    padding-top: 22px;
    border-top: 1px solid rgba(18, 24, 22, 0.1);
  }

  /* ── ROW (label + price, e.g. "Additional outfit  $75") ─────────────────── */
  .pricing-row {
    display: flex;
    justify-content: space-between;
    gap: 18px;
    padding: 12px 0;
    border-bottom: 1px solid rgba(18, 24, 22, 0.08);
    color: #33403b;
    font-size: 15px;
    font-weight: 720;
  }
  .pricing-row span:last-child {
    color: #101412;
    white-space: nowrap;
  }

  /* ── INVESTMENT BLOCK (price + book button at bottom of package) ─────────── */
  .pricing-investment {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 18px;
    margin-top: 30px;
  }

  /* ── BUTTON / LINK (e.g. "Book this session", "Inquire now") ────────────────
     To change button color: update color, background, border-color
     To change button size: update min-height and padding */
  .pricing-link {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67; /* button text color */
    box-shadow: 0 10px 24px rgba(112, 139, 133, 0.05);
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .pricing-link:hover {
    transform: translateY(-1px);
    border-color: rgba(112, 139, 133, 0.32);
    background: rgba(239, 246, 244, 0.98);
    box-shadow: 0 14px 28px rgba(112, 139, 133, 0.07);
  }

  /* ── NOTE (small italic-style text, used on group sessions) ─────────────── */
  .pricing-note {
    margin: 14px 0 0;
    color: #65726d;
    font-size: 14px;
    line-height: 1.65;
  }

  /* ── GROUP TABLE (group pricing rows, grads page only) ──────────────────── */
  .pricing-group-table {
    display: grid;
    gap: 8px;
    margin-top: 28px;
  }
  .pricing-group-table .pricing-row {
    min-height: 52px;
    align-items: center;
    padding: 0 14px;
    border: 1px solid rgba(18, 24, 22, 0.09);
    border-radius: 8px;
    background: rgba(247, 250, 248, 0.82);
  }

  /* ── BOTTOM CTA STRIP (the "Ready?" panel at the very bottom) ────────────── */
  .pricing-cta {
    padding: 70px 0 110px; /* top and bottom spacing above footer */
  }
  .pricing-cta-panel {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    padding: 28px;
  }

  /* ── RESPONSIVE: TABLET (below 940px) ───────────────────────────────────────
     Collapses all grids to single column */
  @media (max-width: 940px) {
    .pricing-hero,
    .pricing-info-grid,
    .pricing-package,
    .pricing-package[data-reverse="true"] {
      grid-template-columns: 1fr;
    }
    /* On mobile, the reversed package puts the photo back on top */
    .pricing-package[data-reverse="true"] .pricing-package-media {
      order: -1;
    }
  }

  /* ── RESPONSIVE: MOBILE (below 760px) ───────────────────────────────────────
     Smaller font sizes, tighter spacing, vertical CTA panel */
  @media (max-width: 760px) {
    .pricing-modern { padding-top: 78px; } /* nav is shorter on mobile */
    .pricing-shell { width: min(1180px, calc(100% - 36px)); } /* less side padding */
    .pricing-hero { padding-top: 48px; }
    .pricing-title { font-size: 40px; line-height: 1; }
    .pricing-copy { font-size: 16px; }
    .pricing-price { font-size: 48px; }
    .pricing-info-grid { padding-bottom: 52px; }
    .pricing-package-content { padding: 20px 8px 12px; }
    .pricing-package h2 { font-size: 32px; line-height: 1.02; }
    /* mediaMinHeightMobile controls the photo height on mobile */
    .pricing-package-media { min-height: ${mediaMinHeightMobile}px; aspect-ratio: 4 / 5; }
    .pricing-row { align-items: flex-start; flex-direction: column; gap: 4px; }
    .pricing-group-table .pricing-row { flex-direction: row; align-items: center; }
    .pricing-cta { padding-bottom: 78px; }
    .pricing-cta-panel { align-items: flex-start; flex-direction: column; padding: 22px; }
  }
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// ANIMATION HELPERS
// Use these directly on elements as inline style props.
// They reference the @keyframes defined in pricingCSS() above.
//
// Usage:
//   <h1 style={anim.fadeUp(0.1)}>  ← fades up, starts after 0.1s delay
//   <p  style={anim.slideRight()}>  ← slides in from left, no delay
//
// Change the duration (0.65s / 0.5s) or easing to tweak the feel.
// ─────────────────────────────────────────────────────────────────────────────
export const anim = {
  fadeUp:     (delay = 0) => ({ animation: `fadeUp 0.65s ${delay}s cubic-bezier(0.22,1,0.36,1) both` }),
  slideRight: (delay = 0) => ({ animation: `slideRight 0.5s ${delay}s cubic-bezier(0.22,1,0.36,1) both` }),
} as const;
