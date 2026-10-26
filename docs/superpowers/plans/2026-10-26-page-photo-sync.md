# Page photo sync — findings + plan (2026-10-26)

Status: BUILT 2026-10-26 (lib/pagePhotos, admin Page Photos tab, migration
20261026000001 applied to prod). Session 1a41e6f3 school set to uc-berkeley.
Re-run the audit any time: `npx tsx --env-file=.env.local scripts/page-photos/audit.ts`.
Correction to the findings below: the couples Palace of Fine Arts guide already
had 12 uploaded photos; Crissy Field, Redwood Grove and family Palace were empty.

## Root cause (verified against prod DB + live HTML)

Every public page reads only its own placement table, and those tables fill only
when one specific Content Engine item is published for that page:

- `/grads/<slug>` reads `school_page_photos` only (via `lib/contentEngine/schoolGalleryData.ts`),
  filled only by the engine's `school_page_photo` item (about 4 per session).
- Location guides read `couples_/family_/portrait_location_photos` only, filled only by `guide_photo`.
- Nothing reads `portfolio_images` per school or location, and **nothing ever writes
  `portfolio_images.school`** (null on every row). The engine publish RPC doesn't set it,
  and the admin form field has never been used. Because of that the `/portfolio?category=grads&school=`
  chip row is also hidden/dead.

Per page:
- **SJSU**: there are 0 Content Engine sessions for SJSU. About 18 SJSU photos exist only as legacy
  `portfolio_images` (ids 24-27, 43, 44, 57, 61, 62, 65, 103-111). So the page has none.
- **UC Berkeley**: live page shows Kim's 4 placements. The 108-photo session `1a41e6f3`
  ("UC Berkeley ", Sather Gate/Doe Library) has `school_slug = null`, so it never placed anything.
  About 20 legacy Berkeley portfolio photos are unused.
- **Shark Fin Cove works** because both sessions (Kayla, Khuong) ran `guide_photo`, which writes
  straight into `couples_location_photos` (19 rows).
- **Same gap on guides**: 18 couples + 7 family portfolio photos with location "Palace of Fine Arts",
  18 family photos at "Redwood Grove Preserve", 14 couples labelled "Crissy Field". All of those
  guides show 0 photos.
- Stanford / SF State show 4 each (Chantal / Tara placements).

## Plan (approved shape, not yet built)

1. **Shared resolver** `lib/pagePhotos/` (no association rows, so it can't drift and re-running can't duplicate):
   - Pool = `getPortfolioData()` images (published) + engine map (derivative_url → session
     school_slug / primary_location / service_type / marketing_permission / revoked / excluded / quality)
     + explicit placements (school_page_photos, *_location_photos).
   - School per photo: explicit `portfolio_images.school` > engine session `school_slug` > text
     inference on title+alt+session_label. For the text inference, add a multi-match `detectSchoolsInText`
     to `lib/schoolDetection.ts`, accept only confidence ≥ 0.9, exactly one school, otherwise report as ambiguous.
     Never infer the school from the shooting location.
   - Place per photo: row.location > session primary_location > session_label parts, matched via
     `matchPlacesByName` + `loadKnownPlaces`. Map the guide type from engine service_type or the
     portfolio category (couples→couples, families→family). Grad photos never go to couples/family guides.
   - Safety: engine-sourced rows need marketing_permission, no revocation, and `excluded = false`.
2. **Curation table** `page_photo_curation(page_key, image_url, mode pin|hide, position, is_hero)`,
   unique (page_key, image_url), one hero per page. Order: hero/pins → explicit placements →
   auto pool (featured, then quality, round-robin across sessions). Limit about 13 for schools, about 18 for guides.
3. **Grad page UI**: split hero with the hero photo (preload), gallery moved directly under the hero.
   Reuse `lib/masonry.ts` + the CouplesLightbox pattern. "See all" links to
   `/portfolio?category=grads&school=<slug>`. Hide the section when empty. `SchoolLandingTemplate.tsx`
   is already 478 lines, so extract the hero.
4. Guides: merge pool rows into `get*LocationPhotos`. Portfolio school filter: use the resolved school.
5. **Revalidation**: pool goes through `cachePublicContent` (public-content tag). Add revalidate calls to
   session facts PATCH, `sessions/[id]/location`, `permissions`, `photos/[id]` PATCH, and the curation API.
6. **Admin "Page Photos" tab** (WEBSITE_NAV_GROUPS + Tab/TAB_LABELS): pick a page, then pin/hide/hero/reorder.
   Also a "needs a school" list that sets `portfolio_images.school`.
7. **Backfill/report script** `scripts/page-photos/audit.ts`: counts per destination, unmatched/ambiguous.
   Set session `1a41e6f3` school_slug = uc-berkeley (81/108 photo analyses name Berkeley landmarks)
   and report it.
8. Tests: unit tests for the resolver, curation and school inference (UC Law ≠ Berkeley, "Cal" < 0.9).
   Then `npx next build --webpack`, ship, and verify the live /grads/sjsu and /grads/uc-berkeley pages.

Open note: the "UC Law" session (7496edcb) has 0 photos and no page.
