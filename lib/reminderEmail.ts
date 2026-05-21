export type ReminderEmailType =
  | "48hr"
  | "day-before"
  | "morning-of"
  | "thank-you"
  | "gallery-delivery";

// Palette — pulled from the live site
const P1    = "#9d6fe8";  // violet accent
const P2    = "#e879a0";  // pink accent
const P3    = "#fbbf24";  // amber accent
const DARK  = "#111827";
const BODY  = "#374151";
const MUTED = "#6b7280";
const BG    = "#f4f5f2";  // sage/off-white — matches the site's page bg
const CARD  = "#ffffff";
const RULE  = "#e5e7eb";

const IG_HANDLE = "@soloxsnaps";
const PHONE     = "(408) 722-7680";
const WEBSITE   = "soloxsnaps.com";

const TOP_BARS: Record<ReminderEmailType, string> = {
  "48hr":             `linear-gradient(90deg, ${P1}, ${P2})`,
  "day-before":       `linear-gradient(90deg, ${P2}, ${P3})`,
  "morning-of":       `linear-gradient(90deg, ${P3}, ${P2})`,
  "thank-you":        `linear-gradient(90deg, ${P1}, ${P2}, ${P3})`,
  "gallery-delivery": `linear-gradient(90deg, ${P3}, ${P2}, ${P1})`,
};

function base(type: ReminderEmailType, content: string): string {
  const topBar = TOP_BARS[type];
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>From Chris @ soloxsnaps</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: ${BG};
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    -webkit-font-smoothing: antialiased;
    color: ${BODY};
  }

  .wrap {
    max-width: 560px;
    margin: 0 auto;
    padding: 48px 20px 72px;
  }

  /* Wordmark — mimics the nav logo */
  .brand {
    margin-bottom: 32px;
  }
  .brand-name {
    font-size: 17px;
    font-weight: 800;
    letter-spacing: -0.2px;
    color: ${DARK};
  }

  /* Card */
  .card {
    background: ${CARD};
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid ${RULE};
  }

  /* Thin gradient bar — only decorative accent */
  .bar {
    height: 3px;
    background: ${topBar};
  }

  /* Content */
  .content {
    padding: 44px 48px 40px;
  }

  /* Eyebrow */
  .eyebrow {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: ${MUTED};
    display: block;
    margin-bottom: 14px;
  }

  /* Headline — big and bold like the site's h1s */
  .headline {
    font-size: 30px;
    font-weight: 900;
    color: ${DARK};
    letter-spacing: -0.6px;
    line-height: 1.15;
    margin-bottom: 24px;
  }

  /* Body copy */
  .copy {
    font-size: 15.5px;
    line-height: 1.75;
    color: ${BODY};
  }
  .copy p { margin-bottom: 16px; }
  .copy p:last-child { margin-bottom: 0; }

  /* Rule */
  .rule {
    height: 1px;
    background: ${RULE};
    margin: 32px 0;
  }

  /* Detail rows — like the site's clean key/value pairs */
  .detail {
    display: flex;
    gap: 0;
    margin-bottom: 14px;
    align-items: baseline;
  }
  .detail:last-of-type { margin-bottom: 0; }
  .detail-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${MUTED};
    min-width: 110px;
    flex-shrink: 0;
    padding-top: 1px;
  }
  .detail-value {
    font-size: 14.5px;
    font-weight: 500;
    color: ${DARK};
    line-height: 1.5;
  }

  /* Callout block — minimal, just a left border */
  .callout {
    border-left: 3px solid ${P1};
    padding: 4px 0 4px 18px;
    margin-top: 32px;
  }
  .callout-amber {
    border-left: 3px solid ${P3};
    padding: 4px 0 4px 18px;
    margin-top: 32px;
  }
  .callout-label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.10em;
    text-transform: uppercase;
    color: ${P1};
    margin-bottom: 6px;
    display: block;
  }
  .callout-amber .callout-label { color: #92400e; }
  .callout-text {
    font-size: 14.5px;
    font-weight: 400;
    color: ${BODY};
    line-height: 1.65;
  }
  .callout-text strong { font-weight: 700; color: ${DARK}; }

  /* Checklist */
  .checklist { margin-top: 12px; }
  .checklist-item {
    font-size: 14.5px;
    color: ${BODY};
    line-height: 1.6;
    padding: 4px 0;
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .check {
    color: ${P1};
    font-weight: 800;
    flex-shrink: 0;
    font-size: 12px;
    margin-top: 3px;
  }

  /* Footer */
  .footer {
    padding: 22px 48px 26px;
    border-top: 1px solid ${RULE};
    background: #fafafa;
  }
  .footer-name {
    font-size: 13px;
    font-weight: 800;
    color: ${DARK};
    margin-bottom: 3px;
    letter-spacing: -0.1px;
  }
  .footer-meta {
    font-size: 12px;
    color: ${MUTED};
    line-height: 1.7;
  }
  .footer-meta a {
    color: ${P1};
    text-decoration: none;
    font-weight: 600;
  }

  @media (max-width: 480px) {
    .content, .footer { padding-left: 24px; padding-right: 24px; }
    .headline { font-size: 25px; }
    .detail-label { min-width: 90px; }
  }
</style>
</head>
<body>
<div class="wrap">

  <div class="brand">
    <span class="brand-name">soloxsnaps</span>
  </div>

  <div class="card">
    <div class="bar"></div>
    ${content}
    <div class="footer">
      <div class="footer-name">Chris Solorzano</div>
      <div class="footer-meta">
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
  <div class="content">
    <span class="eyebrow">2 days out</span>
    <div class="headline">See you in 48 hours.</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="callout">
      <span class="callout-label">Quick checklist</span>
      <div class="checklist">
        <div class="checklist-item"><span class="check">—</span> Outfits picked and wrinkle-free</div>
        <div class="checklist-item"><span class="check">—</span> Plan to arrive 5–10 min early</div>
        <div class="checklist-item"><span class="check">—</span> Text me if anything comes up: <strong>${PHONE}</strong></div>
      </div>
    </div>
  </div>`;
  return base("48hr", content);
}

export function buildDayBeforeEmail(firstName: string, body: string): string {
  const content = `
  <div class="content">
    <span class="eyebrow">Tomorrow</span>
    <div class="headline">See you tomorrow.</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="rule"></div>
    <div class="detail">
      <span class="detail-label">Meeting spot</span>
      <span class="detail-value">Confirmed in this email — or I'll text you</span>
    </div>
    <div class="detail">
      <span class="detail-label">Reach me</span>
      <span class="detail-value">${PHONE}</span>
    </div>
  </div>`;
  return base("day-before", content);
}

export function buildMorningOfEmail(firstName: string, body: string): string {
  const content = `
  <div class="content">
    <span class="eyebrow">Shoot day</span>
    <div class="headline">Today's the day.</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="callout">
      <span class="callout-label">Need me?</span>
      <p class="callout-text">Text or call anytime — <strong>${PHONE}</strong></p>
    </div>
  </div>`;
  return base("morning-of", content);
}

export function buildThankYouEmail(firstName: string, body: string): string {
  const content = `
  <div class="content">
    <span class="eyebrow">After your session</span>
    <div class="headline">That was so fun.</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="callout">
      <span class="callout-label">What's next</span>
      <p class="callout-text">I'm editing your photos now. You'll get a private gallery link as soon as they're ready. Tag me when you post — <strong>${IG_HANDLE}</strong></p>
    </div>
  </div>`;
  return base("thank-you", content);
}

export function buildGalleryDeliveryEmail(firstName: string, body: string): string {
  const content = `
  <div class="content">
    <span class="eyebrow">Gallery ready</span>
    <div class="headline">Your photos are ready.</div>
    <div class="copy">${bodyToParagraphs(body)}</div>
    <div class="callout-amber">
      <span class="callout-label">Tag me when you post</span>
      <p class="callout-text"><strong>${IG_HANDLE}</strong> — I love seeing these go live. It means a lot.</p>
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
