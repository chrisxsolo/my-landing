# Client Portal Mobile Density And Auto-Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the client portal feel much better on mobile and automatically create a portal session from a matching inquiry the first time a client signs in with Google.

**Architecture:** Keep `app/api/client-sessions/route.ts` as the single portal orchestration endpoint, but move inquiry-to-session seeding rules into a focused helper so the route stays readable. On the UI side, preserve the current desktop look while switching mobile to a current-step-focused presentation that compresses progress and details into fewer, denser blocks.

**Tech Stack:** Next.js App Router, React 19 client components, TypeScript, Supabase admin client, Tailwind CSS, existing `@/lib/colors` design tokens

---

## File Structure

- Modify: `app/api/client-sessions/route.ts`
  Purpose: orchestrate fetch-by-user, fetch-by-email, link existing rows, and auto-create a session from a matching inquiry when needed.

- Create: `lib/clientSessionInquirySeed.ts`
  Purpose: define the inquiry row shape, normalize inquiry fields, pick the newest inquiry for an email, and build the minimal `client_sessions` insert payload.

- Modify: `app/components/session-progress-tracker.tsx`
  Purpose: switch mobile from a tall 9-card stack to a compact current-step-focused tracker while keeping desktop readable.

- Modify: `app/components/session-card.tsx`
  Purpose: condense mobile session details, promote the current step and next step, and reduce the number of equally weighted detail cards.

- Optional Modify: `app/components/client-session-dashboard.tsx`
  Purpose: only if needed for spacing around the updated card layout.

- Verify: `package.json`
  Purpose: use existing commands only. No new test framework is required for this feature.

## Task 1: Add Inquiry Seed Helper

**Files:**
- Create: `lib/clientSessionInquirySeed.ts`
- Modify: `app/api/client-sessions/route.ts`

- [ ] **Step 1: Add the inquiry seed helper file**

Create `lib/clientSessionInquirySeed.ts` with this content:

```ts
import { CLIENT_SESSION_TABLE } from "@/lib/clientSessions";

export const INQUIRIES_TABLE = "inquiries";

export type InquirySeedRow = {
  id: number;
  name: string | null;
  email: string | null;
  session_type: string | null;
  session_date: string | null;
  date_in_mind: string | null;
  location: string | null;
  school: string | null;
  created_at: string | null;
};

export type ClientSessionInsertSeed = {
  client_user_id: string;
  client_email: string;
  client_name: string | null;
  session_type: string | null;
  session_date: string | null;
  location: string | null;
  current_status: "inquiry_received";
};

function cleanText(value: string | null | undefined) {
  const text = value?.trim();
  return text ? text : null;
}

export function normalizeClientEmail(value: string | null | undefined) {
  const text = cleanText(value)?.toLowerCase();
  return text && text.includes("@") ? text : null;
}

function timestamp(value: string | null) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export function pickNewestInquiry(rows: InquirySeedRow[]) {
  if (rows.length === 0) return null;

  return [...rows].sort((a, b) => timestamp(b.created_at) - timestamp(a.created_at))[0] ?? null;
}

function normalizeSessionDate(row: InquirySeedRow) {
  const directDate = cleanText(row.session_date);
  if (directDate) return directDate;

  const dateInMind = cleanText(row.date_in_mind);
  if (!dateInMind) return null;

  const parsed = new Date(dateInMind);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function buildClientSessionInsertSeed(userId: string, inquiry: InquirySeedRow): ClientSessionInsertSeed | null {
  const email = normalizeClientEmail(inquiry.email);
  if (!email) return null;

  return {
    client_user_id: userId,
    client_email: email,
    client_name: cleanText(inquiry.name),
    session_type: cleanText(inquiry.session_type),
    session_date: normalizeSessionDate(inquiry),
    location: cleanText(inquiry.location) ?? cleanText(inquiry.school),
    current_status: "inquiry_received",
  };
}
```

- [ ] **Step 2: Run targeted lint on the new helper**

Run:

```bash
npx eslint lib/clientSessionInquirySeed.ts
```

Expected: no output

- [ ] **Step 3: Export only what the route needs**

Confirm the helper exposes only these named exports and nothing else:

```ts
export const INQUIRIES_TABLE = "inquiries";
export type InquirySeedRow = {
  id: number;
  name: string | null;
  email: string | null;
  session_type: string | null;
  session_date: string | null;
  date_in_mind: string | null;
  location: string | null;
  school: string | null;
  created_at: string | null;
};
export function normalizeClientEmail(value: string | null | undefined): string | null;
export function pickNewestInquiry(rows: InquirySeedRow[]): InquirySeedRow | null;
export function buildClientSessionInsertSeed(
  userId: string,
  inquiry: InquirySeedRow,
): ClientSessionInsertSeed | null;
```

Do not export `cleanText`, `timestamp`, or `normalizeSessionDate`. This keeps inquiry seeding logic out of the route and avoids duplicating email normalization.

- [ ] **Step 4: Re-run targeted lint**

Run:

```bash
npx eslint lib/clientSessionInquirySeed.ts
```

Expected: no output

- [ ] **Step 5: Commit the helper**

```bash
git add lib/clientSessionInquirySeed.ts
git commit -m "feat: add inquiry seed helper for client portal"
```

## Task 2: Auto-Create Client Sessions From Matching Inquiries

**Files:**
- Modify: `app/api/client-sessions/route.ts`
- Use: `lib/clientSessionInquirySeed.ts`

- [ ] **Step 1: Replace the route imports and add inquiry helpers**

Update the top of `app/api/client-sessions/route.ts` to:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth/get-user";
import {
  CLIENT_SESSION_TABLE,
  type ClientSessionRow,
  toClientSessionDTO,
} from "@/lib/clientSessions";
import {
  buildClientSessionInsertSeed,
  INQUIRIES_TABLE,
  normalizeClientEmail,
  pickNewestInquiry,
  type InquirySeedRow,
} from "@/lib/clientSessionInquirySeed";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
```

Add these helpers below `sortSessions`:

```ts
async function fetchMatchingInquiries(email: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(INQUIRIES_TABLE)
    .select("id,name,email,session_type,session_date,date_in_mind,location,school,created_at")
    .ilike("email", email)
    .returns<InquirySeedRow[]>();

  if (error) throw error;
  return data ?? [];
}

async function createSessionFromInquiry(userId: string, email: string) {
  const inquiries = await fetchMatchingInquiries(email);
  const inquiry = pickNewestInquiry(inquiries);
  if (!inquiry) return null;

  const seed = buildClientSessionInsertSeed(userId, inquiry);
  if (!seed) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .insert(seed)
    .select("*")
    .single<ClientSessionRow>();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Update the GET flow to seed from inquiries when needed**

Replace the current `GET` implementation with:

```ts
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = normalizeClientEmail(user.email);
    if (email) await linkEmailMatches(user.id, email);

    let [byUserId, byEmail] = await Promise.all([
      fetchRowsByUserId(user.id),
      email ? fetchRowsByEmail(email) : Promise.resolve([]),
    ]);

    const rowsById = new Map<string, ClientSessionRow>();
    for (const row of [...byUserId, ...byEmail]) rowsById.set(row.id, row);

    if (rowsById.size === 0 && email) {
      const created = await createSessionFromInquiry(user.id, email);
      if (created) rowsById.set(created.id, created);
    }

    const sessions = sortSessions([...rowsById.values()]).map(toClientSessionDTO);
    return NextResponse.json({ sessions });
  } catch (err) {
    console.error("[client-sessions]", err);
    return NextResponse.json({ error: "Failed to load sessions" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Tighten duplicate prevention before insert**

Adjust `createSessionFromInquiry` so it re-checks for an existing portal row immediately before insert:

```ts
async function createSessionFromInquiry(userId: string, email: string) {
  const existingRows = await Promise.all([
    fetchRowsByUserId(userId),
    fetchRowsByEmail(email),
  ]);

  if (existingRows[0].length > 0 || existingRows[1].length > 0) {
    return null;
  }

  const inquiries = await fetchMatchingInquiries(email);
  const inquiry = pickNewestInquiry(inquiries);
  if (!inquiry) return null;

  const seed = buildClientSessionInsertSeed(userId, inquiry);
  if (!seed) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .insert(seed)
    .select("*")
    .single<ClientSessionRow>();

  if (error) throw error;
  return data;
}
```

- [ ] **Step 4: Verify the route compiles cleanly**

Run:

```bash
npx eslint app/api/client-sessions/route.ts lib/clientSessionInquirySeed.ts
npm run build
```

Expected:

```txt
✓ no eslint output for the targeted files
✓ Next.js build completes successfully
```

- [ ] **Step 5: Commit the auto-linking route work**

```bash
git add app/api/client-sessions/route.ts lib/clientSessionInquirySeed.ts
git commit -m "feat: auto-create portal sessions from inquiries"
```

## Task 3: Redesign Mobile Progress Into A Current-Step Tracker

**Files:**
- Modify: `app/components/session-progress-tracker.tsx`

- [ ] **Step 1: Replace the mobile-first layout in the progress tracker**

Refactor `SessionProgressTracker` so the structure becomes:

```tsx
export default function SessionProgressTracker({ status }: SessionProgressTrackerProps) {
  const steps = getClientSessionProgress(status);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  const currentStep = steps[currentIndex] ?? steps[0];
  const nextStep = steps[currentIndex + 1] ?? null;
  const completedCount = steps.filter((step) => step.state === "completed").length;
  const progressPercent = steps.length > 1 ? (currentIndex / (steps.length - 1)) * 100 : 0;

  return (
    <div aria-label={`Current status: ${CLIENT_SESSION_STATUS_LABELS[status]}`}>
      <div className="rounded-[1.5rem] border p-4 md:hidden" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
              Current step
            </div>
            <div className="mt-2 text-2xl font-black leading-tight" style={{ color: C.ink }}>
              {currentStep.label}
            </div>
            <div className="mt-2 text-sm font-semibold" style={{ color: C.muted }}>
              {nextStep ? `Next: ${nextStep.label}` : "Final step reached"}
            </div>
          </div>
          <div className="rounded-full px-3 py-2 text-xs font-black" style={{ background: C.p1_08, color: C.p1 }}>
            {currentIndex + 1} / {steps.length}
          </div>
        </div>

        <div className="mt-4 rounded-full p-1" style={{ background: C.page }}>
          <div className="session-progress-rail" style={{ background: C.p1_08 }}>
            <div className="session-progress-fill" style={{ width: `${progressPercent}%`, background: C.grad90 }} />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {steps.map((step, index) => (
            <span
              key={step.value}
              className="rounded-full px-3 py-2 text-[11px] font-black uppercase tracking-[0.1em]"
              style={{
                background: step.state === "current" ? C.grad12 : step.state === "completed" ? C.p1_08 : C.surfaceSoft,
                color: step.state === "current" ? C.white : step.state === "completed" ? C.p1 : C.mutedSoft,
              }}
            >
              {index + 1}. {step.label}
            </span>
          ))}
        </div>

        <div className="mt-4 text-xs font-bold" style={{ color: C.muted }}>
          {completedCount} completed · {steps.length - currentIndex - 1} remaining
        </div>
      </div>

      <div className="hidden md:block">
        {/* Keep the richer desktop tracker here, using the existing card-grid approach */}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Keep the desktop tracker intact inside the `md:block` section**

Move the existing rail + card-grid markup into the desktop-only wrapper:

```tsx
<div className="hidden md:block">
  <div className="mb-5 rounded-full p-1" style={{ background: C.surfaceStrong }}>
    <div className="session-progress-rail" style={{ background: C.p1_08 }}>
      <div className="session-progress-fill" style={{ width: `${progressPercent}%`, background: C.grad90 }} />
    </div>
  </div>

  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-9">
    {steps.map((step, index) => {
      const isCompleted = step.state === "completed";
      const isCurrent = step.state === "current";
      const stepBg = isCurrent ? C.grad12 : isCompleted ? C.surfaceWarm : C.surfaceStrong;
      const border = isCurrent ? C.p1_35 : isCompleted ? C.p2_20 : C.borderSubtle;
      const textColor = isCurrent ? C.white : isCompleted ? C.p1 : C.muted;

      return (
        <div key={step.value} className="relative">
          <div
            className="session-step-card min-h-[96px] rounded-2xl border p-3 md:min-h-[128px]"
            data-state={step.state}
            style={{
              background: stepBg,
              borderColor: border,
              boxShadow: isCurrent ? C.shadowWarm : "none",
              animationDelay: `${index * 55}ms`,
            }}
          >
            <div
              className="mb-3 flex h-7 w-7 items-center justify-center rounded-full text-xs font-black"
              style={{
                background: isCurrent ? C.white_22 : C.p1_08,
                color: textColor,
              }}
            >
              {index + 1}
            </div>
            <div className="text-sm font-black leading-tight" style={{ color: textColor }}>
              {step.label}
            </div>
            <div
              className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em]"
              style={{ color: isCurrent ? C.white_82 : C.mutedSoft }}
            >
              {getStateLabel(step.state)}
            </div>
          </div>
        </div>
      );
    })}
  </div>
</div>
```

- [ ] **Step 3: Update motion and hover CSS so mobile stays calm**

Keep the top style block, but ensure only desktop cards get hover lift:

```css
.session-step-card:hover {
  transform: translateY(-3px);
}

@media (max-width: 767px) {
  .session-step-card:hover {
    transform: none;
  }
}
```

- [ ] **Step 4: Verify the tracker change**

Run:

```bash
npx eslint app/components/session-progress-tracker.tsx
npm run build
```

Expected:

```txt
✓ no eslint output for app/components/session-progress-tracker.tsx
✓ Next.js build completes successfully
```

- [ ] **Step 5: Commit the progress tracker refactor**

```bash
git add app/components/session-progress-tracker.tsx
git commit -m "feat: condense client portal progress on mobile"
```

## Task 4: Condense Mobile Session Details Without Losing Context

**Files:**
- Modify: `app/components/session-card.tsx`
- Optional Modify: `app/components/client-session-dashboard.tsx`

- [ ] **Step 1: Replace the generic detail-card grid with a denser mobile summary**

Add a small reusable detail row helper near the top of `session-card.tsx`:

```tsx
function CompactDetail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-2xl border px-4 py-3" style={{ background: C.surfaceStrong, borderColor: C.borderSubtle }}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: C.p1 }}>
        {label}
      </div>
      <div className="mt-1 text-sm font-bold break-words" style={{ color: value ? C.ink : C.muted }}>
        {value || "Not set yet"}
      </div>
    </div>
  );
}
```

Replace the current detail area with:

```tsx
<div className="mt-6 grid gap-3 md:hidden">
  <div className="grid grid-cols-2 gap-3">
    <CompactDetail label="Session type" value={session.sessionType} />
    <CompactDetail label="Session date" value={formatDateTime(session.sessionDate)} />
  </div>

  <div className="grid grid-cols-2 gap-3">
    <CompactDetail label="Location" value={session.location} />
    <CompactDetail label="Delivery" value={formatDate(session.estimatedDeliveryDate)} />
  </div>

  <div className="flex flex-wrap gap-2">
    <span className="rounded-full px-3 py-2 text-[11px] font-black" style={{ background: C.surfaceStrong, color: session.meetingPoint ? C.inkSoft : C.muted }}>
      Meeting point: {session.meetingPoint || "Not set"}
    </span>
    <span className="rounded-full px-3 py-2 text-[11px] font-black" style={{ background: C.surfaceStrong, color: session.invoiceStatus ? C.inkSoft : C.muted }}>
      Invoice: {session.invoiceStatus || "Not set"}
    </span>
    <span className="rounded-full px-3 py-2 text-[11px] font-black" style={{ background: C.surfaceStrong, color: session.contractStatus ? C.inkSoft : C.muted }}>
      Contract: {session.contractStatus || "Not set"}
    </span>
    <span className="rounded-full px-3 py-2 text-[11px] font-black" style={{ background: C.surfaceStrong, color: session.backupStatus ? C.inkSoft : C.muted }}>
      Backup: {session.backupStatus || "Not set"}
    </span>
  </div>
</div>

<div className="mt-7 hidden gap-3 md:grid md:grid-cols-2 lg:grid-cols-3">
  <DetailItem label="Session type" value={session.sessionType} />
  <DetailItem label="Session date" value={formatDateTime(session.sessionDate)} />
  <DetailItem label="Location" value={session.location} />
  <DetailItem label="Meeting point" value={session.meetingPoint} />
  <DetailItem label="Estimated delivery" value={formatDate(session.estimatedDeliveryDate)} />
  <DetailItem label="Invoice status" value={session.invoiceStatus} />
  <DetailItem label="Contract status" value={session.contractStatus} />
  <DetailItem label="Backup status" value={session.backupStatus} />
</div>
```

- [ ] **Step 2: Tighten the header copy and spacing on mobile**

Update the top section of `SessionCard` to:

```tsx
<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
  <div className="min-w-0">
    <div
      className="inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.16em]"
      style={{ background: C.surfaceStrong, borderColor: C.borderSubtle, color: C.p1 }}
    >
      {statusLabel}
    </div>
    <h2 className="mt-2 text-2xl font-black leading-tight md:text-3xl" style={{ color: C.ink }}>
      {session.clientName || "Your photo session"}
    </h2>
    <p className="mt-3 max-w-2xl text-sm font-medium leading-6" style={{ color: C.muted }}>
      {getSessionIntro(session)}
    </p>
  </div>

  {session.galleryUrl && (
    <Link
      href={session.galleryUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="session-gallery-action inline-flex min-h-11 w-full items-center justify-center rounded-full px-5 text-sm font-black md:w-auto"
      style={{ background: C.grad12, color: C.white, boxShadow: C.shadowWarmSm }}
    >
      View gallery
    </Link>
  )}
</div>
```

- [ ] **Step 3: Trim outer spacing only if the dashboard still feels tall**

If the screen still feels too long, reduce the wrapper spacing in `app/components/client-session-dashboard.tsx`:

```tsx
<div className="grid gap-4 md:gap-5">
  {sessions.map((session, index) => (
    <div key={session.id} className="portal-reveal" style={{ animationDelay: `${160 + index * 90}ms` }}>
      <SessionCard session={session} />
    </div>
  ))}
</div>
```

Only make this change if the updated card still leaves too much empty space between sessions.

- [ ] **Step 4: Verify mobile density and desktop safety**

Run:

```bash
npx eslint app/components/session-card.tsx app/components/client-session-dashboard.tsx
npm run build
```

Then manually verify:

```txt
1. Sign in on a narrow viewport.
2. Confirm the current step is visible near the top of the card.
3. Confirm the progress section is shorter than before.
4. Confirm date, location, and delivery are visible without scrolling through a long card stack.
5. Confirm desktop still shows the richer multi-card layout.
```

- [ ] **Step 5: Commit the mobile card cleanup**

```bash
git add app/components/session-card.tsx app/components/client-session-dashboard.tsx app/components/session-progress-tracker.tsx
git commit -m "feat: tighten client portal mobile layout"
```

## Task 5: End-To-End Verification

**Files:**
- Verify only

- [ ] **Step 1: Verify existing manual sessions still load**

Manual check:

```txt
1. Sign in with an account already linked in client_sessions.
2. Confirm the same session appears.
3. Confirm no duplicate portal row is created.
```

- [ ] **Step 2: Verify inquiry-based auto-creation**

Manual check:

```txt
1. Use a Google account whose email matches an inquiry but has no client_sessions row.
2. Open /dashboard.
3. Confirm a new client_sessions row is created automatically.
4. Confirm the card shows status "Inquiry Received".
5. Confirm name, email, type, and location/date are prefilled when available.
```

- [ ] **Step 3: Verify repeat sign-ins stay idempotent**

Manual check:

```txt
1. Refresh /dashboard.
2. Sign out and sign back in.
3. Confirm the same portal row is reused.
4. Confirm no second row is created for the same email.
```

- [ ] **Step 4: Final targeted verification commands**

Run:

```bash
npx eslint app/api/client-sessions/route.ts lib/clientSessionInquirySeed.ts app/components/session-progress-tracker.tsx app/components/session-card.tsx app/components/client-session-dashboard.tsx
npm run build
```

Expected:

```txt
✓ no eslint output for the targeted files
✓ Next.js build completes successfully
```

- [ ] **Step 5: Final commit**

```bash
git add app/api/client-sessions/route.ts lib/clientSessionInquirySeed.ts app/components/session-progress-tracker.tsx app/components/session-card.tsx app/components/client-session-dashboard.tsx
git commit -m "feat: improve client portal mobile flow and auto-linking"
```

## Self-Review

### Spec Coverage

- Mobile layout is covered by Task 3 and Task 4.
- Auto-create from matching inquiry is covered by Task 1 and Task 2.
- Duplicate prevention is covered by Task 2.
- Build verification and manual portal verification are covered by Task 5.

### Placeholder Scan

- No `TODO` or `TBD` markers remain.
- Commands, files, and code snippets are explicit.
- Manual checks are concrete and tied to the approved behavior.

### Type Consistency

- `InquirySeedRow` matches the existing inquiry fields already used in admin routes.
- `ClientSessionInsertSeed` uses existing `client_sessions` columns.
- `normalizeClientEmail` is reused by the route to keep matching behavior consistent.
