-- Favourites (a person's saved places) and applications to become an admin.
-- Same access model as the first migration: people touch only their own rows; admins act through
-- the server with the service role.

create table public.favorites (
  user_id uuid not null references public.profiles on delete cascade,
  place_id uuid not null references public.places on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);

-- Holds personal details (phone, home address): readable only by the applicant and, via the server, admins.
create table public.admin_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  phone text not null check (char_length(phone) between 5 and 40),
  address text not null check (char_length(address) between 5 and 300),
  years_in_area smallint not null check (years_in_area between 0 and 120),
  occupation text not null check (char_length(occupation) between 1 and 120),
  favourite_thing text not null check (char_length(favourite_thing) between 1 and 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index admin_applications_one_pending on public.admin_applications (user_id) where status = 'pending';

revoke all on public.favorites, public.admin_applications from anon, authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select on public.admin_applications to authenticated;
grant insert (user_id, full_name, email, phone, address, years_in_area, occupation, favourite_thing) on public.admin_applications to authenticated; -- never status / admin_note

alter table public.favorites enable row level security;
alter table public.admin_applications enable row level security;

create policy "see own favourites" on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "add own favourite" on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "remove own favourite" on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);

create policy "see own application" on public.admin_applications for select to authenticated using ((select auth.uid()) = user_id);
create policy "apply as yourself" on public.admin_applications for insert to authenticated with check ((select auth.uid()) = user_id);
