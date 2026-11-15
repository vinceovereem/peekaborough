-- Peekaborough: schema + row-level security.
-- Access model: anyone can read published neighbourhood content; signed-in residents write their own
-- reviews / listings / wishes / claims; verified owners (place_owners) edit their place; admins act
-- through the server with the service role, which bypasses RLS (see lib/supabase-repo.ts).

create schema if not exists private;

-- ---------- people ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null default 'Neighbour' check (char_length(display_name) between 1 and 60),
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'name', ''), nullif(split_part(new.email, '@', 1), ''), 'Neighbour'), 60),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------- places ----------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  osm_id text unique,
  slug text not null unique,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('eat','cafe','drink','groceries','shop','services','health','culture','active','green','community','transport')),
  subcategory text check (char_length(subcategory) <= 60),
  description text check (char_length(description) <= 2000),
  address text check (char_length(address) <= 200),
  lat double precision not null,
  lng double precision not null,
  phone text check (char_length(phone) <= 40),
  website text check (char_length(website) <= 300),
  booking_url text check (char_length(booking_url) <= 300),
  hours jsonb,           -- { mon: { open: "08:00", close: "17:00" } | null, ... }
  hours_note text check (char_length(hours_note) <= 300),
  cover_url text,
  google_place_id text,                       -- the only Google Places datum we are allowed to keep
  extra jsonb not null default '{}',          -- imported facts: { lines, outdoor_seating, photo: { url, credit_url } }
  is_landmark boolean not null default false,
  is_demo boolean not null default false,
  verified boolean not null default false,  -- set when an ownership claim is approved
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_owners (
  place_id uuid not null references public.places on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (place_id, user_id)
);
create index on public.place_owners (user_id);

create function public.is_owner(pid uuid) returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (select 1 from public.place_owners o where o.place_id = pid and o.user_id = (select auth.uid()))
$$;

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role text not null check (char_length(role) between 1 and 60),
  business_email text not null check (char_length(business_email) between 3 and 200),
  phone text check (char_length(phone) <= 40),
  evidence text not null check (char_length(evidence) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index claims_one_pending on public.claims (place_id, user_id) where status = 'pending';

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places on delete cascade,
  section text not null default 'Menu' check (char_length(section) between 1 and 60),
  name text not null check (char_length(name) between 1 and 100),
  description text check (char_length(description) <= 300),
  price_pence integer check (price_pence between 0 and 10000000),
  position bigint not null default 0
);
create index on public.menu_items (place_id);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.posts (place_id, created_at desc);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  place_id uuid references public.places on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 2000),
  kind text not null check (kind in ('football','music','market','community','sport','food','arts')),
  venue_name text not null check (char_length(venue_name) between 1 and 120),
  lat double precision not null,
  lng double precision not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  url text check (char_length(url) <= 300),
  price_pence integer check (price_pence between 0 and 100000000),  -- null = unknown, 0 = free
  is_sample boolean not null default false,
  status text not null default 'pending' check (status in ('published','pending','rejected')),
  created_by uuid references public.profiles on delete set null,
  source text,      -- 'Skiddle', 'Ticketmaster', … for automatically imported events; null for ones people added
  source_id text,   -- the event's id at that source, so a re-sync updates instead of duplicating
  created_at timestamptz not null default now(),
  unique (source, source_id)
);
create index on public.events (status, starts_at);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now(),
  unique (place_id, user_id)
);

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('sell','free','swap','wanted','service')),
  title text not null check (char_length(title) between 1 and 100),
  description text not null check (char_length(description) between 1 and 1000),
  price_pence integer check (price_pence between 0 and 100000000),
  contact text not null check (char_length(contact) between 1 and 200),
  status text not null default 'active' check (status in ('active','closed','hidden')),
  created_at timestamptz not null default now()
);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  description text check (char_length(description) <= 600),
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now()
);
create table public.wish_votes (
  wish_id uuid not null references public.wishes on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  value smallint not null default 1 check (value in (-1, 1)),  -- 1 = agree, -1 = disagree
  primary key (wish_id, user_id)
);

-- Places with their rating. security_invoker so the caller's RLS applies (views bypass it by default).
create view public.places_view with (security_invoker = true) as
select p.*, r.rating, coalesce(r.review_count, 0)::int as review_count
from public.places p
left join (
  select place_id, round(avg(rating), 1)::float as rating, count(*) as review_count
  from public.reviews where status = 'visible' group by place_id
) r on r.place_id = p.id;

-- ---------- privileges: start from nothing, grant exactly what the policies need ----------
revoke all on all tables in schema public from anon, authenticated;

grant select on public.profiles, public.places, public.places_view, public.menu_items, public.posts, public.events, public.reviews, public.wishes, public.wish_votes to anon, authenticated;
grant select on public.claims, public.listings to authenticated;  -- listings carry contact details: signed-in only
grant select on public.place_owners to anon, authenticated;       -- is_owner() runs inside public policies; RLS still hides other people's rows

grant update (display_name, avatar_url) on public.profiles to authenticated;           -- never is_admin
grant update (name, subcategory, description, address, phone, website, booking_url, hours, hours_note, cover_url, updated_at) on public.places to authenticated; -- never status / verified / is_landmark
grant insert (place_id, user_id, role, business_email, phone, evidence) on public.claims to authenticated; -- never status / admin_note
grant insert, update, delete on public.menu_items, public.posts to authenticated;
grant insert, delete on public.events to authenticated;
grant insert (place_id, user_id, rating, comment), update (place_id, user_id, rating, comment), delete on public.reviews to authenticated; -- never status
grant insert (user_id, kind, title, description, price_pence, contact), update (status) on public.listings to authenticated;
grant insert (user_id, title, description) on public.wishes to authenticated;
grant insert, update, delete on public.wish_votes to authenticated;

-- ---------- row-level security ----------
alter table public.profiles enable row level security;
alter table public.places enable row level security;
alter table public.place_owners enable row level security;
alter table public.claims enable row level security;
alter table public.menu_items enable row level security;
alter table public.posts enable row level security;
alter table public.events enable row level security;
alter table public.reviews enable row level security;
alter table public.listings enable row level security;
alter table public.wishes enable row level security;
alter table public.wish_votes enable row level security;

create policy "profiles are public" on public.profiles for select to anon, authenticated using (true);
create policy "edit own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "published places are public" on public.places for select to anon, authenticated
  using (status = 'published' or public.is_owner(id));
create policy "owners edit their place" on public.places for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));

create policy "see own ownerships" on public.place_owners for select to authenticated using ((select auth.uid()) = user_id);

create policy "see own claims" on public.claims for select to authenticated using ((select auth.uid()) = user_id);
create policy "file a claim as yourself" on public.claims for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "menus are public" on public.menu_items for select to anon, authenticated using (true);
create policy "owners add menu items" on public.menu_items for insert to authenticated with check (public.is_owner(place_id));
create policy "owners edit menu items" on public.menu_items for update to authenticated using (public.is_owner(place_id)) with check (public.is_owner(place_id));
create policy "owners delete menu items" on public.menu_items for delete to authenticated using (public.is_owner(place_id));

create policy "posts are public" on public.posts for select to anon, authenticated using (true);
create policy "owners add posts" on public.posts for insert to authenticated with check (public.is_owner(place_id));
create policy "owners edit posts" on public.posts for update to authenticated using (public.is_owner(place_id)) with check (public.is_owner(place_id));
create policy "owners delete posts" on public.posts for delete to authenticated using (public.is_owner(place_id));

create policy "published events are public" on public.events for select to anon, authenticated
  using (status = 'published' or (select auth.uid()) = created_by);
-- Verified owners publish events at their own place straight away; everyone else's suggestions wait for an admin.
create policy "add events" on public.events for insert to authenticated with check (
  (select auth.uid()) = created_by and is_sample = false and source is null
  and (status = 'pending' or (status = 'published' and place_id is not null and public.is_owner(place_id)))
);
create policy "owners delete their events" on public.events for delete to authenticated using (place_id is not null and public.is_owner(place_id));

create policy "visible reviews are public" on public.reviews for select to anon, authenticated
  using (status = 'visible' or (select auth.uid()) = user_id);
create policy "review as yourself" on public.reviews for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "edit own visible review" on public.reviews for update to authenticated
  using ((select auth.uid()) = user_id and status = 'visible') with check ((select auth.uid()) = user_id);
create policy "delete own review" on public.reviews for delete to authenticated using ((select auth.uid()) = user_id);

create policy "members see open listings" on public.listings for select to authenticated
  using (status = 'active' or (select auth.uid()) = user_id);
create policy "list as yourself" on public.listings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "open or close own listing" on public.listings for update to authenticated
  using ((select auth.uid()) = user_id and status <> 'hidden') with check ((select auth.uid()) = user_id and status in ('active','closed'));

create policy "visible wishes are public" on public.wishes for select to anon, authenticated
  using (status = 'visible' or (select auth.uid()) = user_id);
create policy "wish as yourself" on public.wishes for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "votes are public" on public.wish_votes for select to anon, authenticated using (true);
create policy "vote as yourself" on public.wish_votes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "change own vote" on public.wish_votes for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "remove own vote" on public.wish_votes for delete to authenticated using ((select auth.uid()) = user_id);

-- ---------- photos ----------
-- Public-read bucket. No storage policies on purpose: uploads go through the server (service role)
-- after an ownership check, so browsers never write to storage directly.
insert into storage.buckets (id, name, public) values ('place-photos', 'place-photos', true) on conflict (id) do nothing;
