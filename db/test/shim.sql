-- Stands in for what Neon provides once the Data API is enabled: the
-- `authenticated` and `anonymous` roles and `auth.user_id()` (pg_session_jwt).
-- Tests set the JWT subject with set_config('request.jwt.claim.sub', ...).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anonymous') then
    create role anonymous nologin;
  end if;
end
$$;

create schema if not exists auth;

create or replace function auth.user_id() returns text
language sql stable
as $$ select nullif(current_setting('request.jwt.claim.sub', true), '') $$;

grant usage on schema auth to public;
grant execute on function auth.user_id() to public;
