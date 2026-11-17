-- Tightens five things found in a security review. Apply this just before deploying the matching
-- app code: the older code reads columns that this migration closes.

-- ---------- 1. who voted, and who is an admin, are no longer public ----------
-- Only the totals are shown on the site, so only the totals are readable. Each person still sees their own vote.
drop policy "votes are public" on public.wish_votes;
create policy "see own votes" on public.wish_votes for select to authenticated using ((select auth.uid()) = user_id);

create function public.wish_tallies(ids uuid[]) returns table (wish_id uuid, ups int, downs int)
language sql stable security definer set search_path = '' as $$
  select v.wish_id, (count(*) filter (where v.value = 1))::int, (count(*) filter (where v.value = -1))::int
  from public.wish_votes v join public.wishes w on w.id = v.wish_id
  where v.wish_id = any(ids) and w.status = 'visible'
  group by v.wish_id
$$;
revoke execute on function public.wish_tallies(uuid[]) from public;
grant execute on function public.wish_tallies(uuid[]) to anon, authenticated;

-- A profile shows its name and nothing else. The picture was never shown on the site, and is_admin
-- is answered only for the person asking.
revoke select on public.profiles from anon, authenticated;
grant select (id, display_name) on public.profiles to anon, authenticated;
revoke update (avatar_url) on public.profiles from authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false)
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------- 2. links are web addresses, and photos come only from our own upload ----------
-- Imported websites sometimes lack the "https://"; add it, and drop anything that still is not a web address.
update public.places set website = 'https://' || website
  where website !~* '^[a-z][a-z0-9+.-]*:' and website !~ '[[:space:]]' and char_length(website) <= 292;
update public.places set website = null where website !~* '^https?://[^[:space:]]+$';
update public.places set booking_url = null where booking_url !~* '^https?://[^[:space:]]+$';
update public.events set url = null where url !~* '^https?://[^[:space:]]+$';

alter table public.places add constraint places_website_is_web check (website ~* '^https?://[^[:space:]]+$');
alter table public.places add constraint places_booking_url_is_web check (booking_url ~* '^https?://[^[:space:]]+$');
alter table public.events add constraint events_url_is_web check (url ~* '^https?://[^[:space:]]+$');

-- The server stores an uploaded photo and records its address; owners no longer write that column themselves.
revoke update (cover_url) on public.places from authenticated;

-- ---------- 3. a daily ceiling on what one account can add ----------
-- Enforced here so it also holds for anyone who talks to the database directly instead of using the site.
create function private.daily_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
  n int;
begin
  if who is null then return new; end if;  -- the server's own writes (imports, admin) are not limited
  new.created_at := now();                 -- so the count cannot be dodged with a back-dated row
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - interval ''1 day''', tg_table_name, tg_argv[0])
    into n using who;
  if n >= tg_argv[1]::int then raise exception 'daily limit reached'; end if;
  return new;
end $$;

create trigger daily_limit before insert on public.listings for each row execute function private.daily_limit('user_id', '10');
create trigger daily_limit before insert on public.wishes for each row execute function private.daily_limit('user_id', '10');
create trigger daily_limit before insert on public.claims for each row execute function private.daily_limit('user_id', '5');
create trigger daily_limit before insert on public.events for each row execute function private.daily_limit('created_by', '20');
-- Changing a review is an insert that lands on the existing row, so it counts here too.
create trigger daily_limit before insert on public.reviews for each row execute function private.daily_limit('user_id', '30');

-- ---------- 4. the Ask allowance is counted in one place ----------
-- 30 questions an hour per person, whichever server answers. Not readable through the Data API.
create table private.ask_uses (
  user_id uuid not null references public.profiles on delete cascade,
  asked_at timestamptz not null default now()
);
create index on private.ask_uses (user_id, asked_at);

/** Counts one question for the caller; false when this hour's allowance is used up. */
create function public.take_ask_turn() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  who uuid := (select auth.uid());
begin
  if who is null then return false; end if;
  delete from private.ask_uses where user_id = who and asked_at < now() - interval '1 hour';
  if (select count(*) from private.ask_uses where user_id = who) >= 30 then return false; end if;
  insert into private.ask_uses (user_id) values (who);
  return true;
end $$;
revoke execute on function public.take_ask_turn() from public, anon;
grant execute on function public.take_ask_turn() to authenticated;
