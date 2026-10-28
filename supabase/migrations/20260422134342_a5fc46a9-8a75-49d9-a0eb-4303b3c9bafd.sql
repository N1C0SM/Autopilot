create table public.calendar_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  start_hour_gym integer not null default 18,
  start_hour_activity integer not null default 19,
  duration_min integer not null default 60,
  reminder_min integer not null default 60,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.calendar_tokens enable row level security;

create policy "Users manage own calendar token"
on public.calendar_tokens
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create trigger update_calendar_tokens_updated_at
before update on public.calendar_tokens
for each row execute function public.update_updated_at_column();