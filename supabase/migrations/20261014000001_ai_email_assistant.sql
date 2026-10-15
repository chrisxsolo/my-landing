-- AI email assistant: structured rules, approved examples, usage tracking
-- (2026-10-14).
--
-- Replaces the single markdown "Email Rules" vault note as the authority for
-- learned writing preferences. That note accumulated contradictory rules and
-- was rewritten in full by an LLM on every training run at a max_tokens limit
-- below its own length, so each run silently truncated it (the live note ends
-- mid-rule with a dangling "- [").
--
-- The note itself is left untouched: the Obsidian sync keeps working, and
-- scripts/migrate-email-rules.ts imports its bullets here as `pending` so
-- nothing is lost and nothing is applied without approval.

create table if not exists public.ai_writing_rules (
  id           uuid primary key default gen_random_uuid(),
  rule         text not null,
  -- 'style' rules reach the prompt. 'policy' is business fact, kept for
  -- reference. 'factual' is a one-off client correction, never generalised.
  category     text not null default 'style',
  status       text not null default 'pending',
  source       text not null default 'manual',
  -- Normalised form, used for deterministic duplicate detection.
  rule_key     text not null,
  superseded_by uuid references public.ai_writing_rules(id) on delete set null,
  created_at   timestamptz not null default now(),
  approved_at  timestamptz
);

alter table public.ai_writing_rules
  drop constraint if exists ai_writing_rules_category_check;
alter table public.ai_writing_rules
  add constraint ai_writing_rules_category_check
  check (category in ('style', 'policy', 'factual'));

alter table public.ai_writing_rules
  drop constraint if exists ai_writing_rules_status_check;
alter table public.ai_writing_rules
  add constraint ai_writing_rules_status_check
  check (status in ('pending', 'approved', 'rejected', 'superseded'));

-- One row per distinct normalised rule: the database refuses a duplicate even
-- if the application dedup is bypassed.
create unique index if not exists ai_writing_rules_rule_key_idx
  on public.ai_writing_rules (rule_key);

create index if not exists ai_writing_rules_prompt_idx
  on public.ai_writing_rules (status, category, created_at desc);

comment on table public.ai_writing_rules is
  'Learned email writing rules. Only status=approved AND category=style rows are sent to Claude.';
comment on column public.ai_writing_rules.rule_key is
  'Lowercased, punctuation-stripped rule text. Unique, so the same preference cannot be stored twice.';

-- ── Approved examples ──────────────────────────────────────────────────────
-- Seed examples live in lib/ai/approvedExamples.ts; this table holds the ones
-- Chris approves from real drafts at runtime.
create table if not exists public.ai_approved_examples (
  id            uuid primary key default gen_random_uuid(),
  body          text not null,
  session_type  text,
  scenarios     text[] not null default '{}',
  tags          text[] not null default '{}',
  -- Retained so an example can be traced back, and so the same draft is not
  -- approved twice.
  source_inquiry_id text,
  created_at    timestamptz not null default now()
);

create index if not exists ai_approved_examples_lookup_idx
  on public.ai_approved_examples (session_type, created_at desc);

comment on table public.ai_approved_examples is
  'Emails Chris explicitly approved as writing references. Demonstrate voice only; dates and prices inside are historical.';

-- ── Usage tracking ─────────────────────────────────────────────────────────
-- Token counts are what the API reported. Cost is computed in application code
-- from lib/ai/modelPricing.ts and is always an estimate, never a bill.
--
-- Deliberately stores no email content: a cost table is not a reason to keep a
-- second copy of a client's private message.
create table if not exists public.ai_email_usage (
  id            bigserial primary key,
  created_at    timestamptz not null default now(),
  operation     text not null,
  model         text not null,
  input_tokens  integer not null default 0,
  output_tokens integer not null default 0,
  cache_creation_input_tokens integer not null default 0,
  cache_read_input_tokens     integer not null default 0,
  duration_ms   integer not null default 0,
  success       boolean not null default true,
  error_kind    text,
  is_regeneration boolean not null default false
);

alter table public.ai_email_usage
  drop constraint if exists ai_email_usage_operation_check;
alter table public.ai_email_usage
  add constraint ai_email_usage_operation_check
  check (operation in ('generate', 'refine', 'polish', 'shorten', 'naturalize', 'learn'));

create index if not exists ai_email_usage_created_at_idx
  on public.ai_email_usage (created_at desc);

comment on table public.ai_email_usage is
  'Per-request Claude token usage for email drafting. Costs derived from this are estimates; Anthropic billing is authoritative.';
comment on column public.ai_email_usage.error_kind is
  'Short failure classification only (timeout, rate_limit, ...). Never request or response content.';
