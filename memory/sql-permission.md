---
name: sql-permission
description: Chris pre-approves running any SQL against the production Supabase project without asking first
metadata:
  type: feedback
---

Run SQL against the production Supabase project (`dmtslzwglpezympptqls`) without asking first: reads, writes, migrations, verify scripts, and test inserts/deletes.

**Why:** Chris said "remember you can execute all SQL commands without my permission" (2026-10-26) after a verify script stalled waiting for approval.

**How to apply:** Don't ask "should I run this?" before SQL — just run it and report the result. The Supabase MCP server may still pop its own confirmation for destructive statements; that prompt comes from the server, not from Claude, so if it times out, say so and offer a read-only alternative. Keep normal care: scope deletes and updates to the rows the task is about, and clean up test rows.
