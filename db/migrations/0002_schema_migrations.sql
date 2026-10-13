-- Records which migrations are applied, so a session can compare the live
-- project with db/migrations/ (session-handoff, start step 4).
-- Every later migration ends with its own insert into this table.

begin;

create table private.schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table private.schema_migrations enable row level security;

insert into private.schema_migrations (version) values ('0001_init'), ('0002_schema_migrations');

commit;
