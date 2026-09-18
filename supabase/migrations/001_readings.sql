create table public.readings (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  value numeric not null check (value > 0 and value < 10000),
  unit text not null check (unit in ('mg/dL', 'mmol/L')),
  measured_at timestamptz not null,
  fasting boolean,
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index readings_user_date on public.readings (user_id, measured_at desc);
alter table public.readings enable row level security;
revoke all on public.readings from anon;
grant select, insert, update, delete on public.readings to authenticated;
create policy "Read own readings" on public.readings for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own readings" on public.readings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own readings" on public.readings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own readings" on public.readings for delete to authenticated using ((select auth.uid()) = user_id);
