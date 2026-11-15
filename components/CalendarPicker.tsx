'use client'
import { useSyncExternalStore } from 'react'
import { APP_NAME, EVENT_KINDS, type EventKind } from '@/lib/config'

const noop = () => () => {}

/** Adds whatever the filter above is showing to your calendar — everything, if nothing is filtered. */
export default function CalendarPicker({ kinds }: { kinds: EventKind[] }) {
  const host = useSyncExternalStore(noop, () => location.host, () => '') // only known in the browser
  const isLocal = /^(localhost|127\.|\[::1\])/.test(host)
  const query = kinds.length ? `?kinds=${kinds.join(',')}` : ''
  const feed = `${host}/calendar${query}`
  const what = kinds.length ? kinds.map(k => EVENT_KINDS[k].label.toLowerCase()).join(' + ') : 'everything'

  return (
    <section className="card mb-6 p-4">
      <h2 className="text-lg font-bold">📅 Add <span className="rounded-md bg-sun px-1.5">{what}</span> to your calendar</h2>
      <p className="muted mb-3 text-sm">It follows the filter above, and stays up to date when times change or events are added.</p>
      <div className={`flex flex-wrap gap-2 ${host ? '' : 'pointer-events-none opacity-40'}`}>
        <a className="btn btn-white" href={`https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://${feed}`)}`} target="_blank" rel="noreferrer">Google Calendar</a>
        <a className="btn btn-white" href={`webcal://${feed}`}>Apple Calendar</a>
        <a className="btn btn-white" href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(`https://${feed}`)}&name=${encodeURIComponent(APP_NAME)}`} target="_blank" rel="noreferrer">Outlook</a>
        <a className="btn btn-white" href={`/calendar${query}${query ? '&' : '?'}download=1`}>Any other (.ics file)</a>
      </div>
      {isLocal && <p className="muted mt-2 text-xs">You&apos;re on a local preview: Google and Outlook can only subscribe once the site has a public address. Apple Calendar and the .ics file work now.</p>}
    </section>
  )
}
