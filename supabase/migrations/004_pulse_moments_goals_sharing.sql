-- Pulse, glucose moments, personal goals and read-only family sharing. Existing data is preserved.
begin;
alter table public.readings add column pulse integer, add column moment text;
alter table public.readings add constraint readings_moment_check check (moment in ('fasting', 'before_meal', 'after_meal', 'bedtime', 'other'));
alter table public.readings add constraint readings_pulse_moment_check check (
  (unit = 'mmHg' and moment is null and (pulse is null or (pulse > 20 and pulse < 300)))
  or (unit <> 'mmHg' and pulse is null)
);
update public.readings set moment = case when fasting then 'fasting' when not fasting then 'other' end where unit <> 'mmHg';

-- Goals the person's doctor gave them. Glucose is stored in mg/dL.
alter table public.profiles
  add column glucose_min numeric check (glucose_min > 0 and glucose_min < 1000),
  add column glucose_max numeric check (glucose_max > 0 and glucose_max < 1000),
  add column systolic_max integer check (systolic_max > 50 and systolic_max < 300),
  add column diastolic_max integer check (diastolic_max > 20 and diastolic_max < 250),
  add column weight_goal_kg numeric check (weight_goal_kg > 0 and weight_goal_kg < 500),
  add constraint profiles_glucose_range_check check (glucose_min is null or glucose_max is null or glucose_min < glucose_max);

-- An owner lets another account (by its confirmed email) read their records.
create table public.shares (
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  viewer_email text not null check (viewer_email = lower(viewer_email) and char_length(viewer_email) between 3 and 254),
  created_at timestamptz not null default now(),
  primary key (owner_id, viewer_email)
);
alter table public.shares enable row level security;
revoke all on public.shares from anon;
grant select, insert, delete on public.shares to authenticated;
create policy "Owners read own shares" on public.shares for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Viewers read shares to them" on public.shares for select to authenticated using (viewer_email = lower((select auth.jwt() ->> 'email')));
create policy "Owners add shares" on public.shares for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Owners remove shares" on public.shares for delete to authenticated using ((select auth.uid()) = owner_id);

create policy "Viewers read shared readings" on public.readings for select to authenticated using (exists (select 1 from public.shares s where s.owner_id = readings.user_id and s.viewer_email = lower((select auth.jwt() ->> 'email'))));
create policy "Viewers read shared body" on public.body_measurements for select to authenticated using (exists (select 1 from public.shares s where s.owner_id = body_measurements.user_id and s.viewer_email = lower((select auth.jwt() ->> 'email'))));
create policy "Viewers read shared profile" on public.profiles for select to authenticated using (exists (select 1 from public.shares s where s.owner_id = profiles.user_id and s.viewer_email = lower((select auth.jwt() ->> 'email'))));
commit;
