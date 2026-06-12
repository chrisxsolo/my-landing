# Portal Redesign — Client Dashboard, Login, Admin Portal Sessions

**Date:** 2026-06-12
**Status:** Approved by Chris (brainstorm session, visual companion mockups in `.superpowers/brainstorm/19363-1781306212/`)

## Goal

Full redesign of three surfaces — restyle + restructure, with **no new features, no API changes, no schema changes**:

1. Client sessions dashboard at `/dashboard`
2. Client portal login at `/login`
3. Admin Portal Sessions at `/admin/sessions`

## Decisions (validated with mockups)

| Question | Decision |
|---|---|
| Scope | Client surfaces + admin Portal Sessions |
| Client visual direction | **Gallery Print** — light counterpart to the admin Darkroom |
| Dashboard layout | **Active Session Hero** |
| Login layout | **Minimal Card** |
| Admin layout | **Darkroom theme, table-first + slide-over drawer** |
| Depth | Restyle + restructure; data, auth, and handlers unchanged |

## 1. Gallery Print design system (client-facing)

New token file `lib/portalTheme.ts` exporting `G` — same pattern as `T` in
`app/admin/adminTheme.ts`, which stays the single source for the admin side.

- **Canvas:** warm paper `#faf8f3`; white panels; warm borders `rgba(40,30,15,0.10)`; soft warm shadows
- **Ink ramp (warm):** `#221f1b` / `#5c554b` / `#a39a8c`
- **Accent:** print amber `#b07a35` (deeper sibling of Darkroom `#e8a04c`, AA on light backgrounds); accent bg `rgba(176,122,53,0.10)`; delivered green `#2e7d52`
- **Type:** Fraunces (display serif, replaces Playfair Display) + IBM Plex Mono (EXIF-style labels, replaces DM Mono). Loaded the same way fonts are loaded today (CSS `@import` inside component style blocks).
- **Motion:** keep current restraint — staggered entrance fades, drawn-in rules, `prefers-reduced-motion` disables all of it.

No hardcoded hex values inline in components; everything reads from `G`.

## 2. Client dashboard `/dashboard` — Active Session Hero

Files: `app/components/client-session-dashboard.tsx`, `app/components/session-card.tsx`, `app/components/session-progress-tracker.tsx` (all rebuilt visually; data flow untouched).

Structure top to bottom:

1. **Slim top bar** — mono wordmark "SOLOXSNAPS · CLIENT GALLERY" left; signed-in email, "Email Chris" (existing Gmail compose URL), "Sign out" right. The current marketing hero panel and 3 stat tiles are **removed**.
2. **Hero = active session** — active session is the first non-delivered session, falling back to the most recent. A Fraunces greeting states the status in plain words (e.g. "Hi Sarah — your grad session is in editing."), first name parsed from `clientName` (fall back to "Hi there"). Directly beneath:
   - progress bar + "Step N of M · {status}" + est. delivery (restyled `SessionProgressTracker`)
   - detail tiles: date/time, location, meeting point, invoice, contract
   - "Note from Chris" block when `clientNotes` present
   - "View gallery" CTA when `galleryUrl` present
3. **Other sessions** — compact placard rows (Fraunces title, mono date, status chip; delivered rows show gallery link). Clicking a row expands it in place to the same full detail body the hero uses (one shared component).
4. **States** — empty (no linked sessions: friendly panel + Email Chris CTA), error, and loading skeleton, all in the new palette.

Unchanged: Supabase auth check + redirect to `/login?next=/dashboard`, `/api/client-sessions` fetch, sign-out flow.

## 3. Login `/login` — Minimal Card

File: `app/components/login-panel.tsx` (visual rebuild only).

- Single centered card on the paper canvas: wordmark + secure dot row, Fraunces "Welcome back." heading, one-line subtext, then the form. The 01/02/03 feature list is **dropped** so the form is above the fold on phones.
- Sign-up mode keeps confirm-password + heading swaps to a create-account phrasing.
- Unchanged logic: signin/signup toggle, password show/hide, min-8 validation, `provision-session` call, `next` param redirect, signed-in state (email block, "Go to dashboard", admin-only "Open Portal Sessions", "Sign out"), success/error messaging.

## 4. Admin `/admin/sessions` — Darkroom, table-first + drawer

Files: `app/components/admin-sessions-dashboard.tsx` (restructure), `app/components/admin-session-table.tsx` and `app/components/admin-session-form.tsx` (restyle), all using `T` from `app/admin/adminTheme.ts`.

- **Canvas:** `T.page` + `T.canvasGlow`, replacing the current light-blue gradient/blobs.
- **Header:** breadcrumb to `/admin`, Fraunces "Portal Sessions" display title, header actions: **Scan Gmail** (amber `T.action`), **New session** (opens drawer), Client view, Sign out. The large Gmail-sync banner condenses to this header action plus a one-line mono status/result message.
- **Toolbar:** search input + status filter restyled as dark inputs in a single row above the table.
- **Table:** full-width (no more 420px form column). Dark rows on `T.panel`, chemical-bath status chips (`T.green/amber/blue/violet` etc.), same columns and row actions as today.
- **Drawer:** `admin-session-form` renders inside a right-side slide-over panel above `T.scrim` (same overlay pattern as the Darkroom's existing modal). Opens via "New session" (empty) or row Edit (populated); closes via ✕, scrim click, or Escape; the existing scroll-into-view/focus effect is adapted to focus the first field on open. The "Edit mode" banner moves into the drawer header.
- **Preserved exactly:** all handlers (save, quick status, Gmail sync per-row, scan sent emails, delete, unlink, field update, reorder), the focus/filter navigation from `lib/adminPortalSessionNavigation.ts` (in-progress uncommitted work — do not touch that lib or its tests), `ClientPortalPreview` overlay, auth via Supabase token + `checkAuth()` fallback, 403 messaging.

## 5. Constraints & quality

- Keep files under 400 lines — extract style blocks or subcomponents where a rebuilt file would exceed it (e.g. drawer as its own component `app/components/admin-session-drawer.tsx` if needed).
- Colors only from `G` (client) and `T` (admin); no inline hex.
- One logical change per commit (client theme + dashboard, login, admin can be separate commits).
- This branch has uncommitted work in `admin-sessions-dashboard.tsx`, `app/admin/conversation/[id]/page.tsx`, `lib/adminPortalSessionNavigation.ts`, and its test — the redesign builds on top of it; nothing here may revert it.

## 6. Error handling

Unchanged in logic. Error/success message panels restyled per surface (Gallery Print panels on client, `T.redBg`/`T.greenBg` strips on admin).

## 7. Testing & verification

- Existing `tests/unit/adminPortalSessionNavigation.test.ts` must keep passing (no changes to that lib).
- Manual walkthrough on dev server at desktop + mobile widths:
  - `/login`: signed-out form (both modes, password toggle, error states), signed-in state, redirect with `next`
  - `/dashboard`: 0, 1, and multiple sessions; delivered vs in-progress hero; expand/collapse other sessions; reduced motion
  - `/admin/sessions`: table actions, drawer create/edit/close, Gmail scan messaging, search/filter, focus-by-query-param navigation, portal preview
