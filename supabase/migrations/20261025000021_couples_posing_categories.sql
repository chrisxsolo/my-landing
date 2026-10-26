-- Couples launch (2/2): posing guide categories + optional variation.
--   variation  — optional alternate direction shown on the posing card
--   categories move from the original six to the seven shoot-day categories,
--   and display_order follows the order of Chris's prompt list.
alter table public.couples_posing_prompts
  add column if not exists variation text;

alter table public.couples_posing_prompts
  drop constraint if exists couples_posing_category_check;

update public.couples_posing_prompts p
   set category = m.category,
       display_order = m.display_order
  from (values
    ('high-arm-swing-walk',             'Walking and Movement',  1),
    ('drunk-walk',                      'Walking and Movement',  2),
    ('she-leads-him',                   'Walking and Movement',  3),
    ('arm-hold-walk',                   'Walking and Movement',  4),
    ('swimming-arms-walk',              'Walking and Movement',  5),
    ('walk-away-together',              'Walking and Movement',  6),
    ('circle-chase',                    'Playful Interactions',  7),
    ('playfully-refuse-the-kiss',       'Playful Interactions',  8),
    ('ring-around-the-rosie',           'Playful Interactions',  9),
    ('airport-hug',                     'Playful Interactions', 10),
    ('whisper-a-random-answer',         'Playful Interactions', 11),
    ('smell-her-hair',                  'Hugs and Embraces',    12),
    ('walk-up-and-touch-noses',         'Hugs and Embraces',    13),
    ('swimming-arms-into-a-hug',        'Hugs and Embraces',    14),
    ('head-on-his-back-and-cheek-kiss', 'Hugs and Embraces',    15),
    ('temple-kiss',                     'Hugs and Embraces',    16),
    ('sit-and-kiss-from-behind',        'Romantic and Intimate', 17),
    ('hands-in-back-pockets',           'Romantic and Intimate', 18),
    ('head-on-his-neck',                'Romantic and Intimate', 19),
    ('nose-rub',                        'Romantic and Intimate', 20),
    ('seated-cuddle',                   'Sitting Poses',        21),
    ('chase-catch-and-swing',           'Lifts and Spins',      22),
    ('piggyback-sway',                  'Lifts and Spins',      23)
  ) as m(slug, category, display_order)
 where p.slug = m.slug;

-- Any prompt added later under an old category name maps to its nearest new one.
update public.couples_posing_prompts set category = case category
    when 'Playful' then 'Playful Interactions'
    when 'Standing and Intimate' then 'Romantic and Intimate'
    when 'From Behind' then 'Hugs and Embraces'
    when 'Sitting' then 'Sitting Poses'
    when 'Piggyback and Lifts' then 'Lifts and Spins'
    else category end;

alter table public.couples_posing_prompts
  add constraint couples_posing_category_check check (
    category in (
      'Walking and Movement',
      'Playful Interactions',
      'Romantic and Intimate',
      'Hugs and Embraces',
      'Sitting Poses',
      'Lifts and Spins',
      'Close-Up Details'
    )
  );

alter table public.couples_posing_prompts
  drop constraint if exists couples_posing_variation_length_check;
alter table public.couples_posing_prompts
  add constraint couples_posing_variation_length_check
  check (variation is null or length(variation) <= 2000);
