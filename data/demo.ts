// Sample content for demo mode. Everything here is fictional and labelled as such in the UI;
// real places come from data/places.json (OpenStreetMap) and real fixtures from data/fixtures.json.
import type { Hours, Place, MenuItem, Post, Review, Event, Listing, Claim, User } from '@/lib/types'
import { londonToISO } from '@/lib/hours'
import fixtures from './fixtures.json'

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
export const DEMO_USERS: (Omit<User, 'is_owner'> & { key: string; blurb: string })[] = [
  { key: 'resident', id: uid(1), name: 'Sam Rivera', email: 'sam@demo.test', avatar_url: null, is_admin: false, blurb: 'Browse, review, trade, vote' },
  { key: 'owner', id: uid(2), name: 'Priya Shah', email: 'priya@demo.test', avatar_url: null, is_admin: false, blurb: 'Runs two (demo) businesses' },
  { key: 'admin', id: uid(3), name: 'Patch Admin', email: 'admin@demo.test', avatar_url: null, is_admin: true, blurb: 'Approves owners, moderates' },
]
export const DEMO_NAMES: Record<string, string> = { [uid(1)]: 'Sam Rivera', [uid(2)]: 'Priya Shah', [uid(3)]: 'Patch Admin', [uid(4)]: 'Joan O.', [uid(5)]: 'Deji A.', [uid(6)]: 'Marta K.' }

const week = (open: string, close: string, closedDays: (keyof Hours)[] = []): Hours => {
  const h = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => [d, { open, close }])) as Hours
  for (const d of closedDays) h[d] = null
  return h
}
const base = { osm_id: null, phone: null, hours_note: null, cover_url: null, booking_url: null, google_place_id: null, extra: {}, is_landmark: false, is_demo: true, status: 'published' as const }
const CAFE = 'd0000000-0000-4000-8000-000000000001', DUMPLING = 'd0000000-0000-4000-8000-000000000002', BOOKS = 'd0000000-0000-4000-8000-000000000003'

export const DEMO_PLACES: Omit<Place, 'rating' | 'review_count'>[] = [
  { ...base, id: CAFE, slug: 'fieldside-cafe-demo', name: 'Fieldside Café (demo)', category: 'cafe', subcategory: 'coffee & brunch', verified: true,
    description: 'A made-up café to show what a claimed business page looks like: the owner keeps hours, menu, news and events up to date themselves.',
    address: 'Highbury Place (fictional)', lat: 51.5489, lng: -0.1004, website: 'https://example.com', phone: '020 7946 0000', hours: week('07:30', '17:30'), extra: { outdoor_seating: true } },
  { ...base, id: DUMPLING, slug: 'lucky-cat-dumplings-demo', name: 'Lucky Cat Dumplings (demo)', category: 'eat', subcategory: 'dumplings', verified: true,
    description: 'A made-up dumpling bar on Blackstock Road. Hand-folded every morning, gone by nine.',
    address: 'Blackstock Road (fictional)', lat: 51.5606, lng: -0.0993, website: 'https://example.com', booking_url: 'https://example.com/book', hours: week('12:00', '22:00', ['mon']) },
  { ...base, id: BOOKS, slug: 'barn-owl-books-demo', name: 'Barn Owl Books (demo)', category: 'shop', subcategory: 'books', verified: false,
    description: 'A made-up bookshop that nobody has claimed yet — sign in as the admin to approve the pending ownership claim.',
    address: 'Highbury Barn (fictional)', lat: 51.5556, lng: -0.0979, website: null, hours: week('10:00', '18:00', ['sun']) },
]
export const DEMO_OWNERS = [`${CAFE}|${uid(2)}`, `${DUMPLING}|${uid(2)}`]

const item = (place_id: string, section: string, name: string, price_pence: number, description: string | null = null): Omit<MenuItem, 'id' | 'position'> => ({ place_id, section, name, price_pence, description })
export const DEMO_MENU = [
  item(CAFE, 'Coffee', 'Flat white', 360), item(CAFE, 'Coffee', 'Filter of the week', 320, 'Ask what is on — it changes every Monday'),
  item(CAFE, 'Coffee', 'Oat hot chocolate', 400), item(CAFE, 'Brunch', 'Eggs on sourdough', 850, 'Poached or scrambled'),
  item(CAFE, 'Brunch', 'Halloumi & chilli jam bun', 780), item(CAFE, 'Brunch', 'Cinnamon knot', 380, 'Baked at 7am, usually gone by 11'),
  item(DUMPLING, 'Dumplings (6)', 'Pork & chive', 780), item(DUMPLING, 'Dumplings (6)', 'Mushroom & tofu', 740, 'Vegan'),
  item(DUMPLING, 'Dumplings (6)', 'Prawn har gow', 880), item(DUMPLING, 'Sides', 'Smacked cucumber', 480),
  item(DUMPLING, 'Sides', 'Chilli oil noodles', 690), item(DUMPLING, 'Drinks', 'Jasmine tea, bottomless', 250),
].map((m, i) => ({ ...m, id: `e0000000-0000-4000-8000-${String(i).padStart(12, '0')}`, position: i }))

const DAY = 86400000
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString()
/** `days` from today at a London wall-clock time, so sample events always look current. */
const inDays = (days: number, time: string) => londonToISO(new Date(Date.now() + days * DAY).toISOString().slice(0, 10), time)
const nextWeekday = (weekday: number, time: string, skip = 0) => { // 0 = Sunday
  const d = (weekday - new Date().getUTCDay() + 7) % 7 || 7
  return inDays(d + skip * 7, time)
}

export const demoPosts = (): Post[] => [
  { id: 'f0000000-0000-4000-8000-000000000001', place_id: CAFE, title: 'Winter menu is in', body: 'Spiced pear porridge and a proper cheese toastie are back. Dogs still welcome, muddy paws and all.', created_at: ago(1) },
  { id: 'f0000000-0000-4000-8000-000000000002', place_id: DUMPLING, title: 'Match-day window is open', body: 'Six dumplings in a box, out the hatch in two minutes. From three hours before every Arsenal home game.', created_at: ago(3) },
  { id: 'f0000000-0000-4000-8000-000000000003', place_id: CAFE, title: 'We now take keep-cups from the Fields kiosk', body: 'Bring any reusable cup for 30p off.', created_at: ago(9) },
]

const review = (n: number, place_id: string, user: number, rating: number, comment: string, days: number): Review => ({ id: `a0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, place_id, user_id: uid(user), rating, comment, status: 'visible', created_at: ago(days), author: DEMO_NAMES[uid(user)] })
export const demoReviews = (): Review[] => [
  review(1, CAFE, 4, 5, 'Best flat white this side of the Fields, and they remember your order.', 2),
  review(2, CAFE, 5, 4, 'Lovely spot. Gets rammed after parkrun so come early.', 6),
  review(3, CAFE, 6, 5, 'The cinnamon knot. That is the review.', 12),
  review(4, DUMPLING, 4, 5, 'Mushroom & tofu ones are unreal. Chilli oil is not messing about.', 4),
  review(5, DUMPLING, 1, 4, 'Great before the match, queue moves fast.', 8),
  review(6, BOOKS, 5, 5, 'Proper neighbourhood bookshop. Ask for the staff picks.', 15),
]

const EMIRATES = { venue_name: 'Emirates Stadium', lat: 51.555045, lng: -0.1084 }
const ev = (n: number, e: Omit<Event, 'id' | 'status' | 'created_by' | 'ends_at' | 'url' | 'place_id' | 'description' | 'is_sample' | 'price_pence' | 'source'> & Partial<Event>): Event =>
  ({ id: `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, status: 'published', created_by: null, ends_at: null, url: null, place_id: null, description: null, is_sample: false, price_pence: null, source: null, ...e })

/** Real, sourced events — also what scripts/make-seed.mjs writes into Supabase. */
export const realEvents = (): Event[] => [
  ...fixtures.map((f, i) => ev(100 + i, { ...EMIRATES, kind: 'football', title: `Arsenal v ${f.opponent}`, starts_at: londonToISO(f.date, f.time),
    description: `Premier League, ${f.round}. Expect busy streets, pubs and stations from about three hours before kick-off. Kick-off times can move for TV.`, url: 'https://www.arsenal.com/fixtures' })),
  ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap(w => [
    ev(200 + w, { price_pence: 0, kind: 'sport', title: 'Highbury Fields parkrun', venue_name: 'Highbury Fields', lat: 51.5497, lng: -0.1015, starts_at: nextWeekday(6, '09:00', w), description: 'Free, timed 5k every Saturday morning. Walk, jog or run — just turn up.', url: 'https://www.parkrun.org.uk/highburyfields/' }),
    ev(300 + w, { price_pence: 0, kind: 'sport', title: 'Finsbury Park parkrun', venue_name: 'Finsbury Park', lat: 51.5703, lng: -0.101, starts_at: nextWeekday(6, '09:00', w), description: 'Free, timed 5k every Saturday morning, two hilly laps of the park.', url: 'https://www.parkrun.org.uk/finsbury/' }),
  ]),
]

export const demoEvents = (): Event[] => [
  ...realEvents(),
  ev(1, { is_sample: true, price_pence: 0, place_id: CAFE, kind: 'music', title: 'Live jazz trio & late coffee', venue_name: 'Fieldside Café (demo)', lat: 51.5489, lng: -0.1004, starts_at: nextWeekday(4, '19:00'), description: 'Sample event posted by a business owner from their dashboard.' }),
  ev(2, { is_sample: true, price_pence: 2800, place_id: DUMPLING, kind: 'food', title: 'Fold-your-own dumpling night', venue_name: 'Lucky Cat Dumplings (demo)', lat: 51.5606, lng: -0.0993, starts_at: nextWeekday(3, '18:30'), description: 'Sample event. Twelve seats, all the dumplings you can fold.' }),
  ev(3, { is_sample: true, price_pence: 0, kind: 'market', title: "Sunday makers' market", venue_name: 'Highbury Fields', lat: 51.5503, lng: -0.1022, starts_at: nextWeekday(0, '10:00'), description: 'Sample event: local makers, bakers and growers on the top field.' }),
  ev(4, { is_sample: true, price_pence: 0, kind: 'community', title: 'Litter pick & free coffee', venue_name: 'Gillespie Park', lat: 51.5611, lng: -0.1052, starts_at: nextWeekday(6, '11:00'), description: 'Sample community event suggested by a resident and approved by the admin.' }),
  ev(5, { is_sample: true, ...EMIRATES, kind: 'music', title: 'Summer stadium concert (placeholder)', starts_at: londonToISO('2027-06-12', '17:00'), description: 'Placeholder: no 2027 concerts had been announced when this prototype was built.' }),
  { ...ev(6, { is_sample: true, kind: 'community', title: 'Street party on Aubert Park', venue_name: 'Aubert Park', lat: 51.5572, lng: -0.1012, starts_at: inDays(20, '13:00'), description: 'Sample suggestion waiting for admin approval.' }), status: 'pending', created_by: uid(1) },
]

const listing = (n: number, user: number, kind: Listing['kind'], title: string, description: string, price_pence: number | null, days: number): Listing =>
  ({ id: `c0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, user_id: uid(user), kind, title, description, price_pence, contact: 'Demo listing — no real contact details', status: 'active', created_at: ago(days), author: DEMO_NAMES[uid(user)] })
export const demoListings = (): Listing[] => [
  listing(1, 4, 'free', "Kids' balance bike", 'Outgrown, a bit scuffed, rides fine. Collect near Highbury Barn.', null, 1),
  listing(2, 5, 'sell', 'Two Arsenal v Bournemouth tickets', 'North Bank, face value only, club transfer.', 9800, 2),
  listing(3, 6, 'swap', 'Sourdough starter for houseplant cuttings', 'Eight-year-old starter called Dennis. Will swap for anything that is not a spider plant.', null, 3),
  listing(4, 1, 'wanted', 'Ladder for a weekend', 'Need a 3m ladder to clear gutters. Will return with biscuits.', null, 4),
  listing(5, 4, 'service', 'GCSE maths tutoring', 'Retired teacher, one-to-one at the library. First session free.', 2500, 6),
  listing(6, 5, 'sell', 'Mid-century armchair', 'Reupholstered last year, moving flat. Can deliver within N5.', 12000, 7),
]

export const demoWishes = () => [
  { n: 1, user: 4, title: 'A proper fishmonger', description: 'Nearest good one is a bus ride away.', voters: [1, 2, 4, 5, 6], down: [], days: 20 },
  { n: 2, user: 5, title: 'Safer crossing at Highbury Corner', description: 'The lights by the station give you about four seconds.', voters: [1, 4, 5, 6], down: [], days: 14 },
  { n: 3, user: 6, title: 'More Lime & Forest parking bays near Arsenal station', description: 'Bikes pile up on the pavement on match days.', voters: [2, 4, 6], down: [1, 5], days: 9 },
  { n: 4, user: 1, title: 'A late-opening pharmacy', description: 'Nothing open after 7pm round here.', voters: [1, 5], down: [], days: 5 },
  { n: 5, user: 4, title: 'Repair café once a month', description: 'Somewhere to fix toasters and hem trousers together.', voters: [4], down: [6], days: 2 },
].map(w => ({ id: `ab000000-0000-4000-8000-${String(w.n).padStart(12, '0')}`, user_id: uid(w.user), title: w.title, description: w.description as string | null, status: 'visible' as const, created_at: ago(w.days),
  votes: Object.fromEntries([...w.voters.map(u => [uid(u), 1]), ...w.down.map(u => [uid(u), -1])]) as Record<string, 1 | -1> }))

export const demoClaims = (): Claim[] => [{
  id: 'ac000000-0000-4000-8000-000000000001', place_id: BOOKS, user_id: uid(1), role: 'Owner', business_email: 'sam@barnowlbooks.example', phone: '020 7946 0001',
  evidence: 'I am on the shop lease and the Companies House filing. Happy for someone to pop in and check — I am behind the till Tuesday to Saturday.',
  status: 'pending', admin_note: null, created_at: ago(1),
}]
