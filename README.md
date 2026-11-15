# Peekaborough

A neighbourhood guide for the **London Borough of Islington** on a cartoon 3D map: every shop, café
and pub, what's on (match days, gigs, parkruns), local news, what the area needs, a place to trade
with neighbours, and an AI guide you can ask. Businesses claim a mini-site and run it themselves; an admin verifies every owner.

The name (peekaboo + borough) lives in `APP_NAME` in `lib/config.ts`. When it was chosen, no UK company
used it and peekaborough.co.uk / .com were unregistered; the UK trade mark register was not checked.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

With no environment variables the app runs in **preview mode**: the real places and events, held in
memory, with three one-click guest accounts on the sign-in page:

| Guest | Try |
|---|---|
| Resident | Explore the map, review a place, post in Trade, vote ideas up or down in Needs, suggest an event, edit "My profile" |
| Business owner | Find a business and claim it; once an admin approves, manage its hours, menu, news and events |
| Admin | "Admin" → approve ownership claims and suggested events, hide a review |

Preview mode also deploys as-is (no keys needed). Anything a guest adds is temporary: it resets on
restart and isn't shared between server instances.

## Where the content comes from

| | Source |
|---|---|
| ~3,520 places inside the borough and those two parks (name, category, address, phone, website; hours for about 1 in 6) | OpenStreetMap, via `scripts/import-osm.mjs` |
| The borough boundary | OpenStreetMap's official outline of the London Borough of Islington (`data/area.json`), plus the outlines of Finsbury Park and Clissold Park, which sit just over the border (`EXTRA_PARKS` in the import script) |
| Local headlines on the News page | RSS feeds: Islington Gazette, Islington Local Guide, r/islington — headline and link only |
| Station lines, and live line status on station pages | TfL open API |
| Photos for ~150 landmarks, stations, theatres and churches | Wikimedia Commons (credited on the page) |
| Outdoor seating flag (~260 places) | OpenStreetMap |
| Arsenal home fixtures | openfootball, via `scripts/import-fixtures.mjs` (kick-off times move for TV) |
| Highbury Fields and Finsbury Park parkruns | parkrun: free, every Saturday at 9am |
| Map | OpenFreeMap vector tiles (no API key), restyled in `lib/map-style.ts`. Homes are grey; a building is coloured only if there's a venue in it |
| Pictures for everything else | Drawn on the fly: a little shopfront with the place's name on the sign (`components/PlacePicture.tsx`) |

There is **no invented content**: no made-up businesses, people, reviews, listings, wishes or events.
Reviews, Trade and Needs start empty and fill up only with what people add. Landmark descriptions are
kept to plain facts (what a place is and where).

## What's automatic, and what isn't

The aim is for the guide to fill itself in. Each source is used the way its owner offers it:

| Source | How it's connected |
|---|---|
| OpenStreetMap, TfL, Wikimedia Commons, openfootball | Open data, pulled by the import scripts |
| Islington Gazette, Islington Local Guide, r/islington | Their RSS feeds: headline + link on the News page, refreshed every 15 minutes |
| Skiddle, Ticketmaster | Official event APIs (`lib/sources.ts`). Free keys in `.env.example`; a daily cron (`vercel.json` → `/api/sync`) and a "Sync now" button in the back office pull events inside the borough |
| Eventbrite | No public search API any more — organisers add their events (or Eventbrite link) through "Suggest an event" |
| Time Out, Visit London, The Standard, Islington Life | No feeds: linked from the News page, not copied |
| X / Twitter | Paid API only; not connected |

What it deliberately does not do is copy articles, guides or listings from other sites. That content
belongs to them; the route to using more of it is a partnership (Islington Local Guide would be the
obvious first conversation).

Not yet tested with real keys: the Skiddle and Ticketmaster connectors follow their published docs
but no live response has been through them.

## Ask (the AI guide)

The ✨ Ask button on the map opens a chat that answers from the app's own data. Set
`ANTHROPIC_API_KEY` to switch it on. It uses Claude (`claude-opus-5-5`) with three tools — search
places, what's on, local buzz — in `lib/assistant.ts`. Each question costs a few pence, and each person
is capped at 30 an hour. Not yet tested with a real key: it type-checks against the SDK and the "no key"
path works, but no question has been answered live.

## Google Maps: what's allowed, and how it's wired

Google's terms let you **show** its ratings, reviews, opening hours and photos through the Places API,
with attribution, but not **copy or store** them — only the place ID may be kept — and not draw them on
a non-Google map. So:

- Every place links out to Google Maps and Google directions (plain links, free, no key).
- Set `GOOGLE_MAPS_API_KEY` (Google Cloud → enable "Places API (New)") and each place page fetches, live:
  Google's rating and review count, up to five reviews, opening hours when we have none of our own, and
  one photo when the owner hasn't uploaded one. All credited as Google requires. See `lib/google.ts`.
- Nothing from Google appears on the map pins, and the map's "Open now" filter only uses hours we hold
  ourselves (OpenStreetMap or the owner).
- Google bills per place-page view after a free monthly allowance — set a budget alert before launch.
- Google doesn't expose its "Reserve" links through the API. Owners add their own booking link instead.

Not yet tested with a real key: the request shapes follow Google's current docs, and a rejected key is
handled, but no live response has been through it.

## Guides (the pages search engines can read)

Everything else needs a sign-in, so search engines can only list the front page, the legal pages and
`/guides`. Each guide is a filter over the real places (`lib/guides.ts`): pubs with outdoor seating,
places to eat by cuisine, what is mapped within 600 m of each station, and so on. Nothing on them is
written by hand, and they never call Google. The pages are built ahead of time and rebuilt once a
day, read with a signed-out database client, so they show exactly what the public may see. To add a
guide, add an entry to `GUIDES`; the index, sitemap and front-page links pick it up.

## Calendars

`/calendar?kinds=football,music` is a public iCalendar feed (published events only), and
`/calendar?event=<id>` is a single event. What's On offers Google, Apple, Outlook and plain .ics for both.
Google and Outlook subscriptions need the site to be on a public address.

## Going live (Supabase + Google sign-in + Vercel)

1. **Supabase** — create a project (London region). Then either
   - CLI: `npx supabase init`, `npx supabase link`, `npx supabase db push --include-seed`; or
   - SQL Editor: run `supabase/migrations/20261115000000_init.sql`, then `supabase/seed.sql` (about 1 MB —
     use the CLI if the editor refuses it).
2. **Google sign-in** — in Google Cloud Console create an OAuth client (type: Web application) with the
   authorised redirect URI `https://<project-ref>.supabase.co/auth/v1/callback`. Paste the client ID and
   secret into Supabase → Authentication → Providers → Google.
3. **Supabase → Authentication → URL Configuration** — set Site URL to your domain and add
   `https://<your-domain>/auth/callback` and `http://localhost:3000/auth/callback` to Redirect URLs.
4. **Environment** — copy `.env.example` to `.env.local` and fill in the three Supabase values (the
   Google Maps, event-source and AI keys are optional extras). Add the same to the Vercel project, then deploy.
5. **Make yourself admin** — sign in once, then in the SQL Editor:
   ```sql
   update public.profiles set is_admin = true
   where id = (select id from auth.users where email = 'you@example.com');
   ```

The live database starts with the real places and events only; reviews, listings and wishes start empty.

## How it fits together

- `lib/memory.ts` (preview) and `lib/supabase-repo.ts` (live) implement one interface; `lib/repo.ts` picks.
- `app/actions.ts` — every write: validated with Zod, checked for ownership/admin, then sent to the repo.
- `supabase/migrations/` — schema and row-level security. Residents write only their own rows, owners
  edit only their own place (and can't verify or hide it), admin actions run server-side with the
  secret key after `requireAdmin()`.
- `proxy.ts` — sends signed-out visitors to `/login`.
- `components/CartoonMap.tsx` + `lib/map-style.ts` — the map.

## Checks

```bash
npm test           # opening-hours logic + runs the real migration and seed in an in-process
                   # Postgres and attacks the security rules as different users
npm run typecheck && npm run lint && npm run build
```

Not yet tested against a real Supabase project: `lib/supabase-repo.ts`, the Google sign-in round trip
and photo upload. Not yet tested with a real Google key: `lib/google.ts`. The SQL itself is tested; the calls into it are type-checked only.

## Refreshing data

```bash
node scripts/import-osm.mjs        # re-pull places, station lines, photos and the area outline (keeps ids stable)
node scripts/import-fixtures.mjs   # re-pull fixtures
npm run seed:sql                   # regenerate supabase/seed.sql from both
```

## Not built yet

- **Lime / Forest bikes** — neither publishes an open London feed. It needs a data-sharing agreement
  with the operators (the council already has one, which is a good thing to ask them for).
- **"Is this pub in the sun right now?"** — places with outdoor seating are flagged and filterable, and
  their pages show today's sunrise/sunset. A per-table sun/shade answer needs to know where each
  venue's seats are and to cast building shadows; that's its own piece of work.
- **Opening hours for every venue** — OpenStreetMap covers about 1 in 6. A Google key fills the rest on
  place pages; owners claiming their page is what makes them searchable on the map.
- **True-to-life 3D buildings** — heights are real, shapes are simple blocks. Photorealistic models
  exist (Google's 3D tiles) but can't be restyled as a cartoon.
- **Messaging** — Trade listings show a contact line instead of in-app chat.
- **Drop-a-pin for suggested events**, a second borough, a native app, email notifications when a
  claim is approved, generated Supabase types.

Place data © OpenStreetMap contributors (ODbL). Map tiles © OpenFreeMap / OpenMapTiles.
