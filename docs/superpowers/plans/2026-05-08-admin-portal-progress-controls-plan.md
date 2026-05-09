# Admin Portal Progress Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-click client portal progress controls to both `/admin/sessions` and `/admin`, with `client_sessions` remaining the single source of truth and auto-seeding when a portal session does not exist yet.

**Architecture:** Extend the existing admin sessions API so both dashboards can call one shared “ensure session then update status” path. Keep `/admin/sessions` as the full control surface, add a reusable quick-status component, and mirror that component inside the legacy `/admin` clients tab using a separate cache of portal-session records keyed to inquiry rows.

**Tech Stack:** Next.js App Router, React client components, TypeScript, Supabase, Tailwind CSS, Node test runner

---

## File Structure

- Modify: `lib/clientSessions.ts`
  - Keep shared session constants and DTO helpers
  - Add reusable status UI metadata and session-matching helpers used by both admin surfaces
- Create: `lib/adminPortalSessionUpsert.ts`
  - Centralize “find or create portal session, then update status” logic for admin routes
- Modify: `app/api/admin/sessions/route.ts`
  - Reuse the helper for PATCH updates and support quick status updates safely
- Modify: `tests/clientSessions.test.mjs`
  - Cover shared status helpers and any new matching behavior that can be tested without the UI
- Create: `app/components/admin-session-status-strip.tsx`
  - Shared quick-action control for portal progress buttons
- Modify: `app/components/admin-session-table.tsx`
  - Add quick progress controls to each `/admin/sessions` card
- Modify: `app/components/admin-sessions-dashboard.tsx`
  - Add update handlers, local saving state, and local session replacement after quick updates
- Modify: `app/admin/page.tsx`
  - Load portal session records alongside inquiries and render mirrored quick controls in the clients tab

### Task 1: Shared Session Matching And Quick-Update API

**Files:**
- Modify: `lib/clientSessions.ts`
- Create: `lib/adminPortalSessionUpsert.ts`
- Modify: `app/api/admin/sessions/route.ts`
- Test: `tests/clientSessions.test.mjs`

- [ ] **Step 1: Add failing shared-helper tests for matching rules**

Add tests that lock down the new matching helpers in `tests/clientSessions.test.mjs`:

```js
import {
  buildClientSessionMatchKey,
  findMatchingClientSession,
} from "../lib/clientSessions.ts";

test("match key normalizes email and session metadata", () => {
  assert.deepEqual(
    buildClientSessionMatchKey({
      clientEmail: "Chris@Example.com ",
      sessionType: "Graduation",
      sessionDate: "2026-06-01T18:00:00.000Z",
    }),
    {
      email: "chris@example.com",
      sessionType: "graduation",
      sessionDate: "2026-06-01",
    },
  );
});

test("matching prefers session date and type before email-only fallback", () => {
  const rows = [
    { id: "a", client_email: "client@example.com", session_type: "Graduation", session_date: "2026-06-01T18:00:00.000Z" },
    { id: "b", client_email: "client@example.com", session_type: "Family", session_date: "2026-06-20T18:00:00.000Z" },
  ];

  assert.equal(
    findMatchingClientSession(rows, {
      clientEmail: "client@example.com",
      sessionType: "Family",
      sessionDate: "2026-06-20",
    })?.id,
    "b",
  );
});
```

- [ ] **Step 2: Run the focused shared tests and confirm they fail**

Run: `node --test tests/clientSessions.test.mjs`

Expected: FAIL with missing export or undefined helper errors for the new match helpers.

- [ ] **Step 3: Implement shared matching helpers in `lib/clientSessions.ts`**

Add focused helpers instead of burying the logic in `/admin`:

```ts
export type ClientSessionMatchInput = {
  clientEmail: string | null | undefined;
  sessionType?: string | null;
  sessionDate?: string | null;
};

export function buildClientSessionMatchKey(input: ClientSessionMatchInput) {
  return {
    email: normalizeSessionEmail(input.clientEmail),
    sessionType: normalizeSessionText(input.sessionType),
    sessionDate: normalizeSessionDate(input.sessionDate),
  };
}

export function findMatchingClientSession(
  rows: Pick<ClientSessionRow, "id" | "client_email" | "session_type" | "session_date">[],
  input: ClientSessionMatchInput,
) {
  const target = buildClientSessionMatchKey(input);
  if (!target.email) return null;

  const emailMatches = rows.filter((row) => normalizeSessionEmail(row.client_email) === target.email);
  if (emailMatches.length === 1) return emailMatches[0] ?? null;

  const exactMatch = emailMatches.find((row) => {
    const candidate = buildClientSessionMatchKey({
      clientEmail: row.client_email,
      sessionType: row.session_type,
      sessionDate: row.session_date,
    });
    return candidate.sessionDate === target.sessionDate && candidate.sessionType === target.sessionType;
  });

  return exactMatch ?? null;
}
```

- [ ] **Step 4: Add a server helper that ensures a client session exists before status updates**

Create `lib/adminPortalSessionUpsert.ts` and move the upsert logic there:

```ts
export type EnsureAdminPortalSessionInput = {
  id?: string;
  clientEmail: string;
  clientName?: string | null;
  sessionType?: string | null;
  sessionDate?: string | null;
  location?: string | null;
  currentStatus: ClientSessionStatus;
};

export async function ensureAdminPortalSession(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: EnsureAdminPortalSessionInput,
) {
  // 1. resolve by id when present
  // 2. resolve by shared match helper
  // 3. create a new row with inquiry-derived data when no match exists
  // 4. return the row that should be updated
}
```

Implementation notes:

- normalize `clientEmail` to lowercase before writes
- only fall back to email-only matching when there is a single session for that email
- populate new rows with `client_name`, `session_type`, `session_date`, `location`, and `current_status`
- leave unknown fields as `null`

- [ ] **Step 5: Update the admin sessions PATCH route to reuse the helper**

Refactor `app/api/admin/sessions/route.ts` so PATCH can serve both full form saves and quick status updates:

```ts
if (body.quickStatusUpdate === true) {
  const ensured = await ensureAdminPortalSession(supabase, {
    id: typeof body.id === "string" ? body.id : undefined,
    clientEmail: readText(body.clientEmail) ?? "",
    clientName: readText(body.clientName),
    sessionType: readText(body.sessionType),
    sessionDate: readText(body.sessionDate),
    location: readText(body.location),
    currentStatus: body.currentStatus as ClientSessionStatus,
  });

  const { data, error } = await supabase
    .from(CLIENT_SESSION_TABLE)
    .update({ current_status: ensured.current_status })
    .eq("id", ensured.id)
    .select("*")
    .single<ClientSessionRow>();
}
```

Keep the existing full-form PATCH behavior intact for explicit edits, including the “don’t unlink Google unless email changes” rule.

- [ ] **Step 6: Re-run shared tests**

Run: `node --test tests/clientSessions.test.mjs`

Expected: PASS with the new matching helper coverage added to the existing tests.

### Task 2: Reusable Admin Quick-Status Control

**Files:**
- Modify: `lib/clientSessions.ts`
- Create: `app/components/admin-session-status-strip.tsx`

- [ ] **Step 1: Add shared status presentation metadata**

Extend `lib/clientSessions.ts` with compact UI metadata so both dashboards render the same buttons:

```ts
export const CLIENT_SESSION_STATUS_SHORT_LABELS: Record<ClientSessionStatus, string> = {
  inquiry_received: "Inquiry",
  booking_in_progress: "Booking",
  booked: "Booked",
  session_completed: "Completed",
  photos_backed_up: "Backup",
  culling: "Cull",
  editing: "Edit",
  final_review: "Review",
  delivered: "Delivered",
};
```

- [ ] **Step 2: Build a shared status strip component**

Create `app/components/admin-session-status-strip.tsx`:

```tsx
type AdminSessionStatusStripProps = {
  currentStatus: ClientSessionStatus;
  savingStatus?: ClientSessionStatus | null;
  onSelect: (status: ClientSessionStatus) => void;
  disabled?: boolean;
  compact?: boolean;
};

export default function AdminSessionStatusStrip(props: AdminSessionStatusStripProps) {
  const progress = getClientSessionProgress(props.currentStatus);

  return (
    <div className="flex flex-wrap gap-2">
      {progress.map((step) => (
        <button
          key={step.value}
          type="button"
          onClick={() => props.onSelect(step.value)}
          disabled={props.disabled || props.savingStatus === step.value}
        >
          {CLIENT_SESSION_STATUS_SHORT_LABELS[step.value]}
        </button>
      ))}
    </div>
  );
}
```

Style direction:

- current state is strongest
- completed states still feel active
- upcoming states look available but quieter
- mobile wraps without overflow

- [ ] **Step 3: Run targeted lint on the new shared component**

Run: `npx eslint app/components/admin-session-status-strip.tsx lib/clientSessions.ts`

Expected: PASS with no unused imports or type errors in the new shared status UI code.

### Task 3: Upgrade `/admin/sessions` Into The Primary Control Surface

**Files:**
- Modify: `app/components/admin-session-table.tsx`
- Modify: `app/components/admin-sessions-dashboard.tsx`

- [ ] **Step 1: Add a quick-update handler in the dashboard**

In `app/components/admin-sessions-dashboard.tsx`, add card-level saving state and a shared updater:

```tsx
const [statusSavingId, setStatusSavingId] = useState<string | null>(null);

async function updateSessionStatus(session: AdminClientSessionDTO, status: ClientSessionStatus) {
  setStatusSavingId(session.id);
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
    const json = await res.json();
    if (!res.ok || !json.session) throw new Error(json.error ?? "Could not update status.");
    setSessions((prev) => prev.map((item) => item.id === json.session.id ? json.session : item));
    setMessage(`Updated ${json.session.clientName || "client"} to ${CLIENT_SESSION_STATUS_LABELS[status]}.`);
  } catch (err) {
    console.error("[admin-sessions-dashboard] quick status", err);
    setError(err instanceof Error ? err.message : "Could not update status.");
  } finally {
    setStatusSavingId(null);
  }
}
```

- [ ] **Step 2: Pass the quick-update handler into the table**

Update the component call:

```tsx
<AdminSessionTable
  sessions={filteredSessions}
  onEdit={setEditing}
  onUpdateStatus={updateSessionStatus}
  statusSavingId={statusSavingId}
/>
```

- [ ] **Step 3: Render the status strip in each session card**

Update `app/components/admin-session-table.tsx`:

```tsx
type AdminSessionTableProps = {
  sessions: AdminClientSessionDTO[];
  onEdit: (session: AdminClientSessionDTO) => void;
  onUpdateStatus: (session: AdminClientSessionDTO, status: ClientSessionStatus) => void;
  statusSavingId: string | null;
};

<div className="mt-4">
  <p className="text-[11px] font-black uppercase tracking-[0.14em]" style={{ color: C.p1 }}>
    Portal progress
  </p>
  <div className="mt-2">
    <AdminSessionStatusStrip
      currentStatus={session.currentStatus}
      savingStatus={statusSavingId === session.id ? session.currentStatus : null}
      onSelect={(status) => onUpdateStatus(session, status)}
    />
  </div>
</div>
```

Also tighten the card copy so quick actions are the primary action and `Edit` becomes the secondary detailed action.

- [ ] **Step 4: Run targeted lint for the `/admin/sessions` surface**

Run: `npx eslint app/components/admin-sessions-dashboard.tsx app/components/admin-session-table.tsx app/components/admin-session-status-strip.tsx`

Expected: PASS with no React/TypeScript lint failures in the updated admin session controls.

### Task 4: Mirror Portal Controls Inside `/admin` Clients

**Files:**
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Add portal-session state separate from inquiries**

In `app/admin/page.tsx`, add focused state near the existing clients state:

```tsx
const [portalSessions, setPortalSessions] = useState<AdminClientSessionDTO[]>([]);
const [portalSessionsLoading, setPortalSessionsLoading] = useState(false);
const [portalStatusSavingKey, setPortalStatusSavingKey] = useState<string | null>(null);
```

Also add a loader:

```tsx
async function fetchPortalSessions() {
  setPortalSessionsLoading(true);
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return;

  const res = await fetch("/api/admin/sessions", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (res.ok) setPortalSessions(json.sessions ?? []);
  setPortalSessionsLoading(false);
}
```

- [ ] **Step 2: Load portal sessions when admin clients data loads**

Extend the existing auth-triggered effects so `fetchPortalSessions()` runs whenever inquiries are refreshed for the admin surfaces:

```tsx
useEffect(() => {
  if (authed) {
    fetchInquiries();
    fetchPortalSessions();
  }
}, [authed]);
```

Keep the current inquiry loading behavior intact.

- [ ] **Step 3: Add row-level matching and update helpers**

Inside `app/admin/page.tsx`, add helpers that reuse the shared session match logic:

```tsx
function getPortalSessionForInquiry(inquiry: Inquiry) {
  return findMatchingClientSession(portalSessions, {
    clientEmail: inquiry.email,
    sessionType: inquiry.session_type,
    sessionDate: inquiry.session_date ?? inquiry.date_in_mind,
  });
}

async function updatePortalStatusFromInquiry(inquiry: Inquiry, status: ClientSessionStatus) {
  const match = getPortalSessionForInquiry(inquiry);
  const savingKey = `${inquiry.id}:${status}`;
  setPortalStatusSavingKey(savingKey);

  // PATCH /api/admin/sessions with quickStatusUpdate=true
  // include inquiry-derived metadata so the server can seed if missing
  // update portalSessions local state with returned session
}
```

If matching is ambiguous because multiple sessions share the email and no exact metadata match exists, do not guess. Render a fallback link to `/admin/sessions` instead of interactive buttons.

- [ ] **Step 4: Render the mirrored quick controls in each client session row**

Within the existing `client.sessions.map(s => ...)` block, render:

```tsx
const portalSession = getPortalSessionForInquiry(s);
const portalAmbiguous = !portalSession && hasAmbiguousPortalSessionMatch(portalSessions, s.email);

{portalAmbiguous ? (
  <a href="/admin/sessions" className="text-[11px] font-black">
    Open in Client Sessions →
  </a>
) : (
  <AdminSessionStatusStrip
    compact
    currentStatus={portalSession?.currentStatus ?? "inquiry_received"}
    savingStatus={portalStatusSavingKey === `${s.id}:${portalSession?.currentStatus ?? "inquiry_received"}` ? portalSession?.currentStatus ?? "inquiry_received" : null}
    onSelect={(status) => updatePortalStatusFromInquiry(s, status)}
  />
)}
```

Keep the inquiry `ClientTimeline` visible and label the new strip clearly as client portal progress so the two systems are not confused.

- [ ] **Step 5: Run targeted lint on the legacy admin page**

Run: `npx eslint app/admin/page.tsx`

Expected: PASS for the updated clients-tab logic.

### Task 5: Full Verification

**Files:**
- Modify: `docs/superpowers/plans/2026-05-08-admin-portal-progress-controls-plan.md`

- [ ] **Step 1: Run focused shared tests**

Run: `node --test tests/clientSessions.test.mjs`

Expected: PASS

- [ ] **Step 2: Run targeted lint on all changed files**

Run:

```bash
npx eslint \
  lib/clientSessions.ts \
  lib/adminPortalSessionUpsert.ts \
  app/api/admin/sessions/route.ts \
  app/components/admin-session-status-strip.tsx \
  app/components/admin-sessions-dashboard.tsx \
  app/components/admin-session-table.tsx \
  app/admin/page.tsx
```

Expected: PASS

- [ ] **Step 3: Run the project build**

Run: `npm run build`

Expected: PASS

- [ ] **Step 4: Manual browser verification checklist**

Verify all of the following in the running app:

- `/admin/sessions` cards show one-click portal progress buttons
- clicking a button updates the current status highlight immediately after the response
- `/admin` client rows show mirrored portal progress controls
- clicking a portal progress button from `/admin` updates the same client portal status
- a client with inquiry data but no portal session gets seeded automatically on first admin click
- mobile width does not overflow on either admin surface

- [ ] **Step 5: Mark plan-completion notes**

Append a short completion note to this plan after implementation:

```md
## Completion Notes

- Implemented quick portal progress controls in both admin dashboards
- Shared update path uses `client_sessions` as the single source of truth
- Verification run: `node --test tests/clientSessions.test.mjs`, targeted `eslint`, `npm run build`
```

## Self-Review

- Spec coverage: the plan covers shared source-of-truth updates, `/admin/sessions` controls, mirrored `/admin` controls, auto-create behavior, ambiguity handling, mobile-safe rendering, and verification.
- Placeholder scan: removed generic “handle later” language; each task has concrete files, code direction, and commands.
- Type consistency: the plan uses `AdminClientSessionDTO`, `ClientSessionStatus`, and `client_sessions` throughout, with one shared quick-update flow instead of separate route contracts.

## Completion Notes

- Implemented quick portal progress controls in both admin dashboards.
- Shared update path now accepts either the existing admin cookie auth or Supabase admin session auth.
- Added auto-seeding for portal sessions when an admin updates a client who only has inquiry data.
- Verification run: `node --test tests/clientSessions.test.mjs`, targeted `eslint` on new shared files, `npm run build`, and route-level browser smoke checks on `/admin` and `/admin/sessions`.
