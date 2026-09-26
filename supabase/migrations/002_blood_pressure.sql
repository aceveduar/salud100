-- Existing glucose readings and ownership policies are preserved.
begin;
alter table public.readings add column diastolic numeric;
alter table public.readings drop constraint readings_unit_check;
alter table public.readings add constraint readings_unit_check
  check (unit in ('mg/dL', 'mmol/L', 'mmHg'));
alter table public.readings add constraint readings_pressure_check check (
  (unit in ('mg/dL', 'mmol/L') and diastolic is null)
  or (unit = 'mmHg' and diastolic is not null
      and value = trunc(value) and diastolic = trunc(diastolic)
      and diastolic > 0 and diastolic < value and fasting is null)
);
commit;
