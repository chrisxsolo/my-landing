# About Page Personal Redesign — Design Spec

**Date:** 2026-06-12
**Status:** Approved (Approach A)
**Inspiration:** bennysituphoto.com/about — scroll-driven personal storytelling + toggleable facts

## Goal

Make `/about` feel personal, not just professional. Add two new sections between the existing Bio and Approach sections: an interactive rotating personal-facts card and a photography-journey timeline. Fact card text is hardcoded (consistent with the rest of the page copy); fact photos are uploadable later via the Darkroom admin.

## What stays the same

Hero, Bio, Approach, Process, and CTA sections in `app/(professional)/about/page.tsx` are untouched. Existing metadata and SEO copy unchanged.

## New page sections

### 1. "Off the clock" — rotating facts (after Bio)

A client component (`AboutFactsCard`) rendering one fact at a time inside a glass card matching the page's design system (`#f5f6f4` background band, white card, existing kicker/title typography).

- Kicker shows progress: "Fact 01 / 04".
- Bold title + 2–3 sentence body per fact.
- "Next fact" arrow button + dot indicators to jump directly; crossfade transition; swipe support on touch; buttons keyboard-accessible with `aria-label`s.
- When a fact has an uploaded photo, the card shows it on the right (text left); with no photo, the card is a clean typographic layout full-width. No layout shift gimmicks — photo column simply not rendered.

**Fact content (hardcoded, keyed by slug):**

| slug | title | body gist |
|---|---|---|
| `burritos` | Powered by El Farolito | Travels all over SF hunting the best burrito; current champion is El Farolito. |
| `running` | Runner's high, ocean views | Favorite routes: loops around Lake Merced, and SF Zoo → Sutro Baths along the coast. |
| `skateboard` | Scouting on four wheels | Rides an electric skateboard around SF discovering photo spots you wouldn't normally think of. |
| `mt-tam` | Across the bridge to Mt. Tam | Hikes Mount Tam across the Golden Gate for stunning views — camera always packed. |

Final copy written during implementation in the site's voice (warm, direct, first person).

### 2. "The road here" — timeline (after facts)

Server-rendered vertical timeline using the existing `data-reveal` scroll-reveal pattern. Entries:

- **2019** — Picked up a first camera after graduating high school; hooked on realizing photos could make moments look even better than in person.
- **2022** — Started shooting grad sessions for real.
- **2023** — First big season: at least one grad session every day through April, May, and the back half of June. The moment it clicked.
- **Today (2026)** — Refining the craft and the client experience from everything learned since.

Styling: vertical line with year markers, alternating or single-column entries, consistent with existing section kickers/titles. Hardcoded array in the page file.

## Data & admin (photos)

### Table: `about_photos`

```sql
create table about_photos (
  id uuid primary key default gen_random_uuid(),
  fact_slug text not null unique,   -- one photo per fact
  image_url text not null,
  storage_path text not null,
  alt_text text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

Storage bucket: `about-photos` (public read). Migration applied via Supabase MCP. Note: RLS is currently disabled project-wide ([[supabase-rls-disabled]]); this table follows the same service-role-only write pattern as `family_location_photos`.

### API route: `app/api/admin/about-photos/route.ts`

Mirrors `app/api/admin/family-photos/route.ts` pattern:

- All methods gated by `requireAdmin(req)`, use `createSupabaseAdminClient()`.
- `GET` — list all fact photos.
- `POST` (multipart) — upload/replace photo for a `fact_slug` (validated against the hardcoded slug list, shared via a `lib/aboutFacts.ts` constants module). Replace deletes the old storage object; DB failure rolls back the uploaded object.
- `PATCH` — update `alt_text`.
- `DELETE` — remove row + storage object.
- On any successful mutation, the admin client calls `revalidatePublicSite()`.

### Admin UI

A small dedicated tab: add `"aboutPage"` to the `Tab` type and `WEBSITE_TABS` in `app/admin/page.tsx`, rendering a new `AboutPhotosTab.tsx` component — one row per fact slug showing fact title, current photo thumbnail (or "no photo" state), upload/replace button, alt-text field, delete. Uses `showToast` for errors, follows `adminTheme.ts` styling.

### Page data flow

`/about` page becomes async, fetches `about_photos` via the server Supabase client, sets `export const revalidate = 3600`. Photos passed as props to `AboutFactsCard`. Page renders fine with zero photos (launch state).

## Files touched

- `app/(professional)/about/page.tsx` — add two sections, data fetch, `revalidate`.
- `app/components/AboutFactsCard.tsx` — new client component (facts + photos props).
- `lib/aboutFacts.ts` — fact slugs/titles/bodies + timeline entries + table/bucket constants.
- `app/api/admin/about-photos/route.ts` — new admin API.
- `app/admin/AboutPhotosTab.tsx` — new admin panel.
- `app/admin/page.tsx` — register the new tab.
- Supabase migration — `about_photos` table + `about-photos` bucket.

## Error handling

- API returns JSON errors with status codes; storage rollback on partial failure (same as family-photos).
- Admin UI surfaces failures via `showToast(msg, false)`.
- Public page: if the photos query fails, log and render text-only cards — never break the page.

## Testing

- Build passes (`next build`).
- Manual: facts rotation (click, dots, keyboard), responsive at 760px/900px breakpoints, timeline reveal, admin upload → photo appears on `/about` after revalidate, delete → card returns to text-only.

## Out of scope

- Editing fact/timeline **text** from the admin (code-change only, like the rest of the page).
- Testimonials section (already exists elsewhere on the site).
- Migrating existing portrait to the new table.
