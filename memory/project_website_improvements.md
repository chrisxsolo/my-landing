---
name: project-website-improvements
description: Ongoing 7-priority initiative to improve soloxsnaps.com conversion/trust/SEO
metadata:
  type: project
---

Chris is running a 7-priority initiative to improve soloxsnaps.com (conversion, trust, client experience, SEO, professionalism). NOT building a couples portfolio yet (deferred until more couples work exists).

Priorities: P1 trust/social proof (stats + testimonials higher), P2 client experience (booking timeline + dashboard showcase + more FAQ), P3 homepage CTAs + "no experience needed" messaging, P4 expand About, P5 resource hub, P6 campus location guides, P7 recent sessions section.

**Already built before the initiative:** P6 campus guides exist at [grads/uc-berkeley](app/(professional)/grads/) (also sjsu, usf, sf-state, csueb) via a shared `SchoolLandingTemplate`. A client portal/dashboard already exists and is teased on the homepage.

**P1 progress (2026-06-04):** Added a stats band under the hero (300+ grads, 7 campuses, 3+ years, 2-week delivery — real numbers; deliberately did NOT fabricate a "sessions photographed" count). Added reusable [Testimonials](app/components/Testimonials.tsx) component fed by [lib/testimonials.ts](lib/testimonials.ts) — renders nothing until Chris pastes real quotes (still pending). Homepage order is now Hero → Stats → Testimonials → Services → Editorial → Session System → CTA → Instagram → Portal. See [[homepage-green-palette]].

Real stats: 300+ grads, 3+ years, 2-week delivery, schools = UC Berkeley, SJSU, SFSU, USF, UC Law, Stanford, Santa Clara (7). Won't invent testimonials/stats for the live site.
