// Runs the real migration + seed in an in-process Postgres (PGlite) and attacks the row-level
// security as different users. `npm test` fails if any rule is looser or tighter than intended.
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, readdirSync } from 'node:fs'
import assert from 'node:assert/strict'

const root = new URL('../supabase/', import.meta.url)
const db = new PGlite()
// The bits of a Supabase project the migration expects to exist already.
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create table storage.buckets (id text primary key, name text, public boolean);
  grant usage on schema public, auth to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;  -- Supabase's permissive default
`)
for (const f of readdirSync(new URL('migrations/', root)).sort()) await db.exec(readFileSync(new URL(`migrations/${f}`, root), 'utf8'))
await db.exec(readFileSync(new URL('seed.sql', root), 'utf8'))

const [A, B] = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222']
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('${A}', 'alice@example.com', '{"full_name":"Alice"}'), ('${B}', 'bob@example.com', '{}')`)
const one = async sql => (await db.query(sql)).rows[0]
const place = (await one(`select id from public.places where name = 'Emirates Stadium'`)).id
const other = (await one(`select id from public.places where name = 'Highbury Fields'`)).id

/** Run SQL as a signed-in user (or anon when uid is null); returns affected/returned row count. */
async function as(uid, sql) {
  await db.exec(`set role ${uid ? 'authenticated' : 'anon'}; select set_config('request.jwt.claim.sub', '${uid ?? ''}', false)`)
  try { const r = await db.query(sql); return r.rows.length || r.affectedRows || 0 } finally { await db.exec('reset role') }
}
const allowed = async (uid, sql, why) => assert.ok(await as(uid, sql) > 0, `should be allowed: ${why}`)
const denied = async (uid, sql, why) => {
  let n; try { n = await as(uid, sql) } catch { return } // permission denied / RLS violation / check violation
  assert.equal(n, 0, `should be denied: ${why}`)
}

assert.equal((await one(`select count(*)::int n from public.places`)).n > 1000, true, 'seed loaded')
assert.equal((await one(`select display_name from public.profiles where id = '${A}'`)).display_name, 'Alice', 'profile trigger')
assert.equal((await one(`select display_name from public.profiles where id = '${B}'`)).display_name, 'bob', 'profile name falls back to email')

await allowed(null, `select 1 from public.places_view limit 1`, 'anyone reads places')
await allowed(null, `select 1 from public.events where status = 'published' limit 1`, 'anyone reads events')
await denied(null, `insert into public.reviews (place_id, user_id, rating) values ('${place}', '${A}', 5)`, 'anon cannot review')
await denied(null, `select 1 from public.listings`, 'anon cannot read listings (contact details)')

await allowed(A, `insert into public.reviews (place_id, user_id, rating, comment) values ('${place}', '${A}', 5, 'Great') returning id`, 'review as yourself')
await denied(A, `insert into public.reviews (place_id, user_id, rating) values ('${other}', '${B}', 1)`, 'review as someone else')
await denied(B, `update public.reviews set comment = 'hacked' where user_id = '${A}'`, "edit another person's review")
await denied(A, `update public.profiles set is_admin = true where id = '${A}'`, 'make yourself admin')
await allowed(A, `update public.profiles set display_name = 'Alice B' where id = '${A}' returning id`, 'rename yourself')
await db.exec(`update public.reviews set status = 'hidden' where user_id = '${A}'`) // admin hides it
await denied(A, `update public.reviews set comment = 'still here' where user_id = '${A}'`, 'edit a review an admin hid')
await denied(A, `update public.reviews set status = 'visible' where user_id = '${A}'`, 'un-hide your own review')
assert.equal((await one(`select review_count from public.places_view where id = '${place}'`)).review_count, 0, 'hidden reviews do not count')

await denied(A, `update public.places set name = 'Mine now' where id = '${place}'`, 'edit a place you do not own')
await denied(A, `insert into public.posts (place_id, title, body) values ('${place}', 'x', 'y')`, 'post for a place you do not own')
await denied(A, `insert into public.claims (place_id, user_id, role, business_email, evidence, status) values ('${place}', '${A}', 'Owner', 'a@b.co', 'trust me', 'approved')`, 'self-approve a claim')
await denied(A, `insert into public.place_owners (place_id, user_id) values ('${place}', '${A}')`, 'make yourself an owner')
await allowed(A, `insert into public.claims (place_id, user_id, role, business_email, evidence) values ('${place}', '${A}', 'Owner', 'a@b.co', 'On the lease') returning id`, 'file a claim')
await denied(A, `insert into public.claims (place_id, user_id, role, business_email, evidence) values ('${place}', '${A}', 'Owner', 'a@b.co', 'again')`, 'second pending claim for the same place')
await denied(B, `select 1 from public.claims`, "read someone else's claim")

await db.exec(`insert into public.place_owners (place_id, user_id) values ('${place}', '${A}')`) // admin approves
await allowed(A, `update public.places set description = 'Hello' where id = '${place}' returning id`, 'owner edits their place')
await denied(A, `update public.places set verified = true where id = '${place}'`, 'owner cannot self-verify')
await allowed(A, `update public.places set booking_url = 'https://example.com/book' where id = '${place}' returning id`, 'owner sets a booking link')
await denied(A, `update public.places set extra = '{}' where id = '${place}'`, 'owner cannot rewrite imported facts')
await denied(A, `update public.places set status = 'hidden' where id = '${other}'`, 'owner cannot touch other places')
await allowed(A, `insert into public.menu_items (place_id, name, price_pence) values ('${place}', 'Pie', 650) returning id`, 'owner adds menu item')
await allowed(A, `insert into public.events (place_id, title, kind, venue_name, lat, lng, starts_at, status, created_by) values ('${place}', 'Open day', 'community', 'Here', 51.5, -0.1, now(), 'published', '${A}') returning id`, 'owner publishes an event at their place')
await denied(B, `insert into public.events (title, kind, venue_name, lat, lng, starts_at, status, created_by) values ('Spam', 'music', 'x', 51.5, -0.1, now(), 'published', '${B}')`, 'resident cannot self-publish an event')
await allowed(B, `insert into public.events (title, kind, venue_name, lat, lng, starts_at, status, created_by) values ('Street party', 'community', 'x', 51.5, -0.1, now(), 'pending', '${B}') returning id`, 'resident suggests an event')
await denied(A, `select 1 from public.events where title = 'Street party'`, "pending suggestions stay private")
await denied(B, `insert into public.events (title, kind, venue_name, lat, lng, starts_at, status, created_by, source, source_id) values ('Fake gig', 'music', 'x', 51.5, -0.1, now(), 'pending', '${B}', 'Skiddle', '1')`, 'residents cannot pose as an automatic source')

await allowed(B, `insert into public.listings (user_id, kind, title, description, contact) values ('${B}', 'free', 'Sofa', 'Comfy', 'bob@example.com') returning id`, 'post a listing')
await allowed(A, `select 1 from public.listings`, 'members read listings')
await denied(A, `update public.listings set status = 'closed' where user_id = '${B}'`, "close someone else's listing")
await db.exec(`update public.listings set status = 'hidden'`) // admin hides it
await denied(B, `update public.listings set status = 'active' where user_id = '${B}'`, 'reopen a listing an admin hid')
await allowed(B, `insert into public.wishes (user_id, title) values ('${B}', 'A fishmonger') returning id`, 'add a wish')
await allowed(A, `insert into public.wish_votes (wish_id, user_id) select id, '${A}' from public.wishes returning wish_id`, 'vote')
await denied(A, `insert into public.wish_votes (wish_id, user_id) select id, '${B}' from public.wishes`, 'vote as someone else')
await allowed(A, `update public.wish_votes set value = -1 where user_id = '${A}' returning wish_id`, 'switch to a down-vote')
await denied(A, `update public.wish_votes set value = 5 where user_id = '${A}'`, 'a vote is only ever +1 or -1')
await allowed(B, `insert into public.wish_votes (wish_id, user_id, value) select id, '${B}', -1 from public.wishes returning wish_id`, 'vote down')
await denied(B, `update public.wish_votes set value = 1 where user_id = '${A}'`, "change someone else's vote")

await db.exec(`update public.places set status = 'hidden' where id = '${other}'`) // admin hides a place
await denied(null, `select 1 from public.places_view where id = '${other}'`, 'hidden places are invisible')
await allowed(null, `select 1 from public.places_view where id = '${place}'`, 'anon can still read the rest once something is hidden')
await denied(null, `select 1 from public.place_owners`, 'anon sees no ownership rows')

// --- favourites and admin applications (second migration) ---
await allowed(A, `insert into public.favorites (user_id, place_id) values ('${A}', '${place}') returning place_id`, 'save a favourite')
await denied(A, `insert into public.favorites (user_id, place_id) values ('${B}', '${place}')`, 'save a favourite for someone else')
await denied(B, `select 1 from public.favorites`, "see someone else's favourites")
await denied(null, `select 1 from public.favorites`, 'anon cannot read favourites')
await allowed(A, `delete from public.favorites where user_id = '${A}' returning place_id`, 'remove a favourite')
const APPLY = `(user_id, full_name, email, phone, address, years_in_area, occupation, favourite_thing)`
await allowed(B, `insert into public.admin_applications ${APPLY} values ('${B}', 'Bob', 'bob@example.com', '07000 000000', '1 Test Street', 4, 'Baker', 'The parks') returning id`, 'apply to be an admin')
await denied(B, `insert into public.admin_applications ${APPLY} values ('${B}', 'Bob', 'bob@example.com', '07000 000000', '1 Test Street', 4, 'Baker', 'again')`, 'second pending application')
await denied(A, `insert into public.admin_applications (user_id, full_name, email, phone, address, years_in_area, occupation, favourite_thing, status) values ('${A}', 'Alice', 'a@example.com', '07000 000000', '1 Test Street', 4, 'Baker', 'x', 'approved')`, 'self-approve an application')
await denied(A, `select 1 from public.admin_applications`, "read someone else's application (phone, address)")
await denied(null, `select 1 from public.admin_applications`, 'anon cannot read applications')
await denied(B, `update public.admin_applications set status = 'approved' where user_id = '${B}'`, 'approve your own application')

console.log('✔ migrations + seed apply cleanly; 54 access rules hold')
