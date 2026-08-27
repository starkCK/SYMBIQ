-- SymbiQ — L1 identity schema.
--
-- Run this ONCE in the Supabase dashboard: your project -> SQL Editor ->
-- New query -> paste this whole file -> Run. No database password needed
-- for this — the SQL Editor uses your logged-in dashboard session.
--
-- What it creates:
--   1. the `profiles` table (one row per human; auth.users holds credentials,
--      this holds identity — matches outputs/21_MARKETPLACE_AND_REALITY_TRACKER.md §4.3)
--   2. Row-Level Security so a profile is readable by anyone when public,
--      writable only by its own owner — enforced by the database, not by
--      remembering the rule in application code
--   3. a trigger that creates a profile automatically the moment someone
--      signs up, assigning the next "Symbiont #N" badge number and a safe
--      default handle derived from their email (collision-checked)
--
-- Safe to re-run: every statement is idempotent (IF NOT EXISTS / OR REPLACE /
-- DROP ... IF EXISTS before CREATE).

create extension if not exists citext;

create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  handle        citext unique not null,
  display_name  text not null,
  symbiont_no   int generated always as identity,
  bio           text,
  avatar_key    text,
  country       text,
  links         jsonb not null default '{}',
  progress      jsonb not null default '{}',
  open_to_work  boolean not null default false,
  visibility    text not null default 'public'
                  check (visibility in ('public', 'members', 'private')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

comment on table profiles is
  'One row per human. auth.users holds credentials; this holds identity and the '
  'synced mirror of localStorage progress (see site/save.js).';
comment on column profiles.progress is
  'Mirrors SymbiQ.save''s local shape exactly. Trusted for streaks/UI only -- '
  'NEVER for badges, tiers, or certificates. See design doc §7.3: attested '
  'mastery is a separate table (mastery_events), written by the server only, '
  'not yet built in L1.';

alter table profiles enable row level security;

drop policy if exists "profiles are publicly readable when public" on profiles;
create policy "profiles are publicly readable when public"
  on profiles for select
  using (visibility = 'public' or auth.uid() = id);

drop policy if exists "users can update their own profile" on profiles;
create policy "users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- No insert/delete policy for ordinary users: profiles are created ONLY by
-- the trigger below (security definer, bypasses RLS) and deleted only via
-- the auth.users cascade. This is deliberate -- a user cannot create a
-- second profile for themselves or delete their own record directly.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_handle   text;
  final_handle  text;
  suffix        int := 0;
begin
  base_handle := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), 'symbiont'), '[^a-z0-9_]', '', 'g'));
  if base_handle = '' or base_handle is null then
    base_handle := 'symbiont';
  end if;
  final_handle := base_handle;

  while exists (select 1 from public.profiles where handle = final_handle) loop
    suffix := suffix + 1;
    final_handle := base_handle || suffix::text;
  end loop;

  insert into public.profiles (id, handle, display_name)
  values (new.id, final_handle, coalesce(new.raw_user_meta_data ->> 'full_name', base_handle));

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on profiles;
create trigger profiles_touch_updated_at
  before update on profiles
  for each row execute function public.touch_updated_at();
