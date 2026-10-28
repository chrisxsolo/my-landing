-- Rollback for 20261027000033_session_location_inheritance.
--
-- Clears exactly the photo locations the backfill wrote, found through the
-- history rows it recorded, and only while the row still holds that
-- session-inherited value — a location the photographer has since changed by
-- hand (evidence no longer 'session', or a different value) is left alone.
-- Nothing else changes; rolling back only re-creates the review-queue cards.

with logged as (
  select id as log_id,
         substring(photo_key from 8)::uuid as photo_id,
         new_value #>> '{}' as location
    from public.photo_change_log
   where actor = 'system'
     and field = 'location'
     and reason = 'backfill: inherited the session''s only location'
), cleared as (
  update public.session_photos p
     set photo_location = null,
         photo_location_source = null,
         photo_location_evidence = null,
         photo_location_confirmed_at = null
    from logged l
   where p.id = l.photo_id
     and p.photo_location_evidence = 'session'
     and p.photo_location = l.location
  returning p.id
)
delete from public.photo_change_log
 where id in (select log_id from logged);
