# Portal Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the client portal (`/dashboard`, `/login`) with a new light "Gallery Print" design system, and redesign admin Portal Sessions (`/admin/sessions`) into the existing Darkroom theme with a table-first + slide-over-drawer layout.

**Architecture:** Client surfaces get a new token file (`lib/portalTheme.ts`, exported as `G`) plus a shared CSS module, mirroring how the admin Darkroom uses `T` from `app/admin/adminTheme.ts`. The dashboard restructures around an "Active Session Hero"; login becomes a single minimal card; admin Portal Sessions drops its two-column layout for a full-width dark table with the create/edit form in a slide-over drawer. **No API routes, schema, data flow, or feature logic change** — every fetch, handler, and auth path is preserved verbatim.

**Tech Stack:** Next.js App Router, React client components, inline `<style>` CSS (existing pattern), Vitest for unit tests, Google Fonts (Fraunces + IBM Plex Mono, already used by the admin).

**Spec:** `docs/superpowers/specs/2026-06-12-portal-redesign-design.md`

---

## Critical constraints

1. **Do not modify** `lib/adminPortalSessionNavigation.ts` or `tests/unit/adminPortalSessionNavigation.test.ts`. The working tree has uncommitted in-progress changes in `app/components/admin-sessions-dashboard.tsx`, `app/admin/conversation/[id]/page.tsx`, and those two files. Never run `git checkout -- .`, `git stash`, or anything that could discard them. The rewrite of `admin-sessions-dashboard.tsx` in Task 10 **keeps** its imports and usage of `filterAdminPortalSessions` / `resolveAdminPortalSessionFocus` exactly as they are today.
2. Keep every file under 400 lines.
3. No hardcoded hex in components: client surfaces read from `G`, admin surfaces from `T`.
4. `app/admin/ClientPortalPreview.tsx` imports `SessionCard` — the rebuilt card must remain fully self-contained (it carries its own font link + styles). Do not modify `ClientPortalPreview.tsx`.
5. Commit messages use the project format (`type: description` + Co-Authored-By trailer shown in each commit step).

## File structure

| File | Action | Responsibility |
|---|---|---|
| `lib/portalSessionDisplay.ts` | Create | Pure helpers: pick active session, first name, plain-English status phrase |
| `tests/unit/portalSessionDisplay.test.ts` | Create | Unit tests for the above |
| `lib/portalTheme.ts` | Create | `G` — Gallery Print color/type tokens |
| `app/components/portal-styles.ts` | Create | Shared `gp-*` CSS string + fonts URL |
| `app/components/portal-style-tag.tsx` | Create | `<PortalStyleTag/>` — font link + shared styles in one element |
| `app/components/session-progress-tracker.tsx` | Rewrite | Progress tracker, Gallery Print palette (same props) |
| `app/components/session-card.tsx` | Rewrite | Self-contained session detail body (same props) |
| `app/components/client-session-dashboard.tsx` | Rewrite | `/dashboard` — Active Session Hero layout |
| `app/components/login-panel.tsx` | Rewrite | `/login` — Minimal Card (logic preserved) |
| `app/components/admin-session-drawer.tsx` | Create | Darkroom slide-over drawer shell |
| `app/components/admin-session-form.tsx` | Rewrite | Form restyled to `T`, drawer-native (no collapsible header) |
| `app/components/admin-session-table.tsx` | Rewrite | Table cards restyled to `T`, dark status strip |
| `app/components/admin-sessions-dashboard.tsx` | Rewrite | Page restructure: dark canvas, header actions, toolbar, drawer wiring |

Untouched: `app/dashboard/page.tsx`, `app/login/page.tsx`, `app/admin/sessions/page.tsx`, all API routes, `lib/clientSessions.ts`, `lib/adminPortalSessionNavigation.ts`, `app/components/admin-session-status-strip.tsx` (already supports `appearance="dark"`), `app/admin/ClientPortalPreview.tsx`.

---

### Task 1: Portal display helpers (TDD)

**Files:**
- Create: `tests/unit/portalSessionDisplay.test.ts`
- Create: `lib/portalSessionDisplay.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/portalSessionDisplay.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildPortalStatusPhrase,
  getPortalFirstName,
  selectActivePortalSession,
} from "@/lib/portalSessionDisplay";
import type { ClientSessionDTO } from "@/lib/clientSessions";

const BASE: ClientSessionDTO = {
  id: "s1",
  clientEmail: "anna@example.com",
  clientName: "Anna Lee",
  sessionType: "Graduation",
  sessionDate: "2026-06-20",
  location: "Stanford",
  meetingPoint: null,
  currentStatus: "editing",
  estimatedDeliveryDate: null,
  galleryUrl: null,
  invoiceStatus: null,
  contractStatus: null,
  backupStatus: null,
  clientNotes: null,
};

describe("selectActivePortalSession", () => {
  it("returns null for an empty list", () => {
    expect(selectActivePortalSession([])).toBeNull();
  });

  it("prefers the first non-delivered session", () => {
    const delivered = { ...BASE, id: "d1", currentStatus: "delivered" as const };
    const active = { ...BASE, id: "a1" };
    const later = { ...BASE, id: "a2" };
    expect(selectActivePortalSession([delivered, active, later])?.id).toBe("a1");
  });

  it("falls back to the first session when all are delivered", () => {
    const d1 = { ...BASE, id: "d1", currentStatus: "delivered" as const };
    const d2 = { ...BASE, id: "d2", currentStatus: "delivered" as const };
    expect(selectActivePortalSession([d1, d2])?.id).toBe("d1");
  });
});

describe("getPortalFirstName", () => {
  it("returns the first word of the name", () => {
    expect(getPortalFirstName("Anna Lee")).toBe("Anna");
  });

  it("returns null for null or blank names", () => {
    expect(getPortalFirstName(null)).toBeNull();
    expect(getPortalFirstName("   ")).toBeNull();
  });
});

describe("buildPortalStatusPhrase", () => {
  it("describes an in-editing session", () => {
    expect(buildPortalStatusPhrase(BASE)).toBe("your photos are in editing.");
  });

  it("describes a delivered session", () => {
    expect(buildPortalStatusPhrase({ ...BASE, currentStatus: "delivered" })).toBe(
      "your gallery is ready.",
    );
  });

  it("covers every status", () => {
    expect(buildPortalStatusPhrase({ ...BASE, currentStatus: "inquiry_received" })).toBe(
      "we got your inquiry.",
    );
    expect(buildPortalStatusPhrase({ ...BASE, currentStatus: "booked" })).toBe(
      "your session is booked.",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/unit/portalSessionDisplay.test.ts`
Expected: FAIL — cannot resolve `@/lib/portalSessionDisplay`.

- [ ] **Step 3: Write the implementation**

Create `lib/portalSessionDisplay.ts`:

```ts
import type { ClientSessionDTO, ClientSessionStatus } from "@/lib/clientSessions";

// Plain-English phrases for the dashboard hero greeting ("Hi Anna — your
// photos are in editing."). One entry per pipeline status.
const STATUS_PHRASES: Record<ClientSessionStatus, string> = {
  inquiry_received: "we got your inquiry.",
  booking_in_progress: "your booking is in progress.",
  booked: "your session is booked.",
  session_completed: "your session is complete.",
  photos_backed_up: "your photos are safely backed up.",
  culling: "your photos are being selected.",
  editing: "your photos are in editing.",
  final_review: "your gallery is in final review.",
  delivered: "your gallery is ready.",
};

/** Active session = first non-delivered (API returns newest first), else the newest. */
export function selectActivePortalSession(
  sessions: ClientSessionDTO[],
): ClientSessionDTO | null {
  return sessions.find((s) => s.currentStatus !== "delivered") ?? sessions[0] ?? null;
}

export function getPortalFirstName(clientName: string | null): string | null {
  const first = clientName?.trim().split(/\s+/)[0] ?? "";
  return first.length ? first : null;
}

export function buildPortalStatusPhrase(session: ClientSessionDTO): string {
  return STATUS_PHRASES[session.currentStatus];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- tests/unit/portalSessionDisplay.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/portalSessionDisplay.ts tests/unit/portalSessionDisplay.test.ts
git commit -m "feat: portal session display helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Gallery Print theme tokens + shared styles

**Files:**
- Create: `lib/portalTheme.ts`
- Create: `app/components/portal-styles.ts`
- Create: `app/components/portal-style-tag.tsx`

- [ ] **Step 1: Create `lib/portalTheme.ts`**

```ts
// Visual tokens for the client-facing "Gallery Print" theme — the light
// counterpart to the admin Darkroom (app/admin/adminTheme.ts): warm paper
// canvas like a print gallery, the same Fraunces/IBM Plex Mono type system,
// and a deeper print-amber accent that passes AA on light backgrounds.
// Single source for these surfaces so no hex values live inline.

export const G = {
  // Canvas — warm paper white
  page: "#faf8f3",

  // Panels — gallery-white cards on paper
  panel: "#ffffff",
  border: "rgba(40,30,15,0.10)",
  borderStrong: "rgba(40,30,15,0.20)",
  inset: "rgba(40,30,15,0.035)",
  insetBorder: "rgba(40,30,15,0.08)",
  shadow: "0 1px 2px rgba(40,30,15,0.04), 0 12px 32px rgba(40,30,15,0.07)",
  shadowLift: "0 2px 4px rgba(40,30,15,0.05), 0 18px 44px rgba(40,30,15,0.10)",

  // Ink — warm gray ramp
  ink: "#221f1b",
  inkSoft: "#5c554b",
  inkFaint: "#a39a8c",

  // Accent — print amber (deeper sibling of the Darkroom safelight #e8a04c)
  accent: "#b07a35",
  accentBg: "rgba(176,122,53,0.10)",
  accentBorder: "rgba(176,122,53,0.32)",

  // Semantic
  green: "#2e7d52",
  greenBg: "rgba(46,125,82,0.10)",
  greenBorder: "rgba(46,125,82,0.28)",
  red: "#b3473d",
  redBg: "rgba(179,71,61,0.08)",
  redBorder: "rgba(179,71,61,0.25)",

  // Primary button — gallery ink on paper
  dark: "#221f1b",
  darkHover: "#352f27",
  paperText: "#faf8f3",

  // Typography — Fraunces for display, IBM Plex Mono for EXIF-style labels
  display: "'Fraunces', Georgia, 'Times New Roman', serif",
  mono: "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
} as const;
```

- [ ] **Step 2: Create `app/components/portal-styles.ts`**

```ts
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
```

- [ ] **Step 3: Create `app/components/portal-style-tag.tsx`**

```tsx
import { PORTAL_FONTS_URL, PORTAL_STYLES } from "@/app/components/portal-styles";

/** Font link + shared Gallery Print styles. Safe to render more than once. */
export default function PortalStyleTag() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={PORTAL_FONTS_URL} />
      <style>{PORTAL_STYLES}</style>
    </>
  );
}
```

(If eslint does not flag the font link, drop the disable comment — match how `app/admin/page.tsx` renders the same kind of `<link>` without one.)

- [ ] **Step 4: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep -E "portalTheme|portal-styles|portal-style-tag" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 5: Commit**

```bash
git add lib/portalTheme.ts app/components/portal-styles.ts app/components/portal-style-tag.tsx
git commit -m "feat: Gallery Print theme tokens and shared portal styles

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Restyle the session progress tracker

**Files:**
- Rewrite: `app/components/session-progress-tracker.tsx`

Same export, same props (`{ status: ClientSessionStatus }`). It renders inside surfaces that already include `PortalStyleTag`, but stays standalone-safe by only using its own `spt-*` classes plus token values.

- [ ] **Step 1: Replace the entire file content**

```tsx
import {
  CLIENT_SESSION_STATUS_LABELS,
  getClientSessionProgress,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import { G } from "@/lib/portalTheme";

type SessionProgressTrackerProps = {
  status: ClientSessionStatus;
};

const TRACKER_STYLES = `
  .spt-rail {
    height: 3px;
    background: ${G.inset};
    border-radius: 999px;
    overflow: hidden;
    position: relative;
  }

  .spt-fill {
    height: 100%;
    border-radius: inherit;
    background: ${G.accent};
    animation: spt-fill-in 800ms cubic-bezier(0.4, 0, 0.2, 1) 200ms both;
  }
  @keyframes spt-fill-in {
    from { width: 0% !important; }
  }

  .spt-step {
    flex: 1;
    min-width: 0;
    padding: 11px 12px;
    border-radius: 10px;
    border: 1px solid transparent;
    animation: spt-step-in 380ms cubic-bezier(0.22, 0.68, 0, 1.05) both;
  }
  .spt-step:nth-child(1) { animation-delay: 80ms; }
  .spt-step:nth-child(2) { animation-delay: 120ms; }
  .spt-step:nth-child(3) { animation-delay: 160ms; }
  .spt-step:nth-child(4) { animation-delay: 200ms; }
  .spt-step:nth-child(5) { animation-delay: 240ms; }
  .spt-step:nth-child(6) { animation-delay: 280ms; }
  .spt-step:nth-child(7) { animation-delay: 320ms; }
  .spt-step:nth-child(8) { animation-delay: 360ms; }
  .spt-step:nth-child(9) { animation-delay: 400ms; }
  @keyframes spt-step-in {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .spt-step[data-state="completed"] {
    background: ${G.greenBg};
    border-color: ${G.greenBorder};
  }
  .spt-step[data-state="current"] {
    background: ${G.accentBg};
    border-color: ${G.accentBorder};
  }
  .spt-step[data-state="upcoming"] {
    background: transparent;
    border-color: ${G.insetBorder};
  }

  .spt-mono {
    font-family: ${G.mono};
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    .spt-fill, .spt-step { animation: none !important; }
  }
`;

export default function SessionProgressTracker({ status }: SessionProgressTrackerProps) {
  const steps = getClientSessionProgress(status);
  const activeIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  const currentStep = steps[activeIndex] ?? steps[0];
  const nextStep = steps[activeIndex + 1] ?? null;
  const completedCount = steps.filter((s) => s.state === "completed").length;
  const progressPercent = steps.length > 1 ? (activeIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div aria-label={`Current status: ${CLIENT_SESSION_STATUS_LABELS[status]}`}>
      <style>{TRACKER_STYLES}</style>

      {/* Mobile: compact summary */}
      <div className="md:hidden">
        <div style={{
          background: G.inset,
          border: `1px solid ${G.insetBorder}`,
          borderRadius: "12px",
          padding: "16px",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "14px" }}>
            <div>
              <div className="spt-mono" style={{ color: G.inkFaint, marginBottom: "6px" }}>
                Current step
              </div>
              <div style={{ fontSize: "16px", fontWeight: 700, color: G.ink, lineHeight: 1.2 }}>
                {currentStep.label}
              </div>
              {nextStep && (
                <div style={{ marginTop: "4px", fontSize: "12px", color: G.inkSoft }}>
                  Next: {nextStep.label}
                </div>
              )}
            </div>
            <div className="spt-mono" style={{
              color: G.accent,
              background: G.accentBg,
              border: `1px solid ${G.accentBorder}`,
              borderRadius: "6px",
              padding: "5px 9px",
              flexShrink: 0,
            }}>
              {activeIndex + 1} / {steps.length}
            </div>
          </div>

          <div className="spt-rail">
            <div className="spt-fill" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="spt-mono" style={{ color: G.inkFaint, marginTop: "12px" }}>
            {completedCount} completed · {steps.length - activeIndex - 1} remaining
          </div>
        </div>
      </div>

      {/* Desktop: step grid */}
      <div className="hidden md:block">
        <div className="spt-rail" style={{ marginBottom: "14px" }}>
          <div className="spt-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: "6px" }}>
          {steps.map((step, index) => (
            <div key={step.value} className="spt-step" data-state={step.state}>
              <div className="spt-mono" style={{
                color: step.state === "current" ? G.accent : step.state === "completed" ? G.green : G.inkFaint,
                marginBottom: "6px",
              }}>
                {String(index + 1).padStart(2, "0")}
              </div>
              <div style={{
                fontSize: "11px",
                fontWeight: step.state === "current" ? 700 : 500,
                lineHeight: 1.3,
                color: step.state === "current" ? G.ink : step.state === "completed" ? G.inkSoft : G.inkFaint,
              }}>
                {step.label}
              </div>
              {step.state === "current" && (
                <div className="spt-mono" style={{ color: G.accent, marginTop: "6px" }}>Now</div>
              )}
              {step.state === "completed" && (
                <div className="spt-mono" style={{ color: G.green, marginTop: "6px" }}>Done</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

Note: the mobile per-step chip list from the old version is intentionally dropped — the rail + current/next summary covers it (the 9 chips were noise on a phone).

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep "session-progress-tracker" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 3: Commit**

```bash
git add app/components/session-progress-tracker.tsx
git commit -m "feat: restyle session progress tracker to Gallery Print

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Rebuild the session card as a detail body

**Files:**
- Rewrite: `app/components/session-card.tsx`

Same export and props (`{ session: ClientSessionDTO }`). The card no longer renders the big client-name `<h2>` (the dashboard hero greeting owns the headline now); instead it leads with a status chip row. It stays self-contained via `PortalStyleTag` because `ClientPortalPreview` renders it directly.

- [ ] **Step 1: Replace the entire file content**

```tsx
import Link from "next/link";
import {
  CLIENT_SESSION_TIME_ZONE,
  CLIENT_SESSION_STATUS_LABELS,
  formatClientSessionDateTime,
  getClientSessionProgress,
  type ClientSessionDTO,
} from "@/lib/clientSessions";
import { G } from "@/lib/portalTheme";
import PortalStyleTag from "@/app/components/portal-style-tag";
import SessionProgressTracker from "@/app/components/session-progress-tracker";

type SessionCardProps = {
  session: ClientSessionDTO;
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CLIENT_SESSION_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function getSessionIntro(session: ClientSessionDTO) {
  if (session.currentStatus === "delivered") {
    return "Your gallery is ready — use the button below to view your photos.";
  }
  if (session.currentStatus === "inquiry_received") {
    return "Inquiry received. This tracker will move with you from booking through delivery.";
  }
  if (session.currentStatus === "booking_in_progress") {
    return "Getting the details locked in. Once your date, contract, and invoice are confirmed, you'll move into booked.";
  }
  return "This page updates live as your gallery moves through backup, culling, editing, and delivery.";
}

export default function SessionCard({ session }: SessionCardProps) {
  const statusLabel = CLIENT_SESSION_STATUS_LABELS[session.currentStatus];
  const steps = getClientSessionProgress(session.currentStatus);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  const nextStep = steps[currentIndex + 1]?.label ?? "Gallery delivered";
  const delivered = session.currentStatus === "delivered";

  const details = [
    { label: "Date", value: formatClientSessionDateTime(session.sessionDate) },
    { label: "Location", value: session.location },
    { label: "Meeting point", value: session.meetingPoint },
    { label: "Est. delivery", value: formatDate(session.estimatedDeliveryDate) },
    { label: "Invoice", value: session.invoiceStatus },
    { label: "Contract", value: session.contractStatus },
  ];

  return (
    <article className="gp-panel" style={{ overflow: "hidden" }}>
      <PortalStyleTag />
      <div style={{ padding: "24px 26px 28px" }}>

        {/* Status row */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="gp-chip" data-done={delivered}>{statusLabel}</span>
            <span className="gp-mono">Step {currentIndex + 1} of {steps.length}</span>
            {!delivered && <span className="gp-mono">Next: {nextStep}</span>}
          </div>

          {session.galleryUrl && (
            <Link
              href={session.galleryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="gp-btn"
            >
              View gallery
            </Link>
          )}
        </div>

        <p style={{
          marginTop: "12px",
          fontSize: "13px",
          lineHeight: 1.7,
          color: G.inkSoft,
          maxWidth: "520px",
        }}>
          {getSessionIntro(session)}
        </p>

        {/* Progress */}
        <div className="gp-rule" style={{ margin: "22px 0 18px" }} />
        <div className="gp-mono" style={{ marginBottom: "14px" }}>Inquiry to delivery</div>
        <SessionProgressTracker status={session.currentStatus} />

        {/* Details */}
        <div className="gp-rule" style={{ margin: "22px 0 18px" }} />
        <div className="grid gap-2 sm:grid-cols-3">
          {details.map(({ label, value }) => (
            <div key={label} className="gp-tile">
              <div className="gp-mono" style={{ marginBottom: "5px" }}>{label}</div>
              <div style={{
                fontSize: "13px",
                fontWeight: 600,
                color: value && value !== "—" ? G.inkSoft : G.inkFaint,
                overflowWrap: "break-word",
              }}>
                {value || "—"}
              </div>
            </div>
          ))}
        </div>

        {session.clientNotes && (
          <div style={{
            marginTop: "14px",
            background: G.accentBg,
            border: `1px solid ${G.accentBorder}`,
            borderRadius: "10px",
            padding: "16px 18px",
          }}>
            <div className="gp-mono" style={{ color: G.accent, marginBottom: "7px" }}>
              Note from Chris
            </div>
            <p style={{ fontSize: "13px", lineHeight: 1.7, color: G.inkSoft, margin: 0 }}>
              {session.clientNotes}
            </p>
          </div>
        )}

      </div>
    </article>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | grep "session-card" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 3: Commit**

```bash
git add app/components/session-card.tsx
git commit -m "feat: rebuild session card as Gallery Print detail body

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Rebuild the client dashboard (Active Session Hero)

**Files:**
- Rewrite: `app/components/client-session-dashboard.tsx`

Data fetching, auth redirect, and sign-out are preserved exactly. New layout: slim top bar → hero (greeting + active session card) → other sessions as expandable rows → empty/error states.

- [ ] **Step 1: Replace the entire file content**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PortalStyleTag from "@/app/components/portal-style-tag";
import SessionCard from "@/app/components/session-card";
import { G } from "@/lib/portalTheme";
import { buildGmailComposeUrl } from "@/lib/contactEmail";
import {
  CLIENT_SESSION_STATUS_LABELS,
  formatClientSessionDateTime,
  type ClientSessionDTO,
} from "@/lib/clientSessions";
import {
  buildPortalStatusPhrase,
  getPortalFirstName,
  selectActivePortalSession,
} from "@/lib/portalSessionDisplay";
import { supabase } from "@/lib/supabase";

type ClientSessionsResponse = {
  sessions?: ClientSessionDTO[];
  error?: string;
};

const DASHBOARD_STYLES = `
  .pd-row {
    width: 100%;
    text-align: left;
    background: ${G.panel};
    border: 1px solid ${G.border};
    border-radius: 12px;
    padding: 14px 18px;
    cursor: pointer;
    transition: border-color 160ms ease, box-shadow 160ms ease;
  }
  .pd-row:hover { border-color: ${G.borderStrong}; box-shadow: ${G.shadow}; }
  .pd-row[data-open="true"] {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;

export default function ClientSessionDashboard() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ClientSessionDTO[]>([]);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSessions() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const token = session?.access_token;

      if (!token) {
        router.replace("/login?next=/dashboard");
        return;
      }

      setEmail(session.user.email ?? null);

      const res = await fetch("/api/client-sessions", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as ClientSessionsResponse;

      if (!alive) return;
      if (!res.ok) {
        setError(json.error ?? "Could not load your session dashboard.");
        setLoading(false);
        return;
      }

      setSessions(json.sessions ?? []);
      setLoading(false);
    }

    loadSessions().catch((err) => {
      console.error("[client-dashboard]", err);
      if (alive) {
        setError("Could not load your session dashboard.");
        setLoading(false);
      }
    });

    return () => { alive = false; };
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  const contactChrisUrl = buildGmailComposeUrl({
    subject: "SoloXSnaps client portal question",
    body: email
      ? `Hi Chris,\n\nI'm reaching out from the client portal.\n\nMy account email: ${email}\n\nQuestion:\n`
      : "Hi Chris,\n\nI'm reaching out from the client portal.\n\nQuestion:\n",
  });

  const activeSession = selectActivePortalSession(sessions);
  const otherSessions = activeSession
    ? sessions.filter((s) => s.id !== activeSession.id)
    : [];
  const firstName = activeSession ? getPortalFirstName(activeSession.clientName) : null;

  if (loading) {
    return (
      <main className="gp-root px-5 py-8 md:px-8 md:py-10">
        <PortalStyleTag />
        <div className="mx-auto max-w-4xl">
          <div className="gp-skeleton mb-8 h-8 w-56" />
          <div className="gp-skeleton mb-4 h-24 w-full max-w-xl" />
          <div className="gp-skeleton h-80 w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="gp-root px-5 py-8 md:px-8 md:py-10">
      <PortalStyleTag />
      <style>{DASHBOARD_STYLES}</style>

      <div className="mx-auto max-w-4xl">

        {/* Top bar */}
        <header className="gp-in mb-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="gp-mono" style={{ color: G.accent, textDecoration: "none" }}>
            Soloxsnaps · Client Gallery
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {email && <span className="gp-mono" style={{ marginRight: "4px" }}>{email}</span>}
            <a href={contactChrisUrl} target="_blank" rel="noopener noreferrer" className="gp-ghost">
              Email Chris
            </a>
            <button type="button" onClick={signOut} className="gp-ghost">
              Sign out
            </button>
          </div>
        </header>

        {error ? (
          <div className="gp-panel gp-in" style={{ padding: "26px 28px" }}>
            <p style={{ fontSize: "13px", fontWeight: 600, color: G.red, margin: 0 }}>{error}</p>
          </div>
        ) : !activeSession ? (
          /* Empty state */
          <div className="gp-panel gp-in" style={{ padding: "34px 32px" }}>
            <h1 className="gp-display" style={{ fontSize: "clamp(1.8rem, 4vw, 2.6rem)", margin: 0, lineHeight: 1.1 }}>
              No linked session<br />
              <em style={{ fontStyle: "italic", color: G.inkSoft }}>yet.</em>
            </h1>
            <p style={{ marginTop: "14px", fontSize: "13px", color: G.inkSoft, lineHeight: 1.7, maxWidth: "420px" }}>
              No session is connected to this email. If you recently booked, your
              session may not be linked yet — send a note and Chris will connect it.
            </p>
            <div style={{ marginTop: "24px", display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <a href={contactChrisUrl} target="_blank" rel="noopener noreferrer" className="gp-btn">
                Email Chris
              </a>
              <Link href="/" className="gp-ghost">Return to main site</Link>
            </div>
          </div>
        ) : (
          <>
            {/* Hero: active session */}
            <section className="gp-in" style={{ animationDelay: "60ms" }}>
              <div className="gp-mono" style={{ color: G.accent, marginBottom: "12px" }}>
                {[activeSession.sessionType, formatClientSessionDateTime(activeSession.sessionDate)]
                  .filter(Boolean)
                  .join(" · ") || "Your session"}
              </div>
              <h1 className="gp-display" style={{
                fontSize: "clamp(2rem, 5vw, 3.2rem)",
                lineHeight: 1.08,
                margin: 0,
                maxWidth: "640px",
              }}>
                {firstName ? `Hi ${firstName} —` : "Welcome back —"}<br />
                <em style={{ fontStyle: "italic", color: G.inkSoft }}>
                  {buildPortalStatusPhrase(activeSession)}
                </em>
              </h1>
              <div style={{ marginTop: "26px" }}>
                <SessionCard session={activeSession} />
              </div>
            </section>

            {/* Other sessions */}
            {otherSessions.length > 0 && (
              <section className="gp-in" style={{ animationDelay: "140ms", marginTop: "40px" }}>
                <div className="gp-mono" style={{ marginBottom: "12px" }}>Other sessions</div>
                <div className="flex flex-col gap-2.5">
                  {otherSessions.map((session) => {
                    const open = expandedId === session.id;
                    const delivered = session.currentStatus === "delivered";
                    return (
                      <div key={session.id}>
                        <button
                          type="button"
                          className="pd-row"
                          data-open={open}
                          onClick={() => setExpandedId(open ? null : session.id)}
                          aria-expanded={open}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="gp-display" style={{ fontSize: "17px", lineHeight: 1.25 }}>
                                {session.sessionType || "Photo session"}
                              </div>
                              <div className="gp-mono" style={{ marginTop: "4px" }}>
                                {formatClientSessionDateTime(session.sessionDate)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <span className="gp-chip" data-done={delivered}>
                                {CLIENT_SESSION_STATUS_LABELS[session.currentStatus]}
                              </span>
                              <span aria-hidden style={{ color: G.inkFaint, fontSize: "12px" }}>
                                {open ? "▴" : "▾"}
                              </span>
                            </div>
                          </div>
                        </button>
                        {open && <SessionCard session={session} />}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Footer line */}
            <p className="gp-mono gp-in" style={{ animationDelay: "200ms", marginTop: "40px", letterSpacing: "0.1em" }}>
              Securely matched to your account email — only your linked sessions appear here.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify compile + tests + lint**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: tsc clean, all vitest suites pass, lint clean.

- [ ] **Step 3: Visual check**

Run `npm run dev`, open `http://localhost:3000/dashboard` (sign in as a client account, or use the admin "Preview" on /admin/sessions later). Verify: paper background, mono top bar, serif greeting with status phrase, progress tracker, detail tiles, expandable other-session rows at desktop and ~375px width.

- [ ] **Step 4: Commit**

```bash
git add app/components/client-session-dashboard.tsx
git commit -m "feat: redesign client dashboard as Active Session Hero

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Rebuild the login panel (Minimal Card)

**Files:**
- Rewrite: `app/components/login-panel.tsx`

ALL state, handlers, and auth calls are copied verbatim from the current file — only the returned JSX and styles change. The 01/02/03 feature list is removed.

- [ ] **Step 1: Replace the entire file content**

```tsx
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import PortalStyleTag from "@/app/components/portal-style-tag";
import { G } from "@/lib/portalTheme";
import { supabase } from "@/lib/supabase";

type AuthMeResponse = {
  user?: { id: string; email: string | null };
  is_admin?: boolean;
  error?: string;
};

type EmailAuthMode = "signin" | "signup";

function getSafeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

const LOGIN_STYLES = `
  .lp-card {
    width: 100%;
    max-width: 420px;
    background: ${G.panel};
    border: 1px solid ${G.border};
    border-radius: 18px;
    box-shadow: ${G.shadowLift};
    padding: 32px 32px 36px;
    animation: lp-card-in 600ms cubic-bezier(0.22, 0.68, 0, 1.05) both;
  }
  @keyframes lp-card-in {
    from { opacity: 0; transform: translateY(18px) scale(0.985); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .lp-pw-wrap { position: relative; width: 100%; }
  .lp-pw-wrap .gp-input { padding-right: 44px; }
  .lp-pw-toggle {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: ${G.inkFaint};
    display: flex;
    align-items: center;
    transition: color 160ms ease;
  }
  .lp-pw-toggle:hover { color: ${G.inkSoft}; }

  @media (prefers-reduced-motion: reduce) {
    .lp-card { animation: none !important; }
  }
  @media (max-width: 480px) {
    .lp-card { padding: 26px 22px 30px; }
  }
`;

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export default function LoginPanel() {
  const searchParams = useSearchParams();
  const nextPath = getSafeNext(searchParams.get("next"));
  const [email, setEmail] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailAuthMode, setEmailAuthMode] = useState<EmailAuthMode>("signin");
  const [emailInput, setEmailInput] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadSession() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      const token = session?.access_token;

      if (!token) {
        if (alive) setLoading(false);
        return;
      }

      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json() as AuthMeResponse;

      if (!alive) return;
      setEmail(json.user?.email ?? session.user.email ?? null);
      setIsAdmin(Boolean(json.is_admin));
      setLoading(false);
    }

    loadSession().catch(() => {
      if (alive) setLoading(false);
    });

    return () => { alive = false; };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setEmail(null);
    setIsAdmin(false);
  }

  async function provisionSession(token: string) {
    await fetch("/api/auth/provision-session", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    if (emailAuthMode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      if (emailAuthMode === "signup") {
        const { error: signUpError, data: signUpData } = await supabase.auth.signUp({ email: emailInput, password });
        if (signUpError) { setError(signUpError.message); return; }
        if (signUpData.session) {
          await provisionSession(signUpData.session.access_token);
          window.location.href = nextPath;
          return;
        }
        setSuccessMsg("Check your email to confirm your account, then sign in.");
        setEmailAuthMode("signin");
      } else {
        const { error: signInError, data: signInData } = await supabase.auth.signInWithPassword({ email: emailInput, password });
        if (signInError) { setError(signInError.message); return; }
        if (signInData.session) {
          await provisionSession(signInData.session.access_token);
        }
        window.location.href = nextPath;
      }
    } finally {
      setSubmitting(false);
    }
  }

  const signup = emailAuthMode === "signup";

  return (
    <main className="gp-root flex min-h-screen items-center justify-center px-5 py-10">
      <PortalStyleTag />
      <style>{LOGIN_STYLES}</style>

      <div className="lp-card">

        {/* Brand row */}
        <div className="flex items-center justify-between">
          <Link href="/" className="gp-mono" style={{ color: G.accent, textDecoration: "none" }}>
            SoloXSnaps
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
            <div className="gp-dot" />
            <span className="gp-mono">Secure</span>
          </div>
        </div>

        {/* Heading */}
        <h1 className="gp-display" style={{
          marginTop: "26px",
          marginBottom: 0,
          fontSize: "clamp(1.9rem, 5vw, 2.4rem)",
          lineHeight: 1.1,
        }}>
          {email ? "You're signed" : signup ? "Create your" : "Welcome"}<br />
          <em style={{ fontStyle: "italic", color: G.inkSoft }}>
            {email ? "in." : signup ? "account." : "back."}
          </em>
        </h1>
        <p style={{ marginTop: "12px", fontSize: "13px", lineHeight: 1.7, color: G.inkSoft, maxWidth: "300px" }}>
          {email
            ? "Head to your dashboard to follow your session."
            : "Sign in to follow your session from booking to gallery."}
        </p>

        <div className="gp-rule" style={{ margin: "24px 0" }} />

        {/* Auth area */}
        {loading ? (
          <div className="gp-skeleton" style={{ height: "46px", width: "100%" }} />
        ) : email ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div className="gp-tile">
              <div className="gp-mono" style={{ marginBottom: "5px" }}>Signed in as</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: G.inkSoft, wordBreak: "break-all" }}>
                {email}
              </div>
            </div>

            <Link href="/dashboard" className="gp-btn">Go to dashboard</Link>

            {isAdmin && (
              <Link href="/admin/sessions" className="gp-ghost">Open Portal Sessions</Link>
            )}

            <button type="button" onClick={signOut} className="gp-ghost">Sign out</button>
          </div>
        ) : (
          <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              className="gp-input"
              type="email"
              placeholder="your@email.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              required
              autoComplete="email"
            />
            <div className="lp-pw-wrap">
              <input
                className="gp-input"
                type={showPassword ? "text" : "password"}
                placeholder="Password (min 8 characters)"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete={signup ? "new-password" : "current-password"}
              />
              <button type="button" className="lp-pw-toggle" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <EyeIcon off={showPassword} />
              </button>
            </div>
            {signup && (
              <div className="lp-pw-wrap">
                <input
                  className="gp-input"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
                <button type="button" className="lp-pw-toggle" onClick={() => setShowConfirmPassword(v => !v)} aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
                  <EyeIcon off={showConfirmPassword} />
                </button>
              </div>
            )}
            <button type="submit" className="gp-btn" disabled={submitting}>
              {submitting ? "Please wait…" : signup ? "Create account" : "Sign in"}
            </button>
            <button
              type="button"
              className="gp-ghost"
              onClick={() => {
                setEmailAuthMode(signup ? "signin" : "signup");
                setError(null);
                setSuccessMsg(null);
                setConfirmPassword("");
              }}
            >
              {signup ? "Already have an account? Sign in" : "No account? Create one"}
            </button>
            {successMsg && (
              <p style={{ fontSize: "12px", fontWeight: 600, color: G.green, margin: 0, textAlign: "center" }}>
                {successMsg}
              </p>
            )}
            {error && (
              <p style={{ fontSize: "12px", fontWeight: 600, color: G.red, margin: 0 }}>
                {error}
              </p>
            )}
          </form>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Verify compile + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Visual check**

`npm run dev` → `http://localhost:3000/login`. Verify: card centered, form above the fold at 375×667, sign-in/sign-up toggle swaps heading, password eye toggles, signed-in state shows dashboard/portal/sign-out actions.

- [ ] **Step 4: Commit**

```bash
git add app/components/login-panel.tsx
git commit -m "feat: redesign portal login as minimal Gallery Print card

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Admin slide-over drawer component

**Files:**
- Create: `app/components/admin-session-drawer.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useEffect } from "react";
import { T } from "@/app/admin/adminTheme";

type AdminSessionDrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

/** Darkroom slide-over: right-side panel above the scrim, Escape/✕/scrim-click to close. */
export default function AdminSessionDrawer({ open, title, onClose, children }: AdminSessionDrawerProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: T.scrim, backdropFilter: "blur(6px)" }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <aside
        role="dialog"
        aria-label={title}
        className="h-full w-full max-w-2xl overflow-y-auto border-l p-5 md:p-7"
        style={{ background: T.panelSolid, borderColor: T.border, boxShadow: T.shadow }}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-2xl" style={{ color: T.ink, fontFamily: T.display, fontWeight: 600 }}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="h-10 w-10 flex-shrink-0 rounded-lg border text-sm font-black"
            style={{ background: T.panel, borderColor: T.border, color: T.inkSoft }}
          >
            ✕
          </button>
        </div>
        {children}
      </aside>
    </div>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep "admin-session-drawer" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 3: Commit**

```bash
git add app/components/admin-session-drawer.tsx
git commit -m "feat: Darkroom slide-over drawer for admin sessions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Restyle the admin session form for the drawer

**Files:**
- Rewrite: `app/components/admin-session-form.tsx`

Changes: swap `C` → `T` tokens, remove the collapsible header and `open` state (the drawer owns title/close/cancel), keep `ADMIN_SESSION_FORM_ID`, `data-admin-session-primary`, payload type, contacts select, Gmail notes pull, and submit behavior. The `onCancelEdit` prop is removed (drawer close covers it).

- [ ] **Step 1: Replace the entire file content**

```tsx
"use client";

import { useEffect, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import {
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import type { ClientSessionContactOption } from "@/lib/clientSessionContacts";

export const ADMIN_SESSION_FORM_ID = "admin-session-form";

export type AdminSessionFormPayload = {
  clientEmail: string;
  clientName: string;
  sessionType: string;
  sessionDate: string;
  location: string;
  meetingPoint: string;
  currentStatus: ClientSessionStatus;
  estimatedDeliveryDate: string;
  galleryUrl: string;
  invoiceStatus: string;
  contractStatus: string;
  backupStatus: string;
  internalNotes: string;
  clientNotes: string;
};

type AdminSessionFormProps = {
  initialSession?: AdminClientSessionDTO | null;
  contacts: ClientSessionContactOption[];
  saving: boolean;
  onSubmit: (payload: AdminSessionFormPayload) => Promise<void>;
};

const BLANK_FORM: AdminSessionFormPayload = {
  clientEmail: "",
  clientName: "",
  sessionType: "",
  sessionDate: "",
  location: "",
  meetingPoint: "",
  currentStatus: "inquiry_received",
  estimatedDeliveryDate: "",
  galleryUrl: "",
  invoiceStatus: "",
  contractStatus: "",
  backupStatus: "",
  internalNotes: "",
  clientNotes: "",
};

const INVOICE_OPTS = ["Not Sent", "Sent", "Paid", "Overdue"];
const CONTRACT_OPTS = ["Not Sent", "Sent", "Signed"];
const BACKUP_OPTS = ["Not Started", "In Progress", "Done"];

const INPUT_STYLE = { background: T.inset, borderColor: T.border, color: T.ink } as const;

function toDateTimeInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toForm(session: AdminClientSessionDTO | null | undefined): AdminSessionFormPayload {
  if (!session) return BLANK_FORM;

  return {
    clientEmail: session.clientEmail,
    clientName: session.clientName ?? "",
    sessionType: session.sessionType ?? "",
    sessionDate: toDateTimeInput(session.sessionDate),
    location: session.location ?? "",
    meetingPoint: session.meetingPoint ?? "",
    currentStatus: session.currentStatus,
    estimatedDeliveryDate: session.estimatedDeliveryDate ?? "",
    galleryUrl: session.galleryUrl ?? "",
    invoiceStatus: session.invoiceStatus ?? "",
    contractStatus: session.contractStatus ?? "",
    backupStatus: session.backupStatus ?? "",
    internalNotes: session.internalNotes ?? "",
    clientNotes: session.clientNotes ?? "",
  };
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="text-[10px] font-bold uppercase tracking-[0.18em]"
      style={{ color: T.action, fontFamily: T.mono }}
    >
      {children}
    </label>
  );
}

function StatusBtns({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opts.map((opt) => (
        <button key={opt} type="button" onClick={() => onChange(value === opt ? "" : opt)}
          className="rounded-lg border px-3 py-1.5 text-xs font-black transition-colors"
          style={{
            background: value === opt ? T.action : T.inset,
            borderColor: value === opt ? T.action : T.border,
            color: value === opt ? T.actionText : T.inkSoft,
          }}>
          {opt}
        </button>
      ))}
    </div>
  );
}

export default function AdminSessionForm({
  initialSession,
  contacts,
  saving,
  onSubmit,
}: AdminSessionFormProps) {
  const [form, setForm] = useState<AdminSessionFormPayload>(toForm(initialSession));
  const [notesLoading, setNotesLoading] = useState(false);
  const editing = Boolean(initialSession);

  useEffect(() => {
    setForm(toForm(initialSession));
  }, [initialSession]);

  function update<K extends keyof AdminSessionFormPayload>(key: K, value: AdminSessionFormPayload[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectContact(contactId: string) {
    const contact = contacts.find((item) => item.id === contactId);
    if (!contact) return;

    setForm((prev) => ({
      ...prev,
      clientEmail: contact.email,
      clientName: contact.name ?? prev.clientName,
      sessionType: contact.sessionType ?? prev.sessionType,
      sessionDate: contact.sessionDate ? toDateTimeInput(contact.sessionDate) : prev.sessionDate,
      location: contact.location ?? prev.location,
    }));
  }

  async function fetchNotes() {
    if (!form.clientEmail) return;
    setNotesLoading(true);
    try {
      const res = await fetch(`/api/admin/client-notes?email=${encodeURIComponent(form.clientEmail)}`);
      const json = await res.json();
      if (!res.ok) { console.error("[client-notes]", json.error); return; }
      if (json.notes) update("clientNotes", json.notes);
    } catch (err) {
      console.error("[client-notes]", err);
    } finally {
      setNotesLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(form);
    if (!editing) setForm(BLANK_FORM);
  }

  return (
    <form id={ADMIN_SESSION_FORM_ID} onSubmit={handleSubmit}>
      {editing && (
        <div className="mb-5 rounded-lg border p-4" style={{ background: T.inset, borderColor: T.border }}>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.action, fontFamily: T.mono }}>
            Editing now
          </div>
          <p className="mt-1 break-words text-sm font-bold" style={{ color: T.ink }}>
            {initialSession?.clientName || "Unnamed client"} {initialSession?.clientEmail ? `(${initialSession.clientEmail})` : ""}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5" style={{ color: T.inkFaint }}>
            {initialSession?.clientUserId
              ? "This session is already linked to a Google account. That link will stay intact unless you change the client email."
              : "This session will link to the client automatically the first time they sign in with the matching Google email."}
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {contacts.length > 0 && (
          <div className="grid gap-2 md:col-span-2">
            <FieldLabel>Choose existing client</FieldLabel>
            <select
              defaultValue=""
              onChange={(event) => selectContact(event.target.value)}
              className="min-h-11 rounded-lg border px-3 text-sm font-semibold outline-none"
              style={INPUT_STYLE}
            >
              <option value="">Select from inquiries or past sessions</option>
              {contacts.map((contact) => (
                <option key={contact.id} value={contact.id}>
                  {contact.name || contact.email} - {contact.email}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid gap-2">
          <FieldLabel>Client email</FieldLabel>
          <input
            required
            type="email"
            value={form.clientEmail}
            onChange={(event) => update("clientEmail", event.target.value)}
            data-admin-session-primary
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Client name</FieldLabel>
          <input
            value={form.clientName}
            onChange={(event) => update("clientName", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Session type</FieldLabel>
          <input
            value={form.sessionType}
            onChange={(event) => update("sessionType", event.target.value)}
            placeholder="Graduation, family, couples..."
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Session date</FieldLabel>
          <input
            type="datetime-local"
            value={form.sessionDate}
            onChange={(event) => update("sessionDate", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Location</FieldLabel>
          <input
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Meeting point</FieldLabel>
          <input
            value={form.meetingPoint}
            onChange={(event) => update("meetingPoint", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Status</FieldLabel>
          <select
            value={form.currentStatus}
            onChange={(event) => update("currentStatus", event.target.value as ClientSessionStatus)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          >
            {CLIENT_SESSION_STATUS_VALUES.map((status) => (
              <option key={status} value={status}>{CLIENT_SESSION_STATUS_LABELS[status]}</option>
            ))}
          </select>
        </div>

        <div className="grid gap-2">
          <FieldLabel>Estimated delivery</FieldLabel>
          <input
            type="date"
            value={form.estimatedDeliveryDate}
            onChange={(event) => update("estimatedDeliveryDate", event.target.value)}
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Gallery URL</FieldLabel>
          <input
            type="url"
            value={form.galleryUrl}
            onChange={(event) => update("galleryUrl", event.target.value)}
            placeholder="https://..."
            className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Invoice status</FieldLabel>
          <StatusBtns value={form.invoiceStatus} onChange={(v) => update("invoiceStatus", v)} opts={INVOICE_OPTS} />
        </div>

        <div className="grid gap-2">
          <FieldLabel>Contract status</FieldLabel>
          <StatusBtns value={form.contractStatus} onChange={(v) => update("contractStatus", v)} opts={CONTRACT_OPTS} />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Backup status</FieldLabel>
          <StatusBtns value={form.backupStatus} onChange={(v) => update("backupStatus", v)} opts={BACKUP_OPTS} />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <div className="flex items-center justify-between">
            <FieldLabel>Client notes</FieldLabel>
            {form.clientEmail && (
              <button
                type="button"
                onClick={fetchNotes}
                disabled={notesLoading}
                className="rounded-lg border px-2 py-1 text-[10px] font-black disabled:opacity-50"
                style={{ background: T.amberBg, borderColor: T.amberBorder, color: T.amber }}
              >
                {notesLoading ? "Pulling..." : "Pull from Gmail"}
              </button>
            )}
          </div>
          <textarea
            value={form.clientNotes}
            onChange={(event) => update("clientNotes", event.target.value)}
            rows={3}
            className="w-full min-w-0 rounded-lg border px-3 py-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>

        <div className="grid gap-2 md:col-span-2">
          <FieldLabel>Internal notes</FieldLabel>
          <textarea
            value={form.internalNotes}
            onChange={(event) => update("internalNotes", event.target.value)}
            rows={3}
            className="w-full min-w-0 rounded-lg border px-3 py-3 text-sm font-semibold outline-none"
            style={INPUT_STYLE}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={saving}
        className="mt-6 min-h-12 w-full rounded-lg px-5 text-sm font-black disabled:opacity-60"
        style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}
      >
        {saving ? "Saving..." : editing ? "Save session" : "Create session"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Verify compile**

Run: `npx tsc --noEmit 2>&1 | grep -v "admin-sessions-dashboard" | grep "admin-session-form" || echo CLEAN`
Expected: `CLEAN`. (`admin-sessions-dashboard.tsx` will now have errors — it still passes `onCancelEdit` and imports the old layout. That is expected and fixed in Task 10; do not commit in between with a broken build... see Step 3.)

- [ ] **Step 3: Hold the commit**

Do **not** commit yet — `admin-sessions-dashboard.tsx` references the removed `onCancelEdit` prop until Task 10. Continue straight to Task 9 and commit all three admin tasks together at the end of Task 10.

---

### Task 9: Restyle the admin session table to Darkroom

**Files:**
- Rewrite: `app/components/admin-session-table.tsx`

Same props, same handlers, same inline-edit behavior. Token swap to `T`, plus `appearance="dark"` on the status strip.

- [ ] **Step 1: Replace the entire file content**

```tsx
"use client";

import { type ReactNode, useState } from "react";
import { T } from "@/app/admin/adminTheme";
import AdminSessionStatusStrip from "@/app/components/admin-session-status-strip";
import {
  CLIENT_SESSION_STATUS_LABELS,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";

type AdminSessionTableProps = {
  sessions: AdminClientSessionDTO[];
  onEdit: (session: AdminClientSessionDTO) => void;
  onPreview: (email: string) => void;
  onUpdateStatus: (session: AdminClientSessionDTO, status: ClientSessionStatus) => void;
  statusSaving: { id: string; status: ClientSessionStatus } | null;
  gmailSyncing: string | null;
  onSyncFromGmail: (session: AdminClientSessionDTO) => void;
  onDelete: (session: AdminClientSessionDTO) => void;
  onUnlinkAccount: (session: AdminClientSessionDTO) => void;
  onUpdateInvoice: (session: AdminClientSessionDTO, status: string | null) => void;
  onUpdateContract: (session: AdminClientSessionDTO, status: string | null) => void;
  onUpdateField: (session: AdminClientSessionDTO, fields: Record<string, unknown>) => void;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  deletingId?: string | null;
  unlinkingId?: string | null;
};

const INVOICE_CYCLE: Array<string | null> = [null, "sent", "paid"];
const CONTRACT_CYCLE: Array<string | null> = [null, "sent", "signed"];

function nextInCycle(cycle: Array<string | null>, current: string | null): string | null {
  const normalized = current?.trim().toLowerCase() || null;
  const idx = cycle.indexOf(normalized);
  return cycle[(idx + 1) % cycle.length];
}

function invoiceLabel(status: string | null) {
  const s = status?.trim().toLowerCase() || null;
  if (s === "paid") return { label: "Invoice Paid", bg: T.greenBg, color: T.green };
  if (s === "sent") return { label: "Invoice Sent", bg: T.amberBg, color: T.amber };
  return { label: "No Invoice", bg: T.neutralBg, color: T.inkFaint };
}

function contractLabel(status: string | null) {
  const s = status?.trim().toLowerCase() || null;
  if (s === "signed") return { label: "Contract Signed", bg: T.greenBg, color: T.green };
  if (s === "sent")   return { label: "Contract Sent",   bg: T.amberBg, color: T.amber };
  return { label: "No Contract", bg: T.neutralBg, color: T.inkFaint };
}

function toDatetimeLocalString(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(value: string | null) {
  if (!value) return "No date";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(value + "T12:00:00") : new Date(value);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

function formatDateTime(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(value));
}

function getLinkStatus(session: AdminClientSessionDTO) {
  return session.clientUserId ? "Google linked" : "Waiting for first login";
}

export default function AdminSessionTable({
  sessions,
  onEdit,
  onPreview,
  onUpdateStatus,
  statusSaving,
  gmailSyncing,
  onSyncFromGmail,
  onDelete,
  onUnlinkAccount,
  onUpdateInvoice,
  onUpdateContract,
  onUpdateField,
  onMoveUp,
  onMoveDown,
  deletingId,
  unlinkingId,
}: AdminSessionTableProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [inlineEdit, setInlineEdit] = useState<{ sessionId: string; field: string; value: string } | null>(null);

  function commitEdit(session: AdminClientSessionDTO) {
    if (!inlineEdit) return;
    onUpdateField(session, { [inlineEdit.field]: inlineEdit.value.trim() || null });
    setInlineEdit(null);
  }

  function renderInlineField(
    session: AdminClientSessionDTO,
    field: string,
    currentValue: string | null,
    display: ReactNode,
    inputType: string,
  ) {
    const isEditing = inlineEdit?.sessionId === session.id && inlineEdit.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          type={inputType}
          value={inlineEdit.value}
          onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
          onBlur={() => commitEdit(session)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit(session);
            if (e.key === "Escape") setInlineEdit(null);
          }}
          className="w-full rounded border px-1 py-0.5 text-sm font-semibold outline-none"
          style={{ borderColor: T.amberBorder, color: T.ink, background: T.inset }}
        />
      );
    }
    return (
      <div
        className="cursor-pointer rounded font-semibold transition-colors hover:bg-white/5"
        style={{ color: currentValue ? T.inkSoft : T.inkFaint }}
        onClick={() => setInlineEdit({ sessionId: session.id, field, value: currentValue ?? "" })}
        title="Click to edit"
      >
        {display}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="rounded-xl border p-6" style={{ background: T.panel, borderColor: T.border }}>
        <h2 className="text-xl" style={{ color: T.ink, fontFamily: T.display, fontWeight: 600 }}>No sessions found</h2>
        <p className="mt-2 text-sm font-semibold" style={{ color: T.inkFaint }}>
          Create a session or adjust the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {sessions.map((session, index) => {
        const inv = invoiceLabel(session.invoiceStatus);
        const con = contractLabel(session.contractStatus);
        const isDeleteConfirming = deleteConfirmId === session.id;
        const isDeleting = deletingId === session.id;
        const isUnlinking = unlinkingId === session.id;
        const isFirst = index === 0;
        const isLast = index === sessions.length - 1;

        return (
          <article
            key={session.id}
            className="overflow-hidden rounded-xl border p-4"
            style={{ background: T.panel, borderColor: T.border, boxShadow: T.shadow }}
          >
            {/* Top row: status label + reorder + action buttons */}
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.action, fontFamily: T.mono }}>
                    {CLIENT_SESSION_STATUS_LABELS[session.currentStatus]}
                  </div>
                  <span
                    className="rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em]"
                    style={{
                      background: session.clientUserId ? T.greenBg : T.neutralBg,
                      color: session.clientUserId ? T.green : T.inkFaint,
                    }}
                  >
                    {getLinkStatus(session)}
                  </span>
                  {session.googleLinkedAt && (
                    <span className="text-[10px] font-semibold" style={{ color: T.inkFaint }}>
                      Signed in {formatDateTime(session.googleLinkedAt)}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 text-lg" style={{ color: T.ink, fontFamily: T.display, fontWeight: 600 }}>
                  {session.clientName || "Unnamed client"}
                </h3>
                <p className="mt-1 break-all text-sm font-semibold" style={{ color: T.inkFaint, fontFamily: T.mono, fontSize: "12px" }}>
                  {session.clientEmail}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 md:flex-nowrap">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveUp(session.id)}
                    disabled={isFirst}
                    title="Move up"
                    className="min-h-10 w-10 rounded-lg border text-base font-black disabled:opacity-25"
                    style={{ background: T.inset, borderColor: T.border, color: T.inkSoft }}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveDown(session.id)}
                    disabled={isLast}
                    title="Move down"
                    className="min-h-10 w-10 rounded-lg border text-base font-black disabled:opacity-25"
                    style={{ background: T.inset, borderColor: T.border, color: T.inkSoft }}
                  >
                    ↓
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => onSyncFromGmail(session)}
                  disabled={gmailSyncing === session.id}
                  className="min-h-10 rounded-lg border px-3 text-sm font-black"
                  style={{ background: T.amberBg, borderColor: T.amberBorder, color: T.amber, opacity: gmailSyncing === session.id ? 0.6 : 1 }}
                >
                  {gmailSyncing === session.id ? "Syncing…" : "Sync Gmail"}
                </button>
                <button
                  type="button"
                  onClick={() => onPreview(session.clientEmail)}
                  className="min-h-10 rounded-lg border px-3 text-sm font-black"
                  style={{ background: T.blueBg, borderColor: T.blueBorder, color: T.blue }}
                >
                  Preview
                </button>
                <button
                  type="button"
                  onClick={() => onEdit(session)}
                  className="min-h-10 rounded-lg border px-4 text-sm font-black"
                  style={{ background: T.inset, borderColor: T.borderStrong, color: T.ink }}
                >
                  Edit
                </button>
              </div>
            </div>

            {/* Invoice + Contract quick-toggle pills */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onUpdateInvoice(session, nextInCycle(INVOICE_CYCLE, session.invoiceStatus))}
                className="rounded-full px-3 py-1 text-[11px] font-black transition-opacity hover:opacity-75"
                style={{ background: inv.bg, color: inv.color }}
                title="Click to advance invoice status"
              >
                {inv.label} →
              </button>
              <button
                type="button"
                onClick={() => onUpdateContract(session, nextInCycle(CONTRACT_CYCLE, session.contractStatus))}
                className="rounded-full px-3 py-1 text-[11px] font-black transition-opacity hover:opacity-75"
                style={{ background: con.bg, color: con.color }}
                title="Click to advance contract status"
              >
                {con.label} →
              </button>
            </div>

            {/* Progress strip */}
            <div className="mt-4 rounded-xl border p-3" style={{ background: T.inset, borderColor: T.rowBorder }}>
              <div className="text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.action, fontFamily: T.mono }}>
                Portal progress
              </div>
              <p className="mt-1 text-xs font-semibold" style={{ color: T.inkFaint }}>
                Click any stage and the client dashboard updates to match.
              </p>
              <div className="mt-3">
                <AdminSessionStatusStrip
                  appearance="dark"
                  currentStatus={session.currentStatus}
                  savingStatus={statusSaving?.id === session.id ? statusSaving.status : null}
                  onSelect={(status) => onUpdateStatus(session, status)}
                />
              </div>
            </div>

            {/* Session details — click any value to edit inline */}
            <div className="mt-4 grid gap-2 text-sm md:grid-cols-4">
              <div className="min-w-0">
                <span className="font-black" style={{ color: T.ink }}>Type</span>
                {renderInlineField(
                  session,
                  "sessionType",
                  session.sessionType,
                  <span className="break-words">{session.sessionType || "Not set"}</span>,
                  "text",
                )}
              </div>
              <div className="min-w-0">
                <span className="font-black" style={{ color: T.ink }}>Date &amp; Time</span>
                {renderInlineField(
                  session,
                  "sessionDate",
                  toDatetimeLocalString(session.sessionDate),
                  <>
                    {formatDate(session.sessionDate)}
                    {session.sessionDate && formatDateTime(session.sessionDate) !== formatDate(session.sessionDate) && (
                      <span className="ml-1 text-[11px]" style={{ color: T.amber }}>
                        {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(session.sessionDate))}
                      </span>
                    )}
                  </>,
                  "datetime-local",
                )}
              </div>
              <div className="min-w-0">
                <span className="font-black" style={{ color: T.ink }}>Location</span>
                {renderInlineField(
                  session,
                  "location",
                  session.location,
                  <span className="break-words">{session.location || "Not set"}</span>,
                  "text",
                )}
                {session.meetingPoint && !(inlineEdit?.sessionId === session.id && inlineEdit.field === "location") && (
                  <div className="mt-0.5 break-words text-xs font-semibold" style={{ color: T.amber }}>{session.meetingPoint}</div>
                )}
              </div>
              <div className="min-w-0">
                <span className="font-black" style={{ color: T.ink }}>Delivery</span>
                {renderInlineField(
                  session,
                  "estimatedDeliveryDate",
                  session.estimatedDeliveryDate,
                  <span className="break-words" style={{ color: session.estimatedDeliveryDate ? T.inkSoft : T.inkFaint }}>
                    {session.estimatedDeliveryDate ? formatDate(session.estimatedDeliveryDate) : "Not set"}
                  </span>,
                  "date",
                )}
              </div>
            </div>

            {session.internalNotes && (
              <p className="mt-3 break-words rounded-lg border p-3 text-xs font-semibold leading-5" style={{ background: T.violetBg, borderColor: T.violetBorder, color: T.inkSoft }}>
                {session.internalNotes}
              </p>
            )}

            {/* Bottom actions: unlink account + delete */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: T.rowBorder }}>
              {session.clientUserId && (
                <button
                  type="button"
                  onClick={() => onUnlinkAccount(session)}
                  disabled={isUnlinking}
                  className="rounded-lg border px-3 py-1.5 text-xs font-black transition-opacity hover:opacity-75 disabled:opacity-50"
                  style={{ background: T.amberBg, borderColor: T.amberBorder, color: T.amber }}
                >
                  {isUnlinking ? "Unlinking…" : "Unlink Google account"}
                </button>
              )}

              <div className="ml-auto flex items-center gap-2">
                {isDeleteConfirming ? (
                  <>
                    <span className="text-xs font-bold" style={{ color: T.inkFaint }}>Delete this session?</span>
                    <button
                      type="button"
                      onClick={() => { setDeleteConfirmId(null); onDelete(session); }}
                      disabled={isDeleting}
                      className="rounded-lg border px-3 py-1.5 text-xs font-black disabled:opacity-50"
                      style={{ background: T.redBg, borderColor: T.redBorder, color: T.red }}
                    >
                      {isDeleting ? "Deleting…" : "Yes, delete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(null)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-black"
                      style={{ background: T.inset, borderColor: T.border, color: T.inkFaint }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(session.id)}
                    className="rounded-lg border px-3 py-1.5 text-xs font-black transition-opacity hover:opacity-75"
                    style={{ background: T.redBg, borderColor: T.redBorder, color: T.red }}
                  >
                    Delete session
                  </button>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify compile (ignoring the known dashboard error)**

Run: `npx tsc --noEmit 2>&1 | grep "admin-session-table" || echo CLEAN`
Expected: `CLEAN`

- [ ] **Step 3: Continue to Task 10 (no commit yet)**

---

### Task 10: Restructure the admin sessions dashboard

**Files:**
- Rewrite: `app/components/admin-sessions-dashboard.tsx`

Every handler and the navigation-focus logic are preserved **byte-for-byte where noted**. New: dark canvas, Darkroom header with Scan Gmail / New session actions, dark toolbar, full-width table, drawer wiring.

- [ ] **Step 1: Replace the entire file content**

```tsx
"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import AdminSessionDrawer from "@/app/components/admin-session-drawer";
import AdminSessionForm, {
  type AdminSessionFormPayload,
} from "@/app/components/admin-session-form";
import AdminSessionTable from "@/app/components/admin-session-table";
import ClientPortalPreview from "@/app/admin/ClientPortalPreview";
import { T } from "@/app/admin/adminTheme";
import {
  CLIENT_SESSION_STATUS_LABELS,
  CLIENT_SESSION_STATUS_VALUES,
  type AdminClientSessionDTO,
  type ClientSessionStatus,
} from "@/lib/clientSessions";
import type { ClientSessionContactOption } from "@/lib/clientSessionContacts";
import { checkAuth } from "@/lib/adminAuth";
import {
  filterAdminPortalSessions,
  resolveAdminPortalSessionFocus,
} from "@/lib/adminPortalSessionNavigation";
import { supabase } from "@/lib/supabase";

type AdminSessionsResponse = {
  sessions?: AdminClientSessionDTO[];
  session?: AdminClientSessionDTO;
  error?: string;
};

type AdminSessionContactsResponse = {
  contacts?: ClientSessionContactOption[];
  error?: string;
};

const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..900;1,9..144,400..900&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

const DARK_INPUT = { background: T.inset, borderColor: T.border, color: T.ink } as const;

export default function AdminSessionsDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appliedFocusKey = useRef<string | null>(null);
  const [sessions, setSessions] = useState<AdminClientSessionDTO[]>([]);
  const [contacts, setContacts] = useState<ClientSessionContactOption[]>([]);
  const [editing, setEditing] = useState<AdminClientSessionDTO | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focusedSessionId, setFocusedSessionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ClientSessionStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState<{
    id: string;
    status: ClientSessionStatus;
  } | null>(null);
  const [gmailSyncing, setGmailSyncing] = useState<string | null>(null);
  const [scanningInvoices, setScanningInvoices] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [previewEmail, setPreviewEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadSessions() {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token && !checkAuth()) {
        router.replace("/login?next=/admin/sessions");
        return;
      }

      const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [sessionsRes, contactsRes] = await Promise.all([
        fetch("/api/admin/sessions", { headers: authHeaders }),
        fetch("/api/admin/session-contacts", { headers: authHeaders }),
      ]);
      const json = await sessionsRes.json() as AdminSessionsResponse;
      const contactsJson = await contactsRes.json() as AdminSessionContactsResponse;

      if (!alive) return;
      if (!sessionsRes.ok) {
        setError(sessionsRes.status === 403 ? "Your Google account is not listed in admin_users yet." : json.error ?? "Could not load sessions.");
        setLoading(false);
        return;
      }

      setSessions(json.sessions ?? []);
      if (contactsRes.ok) setContacts(contactsJson.contacts ?? []);
      setLoading(false);
    }

    loadSessions().catch((err) => {
      console.error("[admin-sessions-dashboard]", err);
      if (alive) {
        setError("Could not load sessions.");
        setLoading(false);
      }
    });

    return () => { alive = false; };
  }, [router]);

  // Focus the first form field when the drawer opens.
  useEffect(() => {
    if (!drawerOpen) return;

    const frame = window.requestAnimationFrame(() => {
      const input = document.querySelector<HTMLInputElement>("[data-admin-session-primary]");
      input?.focus();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [drawerOpen]);

  useEffect(() => {
    if (loading) return;
    const focusKey = searchParams.toString();
    if (appliedFocusKey.current === focusKey) return;

    const focus = resolveAdminPortalSessionFocus(sessions, searchParams);
    appliedFocusKey.current = focusKey;
    if (!focus.clientQuery) {
      setQuery("");
      setFocusedSessionId(null);
      return;
    }

    setQuery(focus.clientQuery);
    setFocusedSessionId(focus.sessionId);
    setStatusFilter("all");
  }, [loading, searchParams, sessions]);

  const filteredSessions = useMemo(() => {
    return filterAdminPortalSessions(sessions, {
      query,
      statusFilter,
      focusedSessionId,
    });
  }, [focusedSessionId, query, sessions, statusFilter]);

  async function getAuthHeaders(): Promise<HeadersInit> {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token && !checkAuth()) throw new Error("You are not signed in.");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }

  function openCreateDrawer() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(session: AdminClientSessionDTO) {
    setEditing(session);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setEditing(null);
  }

  async function saveSession(payload: AdminSessionFormPayload) {
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: editing ? "PATCH" : "POST",
        headers,
        body: JSON.stringify(editing ? { ...payload, id: editing.id } : payload),
      });
      const json = await res.json() as AdminSessionsResponse;

      if (!res.ok || !json.session) {
        setError(json.error ?? "Could not save session.");
        return;
      }

      setSessions((prev) => {
        if (!editing) return [json.session!, ...prev];
        return prev.map((session) => session.id === json.session!.id ? json.session! : session);
      });
      setMessage(editing ? "Session updated." : "Session created.");
      closeDrawer();
    } catch (err) {
      console.error("[admin-sessions-dashboard] save", err);
      setError("Could not save session.");
    } finally {
      setSaving(false);
    }
  }

  async function updateSessionStatus(session: AdminClientSessionDTO, status: ClientSessionStatus) {
    setStatusSaving({ id: session.id, status });
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          quickStatusUpdate: true,
          id: session.id,
          clientEmail: session.clientEmail,
          clientName: session.clientName,
          sessionType: session.sessionType,
          sessionDate: session.sessionDate,
          location: session.location,
          currentStatus: status,
        }),
      });
      const json = await res.json() as AdminSessionsResponse;

      if (!res.ok || !json.session) {
        setError(json.error ?? "Could not update session progress.");
        return;
      }

      setSessions((prev) => prev.map((item) => item.id === json.session!.id ? json.session! : item));
      setMessage(`Updated ${json.session.clientName || "client"} to ${CLIENT_SESSION_STATUS_LABELS[status]}.`);
    } catch (err) {
      console.error("[admin-sessions-dashboard] quick status", err);
      setError("Could not update session progress.");
    } finally {
      setStatusSaving(null);
    }
  }

  async function syncFromGmail(session: AdminClientSessionDTO) {
    setGmailSyncing(session.id);
    setError(null);
    setMessage(null);

    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions/sync-gmail", {
        method: "POST",
        headers,
        body: JSON.stringify({ session_id: session.id }),
      });
      const json = await res.json() as { session?: AdminClientSessionDTO; message?: string; error?: string };

      if (!res.ok) {
        setError(json.error ?? "Gmail sync failed.");
        return;
      }

      if (json.session) {
        setSessions((prev) => prev.map((item) => item.id === json.session!.id ? json.session! : item));
      }
      setMessage(json.message ?? "Synced from Gmail.");
    } catch (err) {
      console.error("[admin-sessions-dashboard] gmail sync", err);
      setError("Gmail sync failed.");
    } finally {
      setGmailSyncing(null);
    }
  }

  async function scanSentEmails() {
    setScanningInvoices(true);
    setError(null);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions/sync-sent-invoices", {
        method: "POST",
        headers,
      });
      const json = await res.json() as { updated?: string[]; message?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Scan failed.");
        return;
      }
      setMessage(json.message ?? "Scan complete.");
      if (json.updated?.length) {
        // Reload sessions to reflect the new statuses
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
        const sessionsRes = await fetch("/api/admin/sessions", { headers: authHeaders });
        if (sessionsRes.ok) {
          const sessionsJson = await sessionsRes.json() as AdminSessionsResponse;
          setSessions(sessionsJson.sessions ?? []);
        }
      }
    } catch (err) {
      console.error("[admin-sessions-dashboard] scanSentEmails", err);
      setError("Scan failed.");
    } finally {
      setScanningInvoices(false);
    }
  }

  async function deleteSession(session: AdminClientSessionDTO) {
    setDeletingId(session.id);
    setError(null);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ id: session.id }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) { setError(json.error ?? "Could not delete session."); return; }
      setSessions((prev) => prev.filter((s) => s.id !== session.id));
      setMessage(`Deleted session for ${session.clientName || session.clientEmail}.`);
    } catch (err) {
      console.error("[admin-sessions-dashboard] delete", err);
      setError("Could not delete session.");
    } finally {
      setDeletingId(null);
    }
  }

  async function unlinkAccount(session: AdminClientSessionDTO) {
    setUnlinkingId(session.id);
    setError(null);
    setMessage(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: session.id, clientEmail: session.clientEmail, unlinkAccount: true }),
      });
      const json = await res.json() as AdminSessionsResponse;
      if (!res.ok || !json.session) { setError(json.error ?? "Could not unlink account."); return; }
      setSessions((prev) => prev.map((s) => s.id === json.session!.id ? json.session! : s));
      setMessage(`Google account unlinked from ${session.clientName || session.clientEmail}.`);
    } catch (err) {
      console.error("[admin-sessions-dashboard] unlink", err);
      setError("Could not unlink account.");
    } finally {
      setUnlinkingId(null);
    }
  }

  async function updateSessionField(session: AdminClientSessionDTO, fields: Record<string, unknown>) {
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/admin/sessions", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ id: session.id, clientEmail: session.clientEmail, ...fields }),
      });
      const json = await res.json() as AdminSessionsResponse;
      if (!res.ok || !json.session) { setError(json.error ?? "Could not update session."); return; }
      setSessions((prev) => prev.map((s) => s.id === json.session!.id ? json.session! : s));
    } catch (err) {
      console.error("[admin-sessions-dashboard] updateField", err);
      setError("Could not update session.");
    }
  }

  function moveSession(id: string, direction: "up" | "down") {
    setSessions((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index === -1) return prev;
      const next = [...prev];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return prev;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      return next;
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  if (loading) {
    return (
      <main className="relative min-h-screen px-5 py-8" style={{ background: T.page }}>
        <link rel="stylesheet" href={FONTS_URL} />
        <div className="pointer-events-none absolute inset-0" style={{ background: T.canvasGlow }} />
        <div className="relative mx-auto max-w-6xl">
          <div className="h-10 w-64 animate-pulse rounded" style={{ background: T.inset }} />
          <div className="mt-6 h-96 animate-pulse rounded-xl" style={{ background: T.panel }} />
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-x-hidden px-5 py-8 md:px-8 md:py-10" style={{ background: T.page }}>
      <link rel="stylesheet" href={FONTS_URL} />
      <div className="pointer-events-none absolute inset-0" style={{ background: T.canvasGlow }} />

      <div className="relative z-10 mx-auto max-w-6xl">
        <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Link
              href="/admin"
              className="text-[10px] font-bold uppercase tracking-[0.28em]"
              style={{ color: T.action, fontFamily: T.mono, textDecoration: "none" }}
            >
              ← The Darkroom
            </Link>
            <h1 className="mt-3 text-3xl md:text-5xl" style={{ color: T.ink, fontFamily: T.display, fontWeight: 600 }}>
              Portal Sessions
            </h1>
            <p className="mt-2 text-sm font-semibold" style={{ color: T.inkFaint }}>
              Manage client portal progress, linking, and delivery visibility.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={scanSentEmails}
              disabled={scanningInvoices}
              title="Scan Gmail to auto-fill session dates, delivery dates, invoice/contract statuses, and deposit payments"
              className="min-h-10 rounded-lg px-4 text-sm font-black disabled:opacity-60"
              style={{ background: T.action, color: T.actionText, boxShadow: T.glow }}
            >
              {scanningInvoices ? "Scanning…" : "Scan Gmail"}
            </button>
            <button
              type="button"
              onClick={openCreateDrawer}
              className="min-h-10 rounded-lg border px-4 text-sm font-black"
              style={{ background: T.insetStrong, borderColor: T.borderStrong, color: T.ink }}
            >
              + New session
            </button>
            <Link
              href="/dashboard"
              className="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-black"
              style={{ background: T.panel, borderColor: T.border, color: T.inkSoft }}
            >
              Client view
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="min-h-10 rounded-lg border px-4 text-sm font-black"
              style={{ background: T.panel, borderColor: T.border, color: T.inkFaint }}
            >
              Sign out
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-5 rounded-lg border p-4 text-sm font-bold" style={{ background: T.redBg, borderColor: T.redBorder, color: T.red }}>
            {error}
          </div>
        )}
        {message && (
          <div className="mb-5 rounded-lg border p-4 text-sm font-bold" style={{ background: T.greenBg, borderColor: T.greenBorder, color: T.green }}>
            {message}
          </div>
        )}

        {/* Toolbar */}
        <div className="mb-4 rounded-xl border p-4" style={{ background: T.panel, borderColor: T.border }}>
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <input
              value={query}
              onChange={(event) => {
                setFocusedSessionId(null);
                setQuery(event.target.value);
              }}
              placeholder="Search name, email, type, location, date..."
              className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
              style={DARK_INPUT}
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setFocusedSessionId(null);
                setStatusFilter(event.target.value as ClientSessionStatus | "all");
              }}
              className="min-h-11 w-full min-w-0 rounded-lg border px-3 text-sm font-semibold outline-none"
              style={DARK_INPUT}
            >
              <option value="all">All statuses</option>
              {CLIENT_SESSION_STATUS_VALUES.map((status) => (
                <option key={status} value={status}>{CLIENT_SESSION_STATUS_LABELS[status]}</option>
              ))}
            </select>
          </div>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: T.inkFaint, fontFamily: T.mono }}>
            {filteredSessions.length} of {sessions.length} sessions
          </p>
        </div>

        <AdminSessionTable
          sessions={filteredSessions}
          onEdit={openEditDrawer}
          onPreview={setPreviewEmail}
          onUpdateStatus={updateSessionStatus}
          statusSaving={statusSaving}
          gmailSyncing={gmailSyncing}
          onSyncFromGmail={syncFromGmail}
          onDelete={deleteSession}
          onUnlinkAccount={unlinkAccount}
          onUpdateInvoice={(session, status) => updateSessionField(session, { invoiceStatus: status ?? "" })}
          onUpdateContract={(session, status) => updateSessionField(session, { contractStatus: status ?? "" })}
          onUpdateField={updateSessionField}
          onMoveUp={(id) => moveSession(id, "up")}
          onMoveDown={(id) => moveSession(id, "down")}
          deletingId={deletingId}
          unlinkingId={unlinkingId}
        />
      </div>

      <AdminSessionDrawer
        open={drawerOpen}
        title={editing ? "Edit session" : "New session"}
        onClose={closeDrawer}
      >
        <AdminSessionForm
          initialSession={editing}
          contacts={contacts}
          saving={saving}
          onSubmit={saveSession}
        />
      </AdminSessionDrawer>

      {previewEmail && (
        <ClientPortalPreview
          email={previewEmail}
          onClose={() => setPreviewEmail(null)}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Full verification suite**

Run: `npx tsc --noEmit && npm test && npm run lint`
Expected: all clean — especially `tests/unit/adminPortalSessionNavigation.test.ts` still passing.

- [ ] **Step 3: Visual check**

`npm run dev` → `/admin/sessions`. Verify: dark canvas + glow, header actions work, "New session" opens the drawer with focus in the email field, row "Edit" opens a populated drawer, Escape and scrim-click close it, save closes it and updates the row, search/filter work, a `?client=`/`?session=` query param still focuses the right session (the uncommitted navigation feature), status strip renders dark, Preview overlay still opens.

- [ ] **Step 4: Commit all admin work**

```bash
git add app/components/admin-session-drawer.tsx app/components/admin-session-form.tsx app/components/admin-session-table.tsx app/components/admin-sessions-dashboard.tsx
git commit -m "feat: Darkroom redesign of admin Portal Sessions with drawer workflow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full build**

Run: `npm run build`
Expected: build succeeds, no type or lint errors.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: all unit suites pass, including `portalSessionDisplay` and `adminPortalSessionNavigation`.

- [ ] **Step 3: Manual walkthrough (dev server, desktop + ~375px width)**

- `/login`: signed-out (both modes, password toggles, validation errors render in `G.red`), signed-in state, `?next=` redirect still works.
- `/dashboard`: hero greeting matches active session status; delivered-only account shows delivered hero with View gallery; multi-session account shows expandable rows; account with no sessions shows the empty state; sign out returns to `/login`.
- `/admin/sessions`: walkthrough from Task 10 Step 3, plus the admin "Preview" overlay shows the redesigned client card.
- Check `prefers-reduced-motion` (e.g. via devtools emulation) kills entrance animations on the client pages.

- [ ] **Step 4: Report**

Summarize results to the user — list anything that failed or looked off rather than fixing ad hoc beyond the plan's scope.
