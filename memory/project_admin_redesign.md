---
name: project-admin-redesign
description: Admin dashboard was redesigned from horizontal tabs to a sticky left sidebar. Calendar view and home tab layout preferences captured.
metadata:
  type: project
---

Admin dashboard redesigned 2026-05-28. Changed from a two-row horizontal tab nav (max-w-3xl centered) to a flex layout with a 200px sticky left sidebar. The calendar view on the home tab was kept exactly as-is per user request.

**Why:** User found horizontal nav hard to navigate efficiently, especially with 18 tabs across 5 groups.

**How to apply:** Any future nav changes should use the sidebar pattern in `app/admin/page.tsx`. The NavBtn component is defined inline inside the sidebar IIFE. Sidebar is `sticky top-14 h-[calc(100vh-56px)]`.

Home tab changes:
- Quick actions bar at top (New Client, Reminder Templates, Portal Sessions, Subscribe Calendar, Availability)
- Stats row (unchanged)
- Two-column grid: SessionCalendar (left) + Upcoming/Needs Reply cards (right, `lg:grid-cols-[1fr_290px]`)
- Gmail inbox full-width below

User explicitly loves: the calendar view, first-glance sessions, the warm gradient aesthetic (violet/pink/amber from `lib/colors.ts`).
