// Styles for the /blog category filter pills, sort dropdown, and filtered
// empty state.
import { C } from "@/lib/colors";

export const BLOG_FILTER_CSS = `
  /* ── FILTER BAR ───────────────────────────────────────────────────────────── */
  .blog-filters {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 28px;
  }
  .blog-filter-pills {
    display: flex;
    flex: 1;
    min-width: 0;
    gap: 8px;
    padding: 3px;
    margin: -3px;
    overflow-x: auto;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .blog-filter-pills::-webkit-scrollbar { display: none; }
  .blog-filter-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
    min-height: 40px;
    padding: 0 17px;
    border: 1px solid ${C.proBorder};
    border-radius: 100px;
    background: rgba(255, 255, 255, 0.78);
    color: var(--ink-muted);
    font: inherit;
    font-size: 13px;
    font-weight: 760;
    white-space: nowrap;
    cursor: pointer;
    transition: background var(--transition), border-color var(--transition), color var(--transition), box-shadow var(--transition);
  }
  .blog-filter-pill:hover {
    border-color: ${C.proAccentBorder};
    background: ${C.white};
    color: var(--ink);
  }
  .blog-filter-pill[aria-pressed="true"] {
    border-color: ${C.proAccent};
    background: ${C.proAccent};
    color: ${C.white};
    box-shadow: ${C.proShadow};
  }
  .blog-filter-pill:focus-visible,
  .blog-sort-select:focus-visible,
  .blog-empty-action:focus-visible {
    outline: 2px solid ${C.proAccent};
    outline-offset: 2px;
  }
  .blog-filter-count {
    font-size: 11px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    opacity: 0.62;
  }

  .blog-sort {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .blog-sort-label {
    color: var(--ink-dim);
    font-size: 11.5px;
    font-weight: 820;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .blog-sort-field { position: relative; display: inline-flex; }
  .blog-sort-select {
    appearance: none;
    -webkit-appearance: none;
    min-height: 40px;
    padding: 0 38px 0 16px;
    border: 1px solid ${C.proBorder};
    border-radius: 100px;
    background: ${C.white};
    color: var(--ink);
    font: inherit;
    font-size: 13px;
    font-weight: 760;
    cursor: pointer;
    transition: border-color var(--transition);
  }
  .blog-sort-select:hover { border-color: ${C.proAccentBorder}; }
  .blog-sort-chevron {
    position: absolute;
    right: 15px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--ink-dim);
    pointer-events: none;
  }

  .blog-empty-action {
    display: inline-flex;
    align-items: center;
    min-height: 42px;
    margin-top: 22px;
    padding: 0 20px;
    border: 1px solid ${C.proAccent};
    border-radius: 100px;
    background: ${C.proAccent};
    color: ${C.white};
    font: inherit;
    font-size: 13px;
    font-weight: 820;
    cursor: pointer;
    transition: background var(--transition);
  }
  .blog-empty-action:hover { background: ${C.proAccentDark}; }

  .blog-sr-only {
    position: absolute;
    width: 1px; height: 1px;
    margin: -1px; padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  @media (max-width: 600px) {
    /* Pills get their own full-width row; sort sits underneath, right-aligned. */
    .blog-filters { flex-wrap: wrap; gap: 12px; margin-bottom: 22px; }
    /* Let the pill row run to both screen edges and fade out, so it reads as scrollable. */
    .blog-filter-pills {
      flex: 1 1 100%;
      margin: -3px calc(50% - 50vw);
      padding: 3px calc(50vw - 50%);
      -webkit-mask-image: linear-gradient(to right, black calc(100% - 28px), transparent);
      mask-image: linear-gradient(to right, black calc(100% - 28px), transparent);
    }
    .blog-filter-pill { min-height: 44px; padding: 0 16px; }
    .blog-sort { margin-left: auto; }
    .blog-sort-select { min-height: 44px; padding: 0 34px 0 14px; }
    .blog-sort-chevron { right: 12px; }
  }
`;
