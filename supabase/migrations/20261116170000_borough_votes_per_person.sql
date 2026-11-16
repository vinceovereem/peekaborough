-- The borough poll becomes one vote per signed-in person. Votes now belong to an account and go in
-- through the voter's own session, like favourites. Anonymous votes cast before this keep a null
-- user_id: they stay in the table but are no longer counted.
alter table public.borough_votes add column user_id uuid references public.profiles on delete cascade;
create unique index borough_votes_one_per_person on public.borough_votes (user_id);

grant select on public.borough_votes to authenticated;
grant insert (borough, user_id) on public.borough_votes to authenticated;

create policy "see own borough vote" on public.borough_votes for select to authenticated using ((select auth.uid()) = user_id);
create policy "vote as yourself" on public.borough_votes for insert to authenticated with check ((select auth.uid()) = user_id);
