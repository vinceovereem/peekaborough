import Link from 'next/link'
import Shell from '@/components/Shell'
import SubmitButton from '@/components/SubmitButton'
import CalendarPicker from '@/components/CalendarPicker'
import { SampleTag, Empty } from '@/components/ui'
import { repo } from '@/lib/repo'
import { EVENT_KINDS, HOOD, type EventKind } from '@/lib/config'
import { formatDay, formatTime, formatPrice, dayKey } from '@/lib/hours'
import { googleCalendarUrl, outlookUrl } from '@/lib/calendar'
import { suggestEvent } from '@/app/actions'
import type { Event } from '@/lib/types'

export const metadata = { title: "What's on" }

const KINDS = Object.keys(EVENT_KINDS) as EventKind[]

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ kinds?: string; ok?: string; error?: string }> }) {
  const { kinds = '', ...flash } = await searchParams
  const picked = KINDS.filter(k => kinds.split(',').includes(k)) // several can be on at once
  const toggled = (k: EventKind) => { const next = picked.includes(k) ? picked.filter(x => x !== k) : [...picked, k]; return next.length ? `/events?kinds=${next.join(',')}` : '/events' }
  const all = await repo.events()
  const events = picked.length ? all.filter(e => picked.includes(e.kind)) : all
  const days = Map.groupBy(events, (e: Event) => dayKey(e.starts_at))
  const nextMatch = all.find(e => e.kind === 'football')

  return (
    <Shell title="What's on" intro={`Match days, gigs, markets and meet-ups across ${HOOD.name}.`} flash={flash}>
      {nextMatch && (
        <div className="card mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 bg-tomato p-4 text-white">
          <span className="text-4xl" aria-hidden>🏟️</span>
          <div><p className="text-sm font-bold uppercase opacity-90">Next at the Emirates</p><p className="font-display text-2xl font-bold">{nextMatch.title}</p><p>{formatDay(nextMatch.starts_at)}, kick-off {formatTime(nextMatch.starts_at)}. Expect the area around the stadium to be busy before and after.</p></div>
        </div>
      )}
      {/* one filter drives both the list below and what the calendar buttons add */}
      <nav className="mb-3 flex gap-1.5 overflow-x-auto pb-1" aria-label="Filter events">
        <Link href="/events" scroll={false} className={`chip ${!picked.length ? 'chip-on' : ''}`}>Everything</Link>
        {KINDS.map(k => <Link key={k} href={toggled(k)} scroll={false} aria-pressed={picked.includes(k)} className={`chip ${picked.includes(k) ? 'chip-on' : ''}`}>{EVENT_KINDS[k].emoji} {EVENT_KINDS[k].label}</Link>)}
      </nav>
      <CalendarPicker kinds={picked} />

      {events.length === 0 ? <Empty>Nothing in the diary for this yet.</Empty> : (
        <div className="space-y-6">{[...days].slice(0, 40).map(([day, list]) => (
          <section key={day} className="grid gap-3 sm:grid-cols-[110px_1fr]">
            <h2 className="font-display text-xl font-bold sm:pt-3">{formatDay(list[0].starts_at)}</h2>
            <ul className="space-y-2">{list.map(e => (
              <li key={e.id} className="card flex items-start gap-3 p-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-ink bg-sun text-xl" aria-hidden>{EVENT_KINDS[e.kind].emoji}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg leading-tight font-bold">{e.title} {e.price_pence != null && <span className={`tag align-middle ${e.price_pence === 0 ? 'bg-grass' : 'bg-sun'}`}>{formatPrice(e.price_pence)}</span>} {e.is_sample && <SampleTag />}</h3>
                  <p className="text-sm font-bold">{formatTime(e.starts_at)} · {e.place ? <Link className="underline" href={`/place/${e.place.slug}`}>{e.venue_name}</Link> : e.venue_name}</p>
                  {e.description && <p className="muted mt-1 text-sm">{e.description}</p>}
                  {e.url && <a href={e.url} target="_blank" rel="noreferrer" className="text-sm font-bold underline">{e.source ? `Tickets & details on ${e.source} ↗` : 'More info ↗'}</a>}
                </div>
                <details className="relative shrink-0">
                  <summary className="btn btn-white btn-sm list-none" aria-label={`Add ${e.title} to your calendar`}>📅 Add</summary>
                  <div className="card absolute right-0 z-10 mt-1 grid w-44 overflow-hidden text-sm font-bold">
                    <a className="px-3 py-2.5 hover:bg-sun/40" href={googleCalendarUrl(e)} target="_blank" rel="noreferrer">Google Calendar</a>
                    <a className="px-3 py-2.5 hover:bg-sun/40" href={`/calendar?event=${e.id}`}>Apple Calendar</a>
                    <a className="px-3 py-2.5 hover:bg-sun/40" href={outlookUrl(e)} target="_blank" rel="noreferrer">Outlook</a>
                    <a className="px-3 py-2.5 hover:bg-sun/40" href={`/calendar?event=${e.id}`}>Other (.ics file)</a>
                  </div>
                </details>
              </li>
            ))}</ul>
          </section>
        ))}</div>
      )}

      <details className="card mt-10 p-4">
        <summary className="font-display cursor-pointer text-xl font-bold">➕ Know about something happening? Suggest it</summary>
        <form action={suggestEvent} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="_from" value="/events" />
          <div className="sm:col-span-2"><label className="label" htmlFor="title">What is it?</label><input id="title" name="title" required maxLength={120} className="input" placeholder="Street party on Aubert Park" /></div>
          <div><label className="label" htmlFor="kind">Type</label><select id="kind" name="kind" className="input">{(Object.keys(EVENT_KINDS) as EventKind[]).filter(k => k !== 'football').map(k => <option key={k} value={k}>{EVENT_KINDS[k].label}</option>)}</select></div>
          <div><label className="label" htmlFor="venue">Where?</label><input id="venue" name="venue" required maxLength={120} className="input" placeholder="Highbury Fields" /></div>
          <div><label className="label" htmlFor="date">Date</label><input id="date" name="date" type="date" required className="input" /></div>
          <div><label className="label" htmlFor="time">Start time</label><input id="time" name="time" type="time" required className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="price">Price in £ <span className="muted font-normal">(0 if it&apos;s free, empty if you don&apos;t know)</span></label><input id="price" name="price" inputMode="decimal" pattern="\d*\.?\d{0,2}" className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="description">Details <span className="muted font-normal">(optional)</span></label><textarea id="description" name="description" rows={2} maxLength={2000} className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="url">Link <span className="muted font-normal">(optional)</span></label><input id="url" name="url" type="url" className="input" placeholder="https://" /></div>
          <div className="sm:col-span-2"><SubmitButton>Send for approval</SubmitButton> <span className="muted ml-2 text-sm">We check every suggestion before it appears.</span></div>
        </form>
      </details>
      <p className="muted mt-6 text-xs">Fixtures: openfootball. Kick-off times can change for TV — check arsenal.com before you travel.</p>
    </Shell>
  )
}
