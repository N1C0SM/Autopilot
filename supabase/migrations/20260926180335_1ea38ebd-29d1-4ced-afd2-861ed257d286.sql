create table public.book_share_links (
  token text primary key default encode(gen_random_bytes(24),'hex'),
  book_id uuid not null references public.library_books(id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_at timestamptz
);
grant select, insert, delete on public.book_share_links to authenticated;
grant all on public.book_share_links to service_role;
alter table public.book_share_links enable row level security;
create policy "Admins manage share links" on public.book_share_links for all to authenticated
using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));