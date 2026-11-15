import { APP_NAME, HOOD } from './config.ts' // .ts extensions: this file also runs under plain `node --test`
import { formatPrice } from './hours.ts'
import type { Event } from './types'

type E = Pick<Event, 'id' | 'title' | 'description' | 'kind' | 'venue_name' | 'lat' | 'lng' | 'starts_at' | 'ends_at' | 'url' | 'price_pence'>
// Events rarely come with an end time; assume an hour for a run and two for everything else.
const end = (e: E) => e.ends_at ?? new Date(new Date(e.starts_at).getTime() + (e.kind === 'sport' ? 1 : 2) * 3600_000).toISOString()
const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, '') // 20261128T150000Z
const where = (e: E) => `${e.venue_name}, ${HOOD.name}, London`
const details = (e: E) => [e.description, e.price_pence != null && `Price: ${formatPrice(e.price_pence)}`, e.url].filter(Boolean).join('\n\n')

export const googleCalendarUrl = (e: E) =>
  `https://calendar.google.com/calendar/render?${new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${stamp(e.starts_at)}/${stamp(end(e))}`, details: details(e), location: where(e) })}`
export const outlookUrl = (e: E) =>
  `https://outlook.live.com/calendar/0/action/compose?${new URLSearchParams({ rru: 'addevent', subject: e.title, startdt: e.starts_at, enddt: end(e), body: details(e), location: where(e) })}`

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')
// Lines longer than 75 bytes must be folded; 60 characters keeps us under that even with emoji.
const fold = (line: string) => [...line].reduce((rows, ch) => { if ([...rows[rows.length - 1]].length >= 60) rows.push(' '); rows[rows.length - 1] += ch; return rows }, ['']).join('\r\n')

/** An iCalendar file: opens in Apple Calendar, Outlook, Google Calendar and anything else that speaks .ics. */
export function toICS(events: E[], name = APP_NAME, now = new Date()): string {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//${APP_NAME}//EN`, 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Europe/London',
    ...events.flatMap(e => [
      'BEGIN:VEVENT', `UID:${e.id}@peekaborough`, `DTSTAMP:${stamp(now.toISOString())}`, `DTSTART:${stamp(e.starts_at)}`, `DTEND:${stamp(end(e))}`,
      `SUMMARY:${esc(e.title)}`, `LOCATION:${esc(where(e))}`, `GEO:${e.lat};${e.lng}`, details(e) && `DESCRIPTION:${esc(details(e))}`, e.url && `URL:${e.url}`, 'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ].filter((l): l is string => !!l).map(fold).join('\r\n') + '\r\n'
}
