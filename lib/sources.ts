// Automatic event listings from ticketing platforms' official APIs. Each connector is off until
// its key is set; `syncEvents` runs daily (vercel.json cron -> /api/sync) and from the admin page.
//
// Eventbrite is not here on purpose: it withdrew its public event-search API, so the only supported
// way to list Eventbrite events is for the organiser to add them (or their Eventbrite link) by hand.
import { HOOD, inArea, type EventKind } from './config'
import { repo } from './repo'
import type { Event } from './types'

export type ExternalEvent = Pick<Event, 'title' | 'description' | 'kind' | 'venue_name' | 'lat' | 'lng' | 'starts_at' | 'ends_at' | 'url' | 'price_pence'> & { source: string; source_id: string }

const [lng, lat] = HOOD.center
const get = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`)
  return res.json()
}
const pence = (v: unknown) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^\d.]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) : null }
const clip = (s: unknown, max: number) => typeof s === 'string' && s.trim() ? s.trim().replace(/<[^>]+>/g, '').slice(0, max) : null

/* eslint-disable @typescript-eslint/no-explicit-any -- third-party JSON */
const SKIDDLE_KINDS: Record<string, EventKind> = { FEST: 'music', LIVE: 'music', CLUB: 'music', THEATRE: 'arts', COMEDY: 'arts', EXHIB: 'arts', ARTS: 'arts', SPORT: 'sport', BARPUB: 'food' }
/** https://github.com/Skiddle/web-api — free key from skiddle.com/api/join.php. Radius is in miles. */
async function skiddle(key: string): Promise<ExternalEvent[]> {
  const d = await get(`https://www.skiddle.com/api/v1/events/search/?api_key=${key}&latitude=${lat}&longitude=${lng}&radius=3&order=date&description=1&limit=100`)
  return (d.results ?? []).flatMap((e: any): ExternalEvent[] => e?.id && e.startdate && e.venue?.latitude ? [{
    source: 'Skiddle', source_id: String(e.id), title: clip(e.eventname, 120) ?? 'Event', description: clip(e.description, 600), kind: SKIDDLE_KINDS[e.EventCode] ?? 'community',
    venue_name: clip(e.venue.name, 120) ?? 'Venue', lat: +e.venue.latitude, lng: +e.venue.longitude,
    starts_at: new Date(e.startdate).toISOString(), ends_at: e.enddate ? new Date(e.enddate).toISOString() : null, url: e.link ?? null,
    price_pence: /free/i.test(String(e.entryprice)) ? 0 : pence(e.entryprice),
  }] : [])
}

/** https://developer.ticketmaster.com — Discovery API v2, free key. Covers the Emirates, O2 Academy Islington, Union Chapel and more. */
async function ticketmaster(key: string): Promise<ExternalEvent[]> {
  const d = await get(`https://app.ticketmaster.com/discovery/v2/events.json?apikey=${key}&latlong=${lat},${lng}&radius=5&unit=km&size=200&sort=date,asc&startDateTime=${new Date().toISOString().slice(0, 19)}Z`)
  return (d._embedded?.events ?? []).flatMap((e: any): ExternalEvent[] => {
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

const CONNECTORS = [
  { name: 'Skiddle', key: process.env.SKIDDLE_API_KEY, run: skiddle },
  { name: 'Ticketmaster', key: process.env.TICKETMASTER_API_KEY, run: ticketmaster },
]

/** Pulls every configured source, keeps upcoming events inside the borough, and saves them. */
export async function syncEvents(): Promise<string> {
  const active = CONNECTORS.filter(c => c.key)
  if (!active.length) return 'No event sources are connected yet — add SKIDDLE_API_KEY or TICKETMASTER_API_KEY.'
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
