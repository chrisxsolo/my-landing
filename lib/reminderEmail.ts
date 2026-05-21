export type ReminderEmailType =
  | "48hr"
  | "day-before"
  | "morning-of"
  | "thank-you"
  | "gallery-delivery";

// Site palette — matches lib/colors.ts
const P1   = "#9d6fe8";   // violet
const P2   = "#e879a0";   // pink
const P3   = "#fbbf24";   // amber
const DARK = "#0e1412";
const INK  = "#2f3835";
const MUTED = "#687571";
const PAGE  = "#fffaf5";

const IG_HANDLE = "@soloxsnaps";
const PHONE     = "(408) 722-7680";
const WEBSITE   = "soloxsnaps.com";

// ── Per-type accent gradients ─────────────────────────────────────────────────
const BARS: Record<ReminderEmailType, string> = {
  "48hr":             `linear-gradient(90deg, ${P1}, ${P2})`,
  "day-before":       `linear-gradient(90deg, ${P2}, ${P3})`,
  "morning-of":       `linear-gradient(90deg, ${P3}, ${P2})`,
  "thank-you":        `linear-gradient(90deg, ${P1}, ${P2}, ${P3})`,
  "gallery-delivery": `linear-gradient(90deg, ${P3}, ${P2}, ${P1})`,
};

// ── Base shell ────────────────────────────────────────────────────────────────
function base(type: ReminderEmailType, content: string): string {
  const bar = BARS[type];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>From Chris @ soloxsnaps</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${PAGE};
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: ${INK};
  }

  .wrap {
    max-width: 560px;
    margin: 0 auto;
    padding: 44px 16px 64px;
  }

  /* Wordmark */
  .brand {
    text-align: center;
    margin-bottom: 32px;
  }
  .brand-name {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: -0.3px;
    background: linear-gradient(135deg, ${P1}, ${P2}, ${P3});
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .brand-sub {
    display: block;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #a8b4b1;
    margin-top: 4px;
  }

  /* Outer glass card */
  .glass-card {
    border-radius: 22px;
    overflow: hidden;
    background: rgba(255,255,255,0.82);
    border: 1px solid rgba(255,255,255,0.9);
    box-shadow:
      0 2px 1px rgba(255,255,255,0.8) inset,
      0 4px 24px rgba(157,111,232,0.09),
      0 1px 4px rgba(0,0,0,0.05);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  /* Gradient top bar */
  .top-bar {
    height: 3px;
    background: ${bar};
  }

  /* Card content area */
  .body {
    padding: 36px 40px 32px;
  }

  /* Section label / eyebrow */
  .eyebrow {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.13em;
    text-transform: uppercase;
    background: linear-gradient(135deg, ${P1}, ${P2});
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    margin-bottom: 10px;
    display: block;
  }

  /* Headline */
  .headline {
    font-size: 26px;
    font-weight: 800;
    color: ${DARK};
    letter-spacing: -0.5px;
    line-height: 1.18;
    margin-bottom: 18px;
  }

  /* Body copy */
  .copy {
    font-size: 15px;
    line-height: 1.78;
    color: ${INK};
    margin-bottom: 28px;
  }
  .copy p { margin-bottom: 14px; }
  .copy p:last-child { margin-bottom: 0; }

  /* Hairline rule */
  .rule {
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(157,111,232,0.15), transparent);
    margin: 28px 0;
  }

  /* Frosted info block */
  .frosted {
    background: rgba(157,111,232,0.05);
    border: 1px solid rgba(157,111,232,0.12);
    border-radius: 14px;
    padding: 20px 22px;
    margin-top: 4px;
  }
  .frosted-amber {
    background: rgba(251,191,36,0.06);
    border: 1px solid rgba(251,191,36,0.18);
    border-radius: 14px;
    padding: 20px 22px;
    margin-top: 4px;
  }

  .block-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${P1};
    margin-bottom: 10px;
    display: block;
  }
  .frosted-amber .block-label { color: #b45309; }

  .block-text {
    font-size: 14px;
    font-weight: 500;
    color: ${INK};
    line-height: 1.65;
  }
  .block-text strong { font-weight: 700; color: ${DARK}; }

  /* Checklist */
  .checklist { list-style: none; margin-top: 0; }
  .checklist li {
    font-size: 14px;
    font-weight: 500;
    color: ${INK};
    line-height: 1.6;
    padding: 5px 0;
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }
  .check {
    flex-shrink: 0;
    font-size: 11px;
    font-weight: 800;
    color: ${P1};
    margin-top: 3px;
    letter-spacing: 0;
  }

  /* Info rows */
  .info-grid { display: table; width: 100%; }
  .info-row {
    display: table-row;
  }
  .info-cell-label {
    display: table-cell;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #a8b4b1;
    padding: 6px 16px 6px 0;
    white-space: nowrap;
    vertical-align: top;
  }
  .info-cell-value {
    display: table-cell;
    font-size: 14px;
    font-weight: 600;
    color: ${DARK};
    padding: 6px 0;
    line-height: 1.45;
  }

  /* Footer */
  .footer {
    padding: 20px 40px 26px;
    border-top: 1px solid rgba(157,111,232,0.08);
    background: rgba(255,250,245,0.6);
  }
  .footer-name {
    font-size: 13.5px;
    font-weight: 700;
    color: ${DARK};
    margin-bottom: 4px;
  }
  .footer-line {
    font-size: 12px;
    color: ${MUTED};
    line-height: 1.7;
  }
  .footer-line a {
    color: ${P1};
    text-decoration: none;
    font-weight: 600;
  }

  @media (max-width: 480px) {
    .body, .footer { padding-left: 22px; padding-right: 22px; }
    .headline { font-size: 22px; }
  }
</style>
</head>
<body>
<div class="wrap">

  <div class="brand">
    <span class="brand-name">Chris.</span>
    <span class="brand-sub">soloxsnaps photography</span>
  </div>

  <div class="glass-card">
    <div class="top-bar"></div>
    ${content}
    <div class="footer">
      <div class="footer-name">Chris Solorzano</div>
      <div class="footer-line">
        <a href="https://${WEBSITE}">${WEBSITE}</a>&nbsp;&nbsp;·&nbsp;&nbsp;${PHONE}&nbsp;&nbsp;·&nbsp;&nbsp;${IG_HANDLE}
      </div>
    </div>
  </div>

</div>
</body>
</html>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function build48hrEmail(firstName: string, body: string): string {
  const content = `
  <div class="body">
    <span class="eyebrow">2 days out</span>
    <div class="headline">See you in 48 hours</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="frosted">
      <span class="block-label">Quick checklist</span>
      <ul class="checklist">
        <li><span class="check">✓</span> Outfits picked and wrinkle-free</li>
        <li><span class="check">✓</span> Plan to arrive 5–10 min early</li>
        <li><span class="check">✓</span> Text me if anything comes up — <strong>${PHONE}</strong></li>
      </ul>
    </div>
  </div>`;
  return base("48hr", content);
}

export function buildDayBeforeEmail(firstName: string, body: string): string {
  const content = `
  <div class="body">
    <span class="eyebrow">Tomorrow</span>
    <div class="headline">See you tomorrow</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="rule"></div>
    <div class="info-grid">
      <div class="info-row">
        <span class="info-cell-label">Meeting spot</span>
        <span class="info-cell-value">Confirmed in this email — or I'll text you</span>
      </div>
      <div class="info-row">
        <span class="info-cell-label">Reach me</span>
        <span class="info-cell-value">${PHONE}</span>
      </div>
    </div>
  </div>`;
  return base("day-before", content);
}

export function buildMorningOfEmail(firstName: string, body: string): string {
  const content = `
  <div class="body">
    <span class="eyebrow">Shoot day</span>
    <div class="headline">Today's the day</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="frosted">
      <span class="block-label">Need me?</span>
      <p class="block-text">Text or call anytime — <strong>${PHONE}</strong></p>
    </div>
  </div>`;
  return base("morning-of", content);
}

export function buildThankYouEmail(firstName: string, body: string): string {
  const content = `
  <div class="body">
    <span class="eyebrow">After your session</span>
    <div class="headline">That was so fun — thank you</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="frosted">
      <span class="block-label">What happens next</span>
      <p class="block-text">I'm editing your photos now. You'll get a private gallery link as soon as they're ready. Tag me when you post — <strong>${IG_HANDLE}</strong></p>
    </div>
  </div>`;
  return base("thank-you", content);
}

export function buildGalleryDeliveryEmail(firstName: string, body: string): string {
  const content = `
  <div class="body">
    <span class="eyebrow">Gallery ready</span>
    <div class="headline">Your photos are ready</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="frosted-amber">
      <span class="block-label">Tag me when you post</span>
      <p class="block-text"><strong>${IG_HANDLE}</strong> — I love seeing these go live. It means a lot.</p>
    </div>
  </div>`;
  return base("gallery-delivery", content);
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export function buildReminderEmail(
  type: ReminderEmailType,
  firstName: string,
  body: string,
): string {
  switch (type) {
    case "48hr":             return build48hrEmail(firstName, body);
    case "day-before":       return buildDayBeforeEmail(firstName, body);
    case "morning-of":       return buildMorningOfEmail(firstName, body);
    case "thank-you":        return buildThankYouEmail(firstName, body);
    case "gallery-delivery": return buildGalleryDeliveryEmail(firstName, body);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function bodyToParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map(p => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
