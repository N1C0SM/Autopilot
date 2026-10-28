create table public.external_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  category text not null default 'externa',
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_hour integer not null default 18 check (start_hour between 0 and 23),
  start_minute integer not null default 0 check (start_minute between 0 and 59),
  duration_min integer not null default 60 check (duration_min between 15 and 600),
  color text not null default '#f97316',
  icon text default '🥊',
  note text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.external_activities enable row level security;

create policy "Users manage own external activities"
on public.external_activities
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_external_activities_updated_at
before update on public.external_activities
for each row execute function public.update_updated_at_column();

-- Tabla para overrides de horarios de los entrenos del plan (drag&drop)
create table public.training_schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  day_label text not null,
  new_day_of_week integer not null check (new_day_of_week between 0 and 6),
  start_hour integer not null default 18,
  start_minute integer not null default 0,
  duration_min integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, day_label)
);

alter table public.training_schedule_overrides enable row level security;

create policy "Users manage own schedule overrides"
on public.training_schedule_overrides
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_training_schedule_overrides_updated_at
before update on public.training_schedule_overrides
for each row execute function public.update_updated_at_column();