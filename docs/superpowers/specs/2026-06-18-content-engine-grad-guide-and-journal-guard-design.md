# Content Engine Grad Guide and Journal Guard Design

## Goal

Make Grad Guide photo generation a supported Content Engine destination, explain intentional skips, and prevent approved journal drafts from appearing publishable when client marketing permission is absent or the draft invents a school.

## Grad Guide Photos

`guide_photo` will support a third guide value, `grad`, with the canonical destination key `grad-guide`. Graduation sessions will generate placements for the public `grad_photos` gallery. Publishing will create a public derivative, insert the live `grad_photos` row, record a `grad_guide_photo` publication target, and revalidate `/grad-guide`. Takedown will remove the live row and delete the derivative only when no other live destination references it.

School-page generation will continue to skip sessions without a canonical school because publishing an off-campus session to a university page without explicit school data would invent a destination.

## Skip Reasons

Generation targets may return a note when skipped. The orchestrator will persist that note in the existing progress error field, and the Generation UI will render it beside the skipped status. Existing package and item schemas remain unchanged.

## Journal Safety and Publication

Approval and publication remain separate actions. The action bar will clearly state when approved content cannot publish because `marketing_permission` is false. It will not bypass or mutate client consent.

Journal generation will reject canonical school names and aliases in generated title, slug, body, or metadata when the session snapshot has no school. This prevents Tara's unsupported SFSU claim from reaching publication. Existing affected drafts require review or regeneration after correcting session facts.

## Data Changes

A Supabase migration will extend the published-target constraint with `grad_guide_photo` and replace the publication RPC with a grad-guide branch. No secrets or private originals become public; only the existing approved-derivative flow writes to `grad_photos`.

## Verification

Focused unit tests cover grad taxonomy, payload validation, prompts, revalidation, skip-note propagation, and unsupported-school detection. Integration tests cover generation, publication, takedown, and derivative references when the local Supabase test environment is available. The production-style webpack build and authenticated browser checks verify the UI.
