// ─────────────────────────────────────────────────────────────────────────────
// lib/theme.ts  —  single source of truth for the whole site's color system
//
// TO RETHEME THE ENTIRE SITE: change the 3 lines marked with ← EDIT THIS
// Everything else derives from these values automatically.
// ─────────────────────────────────────────────────────────────────────────────

export const theme = {
  // ── MAIN GRADIENT ──────────────────────────────────────────────────────────
  // Used on logo, headings, buttons, CTAs, pills across every page
  gradient:      "from-violet-500 via-pink-400 to-amber-300",         // ← EDIT THIS (Tailwind classes)
  gradientStyle: "linear-gradient(135deg, #a78bfa, #f9a8d4, #fcd34d)", // ← EDIT THIS (inline CSS, same colors)
  gradientHover: "shadow-violet-400/20",

  // ── HERO BLOBS ─────────────────────────────────────────────────────────────
  // Animated background blobs on the landing page hero
  blob1: "radial-gradient(circle, #a78bfa, #f9a8d4)", // ← EDIT THIS
  blob2: "radial-gradient(circle, #f9a8d4, #fcd34d)",
  blob3: "radial-gradient(circle, #c4b5fd, #a78bfa)",

  // ── PER-PAGE ACCENT COLORS ─────────────────────────────────────────────────
  // Each grad-guide sub-page has its own accent pulled from the gradient
  posing: {
    blob:    "bg-gradient-to-br from-violet-400 to-pink-300",
    pill:    "bg-violet-50 border border-violet-100",
    dot:     "bg-violet-400",
    label:   "text-violet-500",
    divider: "text-violet-400",
    card:    "from-violet-500 to-purple-400",
    cardShadow: "shadow-violet-400/20",
    hover:   "hover:border-violet-200 hover:shadow-lg hover:shadow-violet-400/10",
    cta:     "from-violet-500 via-pink-400 to-amber-300",
    ctaText: "text-violet-600",
  },
  wear: {
    blob:    "bg-gradient-to-br from-pink-300 to-amber-200",
    pill:    "bg-pink-50 border border-pink-100",
    dot:     "bg-pink-400",
    label:   "text-pink-500",
    divider: "text-pink-400",
    card:    "from-pink-400 to-rose-400",
    cardShadow: "shadow-pink-400/20",
    hover:   "hover:border-pink-200 hover:shadow-lg hover:shadow-pink-400/10",
    cta:     "from-pink-400 via-rose-400 to-amber-300",
    ctaText: "text-pink-600",
  },
  prepare: {
    blob:    "bg-gradient-to-br from-amber-300 to-pink-300",
    pill:    "bg-amber-50 border border-amber-100",
    dot:     "bg-amber-400",
    label:   "text-amber-500",
    divider: "text-amber-400",
    card:    "from-amber-300 to-pink-400",
    cardShadow: "shadow-amber-400/20",
    hover:   "hover:border-amber-200 hover:shadow-lg hover:shadow-amber-400/10",
    cta:     "from-amber-300 via-pink-400 to-violet-500",
    ctaText: "text-amber-600",
  },
} as const