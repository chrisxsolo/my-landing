# Client Portal Mobile Density And Auto-Linking Design

Date: 2026-05-08

## Goal

Improve the SoloXSnaps client portal in two related ways:

1. Make the mobile dashboard easier to scan with less vertical scrolling.
2. Automatically create and link a client portal session from an existing inquiry when a client signs in with the matching Google account for the first time.

## Approved Direction

### Mobile UI

Use a "current step focused" mobile layout.

This keeps the portal centered on the client's current status, reduces the visual weight of the full progress list, and condenses supporting details so more information is visible at once. Desktop can remain close to the current layout, while mobile becomes noticeably shorter and easier to scan.

### Auto-Linking Behavior

When a client signs in with Google and no `client_sessions` row exists yet for that user, the portal should automatically create one from a matching inquiry.

Matching should use the normalized email address from the authenticated Google account against the inquiry email. The created portal record should immediately appear in the dashboard without any manual admin linking step.

## Scope

### In Scope

- Update the mobile presentation of the client portal session card and progress tracker.
- Keep the current visual language, but reduce scroll depth and card height on phones.
- Auto-create a `client_sessions` row from a matching inquiry during the client dashboard load flow.
- Reuse existing `inquiries` and `client_sessions` tables.
- Preserve the existing admin sessions flow and Google sign-in flow.

### Out Of Scope

- New database tables.
- A new onboarding flow for clients.
- Changes to the admin dashboard information architecture.
- Bulk backfills or admin-side migration tools.
- A redesign of the desktop portal beyond small compatibility adjustments.

## Current Code Areas

- `app/api/client-sessions/route.ts`
- `app/components/client-session-dashboard.tsx`
- `app/components/session-card.tsx`
- `app/components/session-progress-tracker.tsx`
- `lib/clientSessions.ts`
- Existing `inquiries` reads already used in admin routes

## Proposed Behavior

### First-Time Portal Creation

On client dashboard load:

1. Authenticate the request from the Google-backed Supabase session.
2. Normalize the signed-in email.
3. Attempt to find existing `client_sessions` rows by `client_user_id`.
4. Attempt to link any existing `client_sessions` rows by matching `client_email`.
5. If no client session exists after those checks, query `inquiries` for matching email.
6. If a matching inquiry exists, create a new `client_sessions` row using inquiry data and assign `client_user_id` to the authenticated user.
7. Return the resulting session list to the dashboard as usual.

### Auto-Created Session Defaults

The first auto-created portal session should use:

- `client_user_id`: authenticated user id
- `client_email`: inquiry email
- `client_name`: inquiry name when present
- `session_type`: inquiry session type when present
- `session_date`: inquiry `session_date` when present
- `location`: inquiry `location` when present, otherwise inquiry `school`
- `current_status`: `inquiry_received`

Fields like meeting point, delivery, gallery, invoice, contract, backup, and notes can remain empty until updated later.

## Duplicate Prevention Rules

To keep this low-maintenance and safe:

- Never create a new portal row if one already exists for the authenticated `client_user_id`.
- Never create a new portal row if one already exists for the matching email in `client_sessions`.
- If multiple inquiries match the same email, use the newest inquiry first.
- If an admin already created a portal row manually, reuse that row instead of creating another one.

## Mobile UI Design

### Layout Direction

On mobile, each client session card should prioritize:

1. Current status
2. What's next
3. Key session details
4. Compressed progress context

### Mobile Adjustments

- Keep a strong current-status header near the top.
- Replace the tall multi-card progress wall with a denser current-step-focused treatment.
- Reduce the number of equally weighted detail cards.
- Group important details into tighter rows or compact cards.
- De-emphasize empty values like "Not set yet" so they take less space.
- Keep gallery action visible when available.

### Desktop Adjustments

- Preserve most of the current desktop structure.
- Allow the denser component structure to scale back up cleanly without hurting readability.

## Error Handling

### API

- If inquiry lookup fails unexpectedly, log the error and return the existing `"Failed to load sessions"` style response.
- If auto-create fails, log the failure and avoid partial client-side crashes.
- If no inquiry exists, return the normal empty-state dashboard.

### UI

- The client dashboard should continue rendering even when partial fields are missing.
- Mobile density changes should not hide essential session details.

## Regression Risks

### Data Risks

- Duplicate portal rows for one email if creation checks are incomplete.
- Choosing the wrong inquiry if several old inquiries share the same email.

### UI Risks

- Mobile-only layout changes accidentally hurting tablet or desktop spacing.
- Condensing too aggressively and making status progression less understandable.

## Verification Plan

- Confirm an existing manually created `client_sessions` row still appears correctly after Google sign-in.
- Confirm a new Google sign-in with a matching inquiry auto-creates a portal session.
- Confirm repeated sign-ins do not create duplicates.
- Confirm a user with no inquiry still sees the empty portal state.
- Confirm the mobile portal shows the current status and key details with significantly less scrolling than before.
- Run `npm run build`.

## Implementation Notes

Keep the first pass narrowly scoped:

- Put auto-create orchestration in `app/api/client-sessions/route.ts`.
- Add only the minimal inquiry query/helper logic needed for the route.
- Refactor the portal display components only as far as needed to support the denser mobile layout.
- Avoid broad admin-side refactors while fixing the client experience.
