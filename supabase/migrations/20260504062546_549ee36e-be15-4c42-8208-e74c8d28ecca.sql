
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'mini-plan',
  quiz_answers jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index leads_email_idx on public.leads (email);
alter table public.leads enable row level security;

create policy "admins read leads" on public.leads
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create policy "admins delete leads" on public.leads
  for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
-- inserts are made by edge functions with service role and bypass RLS
