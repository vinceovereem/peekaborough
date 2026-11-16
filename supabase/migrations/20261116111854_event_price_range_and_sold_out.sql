-- Imported events can say what the dearest ticket costs and whether tickets have run out.
alter table public.events
  add column price_max_pence integer check (price_max_pence between 0 and 100000000),  -- null = one price, or not known
  add column sold_out boolean not null default false;  -- true only when the source says no tickets are left
