-- RLS and grant assertions (spec §4, Access control). Each check raises on failure;
-- run.sh stops at the first one. Runs as a superuser and switches role per check.

-- Seed as the owner: one member, one edition with a story and link, and personal rows.
insert into private.members (user_id, email) values ('noel', 'noel@example.com');
insert into editions (id, edition_date, slot, status, nudge, weather, key_dates, source_count)
  values ('ed-2026-10-13-am', '2026-10-13', 'am', 'ok', 'Fog in Katoomba.', '{}'::jsonb, '[]'::jsonb, 18);
insert into stories (id, edition_id, section, rank, top_rank, title, summary, why_it_matters, picked_because)
  values ('ed-2026-10-13-am-01', 'ed-2026-10-13-am', 'au-economy', 1, 1, 'Rate held', 'The bank held.', 'No relief.', 'Primary source.');
insert into story_links (story_id, source_key, url, publisher_title, published_at)
  values ('ed-2026-10-13-am-01', 'rba-media', 'https://example.com/rate', 'Rate held', '2026-10-12T03:30:00Z');
insert into reads (user_id, story_id) values ('noel', 'ed-2026-10-13-am-01'), ('other', 'ed-2026-10-13-am-01');
insert into app_opens (user_id) values ('noel');

-- A signed-in stranger sees no content.
set role authenticated;
set request.jwt.claim.sub = 'stranger';
do $$ begin
  if (select count(*) from editions) <> 0 then raise exception 'FAIL: stranger sees editions'; end if;
  if (select count(*) from stories) <> 0 then raise exception 'FAIL: stranger sees stories'; end if;
  if (select count(*) from story_links) <> 0 then raise exception 'FAIL: stranger sees links'; end if;
end $$;
do $$ begin
  insert into reads (user_id, story_id) values ('stranger', 'ed-2026-10-13-am-01');
  raise exception 'FAIL: stranger recorded a read';
exception when insufficient_privilege then null;
end $$;

-- The member sees content and only their own personal rows.
set request.jwt.claim.sub = 'noel';
do $$ begin
  if (select count(*) from editions) <> 1 then raise exception 'FAIL: member cannot see editions'; end if;
  if (select count(*) from stories where search @@ to_tsquery('english', 'bank')) <> 1 then raise exception 'FAIL: member cannot search stories'; end if;
  if (select count(*) from story_links) <> 1 then raise exception 'FAIL: member cannot see links'; end if;
  if (select count(*) from reads) <> 1 or exists (select 1 from reads where user_id <> 'noel') then
    raise exception 'FAIL: member sees reads other than their own';
  end if;
end $$;
do $$ begin
  insert into editions (id, edition_date, slot, status) values ('x', '2026-10-14', 'am', 'ok');
  raise exception 'FAIL: member inserted an edition';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  update stories set title = 'changed';
  raise exception 'FAIL: member updated a story';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform count(*) from private.members;
  raise exception 'FAIL: member can read private.members';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  insert into reads (user_id, story_id) values ('other', 'ed-2026-10-13-am-01');
  raise exception 'FAIL: member recorded a read for someone else';
exception when insufficient_privilege then null;
end $$;
-- Own rows: user_id defaults to the JWT subject.
insert into saves (story_id) values ('ed-2026-10-13-am-01');
insert into app_opens default values;
delete from saves where story_id = 'ed-2026-10-13-am-01';
do $$ begin
  if (select count(*) from app_opens) <> 2 then raise exception 'FAIL: member cannot see their own app opens'; end if;
end $$;
reset role;

-- Anonymous: nothing at all.
set role anonymous;
set request.jwt.claim.sub = '';
do $$
declare
  t text;
  n bigint;
begin
  foreach t in array array['editions', 'stories', 'story_links', 'reads', 'saves', 'app_opens'] loop
    begin
      execute format('select count(*) from public.%I', t) into n;
      if n <> 0 then raise exception 'FAIL: anonymous sees % rows in %', n, t; end if;
    exception when insufficient_privilege then null;
    end;
  end loop;
end $$;
reset role;

-- pipeline_writer: the statements pipeline/src/write.ts sends, then a replace.
set role pipeline_writer;
delete from story_links where story_id in (select s.id from stories s where s.edition_id in (select id from editions where edition_date = '2026-10-13' and slot = 'pm'));
delete from stories where edition_id in (select id from editions where edition_date = '2026-10-13' and slot = 'pm');
insert into editions (id, edition_date, slot, status, error, nudge, weather, key_dates, source_count, created_at)
  values ('ed-2026-10-13-pm', '2026-10-13', 'pm', 'partial', null, null, '{}'::jsonb, '[]'::jsonb, 17, '2026-10-13T05:02:00Z')
  on conflict (edition_date, slot) do update set
    id = excluded.id, status = excluded.status, error = null, nudge = excluded.nudge,
    weather = excluded.weather, key_dates = excluded.key_dates,
    source_count = excluded.source_count, created_at = excluded.created_at;
insert into stories (id, edition_id, section, rank, top_rank, title, summary, why_it_matters, picked_because)
  values ('ed-2026-10-13-pm-01', 'ed-2026-10-13-pm', 'world', 1, null, 'Update: talks resume', 'Talks resumed.', 'Markets watch.', 'New since morning.');
insert into story_links (story_id, source_key, url, publisher_title, published_at)
  values ('ed-2026-10-13-pm-01', 'abc-world', 'https://example.com/talks', 'Talks resume', '2026-10-13T04:00:00Z');
-- Replacing the partial edition clears its stories in the same way.
delete from story_links where story_id in (select s.id from stories s where s.edition_id in (select id from editions where edition_date = '2026-10-13' and slot = 'pm'));
delete from stories where edition_id in (select id from editions where edition_date = '2026-10-13' and slot = 'pm');
do $$ begin
  if (select count(*) from stories where edition_id = 'ed-2026-10-13-pm') <> 0 then raise exception 'FAIL: writer could not clear old stories'; end if;
end $$;
-- The fail statement: creates or updates only a failed row, never an ok one.
insert into editions (id, edition_date, slot, status, error, nudge, weather, key_dates, source_count, created_at)
  values ('ed-2026-10-13-am', '2026-10-13', 'am', 'failed', 'validate: boom', null, null, '[]'::jsonb, 0, now())
  on conflict (edition_date, slot) do update set error = excluded.error, created_at = excluded.created_at
  where editions.status = 'failed';
do $$ begin
  if exists (select 1 from editions where id = 'ed-2026-10-13-am' and (status <> 'ok' or error is not null)) then raise exception 'FAIL: fail touched an ok edition'; end if;
end $$;
do $$ begin
  perform count(*) from reads;
  raise exception 'FAIL: pipeline_writer can read reads';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  delete from editions where id = 'ed-2026-10-13-pm';
  raise exception 'FAIL: pipeline_writer deleted an edition';
exception when insufficient_privilege then null;
end $$;
reset role;

-- Deleting a story a member has read takes the read with it (replace must not be blocked).
delete from stories where id = 'ed-2026-10-13-am-01';
do $$ begin
  if (select count(*) from reads) <> 0 then raise exception 'FAIL: reads did not cascade with their story'; end if;
end $$;

-- watchdog_reader: reads editions, stories and app opens; writes nothing.
set role watchdog_reader;
do $$ begin
  if (select count(*) from app_opens) <> 2 then raise exception 'FAIL: watchdog cannot see app opens'; end if;
  if (select count(*) from editions) <> 2 then raise exception 'FAIL: watchdog cannot see editions'; end if;
end $$;
do $$ begin
  insert into app_opens (user_id) values ('noel');
  raise exception 'FAIL: watchdog inserted an app open';
exception when insufficient_privilege then null;
end $$;
do $$ begin
  perform count(*) from reads;
  raise exception 'FAIL: watchdog can read reads';
exception when insufficient_privilege then null;
end $$;
reset role;
