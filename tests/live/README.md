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
