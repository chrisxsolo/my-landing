import { G } from "@/lib/portalTheme";

export const PORTAL_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

// Shared classes for all Gallery Print portal surfaces. Rendered (possibly
// more than once — harmless, identical content) via <PortalStyleTag/>.
export const PORTAL_STYLES = `
  .gp-root {
    background: ${G.page};
    min-height: 100vh;
    font-family: ui-sans-serif, system-ui, sans-serif;
    color: ${G.ink};
  }

  .gp-mono {
    font-family: ${G.mono};
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: ${G.inkFaint};
  }

  .gp-display {
    font-family: ${G.display};
    font-weight: 450;
    letter-spacing: -0.01em;
    color: ${G.ink};
  }

  .gp-panel {
    background: ${G.panel};
    border: 1px solid ${G.border};
    border-radius: 16px;
    box-shadow: ${G.shadow};
  }

  .gp-tile {
    background: ${G.inset};
    border: 1px solid ${G.insetBorder};
    border-radius: 10px;
    padding: 12px 14px;
    min-width: 0;
  }

  .gp-chip {
    display: inline-flex;
    align-items: center;
    height: 24px;
    padding: 0 10px;
    border-radius: 6px;
    border: 1px solid ${G.accentBorder};
    background: ${G.accentBg};
    color: ${G.accent};
    font-family: ${G.mono};
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .gp-chip[data-done="true"] {
    border-color: ${G.greenBorder};
    background: ${G.greenBg};
    color: ${G.green};
  }

  .gp-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 22px;
    border-radius: 10px;
    border: none;
    background: ${G.dark};
    color: ${G.paperText};
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.01em;
    text-decoration: none;
    cursor: pointer;
    transition: background 160ms ease, transform 160ms ease, box-shadow 160ms ease;
  }
  .gp-btn:hover:not(:disabled) {
    background: ${G.darkHover};
    transform: translateY(-1px);
    box-shadow: ${G.shadowLift};
  }
  .gp-btn:active { transform: translateY(0); }
  .gp-btn:disabled { opacity: 0.55; cursor: not-allowed; }

  .gp-ghost {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 36px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid ${G.border};
    background: ${G.panel};
    color: ${G.inkSoft};
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    cursor: pointer;
    transition: border-color 160ms ease, color 160ms ease, background 160ms ease;
    white-space: nowrap;
  }
  .gp-ghost:hover { border-color: ${G.borderStrong}; color: ${G.ink}; }

  .gp-input {
    width: 100%;
    min-height: 46px;
    padding: 0 14px;
    border-radius: 10px;
    border: 1px solid ${G.border};
    background: ${G.panel};
    font-size: 14px;
    font-weight: 500;
    color: ${G.ink};
    outline: none;
    transition: border-color 160ms ease, box-shadow 160ms ease;
    box-sizing: border-box;
  }
  .gp-input::placeholder { color: ${G.inkFaint}; }
  .gp-input:focus {
    border-color: ${G.accent};
    box-shadow: 0 0 0 3px ${G.accentBg};
  }

  .gp-rule {
    height: 1px;
    background: linear-gradient(90deg, transparent, ${G.border} 18%, ${G.border} 82%, transparent);
  }

  .gp-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${G.green};
    box-shadow: 0 0 0 2px ${G.greenBg};
    flex-shrink: 0;
  }

  .gp-in { animation: gp-up 480ms cubic-bezier(0.22, 0.68, 0, 1.05) both; }
  @keyframes gp-up {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .gp-skeleton {
    background: ${G.inset};
    border-radius: 12px;
    animation: gp-pulse 1.8s ease-in-out infinite;
  }
  @keyframes gp-pulse {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .gp-in, .gp-skeleton { animation: none !important; }
    .gp-btn:hover:not(:disabled) { transform: none; box-shadow: none; }
  }
`;
