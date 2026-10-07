-- Apply once using the Supabase SQL editor. Service-role keys stay on the Next.js server.
create table if not exists public.hq_records (
  kind text not null,
  id text not null,
  owner_id text not null,
  version integer not null default 1,
  payload jsonb not null,
  primary key (kind, id)
);
create index if not exists hq_records_owner_kind on public.hq_records(owner_id, kind);
alter table public.hq_records enable row level security;
-- No direct anonymous/client access. Server routes authenticate and check ownership.
revoke all on public.hq_records from anon, authenticated;
grant all on public.hq_records to service_role;
insert into storage.buckets (id, name, public, file_size_limit)
values ('heyquiz', 'heyquiz', false, 10485760)
on conflict (id) do nothing;
-- Keep the bucket private. The app authorizes downloads and streams authorized files.
