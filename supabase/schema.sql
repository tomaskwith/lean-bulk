-- Lean Bulk: database setup for Supabase.
-- Run this whole file once in Supabase → SQL Editor → New query → Run.
-- Then set your PIN with the one-liner in the README (never commit the PIN).
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
