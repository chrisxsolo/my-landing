---
name: deploy-workflow
description: Chris wants every finished change pushed and deployed, not left on a branch
metadata:
  type: feedback
---

Always push and deploy finished work: commit, push, merge to `main` (Vercel deploys `main` to production), and apply any new Supabase migration to the production project (`dmtslzwglpezympptqls`) before or with the deploy.

**Why:** Chris said "always push and deploy" (2026-10-26) after a change was left on a feature branch awaiting approval.

**How to apply:** Don't stop at a branch or ask whether to open a PR. Run typecheck/lint/tests first, apply migrations, fast-forward `main`, push, then confirm the Vercel production deployment succeeds. Still ask before destructive or irreversible data changes.
