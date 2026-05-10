 # Journal Image Library Design

Date: 2026-05-09

## Summary

Journal images should become permanent reusable assets the moment they are uploaded, without forcing them into the public portfolio automatically.

The approved direction is:

- keep uploading journal cover images and extra images to Supabase Storage
- automatically save both types of images into a shared image library
- surface that library inside `Studio Admin`
- let Chris choose which saved images get promoted into `portfolio_images`

This turns journal uploads into a reusable asset pipeline instead of a one-off blog-only workflow.

## Goals

- Save every journal upload as a permanent reusable asset
- Avoid re-uploading the same photo just to use it somewhere else
- Keep portfolio inclusion manual and intentional
- Add a shared image-library view inside `Studio Admin`
- Preserve the current journal publishing flow

## Non-Goals

- Replacing Supabase Storage with database blob storage
- Auto-publishing all journal images to the portfolio
- Rebuilding the public portfolio page architecture
- Building a full DAM with folders, smart search, or batch editing in this phase
- Changing how public journal pages render their images

## Current State

Today, the journal flow already uploads images permanently to Supabase Storage through the admin page helper.

What is missing is a reusable asset record:

- `blog_posts.cover_image_url` stores only one raw URL
- `blog_posts.extra_image_urls` stores only raw URLs
- `portfolio_images` is a separate portfolio-specific table
- there is no shared database layer that says "this image exists, came from this journal post, and can be reused elsewhere"

So the images persist physically, but not as first-class reusable content objects.

## Recommended Architecture

Add a new shared table for reusable uploaded images. This table becomes the source of truth for image reuse across admin-controlled website sections.

Recommended table name:

- `image_library`

This table should represent assets, not placement. In other words:

- `image_library` answers "what images do we have?"
- `portfolio_images` answers "which images are currently in the portfolio and how are they arranged there?"

That keeps responsibilities clean and avoids turning `portfolio_images` into a catch-all bucket.

## Data Model

### `image_library`

Each row should represent one reusable uploaded image.

Suggested fields:

- `id`
- `title`
- `alt`
- `image_url`
- `storage_path`
- `source_type`
- `source_post_id`
- `source_post_slug`
- `source_role`
- `in_portfolio`
- `created_at`
- `updated_at`

### Field Meanings

- `title`: default human label, seeded from the journal post title or filename
- `alt`: seeded from title and editable later
- `image_url`: public URL used by the site today
- `storage_path`: bucket-relative path so the asset can be managed without parsing the public URL
- `source_type`: for this phase, always `journal`
- `source_post_id`: the originating `blog_posts.id`
- `source_post_slug`: helpful for admin context and backfill resilience
- `source_role`: either `cover` or `gallery`
- `in_portfolio`: quick flag showing whether this asset has been promoted into `portfolio_images`

### Why Both `image_library` And `portfolio_images`

The split is intentional:

- the library is reusable inventory
- the portfolio table stays a curated presentation layer

This means one asset can exist in the library forever even if it is never shown publicly in the portfolio.

## Journal Save Behavior

### New Uploads

When a new journal post is created or an existing one is updated:

1. Upload the cover image and extra images to Supabase Storage as usual
2. Save the resulting URLs back to `blog_posts` exactly as today
3. For each uploaded image, create a matching `image_library` row
4. Tag each asset with:
   - source post id
   - source post slug
   - source role `cover` or `gallery`
   - source type `journal`

This keeps the journal publishing experience familiar while adding asset persistence.

### Existing Images During Edit

When editing a post:

- existing already-saved library entries should remain intact
- newly uploaded replacements or additions should create new library rows
- removing an image from a journal post should not delete the library asset automatically in this phase

That last rule is important: once uploaded, the asset is treated as reusable media, not disposable post-only content.

## Backfill Behavior

Older journal posts should also become reusable without manual re-upload.

Add a backfill path that scans existing `blog_posts` rows and creates missing `image_library` records from:

- `cover_image_url`
- every item in `extra_image_urls`

Backfill rules:

- only create a library row when one does not already exist for that post + URL + role
- preserve the original blog post data without rewriting URLs
- mark the source as `journal`

This can be implemented as either:

- a one-time admin action in `Studio Admin`, or
- a migration/script path run once during rollout

Recommended first pass:

- run a safe backfill once during rollout
- avoid exposing a permanent admin button unless needed later

## Studio Admin Experience

Add a new `Image Library` section inside `Studio Admin`.

This should feel like a shared media shelf, not a second portfolio editor.

Each image card should show:

- thumbnail
- title
- source label such as journal post title or slug
- whether it is a cover image or gallery image
- whether it is already in the portfolio
- a primary action for portfolio promotion

### Primary Actions

Required first-pass actions:

- `Add to Portfolio`
- `View Source Post` or equivalent context link if easy to provide

Optional later actions, not required now:

- edit title/alt
- remove from portfolio
- assign to other site surfaces

### Portfolio Promotion Behavior

Clicking `Add to Portfolio` should:

1. take the selected library asset
2. create a `portfolio_images` row using its URL and metadata
3. let the admin choose or default the portfolio category according to the current admin patterns
4. set `image_library.in_portfolio = true`

This keeps portfolio rendering unchanged while making reuse trivial.

## Public Site Behavior

Public rendering should stay stable in this phase.

### Journal

Journal pages continue reading:

- `cover_image_url`
- `extra_image_urls`

No public journal page rewrite is required.

### Portfolio

Portfolio pages continue reading `portfolio_images`.

The only change is how those rows can be created:

- existing manual portfolio uploads still work
- new rows can now also be created from shared library assets

## Admin Boundaries

The implementation should avoid adding more complexity directly into the already-large `app/admin/page.tsx`.

Preferred boundaries:

- shared asset constants/types in a small helper module
- a focused image-library data helper for create/backfill/promote behavior
- a small admin UI component for image-library cards or rows
- minimal journal save-flow integration from the existing admin page

This feature should improve reuse without turning the admin file into an even larger monolith.

## Duplicate Prevention

The system should avoid duplicate library rows for the same source image.

Safe uniqueness rule for this phase:

- one `image_library` row per `source_post_id + source_role + image_url`

This is enough to prevent duplicate entries from repeated edits or backfills while staying simple.

For gallery images, multiple rows are still allowed across different posts if the same URL is intentionally reused elsewhere.

## Error Handling

### Journal Save

If blog image upload fails:

- preserve the current failure behavior
- do not save partial broken image references

If the blog post saves but library persistence fails:

- log the failure clearly
- show an admin-facing error or warning
- prefer not to block the entire post publish if the core blog save succeeded, unless implementation safety strongly favors transaction-like failure behavior

Recommended first pass:

- publish the post if the blog save succeeds
- surface a warning that library sync failed
- make the asset backfill path able to repair missed rows later

### Portfolio Promotion

If `Add to Portfolio` fails:

- do not mark `in_portfolio` as true locally
- show a toast error
- keep the asset available for retry

## Migration And Rollout

The rollout should happen in this order:

1. Create the `image_library` schema
2. Add the code that writes journal uploads into the library
3. Backfill old journal images into the library
4. Add the `Studio Admin` image-library UI
5. Add portfolio-promotion actions from the library

This order keeps new uploads correct first, then catches up the historical content.

## Risks

### `app/admin/page.tsx` Size

The current admin page already does too much. If the image library UI is embedded inline, the file will become harder to maintain. Extraction should be part of the implementation plan.

### Asset Duplication In Portfolio

If portfolio promotion does not check existing `portfolio_images` rows by URL, the same image could be added multiple times. The promote action should guard against accidental duplicates.

### Library Drift

Because blog posts continue storing raw URLs directly, library creation failures could temporarily leave some images untracked. That is why a backfill or repair path matters.

## Verification

Implementation is complete when:

- publishing a journal post saves the cover image into `image_library`
- publishing a journal post saves every extra image into `image_library`
- editing a journal post with new uploads adds the new assets without duplicating old ones
- old journal posts can be backfilled into the library without re-upload
- `Studio Admin` shows a reusable image library
- clicking `Add to Portfolio` creates a usable portfolio entry without re-uploading the image
- portfolio images remain opt-in rather than automatic
- public journal pages still work unchanged
- public portfolio pages still work unchanged
- targeted lint passes on changed files
- `npm run build` passes

## Recommendation

Implement a dedicated `image_library` table and `Studio Admin` library surface, fed automatically by journal uploads and used as the source for manual portfolio promotion.

This is the cleanest long-term path because it separates:

- asset storage
- content reuse
- public portfolio curation

without changing how the public website already works.
