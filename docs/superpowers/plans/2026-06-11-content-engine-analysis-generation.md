# Content Engine Analysis & Generation (Plan 3 of 6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI analysis pipeline (atomic photo claims, adaptive batching, Claude vision, identity-validated results) and the per-type content-generation pipeline (atomic jsonb progress claims, prompt construction from the closed taxonomy, Zod-validated draft items, per-type usage recording), per spec `docs/superpowers/specs/2026-06-10-session-content-engine-design.md` §8.1–§8.3 and §11.

**Architecture:** One new migration (20260611000009) adds four `security definer` claim/record RPCs so every lease transition is a single atomic SQL statement. Pure modules (`prompts`, `analysisBatching`, `analysisResponse`, `aiPricing`) are unit-tested; the two service functions (`analyzePhotos`, `generateContent`/`generationTargets`) take an injected `ModelCaller` so integration tests run against the real local DB + storage with a **fake model** (no API key, deterministic). Three thin admin routes wire the real Anthropic caller.

**Tech Stack:** Postgres plpgsql (local Supabase stack), `@anthropic-ai/sdk` (already a dep), sharp, zod v4, Vitest.

**Plan series:** 1 Foundation (DONE) → 2 Upload pipeline + domain modules (DONE) → **3 Analysis & generation (this plan)** → 4 Publishers' Node side + admin workflow UI → 5 Public-page integrations → 6 Analytics + deployment verification. Social captions are Phase 2 and appear in no plan.

**Spec is law:** if any step here contradicts the spec, the spec wins; stop and flag it.

**Standing constraints (unchanged from Plans 1–2):**
- **Nothing is applied to production.** Migration 9 is local-only (applied by `reset-test-db.sh`); production apply is the Plan-6 gate.
- Engine tables are touched only via `requireAdmin(req)` → service-role client. Both AI gates are server-enforced: `ai_processing_allowed` gates analysis/generation (§3.1) — enforced inside the claim RPCs, not just routes.
- Model default is **`claude-sonnet-4-6`** (spec §8.3 — explicitly chosen in the approved spec; do not substitute another model), recorded per call, overridable via `generation_settings.overrides.model_name`.
- Prompts receive ONLY `SessionFactsSnapshot` (Plan 2's `buildSessionFactsSnapshot`) — `internal_client_name`, `internal_notes`, and email can never be interpolated (§8.3).
- Integration tests NEVER call the real Anthropic API — they inject a fake `ModelCaller`.
- Files <400 lines, functions <50 lines (AGENTS.md).

---

## File Structure

```
supabase/migrations/
  20260611000009_create_analysis_generation_rpcs.sql   (+ _rollback.sql, _verify.sql)
  20260611000008_create_content_engine_rpcs.sql         MODIFY: advisory-lock doc comment (carry-forward)
lib/contentEngine/
  aiClient.ts          — ModelCaller seam + createAnthropicCaller + DEFAULT_ENGINE_MODEL
  aiPricing.ts         — maintained rate map + estimateCostUsd (spec §11)
  prompts.ts           — PROMPT_VERSION + analysis & per-type generation prompts (spec §8.3)
  analysisBatching.ts  — batch chunking + encode ladder constants (spec §8.1 step 2)
  analysisResponse.ts  — Zod schema + identity validation for vision output (spec §8.1 steps 3-4)
  analyzePhotos.ts     — service: claim → download → downscale → model → validate → commit (spec §8.1)
  generationTargets.ts — per-type input gathering + draft-item materialization (spec §8.2/§8.4)
  generateContent.ts   — service: claim type → build → model → validate → insert → record (spec §8.2)
app/api/admin/session-content/
  photos/analyze/route.ts  — POST: one batch per call; client orchestrates (spec §8.1)
  packages/route.ts        — POST: snapshot + create_content_package RPC (spec §8.2)
  generate/route.ts        — POST: one content type per call (spec §8.2)
tests/unit/
  aiPricing.test.ts · prompts.test.ts · analysisBatching.test.ts · analysisResponse.test.ts
tests/integration/
  rpc-analysis-claims.test.ts   — lease claiming/expiry/no-steal + batch commit guards
  rpc-generation-claims.test.ts — per-type jsonb claims + package status transitions
  analyze-photos.test.ts        — service with fake model against real storage+DB
  generate-content.test.ts      — service with fake model; items/usage/transitions
  publish-links.test.ts         — carry-forward: internal_link_suggestion publish
package.json — MODIFY: `test:legacy` script (carry-forward)
```

---

### Task 1: Migration 9a — analysis claim + batch-commit RPCs (test-first)

**Files:**
- Create: `tests/integration/rpc-analysis-claims.test.ts`
- Create: `supabase/migrations/20260611000009_create_analysis_generation_rpcs.sql` (first two functions; Task 2 appends the other two before it is ever applied beyond the local stack), `..._rollback.sql`, `..._verify.sql`
- Modify: `supabase/migrations/20260611000008_create_content_engine_rpcs.sql` (doc comment only)

- [ ] **Step 1: Write the failing tests** (`tests/integration/rpc-analysis-claims.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createTestPhoto } from "./helpers";

beforeAll(() => resetDb());

async function setAnalysis(photoId: string, fields: Record<string, unknown>) {
  const { error } = await service.from("session_photos").update(fields).eq("id", photoId);
  if (error) throw error;
}

async function claim(sessionId: string, opts: { photoIds?: string[]; max?: number; lease?: number } = {}) {
  return service.rpc("claim_photos_for_analysis", {
    p_session_id: sessionId,
    p_photo_ids: opts.photoIds ?? null,
    p_max_photos: opts.max ?? 4,
    p_lease_seconds: opts.lease ?? 180,
  });
}

describe("claim_photos_for_analysis (spec §8.1 step 1)", () => {
  it("claims pending photos: processing + future lease + attempt 1", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, { analysis_status: "pending", analysis_attempt: 0 });

    const { data, error } = await claim(sessionId);
    expect(error).toBeNull();
    expect(data).toContain(photo.id);

    const { data: row } = await service.from("session_photos")
      .select("analysis_status,analysis_attempt,analysis_lease_expires_at,analysis_started_at")
      .eq("id", photo.id).single();
    expect(row!.analysis_status).toBe("processing");
    expect(row!.analysis_attempt).toBe(1);
    expect(new Date(row!.analysis_lease_expires_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("cannot steal an unexpired claim; can reclaim an expired one (attempt increments)", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, {
      analysis_status: "processing", analysis_attempt: 1,
      analysis_lease_expires_at: new Date(Date.now() + 120_000).toISOString(),
    });
    const live = await claim(sessionId);
    expect(live.error).toBeNull();
    expect(live.data).toEqual([]); // unexpired → not claimable

    await setAnalysis(photo.id, {
      analysis_lease_expires_at: new Date(Date.now() - 1_000).toISOString(),
    });
    const expired = await claim(sessionId);
    expect(expired.data).toContain(photo.id);
    const { data: row } = await service.from("session_photos")
      .select("analysis_attempt").eq("id", photo.id).single();
    expect(row!.analysis_attempt).toBe(2);
  });

  it("skips excluded photos and respects p_max_photos ordering by sort_order", async () => {
    const sessionId = await createTestSession();
    const a = await createTestPhoto(sessionId);
    const b = await createTestPhoto(sessionId);
    const c = await createTestPhoto(sessionId);
    await setAnalysis(a.id, { analysis_status: "pending", sort_order: 1 });
    await setAnalysis(b.id, { analysis_status: "pending", sort_order: 2, excluded: true });
    await setAnalysis(c.id, { analysis_status: "pending", sort_order: 3 });

    const { data } = await claim(sessionId, { max: 2 });
    expect(data).toEqual([a.id, c.id]); // excluded b skipped
  });

  it("refuses when ai_processing_allowed is false", async () => {
    const sessionId = await createTestSession({ ai_processing_allowed: false });
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, { analysis_status: "pending" });
    const { error } = await claim(sessionId);
    expect(error?.message).toMatch(/ai processing/i);
  });

  it("concurrent claims never double-claim a photo", async () => {
    const sessionId = await createTestSession();
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, { analysis_status: "pending", analysis_attempt: 0 });

    const results = await Promise.all([claim(sessionId), claim(sessionId)]);
    const claimed = results.flatMap((r) => (r.data ?? []) as string[]);
    expect(claimed.filter((id) => id === photo.id)).toHaveLength(1);
    const { data: row } = await service.from("session_photos")
      .select("analysis_attempt").eq("id", photo.id).single();
    expect(row!.analysis_attempt).toBe(1); // claimed exactly once
  });
});

describe("record_analysis_batch (spec §8.1 steps 4-5)", () => {
  function successResult(photoId: string) {
    return {
      session_photo_id: photoId, success: true,
      analysis_model: "claude-sonnet-4-6", analysis_version: "test-v1",
      fields: {
        alt_text: "Grad in SJSU colors at golden hour", title: "Tower Lawn portrait",
        description: "Backlit portrait near Tower Lawn.", tags: ["sjsu", "golden hour"],
        quality_score: 8, suggested_category: "grads",
        destination_recommendations: { portfolio: true, school_page: true },
      },
      payload: { raw: "model response", usage: { input_tokens: 1000, output_tokens: 200 } },
    };
  }

  async function claimedPhoto(sessionId: string) {
    const photo = await createTestPhoto(sessionId);
    await setAnalysis(photo.id, { analysis_status: "pending" });
    const { data } = await claim(sessionId, { photoIds: [photo.id] });
    expect(data).toContain(photo.id);
    return photo;
  }

  it("commits a successful batch: fields + payload + completed", async () => {
    const sessionId = await createTestSession();
    const photo = await claimedPhoto(sessionId);

    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionId, p_results: [successResult(photo.id)],
    });
    expect(error).toBeNull();

    const { data: row } = await service.from("session_photos").select("*").eq("id", photo.id).single();
    expect(row!.analysis_status).toBe("completed");
    expect(row!.alt_text).toBe("Grad in SJSU colors at golden hour");
    expect(row!.tags).toEqual(["sjsu", "golden hour"]);
    expect(row!.quality_score).toBe(8);
    expect(row!.suggested_category).toBe("grads");
    expect(row!.analysis_model).toBe("claude-sonnet-4-6");
    expect(row!.analysis_version).toBe("test-v1");
    expect(row!.analysis_payload.usage.input_tokens).toBe(1000);
    expect(row!.analyzed_at).not.toBeNull();
  });

  it("records a failed photo with a safe error", async () => {
    const sessionId = await createTestSession();
    const photo = await claimedPhoto(sessionId);
    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionId,
      p_results: [{ session_photo_id: photo.id, success: false, error: "identity validation failed",
                    analysis_model: "claude-sonnet-4-6", analysis_version: "test-v1" }],
    });
    expect(error).toBeNull();
    const { data: row } = await service.from("session_photos")
      .select("analysis_status,analysis_error").eq("id", photo.id).single();
    expect(row!.analysis_status).toBe("failed");
    expect(row!.analysis_error).toMatch(/identity validation/);
  });

  it("rejects the WHOLE batch when any lease is expired", async () => {
    const sessionId = await createTestSession();
    const ok = await claimedPhoto(sessionId);
    const stale = await claimedPhoto(sessionId);
    await setAnalysis(stale.id, { analysis_lease_expires_at: new Date(Date.now() - 1000).toISOString() });

    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionId, p_results: [successResult(ok.id), successResult(stale.id)],
    });
    expect(error?.message).toMatch(/lease/i);
    // rollback: the ok photo must still be processing, not completed
    const { data: row } = await service.from("session_photos")
      .select("analysis_status").eq("id", ok.id).single();
    expect(row!.analysis_status).toBe("processing");
  });

  it("rejects a photo from another session", async () => {
    const sessionA = await createTestSession();
    const sessionB = await createTestSession();
    const foreign = await claimedPhoto(sessionB);
    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionA, p_results: [successResult(foreign.id)],
    });
    expect(error?.message).toMatch(/not part of session/i);
  });

  it("caps an oversized raw payload instead of storing it", async () => {
    const sessionId = await createTestSession();
    const photo = await claimedPhoto(sessionId);
    const huge = successResult(photo.id);
    huge.payload = { raw: "x".repeat(100_000) } as never;
    const { error } = await service.rpc("record_analysis_batch", {
      p_session_id: sessionId, p_results: [huge],
    });
    expect(error).toBeNull();
    const { data: row } = await service.from("session_photos")
      .select("analysis_payload").eq("id", photo.id).single();
    expect(row!.analysis_payload.truncated).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `./scripts/content-engine/reset-test-db.sh && npm run test:integration -- rpc-analysis`
Expected: FAIL — `function public.claim_photos_for_analysis(...) does not exist`.

- [ ] **Step 3: Write the migration** (`supabase/migrations/20260611000009_create_analysis_generation_rpcs.sql`)

```sql
-- Analysis + generation claim/record RPCs (spec §8.1 step 1+4-5, §8.2).
-- security definer with pinned search_path; EXECUTE revoked from
-- PUBLIC/anon/authenticated (spec §5). Local-only until the Plan-6 gate.

-- ── claim_photos_for_analysis ───────────────────────────────────────────────
-- Atomic claim: only pending/failed photos or expired processing leases are
-- claimable; unexpired claims cannot be stolen. ai_processing_allowed is
-- enforced HERE (server-side gate, spec §3.1), not just in the route.
create or replace function public.claim_photos_for_analysis(
  p_session_id uuid,
  p_photo_ids uuid[] default null,      -- null = any eligible photo
  p_max_photos int default 4,
  p_lease_seconds int default 180
) returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_allowed boolean;
begin
  select s.ai_processing_allowed into v_allowed
    from public.photography_sessions s where s.id = p_session_id;
  if v_allowed is null then raise exception 'photography session not found'; end if;
  if not v_allowed then
    raise exception 'ai processing is not allowed for this session';
  end if;

  return query
  update public.session_photos sp
     set analysis_status = 'processing',
         analysis_started_at = now(),
         analysis_lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         analysis_attempt = sp.analysis_attempt + 1,
         analysis_error = null
   where sp.id in (
     select sp2.id from public.session_photos sp2
      where sp2.photography_session_id = p_session_id
        and not sp2.excluded
        and (p_photo_ids is null or sp2.id = any (p_photo_ids))
        and (sp2.analysis_status in ('pending','failed')
             or (sp2.analysis_status = 'processing'
                 and sp2.analysis_lease_expires_at <= now()))
      order by sp2.sort_order, sp2.created_at
      limit greatest(p_max_photos, 0)
      for update skip locked
   )
   returning sp.id;
end;
$$;

-- ── record_analysis_batch ───────────────────────────────────────────────────
-- Batch-atomic commit (spec §8.1 step 4): every photo must belong to the
-- session, be processing, and hold an unexpired lease — ANY violation aborts
-- the whole batch ("violations fail only the affected batch"). Raw payloads
-- over 64KB are replaced by a truncation marker (size-capped, spec §3.2).
create or replace function public.record_analysis_batch(
  p_session_id uuid,
  p_results jsonb
) returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_r jsonb;
  v_id uuid;
  v_photo public.session_photos%rowtype;
  v_fields jsonb;
  v_payload jsonb;
  v_count int := 0;
begin
  if p_results is null or jsonb_typeof(p_results) <> 'array'
     or jsonb_array_length(p_results) = 0 then
    raise exception 'p_results must be a non-empty array';
  end if;

  for v_r in select * from jsonb_array_elements(p_results) loop
    v_id := (v_r->>'session_photo_id')::uuid;
    select * into v_photo from public.session_photos where id = v_id for update;
    if not found or v_photo.photography_session_id is distinct from p_session_id then
      raise exception 'photo % is not part of session % — batch rejected', v_id, p_session_id;
    end if;
    if v_photo.analysis_status <> 'processing'
       or v_photo.analysis_lease_expires_at is null
       or v_photo.analysis_lease_expires_at <= now() then
      raise exception 'lease expired or not held for photo % — batch rejected', v_id;
    end if;

    if coalesce((v_r->>'success')::boolean, false) then
      v_fields := coalesce(v_r->'fields', '{}'::jsonb);
      v_payload := case
        when v_r ? 'payload' and length((v_r->'payload')::text) <= 65536 then v_r->'payload'
        when v_r ? 'payload' then jsonb_build_object('truncated', true, 'note', 'payload exceeded 64KB cap')
        else v_photo.analysis_payload
      end;
      update public.session_photos set
        analysis_status = 'completed',
        analyzed_at = now(),
        analysis_error = null,
        analysis_lease_expires_at = null,
        analysis_model = v_r->>'analysis_model',
        analysis_version = v_r->>'analysis_version',
        alt_text = coalesce(v_fields->>'alt_text', alt_text),
        title = coalesce(v_fields->>'title', title),
        description = coalesce(v_fields->>'description', description),
        tags = case when v_fields ? 'tags'
                    then array(select jsonb_array_elements_text(v_fields->'tags'))
                    else tags end,
        quality_score = coalesce((v_fields->>'quality_score')::int, quality_score),
        suggested_category = coalesce(v_fields->>'suggested_category', suggested_category),
        destination_recommendations = coalesce(v_fields->'destination_recommendations',
                                               destination_recommendations),
        analysis_payload = v_payload
      where id = v_id;
    else
      update public.session_photos set
        analysis_status = 'failed',
        analysis_error = left(coalesce(v_r->>'error', 'unknown analysis error'), 2000),
        analysis_lease_expires_at = null,
        analysis_model = v_r->>'analysis_model',
        analysis_version = v_r->>'analysis_version'
      where id = v_id;
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.claim_photos_for_analysis(uuid, uuid[], int, int)
  from public, anon, authenticated;
grant execute on function public.claim_photos_for_analysis(uuid, uuid[], int, int) to service_role;
revoke all on function public.record_analysis_batch(uuid, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_analysis_batch(uuid, jsonb) to service_role;
```

- [ ] **Step 4: Write the rollback** (`..._rollback.sql`)

```sql
-- Function-only migration: no data guards needed (spec §14 pre-launch mode).
begin;
drop function if exists public.record_generation_result(uuid, text, text, text, jsonb);
drop function if exists public.claim_generation_type(uuid, text, int);
drop function if exists public.record_analysis_batch(uuid, jsonb);
drop function if exists public.claim_photos_for_analysis(uuid, uuid[], int, int);
commit;
```

- [ ] **Step 5: Write the verify** (`..._verify.sql`) — covers all four functions (Task 2 adds the other two to the same migration file; this verify is written once, complete)

```sql
do $$
declare
  v_fn text;
  v_sig text;
  v_cfg text[];
begin
  for v_fn, v_sig in
    select * from (values
      ('claim_photos_for_analysis', 'public.claim_photos_for_analysis(uuid, uuid[], int, int)'),
      ('record_analysis_batch',     'public.record_analysis_batch(uuid, jsonb)'),
      ('claim_generation_type',     'public.claim_generation_type(uuid, text, int)'),
      ('record_generation_result',  'public.record_generation_result(uuid, text, text, text, jsonb)')
    ) t(fn, sig)
  loop
    if to_regprocedure(v_sig) is null then
      raise exception '% missing', v_fn;
    end if;
    if has_function_privilege('anon', v_sig, 'execute')
       or has_function_privilege('authenticated', v_sig, 'execute') then
      raise exception '% executable by anon/authenticated', v_fn;
    end if;
    if exists (
      select 1 from pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
      where p.oid = v_sig::regprocedure and a.grantee = 0 and a.privilege_type = 'EXECUTE'
    ) then
      raise exception '% executable by PUBLIC', v_fn;
    end if;
    select proconfig into v_cfg from pg_proc where oid = v_sig::regprocedure;
    if v_cfg is null or not ('search_path=public, pg_temp' = any (v_cfg)) then
      raise exception '% search_path not pinned', v_fn;
    end if;
  end loop;
  raise notice 'VERIFY OK: analysis + generation RPCs';
end $$;
```

NOTE: until Task 2 lands the two generation functions, this verify FAILS on the local reset. That is expected mid-task; Step 6 therefore runs only the targeted test file, and the full reset is exercised at the end of Task 2. If you need a clean reset between, temporarily comment the two generation rows OUT of the verify and restore them in Task 2 — but prefer just proceeding to Task 2 promptly.

- [ ] **Step 6: Apply locally + run the analysis-claims tests**

Run: `psql "$SUPABASE_TEST_DB_URL" -v ON_ERROR_STOP=1 -q -f supabase/migrations/20260611000009_create_analysis_generation_rpcs.sql && npm run test:integration -- rpc-analysis`
(If `psql` is not on PATH, use the docker fallback the reset script uses: `docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20260611000009_create_analysis_generation_rpcs.sql`.)
Expected: all `rpc-analysis-claims` tests PASS.

- [ ] **Step 7: Carry-forward — advisory-lock doc comment in migration 8**

In `supabase/migrations/20260611000008_create_content_engine_rpcs.sql`, find the line:

```sql
    -- race-safe without a unique index on the live table (spec §9.2)
```

Replace it with:

```sql
    -- race-safe without a unique index on the live table (spec §9.2).
    -- ADVISORY-LOCK KEY ASSUMPTION (spec §14 risks): the lock key is the exact
    -- string '<guide>:<location_key>:<derivative_content_hash>' hashed via
    -- hashtextextended(..., 0). Any other code path that ever guards
    -- guide-photo inserts MUST build the identical string — keep construction
    -- in this single place or extract a shared helper first.
```

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260611000009* supabase/migrations/20260611000008_create_content_engine_rpcs.sql tests/integration/rpc-analysis-claims.test.ts
git commit -m "feat: analysis claim and batch-commit RPCs with lease tests"
```

---

### Task 2: Migration 9b — generation claim + record RPCs (test-first)

**Files:**
- Create: `tests/integration/rpc-generation-claims.test.ts`
- Modify: `supabase/migrations/20260611000009_create_analysis_generation_rpcs.sql` (append two functions before the revoke block — keep all revokes/grants together at the end of the file)

- [ ] **Step 1: Write the failing tests** (`tests/integration/rpc-generation-claims.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage } from "./helpers";

beforeAll(() => resetDb());

async function claimType(packageId: string, contentType: string, lease = 180) {
  return service.rpc("claim_generation_type", {
    p_package_id: packageId, p_content_type: contentType, p_lease_seconds: lease,
  });
}

async function recordResult(packageId: string, contentType: string, outcome: string,
  opts: { error?: string; usage?: Record<string, unknown> } = {}) {
  return service.rpc("record_generation_result", {
    p_package_id: packageId, p_content_type: contentType, p_outcome: outcome,
    p_error: opts.error ?? null, p_usage: opts.usage ?? null,
  });
}

async function progressOf(packageId: string) {
  const { data } = await service.from("session_content_packages")
    .select("status,generation_settings").eq("id", packageId).single();
  return { status: data!.status as string, progress: data!.generation_settings.progress };
}

describe("claim_generation_type (spec §8.2)", () => {
  it("claims a pending type: processing, attempt 1, future lease; other types untouched", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);

    const { data: claimed, error } = await claimType(pkg, "journal_post");
    expect(error).toBeNull();
    expect(claimed).toBe(true);

    const { progress } = await progressOf(pkg);
    expect(progress.journal_post.status).toBe("processing");
    expect(progress.journal_post.attempt).toBe(1);
    expect(new Date(progress.journal_post.lease_expires_at).getTime()).toBeGreaterThan(Date.now());
    expect(progress.portfolio_pick.status).toBe("pending");
    expect(progress.portfolio_pick.attempt).toBe(0);
  });

  it("returns false for a live claim; reclaims after the lease expires", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    expect((await claimType(pkg, "journal_post")).data).toBe(true);
    expect((await claimType(pkg, "journal_post")).data).toBe(false); // live, no steal

    // claim with a 0-second lease, then reclaim succeeds
    const sessionId2 = await createTestSession();
    const pkg2 = await createPackage(sessionId2, ["journal_post"]);
    expect((await claimType(pkg2, "journal_post", 0)).data).toBe(true);
    expect((await claimType(pkg2, "journal_post")).data).toBe(true); // expired → reclaim
    const { progress } = await progressOf(pkg2);
    expect(progress.journal_post.attempt).toBe(2);
  });

  it("rejects an unselected type and an archived package", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const unselected = await claimType(pkg, "portfolio_pick");
    expect(unselected.error?.message).toMatch(/not selected/i);

    await service.from("session_content_packages")
      .update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", pkg);
    const archived = await claimType(pkg, "journal_post");
    expect(archived.error?.message).toMatch(/archived/i);
  });

  it("concurrent claims: exactly one winner", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const results = await Promise.all([claimType(pkg, "journal_post"), claimType(pkg, "journal_post")]);
    const wins = results.filter((r) => r.data === true);
    expect(wins).toHaveLength(1);
    const { progress } = await progressOf(pkg);
    expect(progress.journal_post.attempt).toBe(1);
  });
});

describe("record_generation_result + package transitions (spec §8.2)", () => {
  it("completed with usage; package → ready when every selected type is terminal-good", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);

    await claimType(pkg, "journal_post");
    const r1 = await recordResult(pkg, "journal_post", "completed",
      { usage: { model: "claude-sonnet-4-6", input_tokens: 900, output_tokens: 400 } });
    expect(r1.error).toBeNull();
    expect(r1.data).toBe("generating"); // portfolio_pick still pending

    await claimType(pkg, "portfolio_pick");
    const r2 = await recordResult(pkg, "portfolio_pick", "completed",
      { usage: { model: "claude-sonnet-4-6", input_tokens: 700, output_tokens: 300 } });
    expect(r2.data).toBe("ready");

    const { status, progress } = await progressOf(pkg);
    expect(status).toBe("ready");
    expect(progress.journal_post.status).toBe("completed");
    expect(progress.journal_post.usage.input_tokens).toBe(900);
    expect(progress.journal_post.completed_at).not.toBeNull();
    expect(progress.journal_post.lease_expires_at).toBeNull();
  });

  it("failed type → needs_attention once all types are terminal; skip-failed → ready", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post", "portfolio_pick"]);

    await claimType(pkg, "journal_post");
    expect((await recordResult(pkg, "journal_post", "failed", { error: "model error" })).data)
      .toBe("generating"); // portfolio still pending → not terminal yet

    await claimType(pkg, "portfolio_pick");
    expect((await recordResult(pkg, "portfolio_pick", "completed")).data).toBe("needs_attention");

    // Skip failed type (spec §7.4 "Skip failed content type") — failed → skipped → ready
    expect((await recordResult(pkg, "journal_post", "skipped")).data).toBe("ready");
    const { progress } = await progressOf(pkg);
    expect(progress.journal_post.status).toBe("skipped");
    expect(progress.journal_post.error).toBeNull();
  });

  it("completed/failed require a held claim; skipped requires processing or failed", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const noClaim = await recordResult(pkg, "journal_post", "completed");
    expect(noClaim.error?.message).toMatch(/not processing/i);
    const badSkip = await recordResult(pkg, "journal_post", "skipped");
    expect(badSkip.error?.message).toMatch(/cannot be skipped/i);
    const badOutcome = await recordResult(pkg, "journal_post", "exploded");
    expect(badOutcome.error?.message).toMatch(/invalid outcome/i);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm run test:integration -- rpc-generation`
Expected: FAIL — `function public.claim_generation_type(...) does not exist`.

- [ ] **Step 3: Append both functions** to `20260611000009_create_analysis_generation_rpcs.sql`, ABOVE the existing revoke block, and extend the revoke block:

```sql
-- ── claim_generation_type ───────────────────────────────────────────────────
-- Atomic per-type claim via jsonb_set on generation_settings.progress[type]
-- (spec §8.2): row-locks the package, never read-modify-writes the whole
-- object, never touches other types' entries or usage. Completed types and
-- live claims return false (no steal); pending/failed/expired claim and
-- increment attempt. ai_processing_allowed enforced server-side here too.
create or replace function public.claim_generation_type(
  p_package_id uuid,
  p_content_type text,
  p_lease_seconds int default 180
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pkg public.session_content_packages%rowtype;
  v_allowed boolean;
  v_entry jsonb;
begin
  select * into v_pkg from public.session_content_packages
   where id = p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if v_pkg.archived_at is not null then raise exception 'package is archived'; end if;

  select s.ai_processing_allowed into v_allowed
    from public.photography_sessions s where s.id = v_pkg.photography_session_id;
  if not coalesce(v_allowed, false) then
    raise exception 'ai processing is not allowed for this session';
  end if;

  v_entry := v_pkg.generation_settings->'progress'->p_content_type;
  if v_entry is null then
    raise exception 'content type % is not selected for this package', p_content_type;
  end if;

  if not (v_entry->>'status' in ('pending','failed')
          or (v_entry->>'status' = 'processing'
              and coalesce((v_entry->>'lease_expires_at')::timestamptz,
                           'epoch'::timestamptz) <= now())) then
    return false;
  end if;

  update public.session_content_packages
     set generation_settings = jsonb_set(
           generation_settings,
           array['progress', p_content_type],
           v_entry || jsonb_build_object(
             'status', 'processing',
             'attempt', coalesce((v_entry->>'attempt')::int, 0) + 1,
             'lease_started_at', to_jsonb(now()),
             'lease_expires_at', to_jsonb(now() + make_interval(secs => p_lease_seconds)),
             'error', null))
   where id = p_package_id;
  return true;
end;
$$;

-- ── record_generation_result ────────────────────────────────────────────────
-- Writes ONE type's terminal progress entry atomically with its usage
-- (spec §11: "written atomically with that type's progress"), then recomputes
-- the package status (spec §8.2): any pending/processing → 'generating';
-- all completed|skipped → 'ready'; otherwise (≥1 failed, all terminal)
-- → 'needs_attention'. 'skipped' from 'failed' is the Skip-failed-type action.
create or replace function public.record_generation_result(
  p_package_id uuid,
  p_content_type text,
  p_outcome text,
  p_error text default null,
  p_usage jsonb default null
) returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_pkg public.session_content_packages%rowtype;
  v_entry jsonb;
  v_progress jsonb;
  v_k text;
  v_s text;
  v_all_terminal boolean := true;
  v_any_failed boolean := false;
  v_new_status text;
begin
  if p_outcome not in ('completed','failed','skipped') then
    raise exception 'invalid outcome %', p_outcome;
  end if;

  select * into v_pkg from public.session_content_packages
   where id = p_package_id for update;
  if not found then raise exception 'package not found'; end if;
  if v_pkg.archived_at is not null then raise exception 'package is archived'; end if;

  v_entry := v_pkg.generation_settings->'progress'->p_content_type;
  if v_entry is null then
    raise exception 'content type % is not selected for this package', p_content_type;
  end if;
  if p_outcome in ('completed','failed') and v_entry->>'status' <> 'processing' then
    raise exception 'type % is not processing (status=%)', p_content_type, v_entry->>'status';
  end if;
  if p_outcome = 'skipped' and v_entry->>'status' not in ('processing','failed') then
    raise exception 'type % cannot be skipped from status %', p_content_type, v_entry->>'status';
  end if;

  v_entry := v_entry || jsonb_build_object(
    'status', p_outcome,
    'completed_at', case when p_outcome in ('completed','skipped')
                         then to_jsonb(now()) else 'null'::jsonb end,
    'error', case when p_outcome = 'failed' and p_error is not null
                  then to_jsonb(left(p_error, 2000)) else 'null'::jsonb end,
    'usage', coalesce(p_usage, v_entry->'usage', 'null'::jsonb),
    'lease_expires_at', 'null'::jsonb);

  v_progress := jsonb_set(v_pkg.generation_settings->'progress',
                          array[p_content_type], v_entry);

  for v_k in
    select jsonb_array_elements_text(v_pkg.generation_settings->'selected_types')
  loop
    v_s := v_progress->v_k->>'status';
    if v_s in ('pending','processing') then v_all_terminal := false; end if;
    if v_s = 'failed' then v_any_failed := true; end if;
  end loop;

  v_new_status := case
    when not v_all_terminal then 'generating'
    when v_any_failed then 'needs_attention'
    else 'ready' end;

  update public.session_content_packages
     set generation_settings = jsonb_set(generation_settings, '{progress}', v_progress),
         status = v_new_status
   where id = p_package_id;
  return v_new_status;
end;
$$;
```

And extend the revoke/grant block at the end of the file:

```sql
revoke all on function public.claim_generation_type(uuid, text, int)
  from public, anon, authenticated;
grant execute on function public.claim_generation_type(uuid, text, int) to service_role;
revoke all on function public.record_generation_result(uuid, text, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.record_generation_result(uuid, text, text, text, jsonb) to service_role;
```

- [ ] **Step 4: Full reset + run both RPC suites**

Run: `./scripts/content-engine/reset-test-db.sh && npm run test:integration -- rpc-`
Expected: reset prints `VERIFY OK: analysis + generation RPCs` (all four functions now exist) plus all prior VERIFY OKs; both `rpc-analysis-claims` and `rpc-generation-claims` suites PASS. Then run the FULL `npm run test:integration` — all prior suites still green.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260611000009_create_analysis_generation_rpcs.sql tests/integration/rpc-generation-claims.test.ts
git commit -m "feat: generation claim and record RPCs with package status transitions"
```

---

### Task 3: AI pricing map (spec §11)

**Files:**
- Create: `lib/contentEngine/aiPricing.ts`
- Create: `tests/unit/aiPricing.test.ts`

- [ ] **Step 1: Verify current per-model prices.** WebFetch `https://docs.claude.com/en/docs/about-claude/pricing` (fallback: `https://www.anthropic.com/pricing`) and note the $/1M input and output token prices for `claude-sonnet-4-6`, `claude-haiku-4-5`, and `claude-opus-4-7`. If the fetch fails, use the placeholder values in Step 4's code and add `// TODO(pricing): verify` is NOT allowed — instead record the values you could confirm and flag unconfirmed ones in your report (the map is editable; estimates are always labeled).

- [ ] **Step 2: Write the failing test** (`tests/unit/aiPricing.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import { AI_RATE_MAP, estimateCostUsd } from "@/lib/contentEngine/aiPricing";

describe("aiPricing (spec §11)", () => {
  it("has rates for the engine default model", () => {
    expect(AI_RATE_MAP["claude-sonnet-4-6"].inputPerMTokUsd).toBeGreaterThan(0);
    expect(AI_RATE_MAP["claude-sonnet-4-6"].outputPerMTokUsd).toBeGreaterThan(0);
  });

  it("computes a cost estimate from recorded usage only", () => {
    const { totalUsd, unknownModels } = estimateCostUsd([
      { model: "claude-sonnet-4-6", input_tokens: 1_000_000, output_tokens: 0 },
      { model: "claude-sonnet-4-6", input_tokens: 0, output_tokens: 1_000_000 },
    ]);
    const rate = AI_RATE_MAP["claude-sonnet-4-6"];
    expect(totalUsd).toBeCloseTo(rate.inputPerMTokUsd + rate.outputPerMTokUsd, 6);
    expect(unknownModels).toEqual([]);
  });

  it("reports unknown models instead of guessing", () => {
    const { totalUsd, unknownModels } = estimateCostUsd([
      { model: "future-model-x", input_tokens: 1000, output_tokens: 1000 },
    ]);
    expect(totalUsd).toBe(0);
    expect(unknownModels).toEqual(["future-model-x"]);
  });

  it("handles empty usage", () => {
    expect(estimateCostUsd([])).toEqual({ totalUsd: 0, unknownModels: [] });
  });
});
```

- [ ] **Step 3: Run to verify failure** — `npm test -- aiPricing` → FAIL (module missing).

- [ ] **Step 4: Write the module** (`lib/contentEngine/aiPricing.ts`)

```ts
// Maintained per-model rate map (spec §11). Cost figures are ALWAYS estimates
// computed from actual recorded token usage — never from fabricated counts.
// Update rates from https://docs.claude.com/en/docs/about-claude/pricing when
// they change; unknown models are surfaced, never guessed.
export interface ModelRate {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
}

// Verified against the Claude pricing docs on 2026-06-11 (Task 3 Step 1).
export const AI_RATE_MAP: Record<string, ModelRate> = {
  "claude-sonnet-4-6": { inputPerMTokUsd: 3, outputPerMTokUsd: 15 },
  "claude-haiku-4-5": { inputPerMTokUsd: 1, outputPerMTokUsd: 5 },
  "claude-opus-4-7": { inputPerMTokUsd: 5, outputPerMTokUsd: 25 },
};

export interface UsageEntry {
  model: string;
  input_tokens: number;
  output_tokens: number;
}

export interface CostEstimate {
  totalUsd: number;
  unknownModels: string[];
}

export function estimateCostUsd(usages: UsageEntry[]): CostEstimate {
  let totalUsd = 0;
  const unknown = new Set<string>();
  for (const u of usages) {
    const rate = AI_RATE_MAP[u.model];
    if (!rate) {
      unknown.add(u.model);
      continue;
    }
    totalUsd += (u.input_tokens / 1_000_000) * rate.inputPerMTokUsd
              + (u.output_tokens / 1_000_000) * rate.outputPerMTokUsd;
  }
  return { totalUsd, unknownModels: [...unknown] };
}
```

Replace the three rate values with the prices confirmed in Step 1 (the ones shown are the best-known placeholders; if Step 1 confirmed different numbers, use those).

- [ ] **Step 5: Run to verify pass** — `npm test -- aiPricing` → PASS. Then full `npm test` (no regressions) and `npx tsc --noEmit` (clean).

- [ ] **Step 6: Commit**

```bash
git add lib/contentEngine/aiPricing.ts tests/unit/aiPricing.test.ts
git commit -m "feat: maintained AI rate map and cost estimator"
```

---

### Task 4: Model-caller seam + prompt construction (spec §8.3)

**Files:**
- Create: `lib/contentEngine/aiClient.ts`
- Create: `lib/contentEngine/prompts.ts`
- Create: `tests/unit/prompts.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/prompts.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  PROMPT_VERSION, buildAnalysisPrompt, buildJournalPrompt, buildPortfolioPickPrompt,
  buildSchoolPagePhotoPrompt, buildGuidePhotoPrompt, buildInternalLinkPrompt,
} from "@/lib/contentEngine/prompts";
import { CANONICAL_INTERNAL_LINKS, guideLocationKeys } from "@/lib/contentEngine/taxonomy";
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";

const facts: SessionFactsSnapshot = {
  public_display_name: "Mia", service_type: "grads", school_slug: "sjsu",
  primary_location: "Tower Lawn", secondary_locations: [], session_date: "2026-05-01",
  lighting_condition: "golden_hour", graduation_year: 2026, degree: "B.S. Biology",
  outfit_count: 2, group_size: 1, public_session_summary: "A sunset grad shoot.",
};

const photoSummaries = [
  { session_photo_id: "11111111-1111-4111-8111-111111111111", alt_text: "Cap toss", title: "Cap toss",
    description: "", tags: ["sjsu"], quality_score: 9, suggested_category: "grads" as const },
];

describe("prompt construction (spec §8.3)", () => {
  it("exports a non-empty PROMPT_VERSION", () => {
    expect(PROMPT_VERSION.length).toBeGreaterThan(0);
  });

  it("analysis prompt demands JSON keyed by session_photo_id and lists every id", () => {
    const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"];
    const p = buildAnalysisPrompt(facts, ids);
    expect(p.system.toLowerCase()).toContain("json");
    for (const id of ids) expect(p.userText).toContain(id);
    expect(p.userText).toContain("session_photo_id");
    expect(p.userText).toContain("Mia"); // public display name allowed
  });

  it("journal prompt embeds links, the testimonial quote, and the public facts", () => {
    const p = buildJournalPrompt(facts, photoSummaries, {
      links: [{ url: "/grads/sjsu", label: "SJSU grad sessions" }],
      testimonialQuote: "Chris made it feel easy!",
    });
    expect(p.userText).toContain("/grads/sjsu");
    expect(p.userText).toContain("Chris made it feel easy!");
    expect(p.userText).toContain("golden_hour");
    expect(p.system).toContain("soloxsnaps");
  });

  it("internal-link prompt carries the full closed canonical list and forbids others", () => {
    const p = buildInternalLinkPrompt(facts);
    for (const url of CANONICAL_INTERNAL_LINKS) expect(p.userText).toContain(url);
    expect(p.system.toLowerCase()).toMatch(/only.*list|list.*only/);
  });

  it("guide prompt carries only the chosen guide's closed location keys", () => {
    const p = buildGuidePhotoPrompt({ ...facts, service_type: "families" }, photoSummaries, "family");
    for (const key of guideLocationKeys("family")) expect(p.userText).toContain(key);
    expect(p.userText).not.toContain("legion-of-honor"); // couples-only key
  });

  it("portfolio + school prompts include photo summaries with their ids", () => {
    const p1 = buildPortfolioPickPrompt(facts, photoSummaries);
    const p2 = buildSchoolPagePhotoPrompt(facts, photoSummaries, "sjsu");
    expect(p1.userText).toContain(photoSummaries[0].session_photo_id);
    expect(p2.userText).toContain("sjsu");
  });

  it("prompts are built ONLY from the snapshot type — no internal fields can appear", () => {
    // Type-level guarantee: buildersaccept SessionFactsSnapshot, which has no
    // internal_client_name/internal_notes/email. Runtime double-check:
    const all = [
      buildAnalysisPrompt(facts, ["11111111-1111-4111-8111-111111111111"]),
      buildJournalPrompt(facts, photoSummaries, { links: [], testimonialQuote: null }),
      buildInternalLinkPrompt(facts),
    ];
    for (const p of all) {
      expect(p.system + p.userText).not.toMatch(/internal_client_name|internal_notes/);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- prompts` → FAIL (module missing).

- [ ] **Step 3: Write the model-caller seam** (`lib/contentEngine/aiClient.ts`)

```ts
// Thin seam over the Anthropic SDK so services accept an injected ModelCaller
// and integration tests run with a deterministic fake (never the real API).
import Anthropic from "@anthropic-ai/sdk";

// spec §8.3: claude-sonnet-4-6 is the engine default for analysis + generation,
// recorded per call, overridable via generation_settings.overrides.model_name.
export const DEFAULT_ENGINE_MODEL = "claude-sonnet-4-6";

export interface ModelUsage {
  input_tokens: number;
  output_tokens: number;
}

export interface ModelCallRequest {
  model: string;
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens: number;
}

export interface ModelCallResult {
  text: string;
  usage: ModelUsage;
  model: string;
}

export type ModelCaller = (req: ModelCallRequest) => Promise<ModelCallResult>;

export function createAnthropicCaller(apiKey: string): ModelCaller {
  const client = new Anthropic({ apiKey });
  return async (req) => {
    const response = await client.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: req.messages,
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return {
      text,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      model: response.model,
    };
  };
}
```

- [ ] **Step 4: Write the prompts module** (`lib/contentEngine/prompts.ts`)

```ts
// All engine prompts live here (spec §8.3) and carry PROMPT_VERSION, which is
// stored on every package and item. Builders accept ONLY SessionFactsSnapshot
// (no internal_client_name / internal_notes / email by type construction) plus
// closed taxonomy lists — output destinations outside those lists fail Zod
// validation downstream.
import type { SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import {
  CANONICAL_INTERNAL_LINKS, guideLocationKeys, PORTFOLIO_CATEGORIES,
  type GuideType, type SchoolSlug,
} from "@/lib/contentEngine/taxonomy";

export const PROMPT_VERSION = "2026-06-11.1";

export interface BuiltPrompt {
  system: string;
  userText: string;
}

export interface PhotoSummary {
  session_photo_id: string;
  alt_text: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  quality_score: number | null;
  suggested_category: string | null;
}

const BRAND =
  "You write for soloxsnaps, a Bay Area photographer (grads, couples, families). " +
  "Voice: warm, specific, natural — never keyword-stuffed, never invented facts.";

function factsBlock(facts: SessionFactsSnapshot): string {
  return `Session facts (the ONLY facts you may use):\n${JSON.stringify(facts, null, 2)}`;
}

function summariesBlock(photos: PhotoSummary[]): string {
  return `Analyzed photos:\n${JSON.stringify(photos, null, 2)}`;
}

export function buildAnalysisPrompt(facts: SessionFactsSnapshot, photoIds: string[]): BuiltPrompt {
  return {
    system:
      `${BRAND} You analyze session photographs for marketing use. ` +
      "Return ONLY a JSON object — no prose, no markdown fences.",
    userText:
      `${factsBlock(facts)}\n\n` +
      `You are given ${photoIds.length} image(s). Image N corresponds to session_photo_id N in this list:\n` +
      photoIds.map((id, i) => `${i + 1}. ${id}`).join("\n") +
      "\n\nReturn JSON: {\"photos\":[{\"session_photo_id\":\"<uuid from the list>\"," +
      "\"alt_text\":\"<=300 chars, descriptive, mentions setting/light/attire\"," +
      "\"title\":\"<=160 chars\",\"description\":\"<=1000 chars\"," +
      "\"tags\":[\"<=15 short tags\"],\"quality_score\":1-10," +
      `\"suggested_category\":one of ${JSON.stringify(PORTFOLIO_CATEGORIES)} or null,` +
      "\"destination_recommendations\":{\"portfolio\":bool,\"school_page\":bool,\"guide\":bool,\"journal\":bool}}]}\n" +
      "Every listed session_photo_id must appear EXACTLY once. Key results by session_photo_id, never by position alone.",
  };
}

export interface JournalInputs {
  links: { url: string; label: string }[];
  testimonialQuote: string | null;
}

export function buildJournalPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], inputs: JournalInputs,
): BuiltPrompt {
  return {
    system:
      `${BRAND} You draft a journal/blog post about one photo session. ` +
      "Return ONLY JSON: {\"title\",\"slug\" (lowercase-kebab),\"body\" (markdown)," +
      "\"meta_description\" (<=160 chars),\"photo_ids\":[uuids],\"cover_photo_id\":uuid}. " +
      "Choose photo_ids and the cover from the provided analyzed photos only.",
    userText:
      `${factsBlock(facts)}\n\n${summariesBlock(photos)}\n\n` +
      `Internal links to weave naturally into the body where relevant (use markdown links; do not invent others):\n` +
      `${JSON.stringify(inputs.links)}\n\n` +
      (inputs.testimonialQuote
        ? `Client words to include as a blockquote, attributed to ${facts.public_display_name ?? "the client"}: "${inputs.testimonialQuote}"\n\n`
        : "") +
      "Write 350-600 words. Mention the location and light honestly.",
  };
}

export function buildPortfolioPickPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[],
): BuiltPrompt {
  return {
    system:
      `${BRAND} You select portfolio-worthy photos. Return ONLY JSON: ` +
      "{\"picks\":[{\"session_photo_id\":uuid,\"category\":" +
      `one of ${JSON.stringify(PORTFOLIO_CATEGORIES)},` +
      "\"title\":\"<=160\",\"alt_text\":\"<=300\",\"description\":\"\",\"featured\":false}]}. " +
      "Pick at most 8, only quality_score >= 7 unless nothing qualifies (then pick the best 1).",
    userText: `${factsBlock(facts)}\n\n${summariesBlock(photos)}`,
  };
}

export function buildSchoolPagePhotoPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], schoolSlug: SchoolSlug,
): BuiltPrompt {
  return {
    system:
      `${BRAND} You choose photos for a university page gallery. Return ONLY JSON: ` +
      "{\"placements\":[{\"session_photo_id\":uuid,\"school_slug\":\"" + schoolSlug + "\"," +
      "\"alt_override\":\"\",\"caption\":\"<=300\",\"sort_order\":0}]}. Pick at most 4.",
    userText: `${factsBlock(facts)}\n\nschool_slug: ${schoolSlug}\n\n${summariesBlock(photos)}`,
  };
}

export function buildGuidePhotoPrompt(
  facts: SessionFactsSnapshot, photos: PhotoSummary[], guide: GuideType,
): BuiltPrompt {
  const keys = guideLocationKeys(guide);
  return {
    system:
      `${BRAND} You place photos on location-guide pages. Return ONLY JSON: ` +
      "{\"placements\":[{\"session_photo_id\":uuid,\"guide\":\"" + guide + "\"," +
      "\"location_key\":\"<one of the allowed keys>\",\"alt_text\":\"<=300\"}]}. " +
      "If no allowed location matches the session, return {\"placements\":[]}.",
    userText:
      `${factsBlock(facts)}\n\nAllowed location keys for the ${guide} guide ` +
      `(any other value is invalid): ${JSON.stringify(keys)}\n\n${summariesBlock(photos)}`,
  };
}

export function buildInternalLinkPrompt(facts: SessionFactsSnapshot): BuiltPrompt {
  return {
    system:
      `${BRAND} You suggest internal links for a journal post. You may use ONLY ` +
      "urls from the provided list — anything else is invalid. Return ONLY JSON: " +
      "{\"links\":[{\"url\":\"<from list>\",\"label\":\"<=120\",\"reason\":\"<=300\"}]}. Suggest 2-5.",
    userText:
      `${factsBlock(facts)}\n\nCanonical internal links (closed list):\n` +
      JSON.stringify([...CANONICAL_INTERNAL_LINKS], null, 1),
  };
}
```

- [ ] **Step 5: Run to verify pass** — `npm test -- prompts` → PASS. Then `npx tsc --noEmit` (clean; `Anthropic.TextBlock` and `Anthropic.MessageParam` come from the installed `@anthropic-ai/sdk`; if the `TextBlock` type name differs in the installed SDK version, check `node_modules/@anthropic-ai/sdk` exports and use the correct narrowing — behavior must stay: join all text blocks).

- [ ] **Step 6: Commit**

```bash
git add lib/contentEngine/aiClient.ts lib/contentEngine/prompts.ts tests/unit/prompts.test.ts
git commit -m "feat: model-caller seam and versioned engine prompts"
```

---

### Task 5: Adaptive batching helpers (spec §8.1 step 2)

**Files:**
- Create: `lib/contentEngine/analysisBatching.ts`
- Create: `tests/unit/analysisBatching.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/analysisBatching.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  MAX_PHOTOS_PER_BATCH, MAX_BATCH_IMAGE_BYTES, ANALYSIS_ENCODE_LADDER,
  chunkForAnalysis, ladderStep, totalBytes,
} from "@/lib/contentEngine/analysisBatching";

describe("adaptive batching (spec §8.1 step 2)", () => {
  it("caps batches at 4 photos", () => {
    expect(MAX_PHOTOS_PER_BATCH).toBe(4);
    expect(chunkForAnalysis(["a", "b", "c", "d", "e", "f"])).toEqual([["a", "b", "c", "d"], ["e", "f"]]);
    expect(chunkForAnalysis([])).toEqual([]);
    expect(chunkForAnalysis(["a"])).toEqual([["a"]]);
  });

  it("ladder steps shrink monotonically and clamp at the last step", () => {
    expect(MAX_BATCH_IMAGE_BYTES).toBe(4 * 1024 * 1024);
    for (let i = 1; i < ANALYSIS_ENCODE_LADDER.length; i++) {
      expect(ANALYSIS_ENCODE_LADDER[i].maxDimension).toBeLessThan(ANALYSIS_ENCODE_LADDER[i - 1].maxDimension);
      expect(ANALYSIS_ENCODE_LADDER[i].quality).toBeLessThan(ANALYSIS_ENCODE_LADDER[i - 1].quality);
    }
    expect(ladderStep(0)).toEqual(ANALYSIS_ENCODE_LADDER[0]);
    expect(ladderStep(99)).toEqual(ANALYSIS_ENCODE_LADDER[ANALYSIS_ENCODE_LADDER.length - 1]);
    expect(ladderStep(-1)).toEqual(ANALYSIS_ENCODE_LADDER[0]);
  });

  it("totalBytes sums buffer lengths", () => {
    expect(totalBytes([Buffer.alloc(10), Buffer.alloc(5)])).toBe(15);
    expect(totalBytes([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- analysisBatching` → FAIL.

- [ ] **Step 3: Write the module** (`lib/contentEngine/analysisBatching.ts`)

```ts
// Adaptive batching constants + pure helpers (spec §8.1 step 2): <=4 photos
// per request, a combined encoded-bytes cap, and a quality/dimension ladder
// the analysis service walks until a batch fits. The UI calls this "batch
// processing"; each route call processes one batch to stay under maxDuration.
export const MAX_PHOTOS_PER_BATCH = 4;
export const MAX_BATCH_IMAGE_BYTES = 4 * 1024 * 1024; // combined encoded payload cap

export interface EncodeStep {
  maxDimension: number;
  quality: number;
}

export const ANALYSIS_ENCODE_LADDER: readonly EncodeStep[] = [
  { maxDimension: 1600, quality: 78 },
  { maxDimension: 1400, quality: 68 },
  { maxDimension: 1200, quality: 60 },
  { maxDimension: 1000, quality: 52 },
];

export function chunkForAnalysis<T>(items: T[], maxPerBatch = MAX_PHOTOS_PER_BATCH): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += maxPerBatch) {
    batches.push(items.slice(i, i + maxPerBatch));
  }
  return batches;
}

export function ladderStep(step: number): EncodeStep {
  const clamped = Math.min(Math.max(step, 0), ANALYSIS_ENCODE_LADDER.length - 1);
  return ANALYSIS_ENCODE_LADDER[clamped];
}

export function totalBytes(buffers: Buffer[]): number {
  return buffers.reduce((sum, b) => sum + b.length, 0);
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- analysisBatching` → PASS; full `npm test` green.

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/analysisBatching.ts tests/unit/analysisBatching.test.ts
git commit -m "feat: adaptive analysis batching constants and helpers"
```

---

### Task 6: Analysis response schema + identity validation (spec §8.1 steps 3-4)

**Files:**
- Create: `lib/contentEngine/analysisResponse.ts`
- Create: `tests/unit/analysisResponse.test.ts`

- [ ] **Step 1: Write the failing test** (`tests/unit/analysisResponse.test.ts`)

```ts
import { describe, it, expect } from "vitest";
import {
  validateAnalysisResponse, extractJsonObject, AnalysisValidationError,
} from "@/lib/contentEngine/analysisResponse";

const ID1 = "11111111-1111-4111-8111-111111111111";
const ID2 = "22222222-2222-4222-8222-222222222222";

function photo(id: string, extra: Record<string, unknown> = {}) {
  return {
    session_photo_id: id, alt_text: "Grad at Tower Lawn", title: "Tower Lawn",
    description: "Golden hour portrait", tags: ["sjsu"], quality_score: 8,
    suggested_category: "grads", destination_recommendations: { portfolio: true },
    ...extra,
  };
}

describe("extractJsonObject", () => {
  it("parses a bare JSON object and one wrapped in prose/fences", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonObject('Here you go:\n```json\n{"a":1}\n```\nthanks')).toEqual({ a: 1 });
  });
  it("throws on text with no JSON object", () => {
    expect(() => extractJsonObject("no json here")).toThrow(AnalysisValidationError);
  });
});

describe("validateAnalysisResponse (identity validation, spec §8.1 step 4)", () => {
  it("accepts a complete keyed response", () => {
    const text = JSON.stringify({ photos: [photo(ID1), photo(ID2)] });
    const out = validateAnalysisResponse(text, [ID1, ID2]);
    expect(out).toHaveLength(2);
    expect(out[0].session_photo_id).toBe(ID1);
    expect(out[0].quality_score).toBe(8);
  });

  it("rejects a missing id, an unknown id, and a duplicate id", () => {
    const missing = JSON.stringify({ photos: [photo(ID1)] });
    expect(() => validateAnalysisResponse(missing, [ID1, ID2])).toThrow(/missing/i);

    const unknown = JSON.stringify({ photos: [photo(ID1), photo("33333333-3333-4333-8333-333333333333")] });
    expect(() => validateAnalysisResponse(unknown, [ID1, ID2])).toThrow(/unknown/i);

    const dup = JSON.stringify({ photos: [photo(ID1), photo(ID1)] });
    expect(() => validateAnalysisResponse(dup, [ID1, ID1])).toThrow(/duplicate/i);
  });

  it("rejects hostile field values (bad category, out-of-range score, wrong types)", () => {
    const badCat = JSON.stringify({ photos: [photo(ID1, { suggested_category: "weddings" })] });
    expect(() => validateAnalysisResponse(badCat, [ID1])).toThrow();
    const badScore = JSON.stringify({ photos: [photo(ID1, { quality_score: 11 })] });
    expect(() => validateAnalysisResponse(badScore, [ID1])).toThrow();
    const badTags = JSON.stringify({ photos: [photo(ID1, { tags: "not-an-array" })] });
    expect(() => validateAnalysisResponse(badTags, [ID1])).toThrow();
  });

  it("tolerates null optional fields", () => {
    const text = JSON.stringify({
      photos: [photo(ID1, { suggested_category: null, destination_recommendations: null })],
    });
    const out = validateAnalysisResponse(text, [ID1]);
    expect(out[0].suggested_category).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm test -- analysisResponse` → FAIL.

- [ ] **Step 3: Write the module** (`lib/contentEngine/analysisResponse.ts`)

```ts
// Vision-response validation (spec §8.1 steps 3-4). The model must key results
// by session_photo_id — never array position — and identity validation
// requires every requested id EXACTLY once with no unknown/missing/duplicate
// ids. Violations fail only the affected batch.
import { z } from "zod";
import { PORTFOLIO_CATEGORIES } from "@/lib/contentEngine/taxonomy";

export class AnalysisValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisValidationError";
  }
}

const photoAnalysisSchema = z.object({
  session_photo_id: z.uuid(),
  alt_text: z.string().min(1).max(300),
  title: z.string().max(160).nullable().default(""),
  description: z.string().max(1000).nullable().default(""),
  tags: z.array(z.string().max(60)).max(15).default([]),
  quality_score: z.number().int().min(1).max(10),
  suggested_category: z.enum(PORTFOLIO_CATEGORIES).nullable().default(null),
  destination_recommendations: z
    .object({
      portfolio: z.boolean().optional(),
      school_page: z.boolean().optional(),
      guide: z.boolean().optional(),
      journal: z.boolean().optional(),
    })
    .nullable()
    .default(null),
});
export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;

export const analysisResponseSchema = z.object({
  photos: z.array(photoAnalysisSchema).min(1),
});

// Pull the first {...} object out of model text (tolerates prose/code fences).
export function extractJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) {
    throw new AnalysisValidationError("model response contains no JSON object");
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    throw new AnalysisValidationError(`model response is not valid JSON: ${String(err)}`);
  }
}

export function validateAnalysisResponse(text: string, expectedIds: string[]): PhotoAnalysis[] {
  const parsed = analysisResponseSchema.safeParse(extractJsonObject(text));
  if (!parsed.success) {
    throw new AnalysisValidationError(`analysis schema validation failed: ${parsed.error.message}`);
  }
  const photos = parsed.data.photos;

  const expected = new Set(expectedIds);
  const seen = new Set<string>();
  for (const p of photos) {
    if (!expected.has(p.session_photo_id)) {
      throw new AnalysisValidationError(`unknown session_photo_id in response: ${p.session_photo_id}`);
    }
    if (seen.has(p.session_photo_id)) {
      throw new AnalysisValidationError(`duplicate session_photo_id in response: ${p.session_photo_id}`);
    }
    seen.add(p.session_photo_id);
  }
  for (const id of expected) {
    if (!seen.has(id)) {
      throw new AnalysisValidationError(`missing session_photo_id in response: ${id}`);
    }
  }
  return photos;
}
```

- [ ] **Step 4: Run to verify pass** — `npm test -- analysisResponse` → PASS; full `npm test` green; `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add lib/contentEngine/analysisResponse.ts tests/unit/analysisResponse.test.ts
git commit -m "feat: identity-validated analysis response schema"
```

---

### Task 7: Image encoding for the model + analysis service (spec §8.1)

**Files:**
- Create: `lib/contentEngine/modelImages.ts`
- Create: `lib/contentEngine/analyzePhotos.ts`
- Create: `tests/integration/analyze-photos.test.ts`

- [ ] **Step 1: Write the failing integration test** (`tests/integration/analyze-photos.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { service, resetDb, createTestSession } from "./helpers";
import { finalizeUpload } from "@/lib/contentEngine/finalizeUpload";
import { ORIGINALS_BUCKET, issueUploadPath } from "@/lib/contentEngine/uploadConfig";
import { runAnalysisBatch } from "@/lib/contentEngine/analyzePhotos";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import type { ModelCaller } from "@/lib/contentEngine/aiClient";

beforeAll(() => resetDb());

// Real bytes in real storage: upload + finalize like production does.
async function realPhoto(sessionId: string, seed: number) {
  const buf = await sharp({
    create: { width: 320, height: 240, channels: 3, background: { r: seed % 255, g: 120, b: 90 } },
  }).jpeg().toBuffer();
  const path = issueUploadPath(sessionId, "image/jpeg");
  const { error } = await service.storage.from(ORIGINALS_BUCKET).upload(path, buf, { contentType: "image/jpeg" });
  if (error) throw error;
  return finalizeUpload({
    client: service, sessionId, storagePath: path,
    declared: { filename: `p${seed}.jpg`, mime: "image/jpeg", sizeBytes: buf.length, contentHash: "" },
  });
}

function analysisJson(ids: string[]) {
  return JSON.stringify({
    photos: ids.map((id) => ({
      session_photo_id: id, alt_text: "Grad at Tower Lawn golden hour", title: "Tower Lawn",
      description: "Backlit portrait", tags: ["sjsu", "golden hour"], quality_score: 8,
      suggested_category: "grads", destination_recommendations: { portfolio: true },
    })),
  });
}

function fakeModel(buildText: (idsInPrompt: string[]) => string): { caller: ModelCaller; calls: number[] } {
  const calls: number[] = [];
  const caller: ModelCaller = async (req) => {
    // ids appear in the user text block (spec: results keyed by session_photo_id)
    const textBlock = (req.messages[0].content as { type: string; text?: string }[])
      .filter((b) => b.type === "text").map((b) => b.text).join("\n");
    const ids = [...textBlock.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g)]
      .map((m) => m[0]);
    const imageBlocks = (req.messages[0].content as { type: string }[]).filter((b) => b.type === "image");
    calls.push(imageBlocks.length);
    return { text: buildText([...new Set(ids)]), usage: { input_tokens: 1234, output_tokens: 567 }, model: req.model };
  };
  return { caller, calls };
}

describe("runAnalysisBatch (spec §8.1)", () => {
  it("claims, downloads, sends images, validates, and commits completed analyses", async () => {
    const sessionId = await createTestSession();
    const p1 = await realPhoto(sessionId, 1);
    const p2 = await realPhoto(sessionId, 2);
    const fake = fakeModel((ids) => analysisJson(ids));

    const result = await runAnalysisBatch({ client: service, callModel: fake.caller, sessionId });
    expect(result.claimed).toBe(2);
    expect(result.completed).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.remaining).toBe(0);
    expect(fake.calls[0]).toBe(2); // one image block per claimed photo

    const { data: rows } = await service.from("session_photos")
      .select("id,analysis_status,alt_text,quality_score,analysis_model,analysis_version,analysis_payload")
      .in("id", [p1.id, p2.id]);
    for (const row of rows!) {
      expect(row.analysis_status).toBe("completed");
      expect(row.alt_text).toBe("Grad at Tower Lawn golden hour");
      expect(row.quality_score).toBe(8);
      expect(row.analysis_model).toBe("claude-sonnet-4-6");
      expect(row.analysis_version).toBe(PROMPT_VERSION);
      expect(row.analysis_payload.usage.input_tokens).toBe(1234);
    }
  });

  it("marks the whole claimed batch failed when identity validation fails", async () => {
    const sessionId = await createTestSession();
    const photo = await realPhoto(sessionId, 3);
    const fake = fakeModel(() => analysisJson(["99999999-9999-4999-8999-999999999999"])); // unknown id

    const result = await runAnalysisBatch({ client: service, callModel: fake.caller, sessionId });
    expect(result.claimed).toBe(1);
    expect(result.failed).toBe(1);
    const { data: row } = await service.from("session_photos")
      .select("analysis_status,analysis_error").eq("id", photo.id).single();
    expect(row!.analysis_status).toBe("failed");
    expect(row!.analysis_error).toMatch(/unknown session_photo_id/i);
  });

  it("returns zeros when nothing is eligible and reports remaining when more await", async () => {
    const sessionId = await createTestSession();
    const idle = await runAnalysisBatch({
      client: service, callModel: fakeModel((ids) => analysisJson(ids)).caller, sessionId,
    });
    expect(idle).toEqual({ claimed: 0, completed: 0, failed: 0, remaining: 0 });

    // 5 photos: one batch of 4 leaves 1 remaining
    for (let i = 10; i < 15; i++) await realPhoto(sessionId, i);
    const fake = fakeModel((ids) => analysisJson(ids));
    const first = await runAnalysisBatch({ client: service, callModel: fake.caller, sessionId });
    expect(first.claimed).toBe(4);
    expect(first.remaining).toBe(1);
  });

  it("refuses a session without ai_processing_allowed", async () => {
    const sessionId = await createTestSession({ ai_processing_allowed: false });
    await expect(
      runAnalysisBatch({ client: service, callModel: fakeModel((ids) => analysisJson(ids)).caller, sessionId }),
    ).rejects.toThrow(/ai processing/i);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm run test:integration -- analyze-photos` → FAIL (modules missing).

- [ ] **Step 3: Write the image-encoding module** (`lib/contentEngine/modelImages.ts`)

```ts
// Downloads private originals and encodes them for a vision request
// (spec §8.1 step 2): EXIF-orient, downscale, JPEG-encode, and walk the
// quality/dimension ladder until the combined payload fits the batch cap.
import sharp from "sharp";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ANALYSIS_ENCODE_LADDER, MAX_BATCH_IMAGE_BYTES, ladderStep, totalBytes,
} from "@/lib/contentEngine/analysisBatching";
import { ORIGINALS_BUCKET, MAX_IMAGE_PIXELS } from "@/lib/contentEngine/uploadConfig";

export async function downloadOriginal(client: SupabaseClient, storagePath: string): Promise<Buffer> {
  const { data, error } = await client.storage.from(ORIGINALS_BUCKET).download(storagePath);
  if (error || !data) {
    throw new Error(`could not download original ${storagePath}: ${error?.message ?? "missing"}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function encodeImageForModel(buffer: Buffer, step: number): Promise<Buffer> {
  const { maxDimension, quality } = ladderStep(step);
  return sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
    .rotate() // apply EXIF orientation
    .resize({ width: maxDimension, height: maxDimension, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality })
    .toBuffer();
}

// Encode all images at ladder step 0; if the combined bytes exceed the cap,
// re-encode everything at the next step ("reduces quality/dimensions
// dynamically", spec §8.1 step 2). The last step is used even if still over.
export async function encodeBatchUnderCap(buffers: Buffer[]): Promise<Buffer[]> {
  for (let step = 0; step < ANALYSIS_ENCODE_LADDER.length; step++) {
    const encoded = await Promise.all(buffers.map((b) => encodeImageForModel(b, step)));
    if (totalBytes(encoded) <= MAX_BATCH_IMAGE_BYTES || step === ANALYSIS_ENCODE_LADDER.length - 1) {
      return encoded;
    }
  }
  throw new Error("unreachable: ladder always returns at the last step");
}

export function toImageBlock(encoded: Buffer): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: encoded.toString("base64") },
  };
}
```

- [ ] **Step 4: Write the analysis service** (`lib/contentEngine/analyzePhotos.ts`)

```ts
// Analysis pipeline service (spec §8.1): claim → download → downscale → one
// vision call per batch → identity-validate → batch-atomic commit. Each call
// processes ONE batch (<=4 photos); the admin client orchestrates by calling
// repeatedly until remaining is 0 (resume-safe via leases).
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL, type ModelCaller } from "@/lib/contentEngine/aiClient";
import { buildAnalysisPrompt, PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { validateAnalysisResponse, type PhotoAnalysis } from "@/lib/contentEngine/analysisResponse";
import { MAX_PHOTOS_PER_BATCH } from "@/lib/contentEngine/analysisBatching";
import {
  downloadOriginal, encodeBatchUnderCap, toImageBlock,
} from "@/lib/contentEngine/modelImages";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";

export interface AnalyzeBatchArgs {
  client: SupabaseClient;
  callModel: ModelCaller;
  sessionId: string;
  photoIds?: string[] | null;
  model?: string;
}

export interface AnalyzeBatchResult {
  claimed: number;
  completed: number;
  failed: number;
  remaining: number;
}

async function countRemaining(client: SupabaseClient, sessionId: string): Promise<number> {
  const { count } = await client
    .from("session_photos")
    .select("id", { count: "exact", head: true })
    .eq("photography_session_id", sessionId)
    .eq("excluded", false)
    .in("analysis_status", ["pending", "failed"]);
  return count ?? 0;
}

type ClaimedPhoto = { id: string; storage_path: string };

async function loadClaimed(client: SupabaseClient, ids: string[]): Promise<ClaimedPhoto[]> {
  const { data, error } = await client
    .from("session_photos").select("id,storage_path").in("id", ids);
  if (error) throw new Error(`could not load claimed photos: ${error.message}`);
  // preserve claim order
  const byId = new Map((data ?? []).map((r) => [r.id as string, r as ClaimedPhoto]));
  return ids.map((id) => {
    const row = byId.get(id);
    if (!row) throw new Error(`claimed photo ${id} disappeared`);
    return row;
  });
}

function successResults(analyses: PhotoAnalysis[], model: string, usage: unknown, rawText: string) {
  return analyses.map((a) => ({
    session_photo_id: a.session_photo_id,
    success: true,
    analysis_model: model,
    analysis_version: PROMPT_VERSION,
    fields: {
      alt_text: a.alt_text,
      title: a.title ?? "",
      description: a.description ?? "",
      tags: a.tags,
      quality_score: a.quality_score,
      suggested_category: a.suggested_category,
      destination_recommendations: a.destination_recommendations,
    },
    payload: { raw: rawText.slice(0, 20_000), usage },
  }));
}

function failureResults(ids: string[], model: string, message: string) {
  return ids.map((id) => ({
    session_photo_id: id,
    success: false,
    error: message.slice(0, 2000),
    analysis_model: model,
    analysis_version: PROMPT_VERSION,
  }));
}

export async function runAnalysisBatch(args: AnalyzeBatchArgs): Promise<AnalyzeBatchResult> {
  const { client, callModel, sessionId } = args;
  const model = args.model ?? DEFAULT_ENGINE_MODEL;

  const { data: session, error: sErr } = await client
    .from("photography_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (sErr) throw new Error(`session lookup failed: ${sErr.message}`);
  if (!session) throw new Error("photography session not found");
  if (!session.ai_processing_allowed) {
    throw new Error("ai processing is not allowed for this session");
  }
  const facts = buildSessionFactsSnapshot(session);

  const { data: claimedIds, error: claimErr } = await client.rpc("claim_photos_for_analysis", {
    p_session_id: sessionId,
    p_photo_ids: args.photoIds ?? null,
    p_max_photos: MAX_PHOTOS_PER_BATCH,
    p_lease_seconds: 180,
  });
  if (claimErr) throw new Error(claimErr.message);
  const ids = (claimedIds ?? []) as string[];
  if (ids.length === 0) {
    return { claimed: 0, completed: 0, failed: 0, remaining: await countRemaining(client, sessionId) };
  }

  let results: Record<string, unknown>[];
  let completed = 0;
  let failed = 0;
  try {
    const photos = await loadClaimed(client, ids);
    const originals = await Promise.all(photos.map((p) => downloadOriginal(client, p.storage_path)));
    const encoded = await encodeBatchUnderCap(originals);
    const prompt = buildAnalysisPrompt(facts, ids);

    const response = await callModel({
      model,
      system: prompt.system,
      maxTokens: 4000,
      messages: [{
        role: "user",
        content: [...encoded.map(toImageBlock), { type: "text", text: prompt.userText }],
      }],
    });

    const analyses = validateAnalysisResponse(response.text, ids);
    results = successResults(analyses, response.model, response.usage, response.text);
    completed = ids.length;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results = failureResults(ids, model, message);
    failed = ids.length;
  }

  const { error: recordErr } = await client.rpc("record_analysis_batch", {
    p_session_id: sessionId,
    p_results: results,
  });
  if (recordErr) throw new Error(`could not record analysis batch: ${recordErr.message}`);

  return { claimed: ids.length, completed, failed, remaining: await countRemaining(client, sessionId) };
}
```

- [ ] **Step 5: Run the integration tests**

Run: `./scripts/content-engine/reset-test-db.sh && npm run test:integration -- analyze-photos`
Expected: all four cases PASS. Then full `npm run test:integration` (everything green) and `npx tsc --noEmit` (clean).

- [ ] **Step 6: Commit**

```bash
git add lib/contentEngine/modelImages.ts lib/contentEngine/analyzePhotos.ts tests/integration/analyze-photos.test.ts
git commit -m "feat: analysis service with claims, vision batching, and batch-atomic commits"
```

---

### Task 8: Generation targets + orchestrator (spec §8.2, §8.3, §9.3-keywords)

**Files:**
- Create: `lib/contentEngine/generationTargets.ts`
- Create: `lib/contentEngine/generateContent.ts`
- Create: `tests/integration/generate-content.test.ts`
- Modify: `tests/integration/helpers.ts` (one-line type extension)

- [ ] **Step 0: Extend the test-session override type.** In `tests/integration/helpers.ts`, the `SessionOverrides` type does not include `client_session_id`, which the testimonial/journal tests below pass. Add it:

```ts
type SessionOverrides = Partial<{
  marketing_permission: boolean;
  ai_processing_allowed: boolean;
  service_type: string;
  school_slug: string | null;
  public_display_name: string | null;
  client_session_id: string | null;
}>;
```

- [ ] **Step 1: Write the failing integration test** (`tests/integration/generate-content.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { randomUUID } from "node:crypto";
import { service, resetDb, createTestSession, createTestPhoto, createPackage } from "./helpers";
import { generateContentType, GenerationConflictError } from "@/lib/contentEngine/generateContent";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import type { ModelCaller } from "@/lib/contentEngine/aiClient";

beforeAll(() => resetDb());

function fakeModel(text: string): ModelCaller {
  return async (req) => ({
    text, usage: { input_tokens: 800, output_tokens: 300 }, model: req.model,
  });
}

async function analyzedPhoto(sessionId: string, quality = 8) {
  const photo = await createTestPhoto(sessionId);
  await service.from("session_photos").update({
    analysis_status: "completed", quality_score: quality,
    alt_text: "Grad at Tower Lawn", title: "Tower Lawn", description: "Golden hour",
    tags: ["sjsu"], suggested_category: "grads",
  }).eq("id", photo.id);
  return photo;
}

async function itemsOf(packageId: string, contentType: string) {
  const { data } = await service.from("session_content_items")
    .select("*").eq("package_id", packageId).eq("content_type", contentType);
  return data ?? [];
}

async function packageState(packageId: string) {
  const { data } = await service.from("session_content_packages")
    .select("status,generation_settings").eq("id", packageId).single();
  return { status: data!.status as string, progress: data!.generation_settings.progress };
}

describe("generateContentType (spec §8.2)", () => {
  it("internal_link_suggestion: model output validated against the closed list, item drafted, usage recorded", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({
        links: [{ url: "/grads/sjsu", label: "SJSU grad sessions", reason: "session school" }],
      })),
    });

    expect(result.outcome).toBe("completed");
    expect(result.packageStatus).toBe("ready");
    const items = await itemsOf(pkg, "internal_link_suggestion");
    expect(items).toHaveLength(1);
    expect(items[0].status).toBe("draft");
    expect(items[0].payload.links[0].url).toBe("/grads/sjsu");
    expect(items[0].prompt_version).toBe(PROMPT_VERSION);
    expect(items[0].generation_model).toBe("claude-sonnet-4-6");

    const { progress } = await packageState(pkg);
    expect(progress.internal_link_suggestion.status).toBe("completed");
    expect(progress.internal_link_suggestion.usage.input_tokens).toBe(800);
  });

  it("a non-canonical link FAILS the type and the package needs attention", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({ links: [{ url: "/nope", label: "x", reason: "y" }] })),
    });
    expect(result.outcome).toBe("failed");
    expect(result.error).toMatch(/canonical|validation/i);
    expect(result.packageStatus).toBe("needs_attention");
    expect(await itemsOf(pkg, "internal_link_suggestion")).toHaveLength(0);
  });

  it("a second call for the same type conflicts (no double generation)", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({ links: [] })),
    });
    await expect(generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({ links: [] })),
    })).rejects.toBeInstanceOf(GenerationConflictError);
  });

  it("portfolio_pick: one draft per pick, photo identity enforced, duplicate picks deduped", async () => {
    const sessionId = await createTestSession();
    const a = await analyzedPhoto(sessionId, 9);
    const b = await analyzedPhoto(sessionId, 8);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);

    const pick = (id: string) => ({
      session_photo_id: id, category: "grads", title: "Pick", alt_text: "Pick alt",
      description: "", featured: false,
    });
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "portfolio_pick",
      callModel: fakeModel(JSON.stringify({ picks: [pick(a.id), pick(b.id), pick(a.id)] })), // dup a
    });
    expect(result.outcome).toBe("completed");
    const items = await itemsOf(pkg, "portfolio_pick");
    expect(items).toHaveLength(2); // dedup by idempotency key
    const keys = items.map((i) => i.idempotency_key);
    expect(new Set(keys).size).toBe(2);
  });

  it("portfolio_pick: a foreign photo id fails the type", async () => {
    const sessionId = await createTestSession();
    await analyzedPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["portfolio_pick"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "portfolio_pick",
      callModel: fakeModel(JSON.stringify({
        picks: [{ session_photo_id: randomUUID(), category: "grads", title: "", alt_text: "x",
                  description: "", featured: false }],
      })),
    });
    expect(result.outcome).toBe("failed");
    expect(result.error).toMatch(/unknown photo/i);
  });

  it("school_page_photo: placements draft against the session school", async () => {
    const sessionId = await createTestSession({ school_slug: "sjsu" });
    const photo = await analyzedPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["school_page_photo"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "school_page_photo",
      callModel: fakeModel(JSON.stringify({
        placements: [{ session_photo_id: photo.id, school_slug: "sjsu", alt_override: "",
                       caption: "Tower Lawn", sort_order: 1 }],
      })),
    });
    expect(result.outcome).toBe("completed");
    const items = await itemsOf(pkg, "school_page_photo");
    expect(items).toHaveLength(1);
    expect(items[0].payload.school_slug).toBe("sjsu");
  });

  it("school_page_photo: skipped when the session has no school", async () => {
    const sessionId = await createTestSession({ school_slug: null });
    await analyzedPhoto(sessionId);
    const pkg = await createPackage(sessionId, ["school_page_photo"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "school_page_photo",
      callModel: fakeModel("{}"),
    });
    expect(result.outcome).toBe("skipped");
    expect(result.packageStatus).toBe("ready"); // skipped counts as terminal-good
  });

  it("guide_photo: empty placements complete with zero items; non-guide service is skipped", async () => {
    const famSession = await createTestSession({ service_type: "families" });
    await analyzedPhoto(famSession);
    const famPkg = await createPackage(famSession, ["guide_photo"]);
    const empty = await generateContentType({
      client: service, packageId: famPkg, contentType: "guide_photo",
      callModel: fakeModel(JSON.stringify({ placements: [] })),
    });
    expect(empty.outcome).toBe("completed");
    expect(await itemsOf(famPkg, "guide_photo")).toHaveLength(0);

    const gradSession = await createTestSession({ service_type: "grads" });
    await analyzedPhoto(gradSession);
    const gradPkg = await createPackage(gradSession, ["guide_photo"]);
    const skipped = await generateContentType({
      client: service, packageId: gradPkg, contentType: "guide_photo",
      callModel: fakeModel("{}"),
    });
    expect(skipped.outcome).toBe("skipped");
  });

  it("testimonial_feature: deterministic email match; skipped when no candidate", async () => {
    const email = `mia-${Date.now()}@example.com`;
    const { data: cs } = await service.from("client_sessions")
      .insert({ client_email: email, current_status: "delivered" }).select("id").single();
    const sessionId = await createTestSession({ client_session_id: cs!.id });
    const { data: t } = await service.from("testimonials").insert({
      first_name: "Mia", last_name: "R", email,
      message: "Chris made the whole session feel easy and fun from start to finish!",
      consent_to_marketing: true, status: "approved",
    }).select("id").single();

    const pkg = await createPackage(sessionId, ["testimonial_feature"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "testimonial_feature",
      callModel: fakeModel("{}"), // never called — deterministic target
    });
    expect(result.outcome).toBe("completed");
    const items = await itemsOf(pkg, "testimonial_feature");
    expect(items).toHaveLength(1);
    expect(items[0].payload.testimonial_id).toBe(t!.id);
    expect(items[0].payload.quote_excerpt.length).toBeGreaterThan(0);

    const lonely = await createTestSession(); // no client session link
    const lonelyPkg = await createPackage(lonely, ["testimonial_feature"]);
    const none = await generateContentType({
      client: service, packageId: lonelyPkg, contentType: "testimonial_feature",
      callModel: fakeModel("{}"),
    });
    expect(none.outcome).toBe("skipped");
  });

  it("journal_post: weaves prior link + testimonial items, deterministic meta_keywords, package → ready", async () => {
    const email = `leo-${Date.now()}@example.com`;
    const { data: cs } = await service.from("client_sessions")
      .insert({ client_email: email, current_status: "delivered" }).select("id").single();
    const sessionId = await createTestSession({
      client_session_id: cs!.id, school_slug: "sjsu",
    });
    await service.from("testimonials").insert({
      first_name: "Leo", last_name: "M", email,
      message: "An amazing experience — the photos came out better than we hoped!",
      consent_to_marketing: true, status: "approved",
    });
    const photo = await analyzedPhoto(sessionId, 9);
    const pkg = await createPackage(sessionId,
      ["internal_link_suggestion", "testimonial_feature", "journal_post"]);

    await generateContentType({
      client: service, packageId: pkg, contentType: "internal_link_suggestion",
      callModel: fakeModel(JSON.stringify({
        links: [{ url: "/grads/sjsu", label: "SJSU grad sessions", reason: "school page" }],
      })),
    });
    await generateContentType({
      client: service, packageId: pkg, contentType: "testimonial_feature",
      callModel: fakeModel("{}"),
    });
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "journal_post",
      callModel: fakeModel(JSON.stringify({
        title: "Golden Hour at SJSU", slug: `golden-hour-sjsu-${Date.now()}`,
        body: "Para one.\n\nPara two.", meta_description: "A golden hour grad session at SJSU.",
        photo_ids: [photo.id], cover_photo_id: photo.id,
      })),
    });

    expect(result.outcome).toBe("completed");
    expect(result.packageStatus).toBe("ready");
    const items = await itemsOf(pkg, "journal_post");
    expect(items).toHaveLength(1);
    const payload = items[0].payload;
    expect(payload.internal_links).toEqual([{ url: "/grads/sjsu", label: "SJSU grad sessions" }]);
    expect(payload.testimonial_id).not.toBeNull();
    expect(payload.meta_keywords).toContain("Bay Area");
    expect(payload.meta_keywords.toLowerCase()).toContain("graduation");
  });

  it("journal_post fails cleanly when no analyzed photos exist", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["journal_post"]);
    const result = await generateContentType({
      client: service, packageId: pkg, contentType: "journal_post",
      callModel: fakeModel("{}"),
    });
    expect(result.outcome).toBe("failed");
    expect(result.error).toMatch(/no analyzed photos/i);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npm run test:integration -- generate-content` → FAIL (modules missing).

- [ ] **Step 3: Write the targets module** (`lib/contentEngine/generationTargets.ts`)

```ts
// Per-type generation targets (spec §8.2): each gathers its inputs, calls the
// model (or resolves deterministically), and materializes Zod-validated draft
// item specs. Every destination/photo reference is identity-checked against
// this session's own analyzed photos.
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ModelCaller, ModelUsage } from "@/lib/contentEngine/aiClient";
import { extractJsonObject } from "@/lib/contentEngine/analysisResponse";
import {
  buildJournalPrompt, buildPortfolioPickPrompt, buildSchoolPagePhotoPrompt,
  buildGuidePhotoPrompt, buildInternalLinkPrompt,
  type BuiltPrompt, type PhotoSummary,
} from "@/lib/contentEngine/prompts";
import { validatePayload, type SessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { isSchoolSlug, type GuideType } from "@/lib/contentEngine/taxonomy";
import { downloadOriginal, encodeBatchUnderCap, toImageBlock } from "@/lib/contentEngine/modelImages";

export class GenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

export interface ItemSpec {
  content_type: string;
  payload: Record<string, unknown>;
  destination: string | null;
  photoId: string | null;
}

export interface TargetUsage extends ModelUsage {
  model: string;
}

export interface TargetResult {
  outcome: "completed" | "skipped";
  itemSpecs: ItemSpec[];
  usage: TargetUsage | null;
  note?: string;
}

export interface TargetContext {
  client: SupabaseClient;
  callModel: ModelCaller;
  model: string;
  sessionId: string;
  packageId: string;
  facts: SessionFactsSnapshot;
}

const SERVICE_KEYWORD: Record<string, string> = {
  grads: "graduation photos", couples: "couples photography", families: "family photography",
  portraits: "portrait photography", maternity: "maternity photography",
  events: "event photography", other: "photography",
};

// Deterministic meta keywords from the approved taxonomy/facts — never
// AI-invented (spec §9.3).
export function deterministicKeywords(facts: SessionFactsSnapshot): string {
  const parts = [
    facts.school_slug ? facts.school_slug.replace(/-/g, " ") : null,
    facts.primary_location,
    SERVICE_KEYWORD[facts.service_type] ?? "photography",
    "Bay Area",
  ].filter((p): p is string => !!p && p.length > 0);
  return parts.join(", ");
}

// First ~200 chars of a testimonial, cut at a word boundary.
export function excerptOf(message: string, max = 200): string {
  const trimmed = message.trim();
  if (trimmed.length <= max) return trimmed;
  const cut = trimmed.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max)}…`;
}

async function loadPhotoSummaries(client: SupabaseClient, sessionId: string): Promise<PhotoSummary[]> {
  const { data, error } = await client
    .from("session_photos")
    .select("id,alt_text,title,description,tags,quality_score,suggested_category,storage_path")
    .eq("photography_session_id", sessionId)
    .eq("excluded", false)
    .eq("analysis_status", "completed")
    .order("quality_score", { ascending: false, nullsFirst: false });
  if (error) throw new GenerationError(`could not load analyzed photos: ${error.message}`);
  return (data ?? []).map((r) => ({
    session_photo_id: r.id as string,
    alt_text: r.alt_text, title: r.title, description: r.description,
    tags: (r.tags ?? []) as string[], quality_score: r.quality_score,
    suggested_category: r.suggested_category,
  }));
}

async function callForJson(
  ctx: TargetContext, prompt: BuiltPrompt,
  imageBlocks: ReturnType<typeof toImageBlock>[] = [],
): Promise<{ json: unknown; usage: TargetUsage }> {
  const response = await ctx.callModel({
    model: ctx.model,
    system: prompt.system,
    maxTokens: 4000,
    messages: [{
      role: "user",
      content: imageBlocks.length
        ? [...imageBlocks, { type: "text", text: prompt.userText }]
        : prompt.userText,
    }],
  });
  return {
    json: extractJsonObject(response.text),
    usage: { model: response.model, ...response.usage },
  };
}

function validated(contentType: string, payload: unknown): Record<string, unknown> {
  const result = validatePayload(contentType, payload);
  if (!result.success) {
    throw new GenerationError(
      `validation failed for ${contentType} (canonical lists are closed): ${result.error.message}`,
    );
  }
  return result.data as Record<string, unknown>;
}

function assertKnownPhotos(ids: string[], known: Set<string>) {
  for (const id of ids) {
    if (!known.has(id)) throw new GenerationError(`unknown photo id from model: ${id}`);
  }
}

const linksResponseSchema = z.object({ links: z.array(z.unknown()) });
const picksResponseSchema = z.object({ picks: z.array(z.unknown()) });
const placementsResponseSchema = z.object({ placements: z.array(z.unknown()) });
const journalResponseSchema = z.object({
  title: z.string(), slug: z.string(), body: z.string(), meta_description: z.string(),
  photo_ids: z.array(z.string()), cover_photo_id: z.string(),
});

async function internalLinkTarget(ctx: TargetContext): Promise<TargetResult> {
  const { json, usage } = await callForJson(ctx, buildInternalLinkPrompt(ctx.facts));
  const parsed = linksResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed links response: ${parsed.error.message}`);
  const payload = validated("internal_link_suggestion", { links: parsed.data.links });
  return { outcome: "completed", itemSpecs: [{
    content_type: "internal_link_suggestion", payload, destination: null, photoId: null,
  }], usage };
}

async function testimonialTarget(ctx: TargetContext): Promise<TargetResult> {
  const { data: session } = await ctx.client.from("photography_sessions")
    .select("client_session_id").eq("id", ctx.sessionId).single();
  if (!session?.client_session_id) {
    return { outcome: "skipped", itemSpecs: [], usage: null, note: "no linked client session" };
  }
  const { data: cs } = await ctx.client.from("client_sessions")
    .select("client_email").eq("id", session.client_session_id).single();
  if (!cs?.client_email) {
    return { outcome: "skipped", itemSpecs: [], usage: null, note: "no client email" };
  }
  const { data: t } = await ctx.client.from("testimonials")
    .select("id,message").eq("email", cs.client_email).eq("status", "approved")
    .is("photography_session_id", null)
    .order("submitted_at", { ascending: false }).limit(1).maybeSingle();
  if (!t) return { outcome: "skipped", itemSpecs: [], usage: null, note: "no matching testimonial" };

  const payload = validated("testimonial_feature", {
    testimonial_id: t.id, quote_excerpt: excerptOf(t.message as string),
  });
  return { outcome: "completed", itemSpecs: [{
    content_type: "testimonial_feature", payload, destination: null, photoId: null,
  }], usage: null };
}

async function journalTarget(ctx: TargetContext): Promise<TargetResult> {
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  // dependency inputs (spec §8.2 graph): links + testimonial from this package
  const { data: siblings } = await ctx.client.from("session_content_items")
    .select("content_type,payload")
    .eq("package_id", ctx.packageId)
    .in("content_type", ["internal_link_suggestion", "testimonial_feature"])
    .neq("status", "rejected");
  const linkItem = siblings?.find((s) => s.content_type === "internal_link_suggestion");
  const testimonialItem = siblings?.find((s) => s.content_type === "testimonial_feature");
  const links = ((linkItem?.payload?.links ?? []) as { url: string; label: string }[])
    .map((l) => ({ url: l.url, label: l.label }));
  const testimonialQuote = (testimonialItem?.payload?.quote_excerpt as string | undefined) || null;
  const testimonialId = (testimonialItem?.payload?.testimonial_id as string | undefined) ?? null;

  // journal-only: top photos inline as downscaled images (spec §8.3)
  const top = photos.slice(0, 4);
  const { data: paths } = await ctx.client.from("session_photos")
    .select("id,storage_path").in("id", top.map((p) => p.session_photo_id));
  const originals = await Promise.all(
    (paths ?? []).map((p) => downloadOriginal(ctx.client, p.storage_path as string)),
  );
  const imageBlocks = (await encodeBatchUnderCap(originals)).map(toImageBlock);

  const { json, usage } = await callForJson(
    ctx, buildJournalPrompt(ctx.facts, photos, { links, testimonialQuote }), imageBlocks,
  );
  const parsed = journalResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed journal response: ${parsed.error.message}`);
  assertKnownPhotos([...parsed.data.photo_ids, parsed.data.cover_photo_id], known);

  const payload = validated("journal_post", {
    ...parsed.data,
    meta_keywords: deterministicKeywords(ctx.facts),
    internal_links: links,
    testimonial_id: testimonialId,
  });
  return { outcome: "completed", itemSpecs: [{
    content_type: "journal_post", payload, destination: null, photoId: null,
  }], usage };
}

async function portfolioTarget(ctx: TargetContext): Promise<TargetResult> {
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  const { json, usage } = await callForJson(ctx, buildPortfolioPickPrompt(ctx.facts, photos));
  const parsed = picksResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed picks response: ${parsed.error.message}`);

  const itemSpecs = parsed.data.picks.map((raw) => {
    const payload = validated("portfolio_pick", raw);
    assertKnownPhotos([payload.session_photo_id as string], known);
    return {
      content_type: "portfolio_pick", payload,
      destination: payload.category as string, photoId: payload.session_photo_id as string,
    };
  });
  return { outcome: "completed", itemSpecs, usage };
}

async function schoolTarget(ctx: TargetContext): Promise<TargetResult> {
  if (!ctx.facts.school_slug || !isSchoolSlug(ctx.facts.school_slug)) {
    return { outcome: "skipped", itemSpecs: [], usage: null, note: "session has no school" };
  }
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  const { json, usage } = await callForJson(
    ctx, buildSchoolPagePhotoPrompt(ctx.facts, photos, ctx.facts.school_slug),
  );
  const parsed = placementsResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed placements response: ${parsed.error.message}`);

  const itemSpecs = parsed.data.placements.map((raw) => {
    const payload = validated("school_page_photo", raw);
    assertKnownPhotos([payload.session_photo_id as string], known);
    return {
      content_type: "school_page_photo", payload,
      destination: payload.school_slug as string, photoId: payload.session_photo_id as string,
    };
  });
  return { outcome: "completed", itemSpecs, usage };
}

async function guideTarget(ctx: TargetContext): Promise<TargetResult> {
  const guide: GuideType | null =
    ctx.facts.service_type === "couples" ? "couples"
    : ctx.facts.service_type === "families" ? "family"
    : null;
  if (!guide) {
    return { outcome: "skipped", itemSpecs: [], usage: null, note: "service type has no guide" };
  }
  const photos = await loadPhotoSummaries(ctx.client, ctx.sessionId);
  if (photos.length === 0) throw new GenerationError("no analyzed photos for this session");
  const known = new Set(photos.map((p) => p.session_photo_id));

  const { json, usage } = await callForJson(ctx, buildGuidePhotoPrompt(ctx.facts, photos, guide));
  const parsed = placementsResponseSchema.safeParse(json);
  if (!parsed.success) throw new GenerationError(`malformed placements response: ${parsed.error.message}`);

  const itemSpecs = parsed.data.placements.map((raw) => {
    const payload = validated("guide_photo", raw);
    assertKnownPhotos([payload.session_photo_id as string], known);
    return {
      content_type: "guide_photo", payload,
      destination: `${guide}-${payload.location_key as string}`,
      photoId: payload.session_photo_id as string,
    };
  });
  return { outcome: "completed", itemSpecs, usage };
}

export const GENERATION_TARGETS: Record<string, (ctx: TargetContext) => Promise<TargetResult>> = {
  internal_link_suggestion: internalLinkTarget,
  testimonial_feature: testimonialTarget,
  journal_post: journalTarget,
  portfolio_pick: portfolioTarget,
  school_page_photo: schoolTarget,
  guide_photo: guideTarget,
};
```

- [ ] **Step 4: Write the orchestrator** (`lib/contentEngine/generateContent.ts`)

```ts
// Generation orchestrator (spec §8.2): atomic per-type claim → target → insert
// validated drafts (idempotency-keyed, retry-safe) → record result + usage
// atomically with that type's progress (spec §11). A failed target records
// 'failed' with a safe error; the drafts of other types are untouched.
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_ENGINE_MODEL, type ModelCaller } from "@/lib/contentEngine/aiClient";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { buildIdempotencyKey } from "@/lib/contentEngine/idempotency";
import { sessionFactsSnapshotSchema } from "@/lib/contentEngine/payloads";
import {
  GENERATION_TARGETS, GenerationError, type ItemSpec, type TargetContext,
} from "@/lib/contentEngine/generationTargets";

export class GenerationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerationConflictError";
  }
}

export interface GenerateTypeArgs {
  client: SupabaseClient;
  callModel: ModelCaller;
  packageId: string;
  contentType: string;
  model?: string;
}

export interface GenerateTypeResult {
  outcome: "completed" | "skipped" | "failed";
  itemIds: string[];
  packageStatus: string;
  error?: string;
}

async function insertDraftItems(
  ctx: TargetContext, specs: ItemSpec[], model: string,
): Promise<string[]> {
  if (specs.length === 0) return [];
  const rows = specs.map((s) => ({
    package_id: ctx.packageId,
    content_type: s.content_type,
    status: "draft",
    payload: s.payload,
    generation_model: model,
    prompt_version: PROMPT_VERSION,
    generated_at: new Date().toISOString(),
    idempotency_key: buildIdempotencyKey({
      sessionId: ctx.sessionId, packageId: ctx.packageId, contentType: s.content_type,
      destination: s.destination, photoId: s.photoId,
    }),
  }));
  const { data, error } = await ctx.client
    .from("session_content_items")
    .upsert(rows, { onConflict: "idempotency_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw new GenerationError(`could not insert draft items: ${error.message}`);
  return (data ?? []).map((r) => r.id as string);
}

export async function generateContentType(args: GenerateTypeArgs): Promise<GenerateTypeResult> {
  const { client, callModel, packageId, contentType } = args;

  const { data: claimed, error: claimErr } = await client.rpc("claim_generation_type", {
    p_package_id: packageId, p_content_type: contentType, p_lease_seconds: 180,
  });
  if (claimErr) throw new Error(claimErr.message);
  if (!claimed) {
    throw new GenerationConflictError(
      `content type ${contentType} is already in progress or terminal for this package`,
    );
  }

  const { data: pkg, error: pkgErr } = await client
    .from("session_content_packages")
    .select("photography_session_id,model_name,session_facts_snapshot,generation_settings")
    .eq("id", packageId).single();
  if (pkgErr || !pkg) throw new Error(`package lookup failed: ${pkgErr?.message ?? "missing"}`);

  const model = args.model
    ?? (pkg.generation_settings?.overrides?.model_name as string | undefined)
    ?? (pkg.model_name as string | undefined)
    ?? DEFAULT_ENGINE_MODEL;

  try {
    const facts = sessionFactsSnapshotSchema.parse(pkg.session_facts_snapshot);
    const target = GENERATION_TARGETS[contentType];
    if (!target) throw new GenerationError(`content type ${contentType} is not generatable`);

    const ctx: TargetContext = {
      client, callModel, model,
      sessionId: pkg.photography_session_id as string,
      packageId, facts,
    };
    const result = await target(ctx);
    const itemIds = await insertDraftItems(ctx, result.itemSpecs, model);

    const { data: status, error: recErr } = await client.rpc("record_generation_result", {
      p_package_id: packageId, p_content_type: contentType,
      p_outcome: result.outcome, p_error: null, p_usage: result.usage,
    });
    if (recErr) throw new Error(`could not record generation result: ${recErr.message}`);
    return { outcome: result.outcome, itemIds, packageStatus: status as string };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { data: status, error: recErr } = await client.rpc("record_generation_result", {
      p_package_id: packageId, p_content_type: contentType,
      p_outcome: "failed", p_error: message, p_usage: null,
    });
    if (recErr) console.error("could not record generation failure", recErr);
    return {
      outcome: "failed", itemIds: [],
      packageStatus: (status as string | null) ?? "generating", error: message,
    };
  }
}
```

- [ ] **Step 5: Run the integration tests**

Run: `npm run test:integration -- generate-content`
Expected: all cases PASS. Then full `npm run test:integration` and `npx tsc --noEmit` (clean).

- [ ] **Step 6: Commit**

```bash
git add lib/contentEngine/generationTargets.ts lib/contentEngine/generateContent.ts tests/integration/generate-content.test.ts
git commit -m "feat: per-type generation targets and claim-driven orchestrator"
```

---

### Task 9: Analyze, packages, and generate routes (spec §8.1-§8.2)

**Files:**
- Create: `app/api/admin/session-content/photos/analyze/route.ts`
- Create: `app/api/admin/session-content/packages/route.ts`
- Create: `app/api/admin/session-content/generate/route.ts`

- [ ] **Step 1: Write the analyze route** (`app/api/admin/session-content/photos/analyze/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { runAnalysisBatch } from "@/lib/contentEngine/analyzePhotos";
import { isUuid } from "@/lib/contentEngine/uploadConfig";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });

  let body: { sessionId?: unknown; photoIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });
  const photoIds = Array.isArray(body.photoIds)
    ? body.photoIds.filter((p): p is string => typeof p === "string" && isUuid(p))
    : null;

  try {
    const result = await runAnalysisBatch({
      client: createSupabaseAdminClient(),
      callModel: createAnthropicCaller(apiKey),
      sessionId: sessionId.toLowerCase(),
      photoIds,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "analysis failed";
    if (/ai processing is not allowed/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("analyze batch failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Write the packages route** (`app/api/admin/session-content/packages/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { DEFAULT_ENGINE_MODEL } from "@/lib/contentEngine/aiClient";
import { PROMPT_VERSION } from "@/lib/contentEngine/prompts";
import { buildSessionFactsSnapshot } from "@/lib/contentEngine/payloads";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { GENERATABLE_CONTENT_TYPES } from "@/lib/contentEngine/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  let body: { sessionId?: unknown; selectedTypes?: unknown; archiveCurrent?: unknown; copyItems?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.toLowerCase() : "";
  if (!isUuid(sessionId)) return NextResponse.json({ error: "sessionId must be a uuid" }, { status: 400 });
  const selectedTypes = Array.isArray(body.selectedTypes)
    ? body.selectedTypes.filter((t): t is string => typeof t === "string")
    : [];
  const invalid = selectedTypes.filter((t) => !(GENERATABLE_CONTENT_TYPES as string[]).includes(t));
  if (selectedTypes.length === 0 || invalid.length > 0) {
    return NextResponse.json(
      { error: `selectedTypes must be a non-empty subset of ${GENERATABLE_CONTENT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: session, error: sErr } = await admin
    .from("photography_sessions").select("*").eq("id", sessionId).maybeSingle();
  if (sErr) {
    console.error("session lookup failed for package request", sErr);
    return NextResponse.json({ error: "could not look up photography session" }, { status: 500 });
  }
  if (!session) return NextResponse.json({ error: "photography session not found" }, { status: 404 });

  let snapshot;
  try {
    snapshot = buildSessionFactsSnapshot(session);
  } catch {
    return NextResponse.json(
      { error: "session facts are incomplete (service_type missing or invalid)" }, { status: 422 },
    );
  }

  const { data: packageId, error } = await admin.rpc("create_content_package", {
    p_session_id: sessionId,
    p_model_name: DEFAULT_ENGINE_MODEL,
    p_prompt_version: PROMPT_VERSION,
    p_selected_types: selectedTypes,
    p_session_facts: snapshot,
    p_generation_settings: {},
    p_archive_current: body.archiveCurrent === true,
    p_copy_items: Array.isArray(body.copyItems) ? body.copyItems : [],
  });
  if (error) {
    const status = /active package/i.test(error.message) ? 409
      : /ai processing/i.test(error.message) ? 403 : 422;
    return NextResponse.json({ error: error.message }, { status });
  }
  return NextResponse.json({ packageId });
}
```

- [ ] **Step 3: Write the generate route** (`app/api/admin/session-content/generate/route.ts`)

```ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireAdmin";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";
import { createAnthropicCaller } from "@/lib/contentEngine/aiClient";
import { generateContentType, GenerationConflictError } from "@/lib/contentEngine/generateContent";
import { isUuid } from "@/lib/contentEngine/uploadConfig";
import { GENERATABLE_CONTENT_TYPES } from "@/lib/contentEngine/taxonomy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const deny = requireAdmin(req);
  if (deny) return deny;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });

  let body: { packageId?: unknown; contentType?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  const packageId = typeof body.packageId === "string" ? body.packageId.toLowerCase() : "";
  const contentType = typeof body.contentType === "string" ? body.contentType : "";
  if (!isUuid(packageId)) return NextResponse.json({ error: "packageId must be a uuid" }, { status: 400 });
  if (!(GENERATABLE_CONTENT_TYPES as string[]).includes(contentType)) {
    return NextResponse.json(
      { error: `contentType must be one of ${GENERATABLE_CONTENT_TYPES.join(", ")}` }, { status: 400 },
    );
  }

  try {
    const result = await generateContentType({
      client: createSupabaseAdminClient(),
      callModel: createAnthropicCaller(apiKey),
      packageId, contentType,
    });
    return NextResponse.json(result, { status: result.outcome === "failed" ? 422 : 200 });
  } catch (err) {
    if (err instanceof GenerationConflictError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    const message = err instanceof Error ? err.message : "generation failed";
    if (/ai processing is not allowed/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 403 });
    }
    console.error("generate type failed", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Type-check, lint, full suites**

Run: `npx tsc --noEmit && npx eslint app/api/admin/session-content lib/contentEngine && npm test && npm run test:integration`
Expected: all clean/green (the routes have no dedicated tests — their logic lives in the tested services; route behavior lands on the Plan 4 manual checklist alongside the photo routes).

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/session-content/photos/analyze/route.ts app/api/admin/session-content/packages/route.ts app/api/admin/session-content/generate/route.ts
git commit -m "feat: analyze, packages, and generate admin routes"
```

---

### Task 10: Carry-forwards — internal_link_suggestion publish test + legacy test script

**Files:**
- Create: `tests/integration/publish-links.test.ts`
- Modify: `package.json` (one script)

- [ ] **Step 1: Write the publish test** (`tests/integration/publish-links.test.ts`)

```ts
import { describe, it, expect, beforeAll } from "vitest";
import { service, resetDb, createTestSession, createPackage, createItem, publish } from "./helpers";

beforeAll(() => resetDb());

describe("internal_link_suggestion publisher (spec §9.2)", () => {
  it("publishes as applied: target type 'none', null target id, and cannot re-publish", async () => {
    const sessionId = await createTestSession();
    const pkg = await createPackage(sessionId, ["internal_link_suggestion"]);
    const item = await createItem(pkg, "internal_link_suggestion", {
      links: [{ url: "/pricing", label: "Pricing", reason: "ready to book" }],
    }, "approved");

    const { error } = await publish(item);
    expect(error).toBeNull();

    const { data: row } = await service.from("session_content_items")
      .select("status,published_target_type,published_target_id,published_at")
      .eq("id", item).single();
    expect(row!.status).toBe("published");
    expect(row!.published_target_type).toBe("none");
    expect(row!.published_target_id).toBeNull();
    expect(row!.published_at).not.toBeNull();

    // the unique published-target index excludes 'none'; the STATUS guard is
    // what must reject a re-publish here
    const again = await publish(item);
    expect(again.error?.message).toMatch(/not approved|already published/i);
  });
});
```

- [ ] **Step 2: Run it** — `npm run test:integration -- publish-links` → PASS (the RPC has supported this type since Plan 1; this is the missing coverage).

- [ ] **Step 3: Add the legacy test script.** In `package.json` scripts, after `"test:integration"`, add:

```json
"test:legacy": "node --test tests/*.test.mjs"
```

Run: `npm run test:legacy`
Expected: the pre-existing `node:test` suites pass. If any fail, do NOT fix them (out of scope) — report which ones fail in your task report.

- [ ] **Step 4: Commit**

```bash
git add tests/integration/publish-links.test.ts package.json
git commit -m "test: internal_link_suggestion publish coverage and legacy test script"
```

---

### Task 11: Full-suite run + plan wrap-up

- [ ] **Step 1: Clean rebuild and run everything**

Run: `./scripts/content-engine/reset-test-db.sh && npm test && npm run test:integration && npm run test:legacy`
Expected: reset prints every `VERIFY OK` including `VERIFY OK: analysis + generation RPCs`; all unit, integration, and legacy tests pass from a fresh database.

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint app/api/admin/session-content lib/contentEngine tests/unit`
Expected: no errors.

- [ ] **Step 3: Confirm no production contact and nothing pushed**

Run: `git log origin/main..HEAD --oneline | head -40 && git status --porcelain`
Confirm: all commits local; working tree clean; the only migration changes in this plan are the new local-only `20260611000009` files and the comment-only edit to migration 8.

- [ ] **Step 4: Final commit of any stragglers and stop**

```bash
git add -A && git commit -m "chore: content engine analysis + generation complete (plan 3 of 6)" || echo "nothing to commit"
```

**STOP — do not apply anything to production.** Plan 4 (publishers' Node side + admin workflow UI) builds on this: `prepareApprovedDerivatives` (spec §4.3/§9.1 Step A), the publish route calling the existing RPC, the `/admin/content-engine` UI (session list, workspace, item editors with `payload_revision` autosave), and the reconciliation endpoint (§9.4). Production migration apply remains the Plan-6 gate requiring explicit user authorization.

---

## Self-Review Notes

- **Spec coverage:** §8.1 step 1 (atomic claim, no-steal, attempt increment, ai-gate) → Task 1; §8.1 step 2 (≤4 photos, bytes cap, dynamic quality/dimension ladder, ~1600px JPEG downscale) → Tasks 5+7; §8.1 step 3 (one vision call per batch, results keyed by session_photo_id) → Tasks 4+7; §8.1 step 4 (identity validation: exactly once, no unknown/missing/duplicate, leases valid at commit, violations fail only the batch) → Tasks 6+1 (`record_analysis_batch` lease checks) +7; §8.1 step 5 (fields + size-capped raw payload + usage) → Tasks 1+7; §8.2 package creation via existing RPC + route → Task 9; §8.2 atomic per-type jsonb claim, package transitions (ready/needs_attention/skip), resume via expired-lease reclaim → Task 2; §8.2 dependency graph (links + testimonial feed journal) → Task 8 (`journalTarget` reads sibling items); §8.3 prompts module with PROMPT_VERSION stored on packages (Task 9 route) and items (Task 8 insert), snapshot-only facts, closed link list, sonnet-4-6 default with overrides → Tasks 4+8; §9.3 deterministic meta_keywords at generation time → Task 8; §11 usage recorded atomically with the type's progress + rate map → Tasks 2+3+8; §13.2 "lease claiming and expiry" → Tasks 1+2. Carry-forwards (advisory-lock comment, publish-links test, test:legacy) → Tasks 1+10.
- **Deliberately deferred:** the analysis/generation UI (Resume buttons, progress chips) is Plan 4; `prepareApprovedDerivatives` and publishing routes are Plan 4; route-level tests land on the Plan 4 manual checklist (services hold the logic and are integration-tested with fake models); `ai_usage_log` cross-session reporting is §15-deferred.
- **Type consistency:** `ModelCaller`/`ModelCallResult`/`ModelUsage` (Task 4) are consumed by Tasks 7-9 with matching shapes; `PhotoSummary` (Task 4) matches `loadPhotoSummaries` output (Task 8); `validateAnalysisResponse` returns `PhotoAnalysis[]` consumed in Task 7's `successResults`; `record_generation_result` returns the new package status text used by `generateContentType.packageStatus`; usage rows store `{model, input_tokens, output_tokens}` which `estimateCostUsd` (Task 3) consumes as `UsageEntry`. `GENERATABLE_CONTENT_TYPES` (taxonomy, Plan 2) gates both new routes.
- **No placeholders:** every code step is complete; every run step has an exact command and expected outcome. The only intentional external lookup is Task 3 Step 1 (pricing verification), with explicit fallback instructions.



