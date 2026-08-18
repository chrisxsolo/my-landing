// ─────────────────────────────────────────────────────────────────────────────
// Payment confirmation email template (used by /api/payment-confirmation).
//
// Service-aware: grads get the 🎓 milestone treatment and the grad guide CTA;
// families and couples get their own copy and guide; every other service gets
// a neutral email with no guide block.
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeServiceType } from "@/lib/contentEngine/taxonomy";

const CHRIS_PHONE = "(408) 722-7680";

function escapeHtml(v: string) {
  return v
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type ServiceEmailContent = {
  emoji: string;
  intro: string;
  guidePath: string | null;
  guideBlurb: string;
  guideCta: string;
};

const SERVICE_EMAIL_CONTENT: Record<string, ServiceEmailContent> = {
  grads: {
    emoji: "🎓",
    intro: "I received your payment — thank you so much! Your session is officially booked and I can't wait to capture this milestone with you.",
    guidePath: "/grad-guide",
    guideBlurb: "My graduation guide covers everything — what to wear, posing tips, how to make the most of golden hour, and all the iconic spots we can hit. Refer back to it any time before shoot day.",
    guideCta: "Open the graduation guide →",
  },
  families: {
    emoji: "📸",
    intro: "I received your payment — thank you so much! Your session is officially booked and I can't wait to capture these memories with your family.",
    guidePath: "/family-guide",
    guideBlurb: "My family session guide covers everything — what to wear, how to prep the little ones, and timing for the best light. Refer back to it any time before shoot day.",
    guideCta: "Open the family guide →",
  },
  couples: {
    emoji: "📸",
    intro: "I received your payment — thank you so much! Your session is officially booked and I can't wait to capture this special time together.",
    guidePath: "/couples-guide",
    guideBlurb: "My couples guide covers everything — what to wear, posing tips, and how to make the most of golden hour. Refer back to it any time before shoot day.",
    guideCta: "Open the couples guide →",
  },
};

const DEFAULT_EMAIL_CONTENT: ServiceEmailContent = {
  emoji: "📸",
  intro: "I received your payment — thank you so much! Your session is officially booked and I can't wait to shoot with you.",
  guidePath: null,
  guideBlurb: "",
  guideCta: "",
};

function emailContentForService(sessionType: string | null): ServiceEmailContent {
  const service = normalizeServiceType(sessionType);
  return (service && SERVICE_EMAIL_CONTENT[service]) || DEFAULT_EMAIL_CONTENT;
}

export function buildPaymentConfirmationHtml(opts: {
  name: string;
  sessionType: string | null;
  confirmedDateLabel: string | null;
  amount: string;
  method: string;
  invoice: string;
  /** Full session price, e.g. "$450". Omitted when the shoot can't be priced. */
  sessionTotal?: string;
  /** Remaining balance, e.g. "$225". Empty once the session is paid in full. */
  balanceDue?: string;
  /** Caption under the balance — the due date, or the paid-in-full note. */
  balanceNote?: string;
  siteUrl: string;
  customMessage?: string;
}) {
  const {
    name, sessionType, confirmedDateLabel, amount, method, invoice,
    sessionTotal, balanceDue, balanceNote, siteUrl, customMessage,
  } = opts;
  const content  = emailContentForService(sessionType);
  const safeName = escapeHtml(name);

  const sessionRow  = sessionType
    ? `<tr style="border-bottom:1px solid rgba(17,21,19,0.09);">
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Session</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;">${escapeHtml(sessionType)}</td>
       </tr>`
    : "";

  const dateRow = confirmedDateLabel
    ? `<tr style="border-bottom:1px solid rgba(17,21,19,0.09);">
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Date</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;font-weight:700;">${escapeHtml(confirmedDateLabel)}</td>
       </tr>`
    : "";

  const invoiceRow = invoice
    ? `<tr>
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Invoice</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;">${escapeHtml(invoice)}</td>
       </tr>`
    : "";

  const totalRow = sessionTotal
    ? `<tr style="border-bottom:1px solid rgba(17,21,19,0.09);">
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Session total</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;">${escapeHtml(sessionTotal)}</td>
       </tr>`
    : "";

  const balanceRow = sessionTotal && (balanceDue || balanceNote)
    ? `<tr style="border-bottom:1px solid rgba(17,21,19,0.09);">
         <td style="padding:13px 0;color:#6a716f;width:140px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;">Balance</td>
         <td style="padding:13px 0;color:#1b201f;font-size:15px;">
           ${balanceDue ? `<strong>${escapeHtml(balanceDue)}</strong>` : ""}
           ${balanceNote ? `<span style="color:#6a716f;">${escapeHtml(balanceNote)}</span>` : ""}
         </td>
       </tr>`
    : "";

  const guideBlock = content.guidePath
    ? `
  <!-- Session guide CTA -->
  <div style="border:1px solid rgba(17,21,19,0.1);border-radius:10px;padding:24px;background:#f7f8f5;margin:0 0 28px;">
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111513;margin:0 0 10px;">
      Prepare for your session
    </p>
    <p style="font-size:15px;line-height:1.7;color:#303635;margin:0 0 20px;">
      ${escapeHtml(content.guideBlurb)}
    </p>
    <a href="${escapeHtml(siteUrl + content.guidePath)}"
       style="display:inline-block;background:#111513;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 20px;font-size:13px;font-weight:700;letter-spacing:.02em;">
      ${escapeHtml(content.guideCta)}
    </a>
  </div>
`
    : "";

  return wrapPaymentConfirmationShell(`<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;padding:48px 28px;background:#ffffff;color:#111513;">

  <!-- Eyebrow -->
  <p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.15em;color:#059669;margin:0 0 20px;">
    soloxsnaps &nbsp;·&nbsp; Booking Confirmed ✓
  </p>

  <!-- Headline -->
  <h1 style="font-size:34px;line-height:1.05;color:#111513;margin:0 0 16px;font-weight:800;">
    You're all set, ${safeName}! ${content.emoji}
  </h1>

  <!-- Intro -->
  <p style="font-size:16px;line-height:1.75;color:#303635;margin:0 0 28px;">
    ${escapeHtml(content.intro)}
  </p>

  <!-- Payment banner -->
  <div style="background:linear-gradient(135deg,#10b981,#047857);border-radius:14px;padding:24px 28px;margin:0 0 28px;">
    <p style="color:rgba(255,255,255,.75);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin:0 0 6px;">
      Payment Received
    </p>
    <p style="color:#ffffff;font-size:30px;font-weight:800;margin:0 0 4px;line-height:1;">
      ${escapeHtml(amount || "Deposit")}
    </p>
    ${method ? `<p style="color:rgba(255,255,255,.8);font-size:14px;margin:6px 0 0;">via ${escapeHtml(method)}</p>` : ""}
  </div>

  <!-- Session details -->
  ${(sessionRow || dateRow || totalRow) ? `
  <div style="border:1px solid rgba(17,21,19,0.1);border-radius:10px;padding:22px 24px;margin:0 0 28px;">
    <p style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#111513;margin:0 0 14px;">
      Session Details
    </p>
    <table style="width:100%;border-collapse:collapse;">
      ${sessionRow}${dateRow}${totalRow}${balanceRow}${invoiceRow}
    </table>
  </div>
  ` : ""}
${guideBlock}
  ${customMessage ? `
  <!-- Custom note from Chris -->
  <div style="border-left:3px solid #10b981;padding:14px 18px;margin:0 0 28px;background:rgba(16,185,129,0.04);">
    <p style="font-size:15px;line-height:1.75;color:#303635;margin:0;white-space:pre-wrap;">${escapeHtml(customMessage)}</p>
  </div>
  ` : ""}

  <!-- Sign-off -->
  <p style="font-size:15px;line-height:1.75;color:#303635;margin:0 0 28px;">
    If you need to reach me before shoot day, feel free to text or call: <strong style="color:#111513;">${CHRIS_PHONE}</strong>. Otherwise just reply to this email — I'm always happy to help. See you soon!
  </p>

  <!-- Footer -->
  <p style="font-size:13px;line-height:1.6;color:#6a716f;border-top:1px solid rgba(17,21,19,0.1);padding-top:20px;margin:0;">
    <strong style="color:#111513;">Chris · soloxsnaps</strong><br>
    <a href="https://soloxsnaps.com" style="color:#6a716f;text-decoration:none;">soloxsnaps.com</a>
    &nbsp;·&nbsp; ${CHRIS_PHONE}
  </p>

</div>`);
}

/** Doctype/body shell around the email content. Exported separately because
 *  the admin preview renders (and lets the user edit) only the inner content —
 *  the browser strips the document shell — so send re-wraps edited HTML here. */
export function wrapPaymentConfirmationShell(inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f4f0;">
${inner}
</body>
</html>`;
}
