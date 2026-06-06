# Testimonial Submission System

## Public form

Share `https://www.soloxsnaps.com/testimonial` with clients after delivering a gallery. The page is not linked in the public navigation and is marked `noindex, nofollow`.

Email is optional. New submissions are validated by `POST /api/testimonials`, stored as plain text, and always created with `status = pending`.

Gallery links can include:

```text
https://www.soloxsnaps.com/testimonial?source=gallery&galleryId=abc123&sessionType=graduation
```

The server validates and sanitizes `source`, `galleryId`, and `sessionType` before storage.

## Admin review

Open `https://www.soloxsnaps.com/admin?tab=testimonials`.

The existing admin session is required. The tab supports:

- Search by client name, email, or testimonial text
- Status and source filters
- Approve, reject, archive, or return to pending
- Private admin notes
- Confirmed permanent deletion

Approving or rejecting sets `reviewed_at`. Approval does not set `published_at`.

## Database and security

Apply:

```text
supabase/migrations/20260606000005_create_testimonials.sql
```

The table has RLS enabled and forced, with no public policies and no grants for `anon` or `authenticated`. Public and admin operations use server-only API routes with the existing Supabase service-role client. No new environment variables are required.

## Future public display

Use `getApprovedTestimonials()` from `lib/testimonialsData.ts`. It returns only:

- `id`
- `message`
- `display_name`
- `session_type`
- `published_at`

It does not return email, admin notes, or private full-name fields.
