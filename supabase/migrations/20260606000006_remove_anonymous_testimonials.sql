update public.testimonials
set display_name_preference = 'first_name_last_initial'
where display_name_preference = 'anonymous';

alter table public.testimonials
drop constraint if exists testimonials_display_name_preference_check;

alter table public.testimonials
add constraint testimonials_display_name_preference_check check (
  display_name_preference in ('first_name_last_initial', 'full_name', 'first_name_only')
);
