# Agent Rules for this Project

## Stack
Next.js App Router · Supabase (Postgres + Auth + Storage) · Tailwind CSS · TypeScript · Vercel

---

## ⚠️ Next.js Version Warning
<!-- BEGIN:nextjs-agent-rules -->
This is NOT the Next.js you know. This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

## Planning First — Always

Before writing any code for a non-trivial task:
1. **Read** the files that will be affected
2. **State** the approach in one sentence — what changes, what stays the same
3. **Flag** any side effects (other components, API routes, Supabase schema, or Vercel config that could be impacted)
4. Only then write code

For multi-file changes, list the files before touching any of them.

---

## Code Quality

- **File size**: Keep files under 400 lines. If a file exceeds 400 lines, extract a component or helper.
- **Functions**: Keep under 50 lines. No nesting deeper than 3 levels.
- **One change at a time**: Each edit should do one thing. Don't refactor while fixing a bug.
- **No dead code**: Don't leave commented-out blocks, unused imports, or `TODO` stubs unless the user asked.
- **Immutable patterns**: Never mutate state or function parameters directly — return new objects/arrays.
- **No magic strings**: Use constants for repeated string keys (e.g. Supabase table names, localStorage keys).

---

## This Project's Conventions

- Colors and gradients → always use `C` from `@/lib/colors` — never hardcode hex values inline
- Supabase client → `supabase` from `@/lib/supabase` (client) or `createSupabaseServerClient()` from `@/lib/supabaseServer` (server/API routes)
- Admin auth → use `requireAdmin(req)` in API routes, `checkAuth()` on client pages
- localStorage keys follow the pattern `draft_${id}` and `ai_draft_${id}`
- Tab values in admin page use the `Tab` type — add new tabs to both the type and `WEBSITE_TABS`/`CLIENT_TABS` arrays

---

## Security

- Never hardcode secrets, API keys, or tokens — use `.env.local` / Vercel env vars
- Validate all user input at API route boundaries (`requireAdmin`, type-checking request body)
- Never expose Supabase service role key to the client
- Sanitize any content before inserting into the DOM as HTML

---

## Error Handling

- API routes: return meaningful JSON errors with appropriate HTTP status codes
- Client: show toast notifications for user-facing errors (`showToast(msg, false)`)
- Never silently swallow errors — at minimum `console.error` with context
- Don't add error handling for impossible cases — trust TypeScript types and framework guarantees

---

## Regression Prevention

Before finishing any change:
- Check that other tabs/features that use the same state or API route still work
- If you changed a shared utility (e.g. `tryParseDate`, `detectSchool`), verify all call sites
- If you changed an API route's response shape, update every place that reads that response
- If you removed a state variable or function, grep for other references before deleting

---

## Commits

Use this format when asked to commit:
```
type: short description

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
Types: `feat` · `fix` · `refactor` · `style` · `chore`

One logical change per commit. Don't bundle unrelated fixes.
