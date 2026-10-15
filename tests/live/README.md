# Live Claude evaluations

These make **real, paid** Anthropic API calls. Nothing here runs as part of
`npm test` — the unit and regression suites in `tests/unit/ai/` use a fake
model caller and cost nothing.

Live evaluation exists for the one question the deterministic suite cannot
answer: does the prose actually sound like Chris. That needs a human reading
the output, so this harness prints drafts for review rather than asserting on
them.

## Running

```bash
AI_LIVE_EVAL=1 npx tsx --env-file=.env.local tests/live/evalDrafts.ts
```

Without `AI_LIVE_EVAL=1` the script exits immediately and spends nothing.

To compare models, set the model for the run:

```bash
AI_LIVE_EVAL=1 CLAUDE_EMAIL_MODEL=claude-haiku-5-5 \
  npx tsx --env-file=.env.local tests/live/evalDrafts.ts
```

## Cost

Eight scenarios, one request each. At the Sonnet 5.5 rate that is roughly
**$0.04 per full run**; on Haiku 5.5 roughly **$0.002**. The script prints the
measured total from API-reported token counts when it finishes, so the figure
is never a guess.

## What to look for

The deterministic validator already checks format and unsupported facts, and
its verdict is printed per scenario. Read the drafts for the things it cannot
see:

- Does it sound like Chris, or like a business?
- Is it the length he would have written?
- Does it answer the actual question first?
- Does it over-explain, or stack apologies?
- Would he send it as-is?

That last one is the metric that matters. The product target is 90% of drafts
sent without substantial rewriting, and it is measured from real use via the
usage dashboard, not from this harness.

---

## Evaluating against real inquiries

```bash
AI_LIVE_EVAL=1 npx tsx --env-file=.env.local tests/live/evalRealInquiries.ts dev
```

The split argument is `dev`, `holdout`, `regression`, or `all`. Read-only on
the database; client addresses are redacted in the output and the full result
is written to `.eval-out/live-<split>.json`, which is gitignored because it
contains real client prose.

### Why the splits exist

Tuning a classifier against the same inquiries you measure it on produces a
number that means nothing. The split is deterministic — even/odd by inquiry id
across the inquiries the first evaluation did not use — so a re-run never
reshuffles it:

- **dev** (23) — the half defects may be diagnosed from
- **holdout** (23) — must not inform a prompt, pattern, or rule before its
  final measurement
- **regression** (11) — the inquiries the first evaluation used

When a defect is found in the holdout half, record the holdout number FIRST,
then fix, and say in the write-up that the fix came after the measurement.
A holdout number taken after tuning on holdout is just a dev number.

## Multi-turn conversations

```bash
AI_LIVE_EVAL=1 npx tsx --env-file=.env.local tests/live/evalConversations.ts
```

Each case in `conversationCases.ts` is one turn of a real thread carrying only
the messages that existed *before* Chris replied, so a draft cannot know a
location the client confirmed two emails later. His real reply is printed for
comparison and is never shown to the model.

The leakage rule is enforced by `tests/unit/ai/conversationContinuity.test.ts`,
which runs free as part of `npm test`. If you add a case, do not pass the whole
thread: that scores beautifully and measures nothing.

## Cost discipline

Deterministic checks come first and cost nothing — classification, pricing,
travel, dates and format are all plain TypeScript, so the unit suite catches
most defects before any request is made. Reserve live runs for the prose.

A full dev or holdout run is 23 requests, roughly **$0.17** on Sonnet 5.5.
Results are written to disk so they can be re-read without paying twice.
