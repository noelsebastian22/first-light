-- First Light schema, roles and row-level security (spec §4).
--
-- Apply as the project owner after the Data API is enabled: it relies on the
-- `authenticated` and `anonymous` roles and `auth.user_id()` that Neon provides.
-- Never edit this file once applied; add 0002_*.sql instead.

begin;

-- Roles. Created without login; Noel sets passwords in Neon (docs/runbook.md).
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'pipeline_writer') then
    create role pipeline_writer nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'watchdog_reader') then
    create role watchdog_reader nologin;
  end if;
end
$$;

-- Content, written only by pipeline_writer.

create type public.section_key as enum ('au-economy', 'au-politics', 'world', 'web-dev', 'ai', 'au-tech-market');

create table public.editions (
  id text primary key,
  edition_date date not null,
  slot text not null check (slot in ('am', 'pm')),
  status text not null check (status in ('ok', 'partial', 'failed')),
  error text,
  nudge text check (slot = 'am' or nudge is null),
  weather jsonb, -- null on a failed row written before weather was fetched
  key_dates jsonb not null default '[]'::jsonb,
  source_count integer not null default 0 check (source_count >= 0),
  created_at timestamptz not null default now(),
  unique (edition_date, slot)
);

create table public.stories (
  id text primary key,
  edition_id text not null references public.editions (id),
  section public.section_key not null,
  rank smallint not null check (rank >= 1),
  top_rank smallint check (top_rank between 1 and 3),
  title text not null,
  summary text not null,
  why_it_matters text not null,
  picked_because text not null,
  search tsvector generated always as (to_tsvector('english', title || ' ' || summary)) stored,
  created_at timestamptz not null default now()
);
create index stories_edition_id on public.stories (edition_id);
create index stories_search on public.stories using gin (search);

create table public.story_links (
  story_id text not null references public.stories (id) on delete cascade,
  source_key text not null,
  url text not null,
  publisher_title text not null,
  published_at timestamptz not null,
  primary key (story_id, url)
);
create index story_links_url on public.story_links (url);

-- Personal.

create schema private;
revoke all on schema private from public;

create table private.members (
  user_id text primary key,
  email text, -- a label only
  added_at timestamptz not null default now()
);

create table public.reads (
  user_id text not null default auth.user_id(),
  story_id text not null references public.stories (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table public.saves (
  user_id text not null default auth.user_id(),
  story_id text not null references public.stories (id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table public.app_opens (
  id bigint generated always as identity primary key,
  user_id text not null default auth.user_id(),
  opened_at timestamptz not null default now()
);
create index app_opens_user_opened on public.app_opens (user_id, opened_at);

-- Membership check. SECURITY DEFINER so policies can read private.members,
-- which no API role can reach directly.
create function public.is_member() returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from private.members where user_id = (select auth.user_id())) $$;
revoke all on function public.is_member() from public;
grant execute on function public.is_member() to authenticated;

-- RLS on every table, always. No policy means no rows.
alter table public.editions enable row level security;
alter table public.stories enable row level security;
alter table public.story_links enable row level security;
alter table private.members enable row level security;
alter table public.reads enable row level security;
alter table public.saves enable row level security;
alter table public.app_opens enable row level security;

-- Start from nothing, then grant exactly what spec §4 lists.
revoke all on all tables in schema public from public, anonymous, authenticated;
grant usage on schema public to authenticated, pipeline_writer, watchdog_reader;

-- authenticated (the Data API): content when a member; own personal rows when a member.
grant select on public.editions, public.stories, public.story_links to authenticated;
create policy member_reads_editions on public.editions for select to authenticated using ((select public.is_member()));
create policy member_reads_stories on public.stories for select to authenticated using ((select public.is_member()));
create policy member_reads_links on public.story_links for select to authenticated using ((select public.is_member()));

grant select, insert, delete on public.reads, public.saves, public.app_opens to authenticated;
create policy own_reads on public.reads for all to authenticated
  using (user_id = (select auth.user_id()) and (select public.is_member()))
  with check (user_id = (select auth.user_id()) and (select public.is_member()));
create policy own_saves on public.saves for all to authenticated
  using (user_id = (select auth.user_id()) and (select public.is_member()))
  with check (user_id = (select auth.user_id()) and (select public.is_member()));
create policy own_app_opens on public.app_opens for all to authenticated
  using (user_id = (select auth.user_id()) and (select public.is_member()))
  with check (user_id = (select auth.user_id()) and (select public.is_member()));

-- pipeline_writer: writes content. DELETE on stories and links only, so a failed
-- or partial edition can be replaced; never deletes an edition.
grant select, insert, update on public.editions, public.stories, public.story_links to pipeline_writer;
grant delete on public.stories, public.story_links to pipeline_writer;
create policy writer_editions on public.editions for all to pipeline_writer using (true) with check (true);
create policy writer_stories on public.stories for all to pipeline_writer using (true) with check (true);
create policy writer_links on public.story_links for all to pipeline_writer using (true) with check (true);

-- watchdog_reader: the watchdog and reminder emails.
grant select on public.editions, public.stories, public.app_opens to watchdog_reader;
create policy watchdog_editions on public.editions for select to watchdog_reader using (true);
create policy watchdog_stories on public.stories for select to watchdog_reader using (true);
create policy watchdog_app_opens on public.app_opens for select to watchdog_reader using (true);

commit;
