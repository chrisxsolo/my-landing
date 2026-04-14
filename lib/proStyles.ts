// lib/proStyles.ts — shared CSS factory for professional pricing pages

type PricingCSSOptions = {
  /** Min-height for package image column on desktop. Default: 600 */
  mediaMinHeight?: number;
  /** Min-height for package image on mobile. Default: 420 */
  mediaMinHeightMobile?: number;
  /** object-position for package images. Default: "center" */
  mediaObjectPosition?: string;
  /** Whether the hero section has a side panel (2-col grid). Default: false */
  heroPanel?: boolean;
};

export function pricingCSS({
  mediaMinHeight = 600,
  mediaMinHeightMobile = 420,
  mediaObjectPosition = "center",
  heroPanel = false,
}: PricingCSSOptions = {}): string {
  return `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes slideRight {
    from { opacity: 0; transform: translateX(-14px); }
    to   { opacity: 1; transform: translateX(0); }
  }

  .pricing-modern {
    padding-top: 98px;
    background: transparent;
    color: #101412;
  }
  .pricing-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }
  .pricing-hero {
    ${heroPanel
      ? `display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.85fr);
    gap: 28px;
    align-items: end;`
      : ``}
    padding: 70px 0 34px;
  }
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
  .pricing-kicker {
    margin: 0 0 14px;
    color: #667f79;
    font-size: 13px;
    font-weight: 820;
  }
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
  .pricing-copy {
    max-width: 620px;
    margin: 22px 0 0;
    color: #4b5a55;
    font-size: 17px;
    line-height: 1.72;
    text-wrap: pretty;
  }
  .pricing-hero-panel,
  .pricing-info-card,
  .pricing-package,
  .pricing-cta-panel {
    border: 1px solid rgba(18, 24, 22, 0.1);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.76);
    box-shadow: 0 14px 34px rgba(18, 24, 22, 0.07);
  }
  .pricing-hero-panel {
    padding: 16px;
  }
  .pricing-price {
    margin: 0;
    color: #101412;
    font-size: 62px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.92;
  }
  .pricing-meta {
    margin: 10px 0 0;
    color: #60706a;
    font-size: 14px;
    font-weight: 720;
  }
  .pricing-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
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
  .pricing-info-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    padding: 24px 0 68px;
  }
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
  .pricing-package-content {
    padding: 34px;
    align-self: center;
  }
  .pricing-package-media {
    min-height: ${mediaMinHeight}px;
    overflow: hidden;
    border-radius: 8px;
    background: #dfe8e4;
  }
  .pricing-package-media img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
    object-position: ${mediaObjectPosition};
  }
  .pricing-package h2 {
    margin: 0;
    color: #101412;
    font-size: 42px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }
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
  .pricing-package li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 0.72em;
    width: 8px;
    height: 8px;
    border-radius: 99px;
    background: #9ab9b2;
  }
  .pricing-addons {
    margin-top: 30px;
    padding-top: 22px;
    border-top: 1px solid rgba(18, 24, 22, 0.1);
  }
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
  .pricing-investment {
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: 18px;
    margin-top: 30px;
  }
  .pricing-link {
    min-height: 46px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 18px;
    border: 1px solid rgba(112, 139, 133, 0.22);
    border-radius: 8px;
    background: rgba(246, 250, 248, 0.94);
    color: #4f6d67;
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
  .pricing-note {
    margin: 14px 0 0;
    color: #65726d;
    font-size: 14px;
    line-height: 1.65;
  }
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
  .pricing-cta {
    padding: 70px 0 110px;
  }
  .pricing-cta-panel {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 24px;
    padding: 28px;
  }
  @media (max-width: 940px) {
    .pricing-hero,
    .pricing-info-grid,
    .pricing-package,
    .pricing-package[data-reverse="true"] {
      grid-template-columns: 1fr;
    }
    .pricing-package[data-reverse="true"] .pricing-package-media {
      order: -1;
    }
  }
  @media (max-width: 760px) {
    .pricing-modern { padding-top: 78px; }
    .pricing-shell { width: min(1180px, calc(100% - 36px)); }
    .pricing-hero { padding-top: 48px; }
    .pricing-title { font-size: 40px; line-height: 1; }
    .pricing-copy { font-size: 16px; }
    .pricing-price { font-size: 48px; }
    .pricing-info-grid { padding-bottom: 52px; }
    .pricing-package-content { padding: 20px 8px 12px; }
    .pricing-package h2 { font-size: 32px; line-height: 1.02; }
    .pricing-package-media { min-height: ${mediaMinHeightMobile}px; aspect-ratio: 4 / 5; }
    .pricing-row { align-items: flex-start; flex-direction: column; gap: 4px; }
    .pricing-group-table .pricing-row { flex-direction: row; align-items: center; }
    .pricing-cta { padding-bottom: 78px; }
    .pricing-cta-panel { align-items: flex-start; flex-direction: column; padding: 22px; }
  }
  `;
}

// Reusable animation helpers — pass directly to style prop
export const anim = {
  fadeUp:     (delay = 0) => ({ animation: `fadeUp 0.65s ${delay}s cubic-bezier(0.22,1,0.36,1) both` }),
  slideRight: (delay = 0) => ({ animation: `slideRight 0.5s ${delay}s cubic-bezier(0.22,1,0.36,1) both` }),
} as const;
