-- ─────────────────────────────────────────────────────────────────────────────
-- ai_draft_outcomes — what happened to each AI draft between generation and send.
--
-- The assistant already recorded what a draft COST (ai_email_usage) but nothing
-- about whether it was any good. The send path computed the diff between the AI
-- draft and the email that actually went out, then threw it away. This table
-- keeps the measurement, which is the only way to answer the question that
-- matters: does Chris send these, or rewrite them.
--
-- Deliberately stores NO email content. One row is word counts, a similarity
-- ratio and the kinds of edit found. The drafts themselves already live in
-- ai_drafts and Gmail; a third copy in a metrics table would be client email
-- sitting somewhere it is not needed.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.ai_draft_outcomes (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),

  -- Which conversation. Null when the send had no inquiry context.
  inquiry_id        bigint references public.inquiries(id) on delete set null,

  -- Length of the AI draft and of the email actually sent.
  ai_words          integer not null,
  sent_words        integer not null,

  -- 1.0 = sent byte-identical to the draft. The headline quality number.
  similarity        numeric(4,3) not null,

  -- True when Chris sent it without changing a character.
  sent_unchanged    boolean not null default false,

  -- Edit counts, split the way correctionDiff classifies them. A factual edit
  -- is a wrong price or date and means the CONTEXT was wrong; a stylistic edit
  -- means the WRITING was wrong. They call for different fixes, so they are
  -- never summed into one number.
  factual_edits     integer not null default 0,
  stylistic_edits   integer not null default 0,
  edit_kinds        text[]  not null default '{}',

  -- Whether this draft came from a regeneration rather than a first attempt.
  was_regenerated   boolean not null default false
);

create index if not exists ai_draft_outcomes_created_at_idx
  on public.ai_draft_outcomes (created_at desc);
create index if not exists ai_draft_outcomes_inquiry_idx
  on public.ai_draft_outcomes (inquiry_id);

comment on table public.ai_draft_outcomes is
  'Per-send measurement of AI draft quality. Metrics only, never email bodies.';
comment on column public.ai_draft_outcomes.similarity is
  'Word-overlap ratio of AI draft to sent email. 1.0 = sent unchanged.';
