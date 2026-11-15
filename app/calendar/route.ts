import type { NextRequest } from 'next/server'
import { repo } from '@/lib/repo'
import { toICS } from '@/lib/calendar'
import { APP_NAME, EVENT_KINDS } from '@/lib/config'

// Public on purpose: calendar apps fetch this without a session. It only ever returns published events.
//   /calendar?kinds=football,music   a feed to subscribe to (or download with &download=1)
//   /calendar?event=<id>             one event
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const all = await repo.events()
  const kinds = (q.get('kinds') ?? '').split(',').filter(k => k in EVENT_KINDS)
  const events = q.get('event') ? all.filter(e => e.id === q.get('event')) : kinds.length ? all.filter(e => kinds.includes(e.kind)) : all
  if (q.get('event') && !events.length) return new Response('Event not found', { status: 404 })
  const name = q.get('event') ? events[0].title : `${APP_NAME}${kinds.length ? ` — ${kinds.map(k => EVENT_KINDS[k as keyof typeof EVENT_KINDS].label).join(', ')}` : ''}`
  return new Response(toICS(events, name), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `${q.get('event') || q.get('download') ? 'attachment' : 'inline'}; filename="peekaborough.ics"`,
      'Cache-Control': 'public, max-age=900',
    },
  })
}
