
create table if not exists public.payment_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  recipient_email text not null,
  subject text not null,
  body text not null,
  sent_by uuid,
  sent_at timestamptz not null default now()
);

alter table public.payment_reminders enable row level security;

create policy "admins can read payment reminders"
on public.payment_reminders for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

create policy "admins can insert payment reminders"
on public.payment_reminders for insert
to authenticated
with check (public.has_role(auth.uid(), 'admin'));

create index if not exists payment_reminders_user_id_idx on public.payment_reminders(user_id);
create index if not exists payment_reminders_sent_at_idx on public.payment_reminders(sent_at desc);
