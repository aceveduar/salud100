-- Personal profile and smart-scale body composition. Existing readings are untouched.
begin;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  birth_date date check (birth_date >= '1900-01-01'),
  sex text check (sex in ('F', 'M')),
  height_cm numeric check (height_cm > 50 and height_cm < 260),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
revoke all on public.profiles from anon;
grant select, insert, update, delete on public.profiles to authenticated;
create policy "Read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own profile" on public.profiles for delete to authenticated using ((select auth.uid()) = user_id);

create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric not null check (weight_kg > 0 and weight_kg < 500),
  bmi numeric check (bmi > 0 and bmi < 100),
  body_fat_pct numeric check (body_fat_pct > 0 and body_fat_pct < 100),
  water_pct numeric check (water_pct > 0 and water_pct < 100),
  muscle_pct numeric check (muscle_pct > 0 and muscle_pct < 100),
  bone_mass_kg numeric check (bone_mass_kg > 0 and bone_mass_kg < 20),
  note text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now()
);
create index body_measurements_user_date on public.body_measurements (user_id, measured_at desc);
alter table public.body_measurements enable row level security;
revoke all on public.body_measurements from anon;
grant select, insert, update, delete on public.body_measurements to authenticated;
create policy "Read own body" on public.body_measurements for select to authenticated using ((select auth.uid()) = user_id);
create policy "Insert own body" on public.body_measurements for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Update own body" on public.body_measurements for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own body" on public.body_measurements for delete to authenticated using ((select auth.uid()) = user_id);
commit;
