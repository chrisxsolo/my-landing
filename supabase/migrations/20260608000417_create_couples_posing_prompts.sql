create table if not exists public.couples_posing_prompts (
  id uuid primary key default gen_random_uuid(),
  prompt_number integer not null unique,
  slug text not null unique,
  title text not null,
  category text not null,
  instructions text not null,
  keywords text[] not null default '{}',
  display_order integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couples_posing_prompt_number_check check (prompt_number > 0),
  constraint couples_posing_title_not_blank check (length(trim(title)) > 0),
  constraint couples_posing_instructions_not_blank check (length(trim(instructions)) > 0),
  constraint couples_posing_category_check check (
    category in (
      'Walking and Movement',
      'Playful',
      'Standing and Intimate',
      'From Behind',
      'Sitting',
      'Piggyback and Lifts'
    )
  ),
  constraint couples_posing_display_order_check check (display_order >= 0)
);

drop trigger if exists couples_posing_prompts_set_updated_at
on public.couples_posing_prompts;

create trigger couples_posing_prompts_set_updated_at
before update on public.couples_posing_prompts
for each row execute function public.set_updated_at();

create index if not exists couples_posing_prompts_order_idx
on public.couples_posing_prompts(display_order, prompt_number);

create index if not exists couples_posing_prompts_category_idx
on public.couples_posing_prompts(category, is_published);

revoke all on public.couples_posing_prompts from anon, authenticated;
grant all on public.couples_posing_prompts to service_role;

alter table public.couples_posing_prompts enable row level security;
alter table public.couples_posing_prompts force row level security;

insert into public.couples_posing_prompts (
  prompt_number,
  slug,
  title,
  category,
  instructions,
  keywords,
  display_order,
  is_published
) values
  (1, 'high-arm-swing-walk', 'High Arm Swing Walk', 'Walking and Movement', $prompt$Have them slowly walk toward the camera while looking at each other and swinging their arms really high$prompt$, array['walk','arms','movement'], 1, true),
  (2, 'drunk-walk', 'Drunk Walk', 'Walking and Movement', $prompt$Have them act like they’re drunk while walking in place or slowly walking toward the camera

They should hold hands, lean into each other, and bump hips as they walk$prompt$, array['walk','hands','hips','playful'], 2, true),
  (3, 'she-leads-him', 'She Leads Him', 'Walking and Movement', $prompt$Have them hold hands and let her take the lead

She should walk ahead of him, look back at him, and guide him forward

While they’re moving, have her pull him toward her so they end up really close, looking at each other and smiling$prompt$, array['walk','lead','hands','pull'], 3, true),
  (4, 'arm-hold-walk', 'Arm-Hold Walk', 'Walking and Movement', $prompt$Have him place one hand in his pocket and leave his other arm hanging naturally

Have her wrap both hands around his free arm and walk very close beside him toward the camera

Tell them to alternate between looking where they’re walking and looking at each other$prompt$, array['walk','arm','close'], 4, true),
  (5, 'swimming-arms-walk', 'Swimming Arms Walk', 'Walking and Movement', $prompt$Have him stand directly behind her while they hold hands

Bring their arms outward to the sides and have them walk toward the camera while moving their arms like they’re swimming through water

Have them look at each other as they move$prompt$, array['walk','behind','arms','swimming'], 5, true),
  (6, 'walk-away-together', 'Walk Away Together', 'Walking and Movement', $prompt$Have them walk off into the distance together and pretend I’m not there$prompt$, array['walk','away','candid'], 6, true),
  (7, 'circle-chase', 'Circle Chase', 'Playful', $prompt$Have them chase each other around in a circle

The girl should look back at him and smile like she’s barely getting away while the guy runs after her

Tell them they’re just playing and not to take the movement too seriously$prompt$, array['chase','circle','run','playful'], 7, true),
  (8, 'playfully-refuse-the-kiss', 'Playfully Refuse the Kiss', 'Playful', $prompt$Have the guy try to kiss her on the cheek while she playfully turns her head away and tries not to let him kiss her

They should stay close and hold onto each other while doing it$prompt$, array['kiss','cheek','playful'], 8, true),
  (9, 'ring-around-the-rosie', 'Ring Around the Rosie', 'Playful', $prompt$Have them hold hands and play Ring Around the Rosie together

Let them spin, laugh, and move naturally$prompt$, array['spin','laugh','hands','playful'], 9, true),
  (10, 'airport-hug', 'Airport Hug', 'Playful', $prompt$Start them far apart and facing away from each other

On the count of three, have them turn around, run toward each other, and give each other a huge bear hug

Tell them to hug like they haven’t seen each other in months and are finally seeing each other at the airport$prompt$, array['run','hug','airport','playful'], 10, true),
  (11, 'chase-catch-and-swing', 'Chase, Catch, and Swing', 'Playful', $prompt$Have the girl run away while the guy chases after her

Have him catch her from behind, wrap his arms around her, pick her up, and swing her around$prompt$, array['chase','catch','lift','swing'], 11, true),
  (12, 'sit-and-kiss-from-behind', 'Sit and Kiss From Behind', 'Standing and Intimate', $prompt$Have the guy sit down

Have the girl stand behind him, lean over him, and go in for a kiss from behind$prompt$, array['sit','kiss','behind'], 12, true),
  (13, 'whisper-a-random-answer', 'Whisper a Random Answer', 'Standing and Intimate', $prompt$Have them stand facing each other and hold hands

Have him lean toward her and whisper something into her ear, such as his favorite cereal

Photograph her reaction rather than the whisper itself$prompt$, array['whisper','reaction','hands','intimate'], 13, true),
  (14, 'smell-her-hair', 'Smell Her Hair', 'Standing and Intimate', $prompt$Have him stand behind her and wrap his arms around her waist

Have them overlap or hold hands around her waist

Tell him to smell her hair while she turns her face toward the direction he’s smelling$prompt$, array['behind','hair','hug','waist'], 14, true),
  (15, 'hands-in-back-pockets', 'Hands in Back Pockets', 'Standing and Intimate', $prompt$Have them stand face to face and get extremely close

Place his hands inside her back pockets and have her place her hands against his chest

Have them gently squish together

Use this for a tighter detail shot$prompt$, array['hands','pockets','close','detail'], 15, true),
  (16, 'walk-up-and-touch-noses', 'Walk Up and Touch Noses', 'Standing and Intimate', $prompt$Have him remain still while she slowly walks toward him

Have her place one arm around his neck and the other around his stomach or waist

Tell her to try touching her nose to his nose and then lean into him$prompt$, array['walk','nose','neck','waist'], 16, true),
  (17, 'nose-rub', 'Nose Rub', 'Standing and Intimate', $prompt$Have them stand face to face

Her hands should be on his shoulders and his hands should be around her waist

Have them gently rub their noses together and smile at each other$prompt$, array['nose','smile','waist','intimate'], 17, true),
  (18, 'temple-kiss', 'Temple Kiss', 'Standing and Intimate', $prompt$Have them stand side by side

Tell him to pull her closer and kiss her on the temple$prompt$, array['kiss','temple','close'], 18, true),
  (19, 'swimming-arms-into-a-hug', 'Swimming Arms Into a Hug', 'From Behind', $prompt$Have him stand behind her with her back against his chest

Have them hold hands and extend their arms outward

Tell them to wave their arms around like they’re swimming in place

On the count of three, have him pull her arms inward and wrap her in a hug$prompt$, array['behind','arms','swimming','hug'], 19, true),
  (20, 'head-on-his-back-and-cheek-kiss', 'Head on His Back and Cheek Kiss', 'From Behind', $prompt$Have her stand behind him and rest her head against his back

Have them hold hands

Place her far hand, the hand away from the camera, on his cheek and have her gently pull his head toward her

Then have her kiss him on the cheek while he smiles$prompt$, array['behind','head','cheek','kiss'], 20, true),
  (21, 'head-on-his-neck', 'Head on His Neck', 'From Behind', $prompt$Have her stand directly behind him while they hold hands

Have her rest her head against his neck

Tell them to look toward each other and make sure he smiles$prompt$, array['behind','head','neck','smile'], 21, true),
  (22, 'seated-cuddle', 'Seated Cuddle', 'Sitting', $prompt$Have him sit down with her sitting between his legs

Her legs should be kicked outward to one side

Have them cuddle closely and tell him to gently hold her cheek$prompt$, array['sit','cuddle','legs','cheek'], 22, true),
  (23, 'piggyback-sway', 'Piggyback Sway', 'Piggyback and Lifts', $prompt$Have her jump onto his back for a piggyback ride

Tell them to sway from side to side and look up toward each other

Have her whisper something into his ear, smile near his ear, and give him small kisses on the cheek or ear$prompt$, array['piggyback','lift','sway','whisper','kiss'], 23, true)
on conflict (prompt_number) do update set
  slug = excluded.slug,
  title = excluded.title,
  category = excluded.category,
  instructions = excluded.instructions,
  keywords = excluded.keywords,
  display_order = excluded.display_order;

alter table public.couples_inspiration_images
drop constraint if exists couples_inspiration_prompt_number_check;

alter table public.couples_inspiration_images
drop constraint if exists couples_inspiration_related_prompt_fkey;

alter table public.couples_inspiration_images
add constraint couples_inspiration_related_prompt_fkey
foreign key (related_prompt_number)
references public.couples_posing_prompts(prompt_number)
on update cascade
on delete set null;
