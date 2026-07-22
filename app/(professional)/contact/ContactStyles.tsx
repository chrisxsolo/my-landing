import { C } from "@/lib/colors";

const CSS = `
  .contact-page {
    padding-top: 98px;
    background: transparent;
    color: var(--ink);
  }
  .contact-shell {
    width: min(1180px, calc(100% - 48px));
    margin: 0 auto;
  }
  .contact-hero {
    display: grid;
    grid-template-columns: minmax(0, 2fr) 360px;
    gap: 28px;
    align-items: end;
    padding: 70px 0 34px;
  }
  .contact-kicker,
  .contact-label,
  .contact-input,
  .contact-select,
  .contact-textarea,
  .submit-btn,
  .contact-link,
  .contact-chip {
    font-family: var(--font-dm-sans), ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    letter-spacing: 0;
  }
  .contact-kicker {
    margin: 0 0 14px;
    color: var(--ink-dim);
    font-size: 13px;
    font-weight: 820;
  }
  .contact-title {
    max-width: 760px;
    margin: 0;
    color: var(--ink);
    font-size: 58px;
    font-weight: 880;
    letter-spacing: 0;
    line-height: 0.98;
    text-wrap: balance;
  }
  .contact-copy {
    max-width: 620px;
    margin: 22px 0 0;
    color: var(--ink-muted);
    font-size: 17px;
    line-height: 1.72;
    text-wrap: pretty;
  }
  .contact-field-hint {
    margin: -6px 0 18px;
    color: var(--ink-muted);
    font-size: 14px;
    line-height: 1.6;
  }
  .contact-field-hint a {
    color: ${C.proAccent};
    font-weight: 700;
  }
  .contact-field-pop {
    animation: contactFieldPop 0.26s ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .contact-field-pop {
      animation: none;
    }
  }
  @keyframes contactFieldPop {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .contact-hero-media {
    position: relative;
    min-height: 360px;
    overflow: hidden;
    border: 1px solid ${C.proBorder};
    border-radius: 8px;
    background: color-mix(in srgb, ${C.proAccent} 18%, ${C.white});
    box-shadow: ${C.shadowWarmLg};
  }
  .contact-hero-media img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }
  .contact-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 330px;
    gap: 18px;
    align-items: start;
    padding: 24px 0 110px;
  }
  .contact-form-panel,
  .contact-side-panel {
    border: 1px solid ${C.proBorder};
    border-radius: 8px;
    background: ${C.surface};
    box-shadow: ${C.proShadow};
  }
  .contact-form-panel {
    min-height: 320px;
    padding: 28px;
  }
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .contact-field {
    display: grid;
    gap: 8px;
    margin-bottom: 18px;
  }
  .contact-label {
    color: var(--ink-dim);
    font-size: 12px;
    font-weight: 820;
  }
  .contact-input,
  .contact-select,
  .contact-textarea {
    width: 100%;
    border: 1px solid ${C.proBorder};
    border-radius: 8px;
    background: ${C.proPage};
    color: var(--ink);
    font-size: 16px;
    font-weight: 680;
    outline: none;
    transition: border-color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  }
  .contact-input,
  .contact-select {
    min-height: 50px;
    padding: 0 14px;
  }
  .contact-textarea {
    min-height: 150px;
    padding: 14px;
    resize: vertical;
  }
  .contact-input:focus,
  .contact-select:focus,
  .contact-textarea:focus {
    border-color: ${C.proAccentBorder};
    background: ${C.white};
    box-shadow: 0 0 0 4px ${C.proAccentSoft};
  }
  .contact-input::placeholder,
  .contact-textarea::placeholder {
    color: var(--ink-dim);
  }
  .submit-btn,
  .contact-link {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid ${C.proAccentBorder};
    border-radius: 8px;
    background: ${C.surfaceStrong};
    color: ${C.proAccent};
    box-shadow: ${C.shadowWarmSm};
    cursor: pointer;
    font-size: 14px;
    font-weight: 820;
    text-decoration: none;
    transition: background 0.18s ease, transform 0.18s ease, opacity 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
  }
  .submit-btn {
    width: 100%;
  }
  .submit-btn:hover:not(:disabled),
  .contact-link:hover {
    transform: translateY(-1px);
    border-color: ${C.proAccent};
    background: ${C.proAccentSoft};
    box-shadow: ${C.shadowWarm};
  }
  .submit-btn:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
  .contact-error {
    margin: 0 0 18px;
    color: ${C.danger};
    font-size: 14px;
    font-weight: 760;
    line-height: 1.5;
  }
  .contact-sr-only,
  .contact-honeypot {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .contact-sidebar {
    display: grid;
    gap: 14px;
  }
  .contact-side-panel {
    padding: 18px;
  }
  .contact-side-panel h2 {
    margin: 0 0 10px;
    color: var(--ink);
    font-size: 23px;
    font-weight: 860;
    letter-spacing: 0;
    line-height: 1.1;
  }
  .contact-side-panel p,
  .contact-side-panel a,
  .contact-expectation-list {
    color: var(--ink-muted);
    font-size: 15px;
    line-height: 1.65;
  }
  .contact-side-panel p {
    margin: 0;
  }
  .contact-side-panel a {
    color: var(--ink);
    font-weight: 780;
    text-decoration: none;
  }
  .contact-expectation-list {
    display: grid;
    gap: 10px;
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }
  .contact-expectation-list li {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    font-size: 14px;
    line-height: 1.5;
  }
  .contact-check {
    flex-shrink: 0;
    color: ${C.proAccent};
    font-weight: 700;
  }
  .contact-chip-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 18px;
  }
  .contact-chip {
    min-height: 34px;
    display: inline-flex;
    align-items: center;
    padding: 0 11px;
    border: 1px solid ${C.proBorder};
    border-radius: 8px;
    background: ${C.surface};
    color: var(--ink);
    font-size: 13px;
    font-weight: 760;
  }
  .booking-intent {
    margin: 0 0 24px;
    padding: 18px 20px;
    border: 1px solid ${C.proAccentBorder};
    border-radius: 8px;
    background: ${C.proAccentSoft};
  }
  .booking-intent .contact-kicker {
    margin-bottom: 8px;
    color: ${C.proAccent};
  }
  .booking-intent-headline {
    margin: 0;
    color: var(--ink);
    font-size: 20px;
    font-weight: 860;
    line-height: 1.15;
  }
  .booking-intent-meta {
    margin: 6px 0 0;
    color: var(--ink-muted);
    font-size: 15px;
    line-height: 1.5;
  }
  .booking-intent-addons {
    display: flex;
    flex-wrap: wrap;
    gap: 7px;
    margin-top: 12px;
  }
  .booking-intent-tag {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid ${C.proBorder};
    border-radius: 8px;
    background: ${C.surface};
    color: var(--ink);
    font-size: 13px;
    font-weight: 760;
  }
  .booking-intent-total {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid ${C.proAccentBorder};
  }
  .booking-intent-total span {
    color: var(--ink-dim);
    font-size: 12px;
    font-weight: 820;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .booking-intent-total strong {
    color: var(--ink);
    font-size: 22px;
    font-weight: 880;
  }
  .booking-intent-note {
    margin: 12px 0 0;
    color: var(--ink-muted);
    font-size: 13px;
    line-height: 1.5;
  }
  .contact-form-loading {
    display: grid;
    gap: 14px;
  }
  .contact-loading-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .contact-loading-block {
    min-height: 50px;
    border: 1px solid ${C.proBorder};
    border-radius: 8px;
    background: ${C.proAccentSoft};
  }
  .contact-loading-message {
    min-height: 150px;
  }
  @media (max-width: 920px) {
    .contact-hero,
    .contact-layout {
      grid-template-columns: 1fr;
    }
    .contact-hero-media {
      min-height: 420px;
      order: -1;
    }
  }
  @media (max-width: 760px) {
    .contact-page {
      padding-top: 78px;
    }
    .contact-shell {
      width: min(1180px, calc(100% - 36px));
    }
    .contact-hero {
      padding-top: 48px;
    }
    .contact-title {
      font-size: 40px;
      line-height: 1;
    }
    .contact-copy {
      font-size: 16px;
    }
    .contact-hero-media {
      min-height: 340px;
    }
    .contact-layout {
      padding-bottom: 78px;
    }
    .contact-form-panel {
      padding: 18px;
    }
    .form-row,
    .contact-loading-row {
      grid-template-columns: 1fr;
      gap: 0;
    }
  }
`;

export default function ContactStyles() {
  return <style>{CSS}</style>;
}
