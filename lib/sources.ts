// Automatic event listings from ticketing platforms' official APIs and from theatres' own feeds. A keyed
// connector is off until its key is set; `syncEvents` runs daily (vercel.json cron -> /api/sync) and from the admin page.
//
// Eventbrite is not here on purpose: it withdrew its public event-search API, so the only supported
// way to list Eventbrite events is for the organiser to add them (or their Eventbrite link) by hand.
import { APP_NAME, SITE_URL, HOOD, inArea, type EventKind } from './config'
import { repo } from './repo'
import { THEATRES, performanceDays, type Theatre } from './theatres'
import type { Event } from './types'

export type ExternalEvent = Pick<Event, 'title' | 'description' | 'kind' | 'venue_name' | 'lat' | 'lng' | 'starts_at' | 'ends_at' | 'url' | 'price_pence'> & { source: string; source_id: string }

const [lng, lat] = HOOD.center
const get = async (url: string) => {
  // Skiddle's terms ask every call to say which app it comes from
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': `${APP_NAME}/1.0 (+${SITE_URL})` } })
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`)
  return res.json()
}
const pence = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : null }
// ponytail: each source is read soonest-first, a fixed number of pages. The search circles reach into central London,
// where about 50 events a day are listed: Skiddle's 30 pages of 100 cover roughly two months (the first live run,
// at 5 pages, reached 10 days). Ticketmaster lets nobody page past 1,000. Search by venue if either bites.
const MAX_PAGES = 5
const clip = (s: unknown, max: number) => typeof s === 'string' && s.trim() ? s.trim().replace(/<[^>]+>/g, '').slice(0, max) : null

/* eslint-disable @typescript-eslint/no-explicit-any -- third-party JSON */
const SKIDDLE_KINDS: Record<string, EventKind> = { FEST: 'music', LIVE: 'music', CLUB: 'music', THEATRE: 'arts', COMEDY: 'arts', EXHIB: 'arts', ARTS: 'arts', SPORT: 'sport', BARPUB: 'food' }
/** https://github.com/Skiddle/web-api — free key from skiddle.com/api/join.php. Radius is in miles. */
async function skiddle(key: string): Promise<ExternalEvent[]> {
  const found: any[] = []
  for (let page = 0; page < 30; page++) {
    const batch = (await get(`https://www.skiddle.com/api/v1/events/search/?api_key=${key}&latitude=${lat}&longitude=${lng}&radius=3&order=date&description=1&limit=100&offset=${page * 100}`)).results ?? []
    found.push(...batch)
    if (batch.length < 100) break
  }
  return found.flatMap((e: any): ExternalEvent[] => e?.id && e.startdate && e.venue?.latitude ? [{
    source: 'Skiddle', source_id: String(e.id), title: clip(e.eventname, 120) ?? 'Event', description: clip(e.description, 600), kind: SKIDDLE_KINDS[e.EventCode] ?? 'community',
    venue_name: clip(e.venue.name, 120) ?? 'Venue', lat: +e.venue.latitude, lng: +e.venue.longitude,
    starts_at: new Date(e.startdate).toISOString(), ends_at: e.enddate ? new Date(e.enddate).toISOString() : null, url: e.link ?? null,
    price_pence: /free/i.test(String(e.entryprice)) ? 0 : pence(e.entryprice),
  }] : [])
}

/** https://developer.ticketmaster.com — Discovery API v2, free key. Covers the Emirates, O2 Academy Islington, Union Chapel and more. */
async function ticketmaster(key: string): Promise<ExternalEvent[]> {
  const found: any[] = [], from = `${new Date().toISOString().slice(0, 19)}Z`
  for (let page = 0; page < MAX_PAGES; page++) { // 5 x 200 is also the furthest Ticketmaster lets anyone page
    const d = await get(`https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&latlong=${lat},${lng}&radius=5&unit=km&size=200&page=${page}&sort=date,asc&startDateTime=${from}`)
    found.push(...(d._embedded?.events ?? []))
    if (page + 1 >= (d.page?.totalPages ?? 1)) break
  }
  return found.flatMap((e: any): ExternalEvent[] => {
    const venue = e._embedded?.venues?.[0], segment = e.classifications?.[0]?.segment?.name, genre = e.classifications?.[0]?.genre?.name
    if (!e.id || !e.dates?.start?.dateTime || !venue?.location) return []
    return [{
      source: 'Ticketmaster', source_id: String(e.id), title: clip(e.name, 120) ?? 'Event', description: clip(e.info ?? e.pleaseNote, 600),
      kind: segment === 'Music' ? 'music' : segment === 'Sports' ? (/football|soccer/i.test(genre ?? '') ? 'football' : 'sport') : segment === 'Arts & Theatre' ? 'arts' : 'community',
      venue_name: clip(venue.name, 120) ?? 'Venue', lat: +venue.location.latitude, lng: +venue.location.longitude,
      starts_at: new Date(e.dates.start.dateTime).toISOString(), ends_at: null, url: e.url ?? null, price_pence: pence(e.priceRanges?.[0]?.min),
    }]
  })
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A theatre's own box-office feed (see lib/theatres.ts). */
async function theatre(t: Theatre): Promise<ExternalEvent[]> {
  const base = `https://system.spektrix.com/${t.client}/api/v3`, today = new Date().toISOString().slice(0, 10)
  const [shows, performances, plans] = await Promise.all([get(`${base}/events?instanceStart_from=${today}`), get(`${base}/instances?startFrom=${today}`), get(`${base}/plans`)])
  return performanceDays(t, shows, performances, plans)
}

const CONNECTORS = [
  { name: 'Skiddle', key: process.env.SKIDDLE_API_KEY, run: skiddle },
  { name: 'Ticketmaster', key: process.env.TICKETMASTER_API_KEY, run: ticketmaster },
  ...THEATRES.map(t => ({ name: t.source, key: 'open feed, no key', run: () => theatre(t) })),
]

/** Pulls every configured source, keeps upcoming events inside the borough, and saves them. */
export async function syncEvents(): Promise<string> {
  const active = CONNECTORS.filter(c => c.key)
  const report: string[] = []
  for (const c of active) {
    try {
      const events = (await c.run(c.key!)).filter(e => inArea(e.lng, e.lat) && Date.parse(e.starts_at) > Date.now())
      await repo.importEvents(events)
      report.push(`${c.name}: ${events.length} events in ${HOOD.name}`)
    } catch (e) {
      console.error(`${c.name} sync failed`, e)
      report.push(`${c.name}: failed (${e instanceof Error ? e.message : 'unknown error'})`)
    }
  }
  return report.join(' · ')
}
