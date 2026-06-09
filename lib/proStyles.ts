// ─────────────────────────────────────────────────────────────────────────────
// lib/proStyles.ts
// Inline animation helpers for the professional pricing pages.
//
// The pricing CSS now lives in app/(professional)/pricing/Pricing.module.css.
// These helpers stay here because they produce inline `style` props (not class
// names) and reference the global `fadeUp` / `slideRight` @keyframes defined in
// app/globals.css.
//
// Usage:
//   import { anim } from "@/lib/proStyles"
//   <h1 style={anim.fadeUp(0.1)}>  ← fades up, starts after 0.1s delay
//   <p  style={anim.slideRight()}>  ← slides in from left, no delay
//
// Change the duration (0.65s / 0.5s) or easing to tweak the feel.
// ─────────────────────────────────────────────────────────────────────────────
export const anim = {
  fadeUp:     (delay = 0) => ({ animation: `fadeUp 0.65s ${delay}s cubic-bezier(0.22,1,0.36,1) both` }),
  slideRight: (delay = 0) => ({ animation: `slideRight 0.5s ${delay}s cubic-bezier(0.22,1,0.36,1) both` }),
} as const;
