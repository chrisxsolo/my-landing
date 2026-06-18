# Admin Website Navigation Design

## Goal

Make the admin sidebar faster to scan by ordering the existing Website links into collapsible, purpose-based groups.

## Structure

- **Guides:** Grad Poses, Couples Posing Guide, Couples Locations, Campus Spots, Bay Guide, Family Guide
- **Showcase:** Portfolio, Case Studies, Categories
- **Publishing:** Blog, Image Library
- **Site Setup:** Navigation, About Page

## Behavior

The Website section uses a single-open accordion. Opening one group closes the previous group. When a Website tab becomes active, its parent group opens automatically. A group may still be collapsed manually while its active tab remains selected.

Existing tab values, destinations, content, labels, and icons remain intact. Client Work, Marketing, Tools, and the mobile horizontal navigation remain unchanged.

## Implementation Boundary

A focused client component owns the Website navigation groups and accordion state. `app/admin/page.tsx` continues to own the active dashboard tab and passes navigation through its existing cleanup callback. No API, Supabase schema, authentication, or Vercel configuration changes are required.

## Verification

Automated tests verify the group order, exact tab membership, uniqueness, and active-tab-to-group lookup. Type checking, linting, the production build, and desktop browser interaction verify integration and visual behavior.
