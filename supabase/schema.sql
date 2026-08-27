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

-- ============================================================================
-- L2 — The Ledger goes live: community claim submissions + forecasts.
-- Added 2026-08-27, appended to the same idempotent file -- re-run the whole
-- thing again in the SQL Editor; every statement above is safe to repeat.
--
-- IMPORTANT ARCHITECTURAL NOTE, read before touching this section: L0's
-- claims are NOT rows in this database. They are git-committed JSON files
-- under site/data/claims/*.json (see outputs/21_MARKETPLACE_AND_REALITY_TRACKER.md
-- §5.7 for why -- permanence, crawlability, a tamper-evident public history).
-- So `claim_slug` below is a plain text column, not a foreign key -- there is
-- no `claims` table to reference. The design doc's own §5.2 schema assumed a
-- `claims` table would exist by L2; it does not, by deliberate choice, and
-- these two tables are adapted accordingly. tools/check_claims.py is what
-- keeps a slug honest (checked against the real JSON files), not a DB
-- constraint.
-- ============================================================================

create table if not exists claim_submissions (
  id                 bigserial primary key,
  submitter_id       uuid not null references profiles(id) on delete cascade,
  raw_url            text not null,
  raw_quote          text,
  why                text,
  suggested_deadline date,
  status             text not null default 'queued'
                       check (status in ('queued', 'promoted', 'rejected', 'duplicate')),
  triage_note        text,
  promoted_claim_slug text,   -- filled in by hand once the desk writes the real claim JSON
  created_at         timestamptz not null default now()
);

comment on table claim_submissions is
  'Community-proposed claims for The Ledger, pre-triage. Nothing here is '
  'public and nothing auto-publishes -- the desk reviews each one by hand '
  '(via the Supabase table editor, which bypasses RLS as project owner) and, '
  'if promoted, writes a real site/data/claims/<slug>.json committed to git.';

alter table claim_submissions enable row level security;

drop policy if exists "submitters can see their own submissions" on claim_submissions;
create policy "submitters can see their own submissions"
  on claim_submissions for select
  using (auth.uid() = submitter_id);

drop policy if exists "authenticated users can submit a claim" on claim_submissions;
create policy "authenticated users can submit a claim"
  on claim_submissions for insert
  with check (auth.uid() = submitter_id);

drop policy if exists "submitters can retract their own queued submission" on claim_submissions;
create policy "submitters can retract their own queued submission"
  on claim_submissions for delete
  using (auth.uid() = submitter_id and status = 'queued');

create table if not exists claim_forecasts (
  id         bigserial primary key,
  claim_slug text not null,   -- see the architectural note above -- no FK, matched against the JSON files
  user_id    uuid not null references profiles(id) on delete cascade,
  p          jsonb not null,  -- {"verified":0.2,"partially_verified":0.5,"not_verified":0.3}
  rationale  text,
  at         timestamptz not null default now()
  -- append-only by design: revising a forecast inserts a new row rather than
  -- updating one, so the trail of how someone's belief changed over time is
  -- itself the record. No update policy exists below -- that omission is
  -- the enforcement.
);

comment on table claim_forecasts is
  'Append-only forecast history. Scoring (Brier skill against the crowd, per '
  'design doc §5.5) is computed client-side for L2 -- fetch every forecast '
  'for a claim, the crowd median is the set of p values at read time.';

alter table claim_forecasts enable row level security;

drop policy if exists "forecasts are publicly readable" on claim_forecasts;
create policy "forecasts are publicly readable"
  on claim_forecasts for select
  using (true);

drop policy if exists "authenticated users can forecast" on claim_forecasts;
create policy "authenticated users can forecast"
  on claim_forecasts for insert
  with check (auth.uid() = user_id);

-- No update or delete policy on claim_forecasts anywhere in this file --
-- append-only means append-only, enforced by RLS having nothing else to grant.

-- ============================================================================
-- L3 -- The Frontier: curated open questions + the model panel.
-- Added 2026-08-27 (scaffold, ahead of the audience gate). Re-run the whole
-- file again; everything above is idempotent.
--
-- SAME ARCHITECTURAL SPLIT AS L0/L2, read before touching this:
--   * The QUESTIONS, the verbatim MODEL-PANEL ANSWERS, and the desk's own
--     reviewed answer are desk-authored, permanent, and crawlable, so they
--     live as git-committed JSON under site/data/frontier/*.json -- NOT as
--     rows here. That is the same call already made for L0's claims (see the
--     L2 note above) and for the same reasons: permanence, crawlability, a
--     public tamper-evident history via `git log`.
--   * This database holds only what the PUBLIC writes: proposed questions
--     awaiting triage, community scores on model answers, and the cached
--     Discord-thread summary a bot writes. `question_slug` is therefore a
--     plain text column, not a foreign key -- tools/check_frontier.py keeps
--     a slug honest against the real JSON files, not a DB constraint.
--   * The design doc (outputs/21_MARKETPLACE_AND_REALITY_TRACKER.md section 7.1)
--     sketches `model_answers` as a table referencing `frontier_questions`;
--     that is adapted here the same way section 5.2's `claims` table was.
-- ============================================================================

create table if not exists frontier_submissions (
  id                  bigserial primary key,
  submitter_id        uuid not null references profiles(id) on delete cascade,
  question            text not null,
  why_open            text,
  reading             text,   -- a URL or citation the submitter thinks is relevant
  status              text not null default 'queued'
                        check (status in ('queued', 'promoted', 'rejected', 'duplicate')),
  triage_note         text,
  promoted_question_slug text, -- filled by hand once the desk writes the real question JSON
  created_at          timestamptz not null default now()
);

comment on table frontier_submissions is
  'Community-proposed Frontier questions, pre-triage. Nothing here is public '
  'and nothing auto-publishes (locked rule 8) -- the desk reviews each one by '
  'hand and, if promoted, writes a real site/data/frontier/<slug>.json '
  'committed to git.';

alter table frontier_submissions enable row level security;

drop policy if exists "submitters can see their own frontier submissions" on frontier_submissions;
create policy "submitters can see their own frontier submissions"
  on frontier_submissions for select
  using (auth.uid() = submitter_id);

drop policy if exists "authenticated users can propose a question" on frontier_submissions;
create policy "authenticated users can propose a question"
  on frontier_submissions for insert
  with check (auth.uid() = submitter_id);

drop policy if exists "submitters can retract their own queued question" on frontier_submissions;
create policy "submitters can retract their own queued question"
  on frontier_submissions for delete
  using (auth.uid() = submitter_id and status = 'queued');

create table if not exists frontier_model_votes (
  id            bigserial primary key,
  question_slug text not null,   -- matched against site/data/frontier/*.json, not an FK
  model_id      text not null,   -- the exact model string from the question JSON's model_answers[]
  user_id       uuid not null references profiles(id) on delete cascade,
  score         jsonb not null,  -- {"correct":1..5,"calibrated":1..5,"sourced":1..5}
  note          text,
  at            timestamptz not null default now()
  -- append-only, same rule as claim_forecasts: revising a vote inserts a new
  -- row. The design doc's model_answers.community_score is the reduction over
  -- these rows, computed at read time (latest row per (user, model, question)).
);

comment on table frontier_model_votes is
  'The community half of a model answer''s score (desk_score is authored in the '
  'question JSON). Append-only. A model answer is never presented as '
  'authoritative -- it is an entrant, graded like everyone else (design doc 7.1).';

alter table frontier_model_votes enable row level security;

drop policy if exists "model votes are publicly readable" on frontier_model_votes;
create policy "model votes are publicly readable"
  on frontier_model_votes for select
  using (true);

drop policy if exists "authenticated users can vote on a model answer" on frontier_model_votes;
create policy "authenticated users can vote on a model answer"
  on frontier_model_votes for insert
  with check (auth.uid() = user_id);

-- No update/delete policy on frontier_model_votes -- append-only, enforced by
-- RLS having nothing else to grant.

create table if not exists frontier_floor (
  question_slug text primary key,  -- matched against site/data/frontier/*.json
  thread_url    text not null,
  participants  int not null default 0,
  messages      int not null default 0,
  top_excerpt   text,
  updated_at    timestamptz not null default now()
);

comment on table frontier_floor is
  'Cache of "The Floor" -- the live Discord discussion thread for a question. '
  'Written ONLY by the summary bot (service role, bypasses RLS); the site '
  'reads it to show participant/message counts and a top excerpt next to the '
  'reviewed answers. This preserves the constitution (no on-site comment '
  'system) and finally wires Discord to the site. Parked until Discord is '
  'wired -- the table exists so the site code has a shape to read.';

alter table frontier_floor enable row level security;

drop policy if exists "the floor summary is publicly readable" on frontier_floor;
create policy "the floor summary is publicly readable"
  on frontier_floor for select
  using (true);

-- No insert/update/delete policy: the bot uses the service-role key, which
-- bypasses RLS. An ordinary signed-in user has read and nothing else.
