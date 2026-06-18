# Content Engine Grad Guide and Journal Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish graduation-session guide photos to the Grad Guide, preserve and display skip reasons, and block unsupported school claims and consent-obscured journal publishing.

**Architecture:** Extend the existing `guide_photo` pipeline with a canonical `grad` guide destination and keep its publish lifecycle inside the established derivative/RPC/takedown boundaries. Add pure validation helpers for journal facts and UI helpers for generation and publication status so behavior is testable without browser-only assertions.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Supabase/Postgres, Vitest

---

### Task 1: Add grad guide taxonomy, payload, and prompt support

**Files:**
- Modify: `lib/contentEngine/taxonomy.ts`
- Modify: `lib/contentEngine/payloads.ts`
- Modify: `lib/contentEngine/prompts.ts`
- Test: `tests/unit/taxonomy.test.ts`
- Test: `tests/unit/payloads.test.ts`
- Test: `tests/unit/prompts.test.ts`

- [ ] Write failing assertions that `grad` is a guide, `grad-guide` is its only location key, its payload validates, and its prompt contains only that destination.
- [ ] Run `npm test -- tests/unit/taxonomy.test.ts tests/unit/payloads.test.ts tests/unit/prompts.test.ts` and confirm the new assertions fail.
- [ ] Add `grad` to `GUIDE_TYPES`, return `["grad-guide"]` from `guideLocationKeys("grad")`, and let the existing payload/prompt builders use those canonical values.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Generate grad placements and persist skip reasons

**Files:**
- Modify: `lib/contentEngine/generationTargets.ts`
- Modify: `lib/contentEngine/generateContent.ts`
- Create: `lib/contentEngine/journalFacts.ts`
- Test: `tests/unit/journalFacts.test.ts`
- Test: `tests/integration/generate-content.test.ts`

- [ ] Write failing tests showing `grads` maps to guide `grad`, skip notes are stored in progress, and a journal response mentioning SFSU is rejected when `school_slug` is null.
- [ ] Run the focused unit/integration tests and confirm RED.
- [ ] Map `service_type === "grads"` to `guide: "grad"`, pass `result.note` as the generation result error for skipped outcomes, and add a pure canonical-school mention detector used before journal payload validation.
- [ ] Re-run the tests and confirm GREEN.

### Task 3: Publish and take down Grad Guide rows

**Files:**
- Create: `supabase/migrations/20260618000001_add_grad_guide_content_target.sql`
- Modify: `lib/contentEngine/taxonomy.ts`
- Modify: `lib/contentEngine/publishRevalidation.ts`
- Modify: `lib/contentEngine/takedown.ts`
- Modify: `lib/contentEngine/derivativeRefs.ts`
- Test: `tests/unit/publishRevalidation.test.ts`
- Test: `tests/integration/publish-school-guide.test.ts`
- Test: `tests/integration/takedown.test.ts`

- [ ] Write failing tests for `/grad-guide` revalidation, `grad_photos` publication, takedown, and derivative reference counting.
- [ ] Run focused tests and confirm RED.
- [ ] Extend the published target constraint with `grad_guide_photo`; update the publication RPC to insert `grad_photos(image_url, caption)` for `guide="grad"`; add takedown and reference-count handling.
- [ ] Apply the migration to the linked Supabase project and run focused integration tests.

### Task 4: Explain skips and blocked publishing in the UI

**Files:**
- Create: `app/admin/content-engine/generationStatus.ts`
- Modify: `app/admin/content-engine/[id]/GenerationSection.tsx`
- Modify: `app/admin/content-engine/[id]/ActionBar.tsx`
- Test: `tests/unit/generationStatus.test.ts`

- [ ] Write failing tests for skipped-reason labels and the marketing-permission blocked message.
- [ ] Implement pure label helpers and render the persisted skip reason plus an explicit consent block for approved items.
- [ ] Run focused tests, TypeScript, and ESLint.

### Task 5: Verify end to end

**Files:**
- Verify all files above.

- [ ] Run `npm test`, `npm run test:integration`, `npx tsc --noEmit`, targeted ESLint, and `npx next build --webpack`.
- [ ] Verify the authenticated Content Engine at desktop width: grad guide is generated after regeneration, inapplicable school output shows its reason, and approved journal content clearly reports that marketing permission is required.
- [ ] Confirm Tara remains unpublished until marketing permission is explicitly enabled and her unsupported SFSU wording is reviewed or regenerated.
