-- The "which borough should Peekaborough cover next?" poll in the footer. Anyone may vote, signed in
-- or not, so nobody gets direct access: the server validates each vote and writes it with the
-- service role, and admins read the tally the same way. No personal data is stored.
create table public.borough_votes (
  id uuid primary key default gen_random_uuid(),
  borough text not null check (char_length(btrim(borough)) between 2 and 60),
  created_at timestamptz not null default now()
);

revoke all on public.borough_votes from anon, authenticated;
alter table public.borough_votes enable row level security;
