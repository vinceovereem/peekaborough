// What the app runs on before a database is connected: three guest accounts, and the real events
// we can source (Arsenal fixtures from data/fixtures.json, the weekly parkruns). There is no
// invented content here on purpose — no made-up businesses, people, reviews, listings or events.
import type { Event, User } from '@/lib/types'
import { londonToISO } from '@/lib/hours'
import fixtures from './fixtures.json'

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
/** One-click guest accounts, so the app can be tried before Google sign-in is switched on. */
export const DEMO_USERS: (Omit<User, 'is_owner'> & { key: string; blurb: string })[] = [
  { key: 'resident', id: uid(1), name: 'Guest resident', email: null, avatar_url: null, is_admin: false, blurb: 'Browse, review, trade, vote' },
  { key: 'owner', id: uid(2), name: 'Guest business owner', email: null, avatar_url: null, is_admin: false, blurb: 'Claim and run a business page' },
  { key: 'admin', id: uid(3), name: 'Guest admin', email: null, avatar_url: null, is_admin: true, blurb: 'Approves owners, moderates' },
]

const DAY = 86400000
/** The next given weekday (0 = Sunday) at a London wall-clock time, optionally some weeks further on. */
const nextWeekday = (weekday: number, time: string, skip = 0) => {
  const days = ((weekday - new Date().getUTCDay() + 7) % 7 || 7) + skip * 7
  return londonToISO(new Date(Date.now() + days * DAY).toISOString().slice(0, 10), time)
}

const EMIRATES = { venue_name: 'Emirates Stadium', lat: 51.555045, lng: -0.1084 }
const ev = (n: number, e: Pick<Event, 'title' | 'kind' | 'venue_name' | 'lat' | 'lng' | 'starts_at'> & Partial<Event>): Event =>
  ({ id: `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`, status: 'published', created_by: null, ends_at: null, url: null, place_id: null, description: null, is_sample: false, price_pence: null, source: null, ...e })

/** Real, sourced events — also what scripts/make-seed.mjs writes into Supabase. */
export const realEvents = (): Event[] => [
  // Source: openfootball's public-domain fixture list. The club's site is the final word on dates and times.
  ...fixtures.map((f, i) => ev(100 + i, { ...EMIRATES, kind: 'football', title: `Arsenal v ${f.opponent}`, starts_at: londonToISO(f.date, f.time),
    description: `Premier League, ${f.round}. Dates and kick-off times can change for TV — check arsenal.com before you travel.`, url: 'https://www.arsenal.com/fixtures' })),
  // parkrun is a free, weekly, timed 5k held every Saturday at 9am.
  ...[0, 1, 2, 3, 4, 5, 6, 7].flatMap(w => [
    ev(200 + w, { price_pence: 0, kind: 'sport', title: 'Highbury Fields parkrun', venue_name: 'Highbury Fields', lat: 51.5497, lng: -0.1015, starts_at: nextWeekday(6, '09:00', w), description: 'Free, timed 5k every Saturday at 9am.', url: 'https://www.parkrun.org.uk/highburyfields/' }),
    ev(300 + w, { price_pence: 0, kind: 'sport', title: 'Finsbury Park parkrun', venue_name: 'Finsbury Park', lat: 51.5703, lng: -0.101, starts_at: nextWeekday(6, '09:00', w), description: 'Free, timed 5k every Saturday at 9am.', url: 'https://www.parkrun.org.uk/finsbury/' }),
  ]),
]
