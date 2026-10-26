-- Verify for 20261025000021_couples_posing_categories. Read-only.
do $$
begin
  if exists (select 1 from public.couples_posing_prompts
              where category not in ('Walking and Movement','Playful Interactions',
                'Romantic and Intimate','Hugs and Embraces','Sitting Poses',
                'Lifts and Spins','Close-Up Details')) then
    raise exception 'a posing prompt still uses an old category';
  end if;
  if (select category from public.couples_posing_prompts
       where slug = 'whisper-a-random-answer') <> 'Playful Interactions' then
    raise exception 'whisper prompt not recategorized';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_name = 'couples_posing_prompts' and column_name = 'variation') then
    raise exception 'couples_posing_prompts.variation missing';
  end if;
end $$;
