---
name: project-seo-growth
description: SoloXSnaps SEO & growth initiative — graduation focus, multi-phase roadmap and progress
metadata:
  type: project
---

Large multi-phase SEO initiative to make SoloXSnaps the Bay Area authority for **graduation photography** and lay groundwork for future couples photography. Goal is SEO visibility / organic traffic, NOT a redesign. Do NOT build a couples portfolio yet.

Work is on branch **`feat/technical-seo-foundation`** (pushed to origin, not merged to main as of 2026-06-05).

**Done (Technical SEO foundation):**
- `app/sitemap.ts` (static routes + dynamic blog/journal from Supabase, hourly revalidate) and `app/robots.ts`
- FAQ schema (`FAQPage` JSON-LD) on /faq and /faq/graduation; FAQ data extracted to `faqData.ts` / `graduationFaqData.ts`
- `lib/breadcrumbs.ts` + `BreadcrumbList` on school landing pages, blog posts, both FAQ pages, grad-guide pages
- `sameAs` (Instagram) added to homepage ProfessionalService schema
- Converted the 4 `grad-guide` pages from client-only to server components with real metadata + Article/Breadcrumb JSON-LD (bodies moved to `*Client.tsx`)
- Journal SEO audit: 7 graduation entries in Supabase `blog_posts`, all category=professional (canonical /blog/[slug]); titles/slugs already optimized — did NOT change slugs. Filled 2 missing meta_descriptions (ids 1,3) and removed id=1's duplicate-title body line. Added `postBody.tsx` so /blog renders real `<h2>`/`<ul>` from body text + a "Keep exploring" internal-links row (school page + grad pricing + availability + guides). `blog_posts` has no school/tags column — school detected from title/slug.

**Known gaps / next up:**
- `LocalBusiness` schema needs real address/geo/telephone — waiting on Chris to provide (or confirm by-appointment)
- `/journal/[slug]` still client-rendered (canonical points cross-posted entries to server-rendered `/blog/[slug]`, so OK for now)
- Pre-existing lint errors (unescaped apostrophes, unused setLoading, `<img>`) in grad-guide `*Client.tsx` left as-is — separate cleanup
- Bigger roadmap phases not started: Journal SEO audit, school landing page content depth, resource hub pages, location guides, couples SEO foundation (FAQ/booking-process/what-to-wear)

Build locally with `next build --webpack` (see [[build-webpack-flag]]). Related: [[project_website_improvements]], [[homepage-green-palette]].
