-- Lean Bulk: database setup for Supabase.
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Then set your PIN with the one-liner in the README (never commit the PIN).
-- Safe to run again after updates: it only adds what is missing.
--
-- Security model: the site is public and the anon key is public. Tables have
-- RLS on with NO policies, so the anon key can't read or write them directly.
-- Everything goes through the three functions below, which check the PIN.

create extension if not exists pgcrypto with schema extensions;

-- Check-ins: one row per person per day.
create table if not exists public.checkins (
  person     text        not null check (person in ('tom', 'joe')),
  date       date        not null,
  session    text        not null default 'rest' check (session in ('A','B','C','D','E','rest')),
  sets       jsonb       not null default '{}'::jsonb check (pg_column_size(sets) < 20000),
  weight     numeric(5,1)         check (weight between 30 and 250),
  kcal       int                  check (kcal between 0 and 15000),
  protein    int                  check (protein between 0 and 1000),
  creatine   boolean     not null default false,
  prep       boolean     not null default false,
  notes      text                 check (char_length(notes) <= 500),
  saved_at   timestamptz not null default now(),
  primary key (person, date)
);

-- The shared PIN (bcrypt hash only) and a log of wrong guesses for lockout.
create table if not exists public.app_pin (
  id       int  primary key default 1 check (id = 1),
  pin_hash text not null
);
create table if not exists public.pin_failures (
  at timestamptz not null default now()
);

alter table public.checkins     enable row level security;
alter table public.app_pin      enable row level security;
alter table public.pin_failures enable row level security;
revoke all on public.checkins, public.app_pin, public.pin_failures from anon, authenticated;

-- Internal: returns 'ok', 'bad_pin' or 'locked'. 15 wrong guesses in 15 minutes locks it.
create or replace function public._pin_status(p_pin text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if (select count(*) from pin_failures where at > now() - interval '15 minutes') >= 15 then
    return 'locked';
  end if;
  select pin_hash into v_hash from app_pin where id = 1;
  if v_hash is not null and p_pin is not null and crypt(p_pin, v_hash) = v_hash then
    return 'ok';
  end if;
  insert into pin_failures default values;
  delete from pin_failures where at < now() - interval '1 day';
  return 'bad_pin';
end;
$$;
revoke all on function public._pin_status(text) from public, anon, authenticated;

create or replace function public.verify_pin(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s text := _pin_status(p_pin);
begin
  return jsonb_build_object('ok', s = 'ok', 'error', case when s = 'ok' then null else s end);
end;
$$;

create or replace function public.get_checkins(p_pin text, p_since date default current_date - 400)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s text := _pin_status(p_pin);
begin
  if s <> 'ok' then
    return jsonb_build_object('ok', false, 'error', s);
  end if;
  return jsonb_build_object('ok', true, 'rows', coalesce((
    select jsonb_agg(to_jsonb(c) order by c.date desc)
    from checkins c where c.date >= p_since
  ), '[]'::jsonb));
end;
$$;

create or replace function public.save_checkin(p_pin text, p_row jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s text := _pin_status(p_pin);
begin
  if s <> 'ok' then
    return jsonb_build_object('ok', false, 'error', s);
  end if;
  insert into checkins (person, date, session, sets, weight, kcal, protein, creatine, prep, notes, saved_at)
  values (
    p_row->>'person',
    (p_row->>'date')::date,
    coalesce(p_row->>'session', 'rest'),
    coalesce(p_row->'sets', '{}'::jsonb),
    (p_row->>'weight')::numeric,
    (p_row->>'kcal')::int,
    (p_row->>'protein')::int,
    coalesce((p_row->>'creatine')::boolean, false),
    coalesce((p_row->>'prep')::boolean, false),
    left(p_row->>'notes', 500),
    now()
  )
  on conflict (person, date) do update set
    session = excluded.session, sets = excluded.sets, weight = excluded.weight,
    kcal = excluded.kcal, protein = excluded.protein, creatine = excluded.creatine,
    prep = excluded.prep, notes = excluded.notes, saved_at = now();
  return jsonb_build_object('ok', true);
exception
  when check_violation or invalid_text_representation or numeric_value_out_of_range then
    return jsonb_build_object('ok', false, 'error', 'invalid');
end;
$$;

grant execute on function public.verify_pin(text)           to anon;
grant execute on function public.get_checkins(text, date)   to anon;
grant execute on function public.save_checkin(text, jsonb)  to anon;

-- ---------------------------------------------------------------------------
-- Part 2: meal library, weekly meal plan and shared settings (targets).
-- Safe to run again. Same model: RLS on, no policies, PIN-checked functions.

-- A recipe is stored as JSON: {"t": title, "tubs": n, "m": [kcal, P, C, F] per tub,
--                              "ing": [lines], "steps": [lines]}
create table if not exists public.recipes (
  id         text        primary key check (id ~ '^[a-z0-9-]{1,64}$'),
  data       jsonb       not null check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 20000),
  updated_at timestamptz not null default now()
);

-- Which recipe goes in which cook. week = the Monday the food is eaten from.
-- A week with no rows uses the most recent earlier week's picks.
create table if not exists public.meal_plan (
  week      date not null,
  cook      text not null check (cook in ('sun', 'wed')),
  slot      text not null check (slot in ('lunch', 'dinner')),
  recipe_id text not null references public.recipes(id) on delete cascade,
  primary key (week, cook, slot)
);

-- One row of shared settings, e.g. {"targets": {"tom": {"kcal": 3500, "protein": 170}, ...}}
create table if not exists public.app_settings (
  id   int   primary key default 1 check (id = 1),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object' and pg_column_size(data) < 5000)
);

alter table public.recipes      enable row level security;
alter table public.meal_plan    enable row level security;
alter table public.app_settings enable row level security;
revoke all on public.recipes, public.meal_plan, public.app_settings from anon, authenticated;

create or replace function public.get_app_data(p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s text := _pin_status(p_pin);
begin
  if s <> 'ok' then
    return jsonb_build_object('ok', false, 'error', s);
  end if;
  return jsonb_build_object(
    'ok', true,
    'recipes', coalesce((select jsonb_agg(r.data || jsonb_build_object('id', r.id) order by r.updated_at) from recipes r), '[]'::jsonb),
    'plan', coalesce((select jsonb_agg(to_jsonb(p) order by p.week) from meal_plan p), '[]'::jsonb),
    'settings', coalesce((select data from app_settings where id = 1), '{}'::jsonb)
  );
end;
$$;

create or replace function public.save_recipe(p_pin text, p_id text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s text := _pin_status(p_pin);
begin
  if s <> 'ok' then
    return jsonb_build_object('ok', false, 'error', s);
  end if;
  if coalesce(char_length(trim(p_data->>'t')), 0) not between 1 and 80 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  insert into recipes (id, data, updated_at) values (p_id, p_data - 'id', now())
  on conflict (id) do update set data = excluded.data, updated_at = now();
  return jsonb_build_object('ok', true);
exception
  when check_violation or invalid_text_representation then
    return jsonb_build_object('ok', false, 'error', 'invalid');
end;
$$;

create or replace function public.delete_recipe(p_pin text, p_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s text := _pin_status(p_pin);
begin
  if s <> 'ok' then
    return jsonb_build_object('ok', false, 'error', s);
  end if;
  delete from recipes where id = p_id;
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.set_plan(p_pin text, p_week date, p_cook text, p_slot text, p_recipe_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s text := _pin_status(p_pin);
begin
  if s <> 'ok' then
    return jsonb_build_object('ok', false, 'error', s);
  end if;
  insert into meal_plan (week, cook, slot, recipe_id) values (p_week, p_cook, p_slot, p_recipe_id)
  on conflict (week, cook, slot) do update set recipe_id = excluded.recipe_id;
  return jsonb_build_object('ok', true);
exception
  when check_violation or foreign_key_violation or not_null_violation then
    return jsonb_build_object('ok', false, 'error', 'invalid');
end;
$$;

create or replace function public.save_settings(p_pin text, p_data jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare s text := _pin_status(p_pin);
begin
  if s <> 'ok' then
    return jsonb_build_object('ok', false, 'error', s);
  end if;
  insert into app_settings (id, data) values (1, p_data)
  on conflict (id) do update set data = excluded.data;
  return jsonb_build_object('ok', true);
exception
  when check_violation then
    return jsonb_build_object('ok', false, 'error', 'invalid');
end;
$$;

grant execute on function public.get_app_data(text)                     to anon;
grant execute on function public.save_recipe(text, text, jsonb)         to anon;
grant execute on function public.delete_recipe(text, text)              to anon;
grant execute on function public.set_plan(text, date, text, text, text) to anon;
grant execute on function public.save_settings(text, jsonb)             to anon;

-- Starter recipes (only added if they're not there already).
insert into public.recipes (id, data) values
  ('peri', $json${"t":"Peri chicken & spicy rice","tubs":6,"m":[868,47,97,31],"ing":["1.2 kg boneless skinless chicken thighs","2 tbsp peri-peri seasoning (or 1 tbsp smoked paprika, 1 tsp chilli flakes, 1 tsp garlic granules, 1 tsp oregano), juice of 1 lemon, 1 tbsp oil, salt","660 g rice, 1 tsp turmeric, 1 tsp paprika, 1 chicken stock cube","480 g frozen peas & sweetcorn","Peri mayo: 120 g light mayo + 1 tsp peri seasoning + squeeze of lemon"],"steps":["Toss the thighs in the seasoning, lemon and oil. Leave 20 min, or overnight if you remember.","Air fry at 200°C for 18–22 min, flipping halfway, until 75°C inside. Do it in two batches.","Boil the rice with turmeric, paprika and the stock cube. Stir the peas and sweetcorn in for the last 3 min.","Split into 6 tubs: about 200 g raw-weight chicken each. Mayo goes in little pots so the rice doesn't go soggy."]}$json$::jsonb),
  ('bigmac', $json${"t":"Big Mac bowl","tubs":6,"m":[790,48,58,40],"ing":["1.08 kg 12% beef mince","1.8 kg potatoes, cubed, 2 tbsp oil, salt, garlic granules","1 onion, finely diced","150 g mature cheddar, grated","1 iceberg lettuce, gherkins","Sauce: 90 g light mayo, 30 g ketchup, 1 tbsp mustard, 3 chopped gherkins + a splash of the jar vinegar"],"steps":["Air fry the potatoes at 200°C for 20–25 min, shaking twice. Do it in batches.","Brown the mince hard with the onion, salt and black pepper. Drain off a little fat if it's swimming.","Tub it up: potatoes, mince, cheese on top. Lettuce, gherkins and sauce go in a separate pot.","Reheat until piping hot, then add the cold lettuce and sauce."]}$json$::jsonb),
  ('katsu', $json${"t":"Chicken katsu curry","tubs":8,"m":[843,62,124,10],"ing":["1.6 kg chicken breast, butterflied and flattened","240 g panko, 2 eggs beaten, oil spray","800 g rice","Sauce: 2 onions + 2 carrots diced, 3 tbsp mild curry powder, 1 tsp garlic granules, 1 tsp ginger, 80 g plain flour, 1 L chicken stock, 2 tbsp soy, 80 g honey"],"steps":["Dip the chicken in egg, then panko. Spray with oil. Air fry at 200°C for 12–15 min until 75°C inside.","Soften the onion and carrot for 8 min. Stir in the spices and flour for 1 min, then whisk in stock, soy and honey. Simmer 15 min and blitz with the hand blender.","Cook the rice. Tub the rice and sliced chicken, with sauce in a separate pot so the coating stays crisp.","If you're at home, reheat the chicken in the air fryer at 180°C for 5 min."]}$json$::jsonb),
  ('doner', $json${"t":"Doner kebab & chips","tubs":8,"m":[846,52,80,34],"ing":["1.44 kg 12% beef mince (swap some for lamb if it's cheap)","1 onion grated and squeezed dry, 2 tsp each garlic granules, cumin, coriander, smoked paprika, salt; 1 tsp oregano, 1 tsp black pepper","2 kg potatoes cut into chips, 2 tbsp oil","8 large wraps","Garlic sauce: 480 g 0% Greek yoghurt, 80 g light mayo, 2 grated garlic cloves, lemon, dried mint, salt","Lettuce, red onion, chilli sauce if you want it"],"steps":["Mix the mince and spices and knead for 5 min until it's sticky and paste-like. That's what gives it the doner texture.","Press into two loaf tins or tight foil logs. Bake at 180°C for 60–70 min until 75°C inside. Rest it, then slice as thin as you can.","Chips: air fry at 200°C for 20–25 min in batches.","To eat, crisp the doner slices in the air fryer at 200°C for 4–5 min, then load a wrap with salad and garlic sauce, chips on the side."]}$json$::jsonb)

on conflict (id) do nothing;
