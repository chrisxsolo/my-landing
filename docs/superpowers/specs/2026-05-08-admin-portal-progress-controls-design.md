# Admin Portal Progress Controls Design

## Summary

This feature adds one-click client portal progress controls to both admin surfaces:

- `/admin/sessions` becomes the primary control center for client-facing progress
- `/admin` gets a mirrored, lighter-weight version of the same controls inside each client card

Both surfaces update the same `client_sessions` record so the client portal always reflects one source of truth.

## Goals

- Let Chris update a client's portal status in a few clicks
- Avoid manual email matching or separate syncing work
- Keep `/admin/sessions` and `/admin` in sync with the client portal
- Preserve the existing inquiry workflow without rewriting the old admin page

## Non-Goals

- Replacing the inquiry timeline in `ClientTimeline`
- Migrating the full `/admin` client experience onto `client_sessions`
- Adding new client-facing progress stages beyond the existing portal statuses

## Source Of Truth

The source of truth for client-facing portal progress remains the `client_sessions` table.

Each client portal record uses:

- `client_email` to match inquiries and Google logins
- `client_user_id` when the client has signed in
- `current_status` to power the client-facing progress tracker

The `inquiries` table remains the source of truth for inquiry-specific workflow fields such as reply sent, invoice sent, deposit paid, and other CRM-style milestones already used by the current admin UI.

## Status Model

The quick actions use the existing portal statuses:

1. `inquiry_received`
2. `booking_in_progress`
3. `booked`
4. `session_completed`
5. `photos_backed_up`
6. `culling`
7. `editing`
8. `final_review`
9. `delivered`

These map directly to the current client portal progress tracker. No new status values are introduced in this phase.

## Admin Experience

### `/admin/sessions`

`/admin/sessions` becomes the best place to manage portal progress end to end.

Each session card will show:

- client name and email
- linked or waiting-for-login state
- key session metadata like type, date, and location
- a compact progress control strip using the portal status values
- the existing edit button for deeper field changes

The progress strip should behave like a direct state selector:

- the current status is visually emphasized
- earlier steps appear completed
- later steps appear available but inactive
- clicking any step immediately updates the session
- saving state appears inline on the card being updated

The card should feel like a control surface rather than a plain table row.

### `/admin`

The existing `/admin` clients tab keeps its current inquiry-centric layout, but each session row inside a client card gains a lighter portal progress control.

That mirrored control should:

- show the client's current portal status if one exists
- allow one-click updates from the same status list
- avoid duplicating the full `/admin/sessions` editing experience
- fit within the denser layout of the current clients tab

This lets Chris stay in the older admin workspace when needed, while still updating the client-facing dashboard directly.

## Auto-Create And Linking Behavior

When an admin updates portal progress from either dashboard, the system should ensure a `client_sessions` record exists first.

Expected behavior:

1. Try to find an existing `client_sessions` row for the specific session first.
   - In `/admin/sessions`, use the session `id`.
   - In `/admin`, prefer matching by normalized email plus session-specific metadata already present on the inquiry row, especially `session_date` and `session_type`.
   - Only fall back to email-only matching when there is exactly one portal session for that email.
2. If found, update that row's `current_status`.
3. If not found, create a new `client_sessions` row using the best available inquiry data:
   - email
   - name
   - session type
   - session date
   - location if available
   - default missing fields to `null`
   - initialize status to the clicked status
4. If the client later signs in with Google using the same email, the existing auto-link flow attaches their account to that session.

This removes the need for manual pre-linking before admin updates can begin.

## Data Flow

### Shared Update Path

Both admin surfaces should use the same backend path for portal status updates.

The shared update flow is:

1. Admin clicks a portal status button
2. UI sends an authenticated request with enough identity to locate or create the session
3. Server validates admin access
4. Server finds or seeds the `client_sessions` row
5. Server updates `current_status`
6. Server returns the updated session DTO
7. Calling UI updates local state immediately

### `/admin/sessions`

`/admin/sessions` already loads real session records, so it only needs to update the matching row in local session state after a successful response.

### `/admin`

`/admin` currently renders grouped `inquiries`, so it will also need portal-session state keyed by session identity rather than a loose client-level status. The simplest safe version for this phase is:

- load portal sessions alongside inquiries
- resolve a portal session for each rendered inquiry row by normalized email plus available session metadata
- if only one portal session exists for that email, use it directly
- if multiple portal sessions exist and no safe match can be inferred, show a clear fallback action that opens `/admin/sessions` for deeper editing instead of guessing
- when a quick action completes, update the cached portal-session state locally without disturbing inquiry state

This avoids reshaping the large existing `inquiries` state tree.

## Component Boundaries

The implementation should favor small, reusable UI pieces instead of embedding more logic directly into the large `/admin` page.

Planned boundaries:

- shared portal status metadata in `lib/clientSessions.ts`
- a small reusable status action component for admin quick updates
- `/admin/sessions` card integration using that shared component
- `/admin` client-row integration using that shared component
- shared API behavior in the admin sessions route or a helper it calls

This keeps the old admin page from growing even more tangled.

## Error Handling

If an update fails:

- the clicked control returns to its previous visual state
- the admin sees a clear inline or toast-style error
- no partial local state should linger as if the update succeeded

If a client cannot be resolved cleanly:

- prefer using the inquiry email as the linking key
- if email is missing or invalid, disable quick actions and explain why

If a session is auto-created during update:

- the UI should still feel like a normal successful click
- the admin should not need to take an extra step

## Mobile And Responsiveness

The quick actions must remain usable on smaller screens.

Requirements:

- buttons wrap cleanly instead of overflowing
- the current step remains obvious even in wrapped layouts
- `/admin/sessions` cards keep the progress controls visible without forcing horizontal scroll
- `/admin` client rows stay compact and readable

The visual language should match the more polished control-room direction already used in the updated portal surfaces.

## Testing And Verification

Implementation is complete when:

- updating a status from `/admin/sessions` changes the client portal progress immediately
- updating a status from `/admin` changes the same underlying portal session
- clicking a status for a client with only an inquiry auto-creates the portal session and sets the clicked status
- later Google login by that same email still links to the correct existing session
- mobile layouts do not overflow on either admin surface
- existing inquiry timeline actions still work unchanged
- targeted lint passes on changed files
- `npm run build` passes

## Risks

### Duplicate Sessions By Email

The old admin page groups by client email, but a single email may eventually have multiple sessions. For this phase, the mirrored `/admin` controls must target the specific rendered inquiry row when enough metadata exists. If the match is ambiguous, the UI should refuse to guess and instead route the admin to `/admin/sessions` for that client.

### Large `/admin` Page Complexity

`app/admin/page.tsx` is already large. The implementation should extract helper UI rather than adding another dense block of inline logic.

### Inquiry Versus Portal Concepts

The inquiry timeline and the portal progress timeline are related but not identical. The UI should keep them visually distinct so the admin understands which buttons affect client-facing portal progress versus internal CRM milestones.

## Recommendation

Implement the quick-update system on top of `client_sessions` as the single source of truth, with `/admin/sessions` as the full control center and `/admin` as a mirrored shortcut surface.

This gives Chris the fastest workflow with the least manual linking and the smallest chance of status drift across dashboards.
