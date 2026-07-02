-- Track whether the Resend notification email for an inquiry was sent
-- successfully. Nullable and additive — existing rows stay NULL (pre-tracking),
-- and the contact route updates it fail-soft after each submission.
alter table public.inquiries
  add column if not exists notification_email_sent boolean;

comment on column public.inquiries.notification_email_sent is
  'TRUE if the Resend notification email to the business inbox sent successfully, FALSE if it failed or was skipped (e.g. missing RESEND_API_KEY), NULL for rows created before tracking existed.';
