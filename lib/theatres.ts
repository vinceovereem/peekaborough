// Theatres whose box office runs on Spektrix publish their programme as open JSON, no key needed
// (system.spektrix.com/<client>/api/v3). The same feed also sells drinks, programmes and shows at other venues, so a
// performance only counts when the theatre marks the show as part of its programme (`show`) AND it plays in a room
// we can place on the map (`rooms`: pattern on the room's name, then venue name and its OpenStreetMap position).
// Only the title, date and time are taken; the link goes to the theatre's own what's-on page.
//
// Not here: Kings Place (its feed cannot tell concerts from restaurant bookings) and Little Angel Studios on
// Sebbon Street (no OpenStreetMap position to pin it to).
import { formatTime } from './hours.ts'
import type { ExternalEvent } from './sources.ts'

/* eslint-disable @typescript-eslint/no-explicit-any -- third-party JSON */
export type Theatre = { client: string; source: string; url: string; show: (e: any) => boolean; rooms: [RegExp, string, number, number][] }
export const THEATRES: Theatre[] = [
  { client: 'parktheatre', source: 'Park Theatre', url: 'https://parktheatre.co.uk/whats-on', show: e => e.attribute_Season === 'Park Main Season', rooms: [[/^(park ?200|park ?90|morris space)$/i, 'Park Theatre', 51.565726, -0.108477]] },
  { client: 'kingsheadtheatre', source: "King's Head Theatre", url: 'https://kingsheadtheatre.com/whats-on', show: e => e.attribute_LiveOnWebsite === true && !e.attribute_SLExcludeFromViewEventsPage, rooms: [[/^(king'?s head theatre|main house)/i, "King's Head Theatre", 51.538312, -0.103005]] },
  { client: 'littleangeltheatre', source: 'Little Angel Theatre', url: 'https://littleangeltheatre.com/whats-on/', show: e => ['In-house show', 'Family activity'].includes(e.attribute_EventType), rooms: [[/^little angel theatre/i, 'Little Angel Theatre', 51.538822, -0.101353]] },
]

/** One entry per show per day for the next 60 days; a day with several performances lists their times. */
export function performanceDays(t: Theatre, shows: any[], performances: any[], plans: any[], now = Date.now()): ExternalEvent[] {
  const showById = new Map(shows.filter(t.show).map(e => [e.id, e])), roomName = new Map(plans.map(p => [p.id, p.name]))
  const days = new Map<string, { show: any; room: Theatre['rooms'][number]; start: Date }[]>()
  for (const p of performances) {
    const show = showById.get(p.event?.id), room = t.rooms.find(([name]) => name.test(roomName.get(p.planId) ?? ''))
    const start = new Date(String(p.startUtc).replace(/Z?$/, 'Z')) // the feed leaves the Z off some UTC times
    if (!show || !room || p.cancelled || !(start.getTime() > now && start.getTime() < now + 60 * 86400000)) continue
    const key = `${show.id}:${String(p.start).slice(0, 10)}` // `start` is London time, so this is the London day
    days.set(key, [...(days.get(key) ?? []), { show, room, start }])
  }
  return [...days].map(([source_id, list]) => {
    list.sort((a, b) => +a.start - +b.start)
    const [{ show, room: [, venue_name, lat, lng], start }] = list
    return {
      source: t.source, source_id, title: String(show.name).trim().slice(0, 120) || 'Show', kind: 'arts' as const, venue_name, lat, lng,
      description: list.length > 1 ? `Performances at ${list.map(x => formatTime(x.start.toISOString())).join(', ')}.` : null,
      starts_at: start.toISOString(), ends_at: null, url: t.url, price_pence: null,
    }
  })
}
