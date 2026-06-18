# Admin Analytics Day Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full-calendar-day analytics browsing for yesterday through seven days ago, comparing each selected day with its preceding day.

**Architecture:** Keep the existing client-side analytics dataset and API unchanged. Put local-calendar range and navigation-boundary logic in a pure helper, then have the existing Analytics tab consume it for a new Day mode.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest

---

### Task 1: Calendar-day range helper

**Files:**
- Create: `lib/analytics/adminDayRange.ts`
- Create: `tests/unit/adminAnalyticsDayRange.test.ts`

- [ ] **Step 1: Write the failing range tests**

Test that `buildAdminDayRange(new Date(2026, 5, 18, 15, 30), 1)` returns June 17 local-day boundaries, June 16 comparison boundaries, the selected-date label, and a previous-day trend label. Test offset 7 and `clampAdminDayOffset` boundaries.

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_ADMIN_DAY_OFFSET,
  MIN_ADMIN_DAY_OFFSET,
  buildAdminDayRange,
  clampAdminDayOffset,
} from "@/lib/analytics/adminDayRange";

describe("admin analytics day range", () => {
  it("builds yesterday and compares it with the preceding full day", () => {
    const range = buildAdminDayRange(new Date(2026, 5, 18, 15, 30), 1);
    expect(range.currStart).toEqual(new Date(2026, 5, 17, 0, 0, 0, 0));
    expect(range.currEnd).toEqual(new Date(2026, 5, 17, 23, 59, 59, 999));
    expect(range.prevStart).toEqual(new Date(2026, 5, 16, 0, 0, 0, 0));
    expect(range.prevEnd).toEqual(new Date(2026, 5, 16, 23, 59, 59, 999));
    expect(range.periodLabel).toBe("Wed, Jun 17");
    expect(range.trendLabel).toBe("the previous day (Tue, Jun 16)");
  });

  it("supports seven completed days and clamps navigation", () => {
    const range = buildAdminDayRange(new Date(2026, 5, 18, 15, 30), 7);
    expect(range.currStart).toEqual(new Date(2026, 5, 11, 0, 0, 0, 0));
    expect(clampAdminDayOffset(0)).toBe(MIN_ADMIN_DAY_OFFSET);
    expect(clampAdminDayOffset(8)).toBe(MAX_ADMIN_DAY_OFFSET);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run `npm test -- tests/unit/adminAnalyticsDayRange.test.ts`. Expect failure because `@/lib/analytics/adminDayRange` does not exist.

- [ ] **Step 3: Implement the helper**

Export `MIN_ADMIN_DAY_OFFSET = 1`, `MAX_ADMIN_DAY_OFFSET = 7`, `clampAdminDayOffset(offset)`, and `buildAdminDayRange(now, offset)`. Construct dates with local `setDate` and `setHours`; return `currStart`, `currEnd`, `prevStart`, `prevEnd`, `periodLabel`, and `trendLabel`.

```ts
export const MIN_ADMIN_DAY_OFFSET = 1;
export const MAX_ADMIN_DAY_OFFSET = 7;

export function clampAdminDayOffset(offset: number) {
  return Math.min(Math.max(offset, MIN_ADMIN_DAY_OFFSET), MAX_ADMIN_DAY_OFFSET);
}

export function buildAdminDayRange(now: Date, offset: number) {
  const selectedOffset = clampAdminDayOffset(offset);
  const currStart = new Date(now);
  currStart.setDate(currStart.getDate() - selectedOffset);
  currStart.setHours(0, 0, 0, 0);
  const currEnd = new Date(currStart);
  currEnd.setHours(23, 59, 59, 999);
  const prevStart = new Date(currStart);
  prevStart.setDate(prevStart.getDate() - 1);
  const prevEnd = new Date(prevStart);
  prevEnd.setHours(23, 59, 59, 999);
  const format = (date: Date) => date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return {
    currStart,
    currEnd,
    prevStart,
    prevEnd,
    periodLabel: format(currStart),
    trendLabel: `the previous day (${format(prevStart)})`,
  };
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run `npm test -- tests/unit/adminAnalyticsDayRange.test.ts`. Expect all tests to pass.

### Task 2: Day mode controls and data filtering

**Files:**
- Modify: `app/admin/AnalyticsTab.tsx`

- [ ] **Step 1: Add Day mode state and range selection**

Add `day` to `ViewMode`, track `dayOffset` starting at 1, use `buildAdminDayRange` when Day is selected, and preserve current Today, 7d, 30d, and Week calculations.

```tsx
type ViewMode = "today" | "day" | "7d" | "30d" | "week";
const [dayOffset, setDayOffset] = useState(MIN_ADMIN_DAY_OFFSET);

if (viewMode === "day") {
  const dayRange = buildAdminDayRange(new Date(), dayOffset);
  ({ currStart, currEnd, prevStart, prevEnd, periodLabel } = dayRange);
}
```

- [ ] **Step 2: Add bounded day navigation**

Render the same compact arrow/date pattern as Week while in Day mode. The older arrow increments through offset 7, the newer arrow decrements through offset 1, and selecting Day resets to yesterday.

```tsx
{viewMode === "day" && (
  <div className="flex items-center gap-2">
    <button onClick={() => setDayOffset(offset => clampAdminDayOffset(offset + 1))} disabled={dayOffset >= MAX_ADMIN_DAY_OFFSET}>‹</button>
    <span>{periodLabel}</span>
    <button onClick={() => setDayOffset(offset => clampAdminDayOffset(offset - 1))} disabled={dayOffset <= MIN_ADMIN_DAY_OFFSET}>›</button>
  </div>
)}
```

- [ ] **Step 3: Verify focused tests and static checks**

Run `npm test -- tests/unit/adminAnalyticsDayRange.test.ts` and `npx eslint app/admin/AnalyticsTab.tsx lib/analytics/adminDayRange.ts tests/unit/adminAnalyticsDayRange.test.ts`. Expect both commands to pass without warnings.

### Task 3: Regression and browser verification

**Files:**
- Verify: `app/admin/AnalyticsTab.tsx`
- Verify: `lib/analytics/adminDayRange.ts`
- Verify: `tests/unit/adminAnalyticsDayRange.test.ts`

- [ ] **Step 1: Run unit regression suite**

Run `npm test`. Expect all unit tests to pass.

- [ ] **Step 2: Run production build**

Run `npx next build --webpack`. Expect a successful production build.

- [ ] **Step 3: Verify in the browser**

Open the authenticated Darkroom Analytics tab. Confirm Day defaults to yesterday, the card values and trend text compare against the preceding date, arrows browse exactly seven completed days, and Today/7d/30d/Week continue to work.
