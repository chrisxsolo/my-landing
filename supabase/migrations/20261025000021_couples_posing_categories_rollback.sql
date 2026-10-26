-- Rollback for 20261025000021_couples_posing_categories.
-- Restores the original six posing categories (by slug where known).
-- Prompt variations are lost on rollback.

alter table public.couples_posing_prompts
  drop constraint if exists couples_posing_category_check;
alter table public.couples_posing_prompts
  drop constraint if exists couples_posing_variation_length_check;

update public.couples_posing_prompts p
   set category = m.category
  from (values
    ('whisper-a-random-answer',         'Standing and Intimate'),
    ('smell-her-hair',                  'Standing and Intimate'),
    ('walk-up-and-touch-noses',         'Standing and Intimate'),
    ('temple-kiss',                     'Standing and Intimate'),
    ('swimming-arms-into-a-hug',        'From Behind'),
    ('head-on-his-back-and-cheek-kiss', 'From Behind'),
    ('head-on-his-neck',                'From Behind'),
    ('chase-catch-and-swing',           'Playful')
  ) as m(slug, category)
 where p.slug = m.slug;

update public.couples_posing_prompts set category = case category
    when 'Playful Interactions' then 'Playful'
    when 'Romantic and Intimate' then 'Standing and Intimate'
    when 'Hugs and Embraces' then 'Standing and Intimate'
    when 'Sitting Poses' then 'Sitting'
    when 'Lifts and Spins' then 'Piggyback and Lifts'
    when 'Close-Up Details' then 'Standing and Intimate'
    else category end;

update public.couples_posing_prompts set display_order = prompt_number;

alter table public.couples_posing_prompts
  add constraint couples_posing_category_check check (
    category in (
      'Walking and Movement', 'Playful', 'Standing and Intimate',
      'From Behind', 'Sitting', 'Piggyback and Lifts'
    )
  );
alter table public.couples_posing_prompts drop column if exists variation;
