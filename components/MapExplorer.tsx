'use client'
import Link from 'next/link'
import { useMemo, useState, useSyncExternalStore } from 'react'
import CartoonMap, { type MapPin } from './CartoonMap'
import PlacePicture from './PlacePicture'
import AskPanel from './AskPanel'
import { Stars, CategoryTag, OpenBadge, VerifiedTag, SampleTag, LinePills } from './ui'
import { CATEGORIES, CATEGORY_KEYS, EVENT_KINDS, type Category } from '@/lib/config'
import { isOpenNow, formatDay, formatTime, formatPrice, dayKey } from '@/lib/hours'
import { googleMapsUrl, directionsUrl } from '@/lib/links'
import type { MapPlace, Event, Post } from '@/lib/types'

type Props = { places: MapPlace[]; events: Event[]; posts: Post[]; favourites: string[]; initialSlug?: string; now: string; askEnabled: boolean }
const venueKey = (e: Event) => `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`

const NO_PINS: MapPin[] = []
const noSubscription = () => () => {}
const readHideEvents = () => { try { return localStorage.getItem('hide-events') === '1' } catch { return false } }
// The server leaves empty fields out to keep the list small; put the defaults back.
const BLANK = { subcategory: null, address: null, hours: null, cover_url: null, extra: {}, is_landmark: false, is_demo: false, verified: false, rating: null, review_count: 0 }

export default function MapExplorer({ places: slim, events, posts, favourites, initialSlug, now: nowISO, askEnabled }: Props) {
  const now = useMemo(() => new Date(nowISO), [nowISO])
  const places = useMemo(() => slim.map(p => ({ ...BLANK, ...p })), [slim])
  const [cat, setCat] = useState<Category | null>(null)
  const [q, setQ] = useState('')
  const [openOnly, setOpenOnly] = useState(false)
  const [outside, setOutside] = useState(false)
  const [favsOnly, setFavsOnly] = useState(false)
  // Event bubbles can be switched off for a cleaner map; the choice is remembered on this device.
  const storedHidden = useSyncExternalStore(noSubscription, readHideEvents, () => false)
  const [eventsChoice, setEventsChoice] = useState<boolean | null>(null) // null until toggled in this visit
  const showEvents = eventsChoice ?? !storedHidden
  const toggleEvents = () => { setEventsChoice(!showEvents); try { localStorage.setItem('hide-events', showEvents ? '1' : '0') } catch { /* private window: works for this visit, just isn't remembered */ } }
  const favSet = useMemo(() => new Set(favourites), [favourites])
  const [placeId, setPlaceId] = useState<string | null>(() => places.find(p => p.slug === initialSlug)?.id ?? null)
  const [venue, setVenue] = useState<string | null>(null)
  // null = not touched yet: the panel starts open on a desktop and tucked away on a phone
  const [panel, setPanel] = useState<boolean | null>(null)
  const [asking, setAsking] = useState(false)
  const [tools, setTools] = useState(true) // search + filters; hide them for an uncluttered map

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return places.filter(p => (!cat || p.category === cat)
      && (!s || p.name.toLowerCase().includes(s) || (p.subcategory ?? '').toLowerCase().includes(s))
      && (!openOnly || isOpenNow(p.hours, now))
      && (!outside || p.extra.outdoor_seating)
      && (!favsOnly || favSet.has(p.id)))
  }, [places, cat, q, openOnly, outside, favsOnly, favSet, now])

  // One bobbing label per venue with something on in the next fortnight.
  const { pins, byVenue } = useMemo(() => {
    const byVenue = new Map<string, Event[]>()
    for (const e of events) if (new Date(e.starts_at).getTime() - now.getTime() < 14 * 86400000) byVenue.set(venueKey(e), [...(byVenue.get(venueKey(e)) ?? []), e])
    const today = dayKey(nowISO)
    const pins: MapPin[] = [...byVenue].map(([id, [first]]) => {
      const isToday = dayKey(first.starts_at) === today
      return { id, lng: first.lng, lat: first.lat, today: isToday, label: `${EVENT_KINDS[first.kind].emoji} ${isToday ? `Today ${formatTime(first.starts_at)}` : formatDay(first.starts_at)}` }
    })
    return { pins, byVenue }
  }, [events, now, nowISO])

  const place = places.find(p => p.id === placeId) ?? null
  const venueEvents = venue ? byVenue.get(venue) ?? events.filter(e => venueKey(e) === venue) : null
  const selected = useMemo(() => place ? { lng: place.lng, lat: place.lat, id: place.id } : venueEvents?.[0] ? { lng: venueEvents[0].lng, lat: venueEvents[0].lat } : null, [place, venueEvents])
  const matchToday = events.find(e => e.kind === 'football' && dayKey(e.starts_at) === dayKey(nowISO))
  const topRated = useMemo(() => places.filter(p => p.rating != null).sort((a, b) => b.rating! - a.rating! || b.review_count - a.review_count).slice(0, 3), [places])
  const suggestions = q.trim().length > 1 && !place ? shown.slice(0, 6) : []
  const filters = +!!cat + +openOnly + +outside + +favsOnly + +!!q.trim()

  const closeCard = () => { setPlaceId(null); setVenue(null) }
  const pickPlace = (id: string | null) => { setPlaceId(id); setVenue(null); setAsking(false); setPanel(p => p === null ? null : false) }
  const pickVenue = (id: string) => { setVenue(id); setPlaceId(null); setAsking(false); setPanel(false) }

  return (
    <div className="relative h-dvh overflow-hidden">
      <CartoonMap places={shown} pins={showEvents ? pins : NO_PINS} selected={selected} onPlace={pickPlace} onPin={pickVenue} />

      {/* search + filters — one tap hides the lot */}
      <div className="pointer-events-none absolute inset-x-0 top-[68px] z-10 px-2 sm:top-[76px] sm:px-3">
        <div className="mx-auto max-w-6xl">
          <div className="pointer-events-auto flex max-w-md gap-2">
            {tools && <div className="relative flex-1">
              <input value={q} onChange={e => { setQ(e.target.value); setPlaceId(null) }} placeholder={`Search ${places.length.toLocaleString()} places…`} aria-label="Search places" className="input shadow-pop-sm" />
              {suggestions.length > 0 && (
                <ul className="card absolute inset-x-0 top-full mt-1 overflow-hidden">
                  {suggestions.map(p => (
                    <li key={p.id}><button onClick={() => pickPlace(p.id)} className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-sun/40">
                      <span aria-hidden>{CATEGORIES[p.category].emoji}</span><b className="truncate">{p.name}</b><span className="muted truncate text-sm">{p.address}</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </div>}
            <button onClick={() => setTools(!tools)} aria-expanded={tools} className="btn btn-white shrink-0">{tools ? '✕ Hide' : `🔎 Search & filter${filters ? ` (${filters})` : ''}`}</button>
            {/* untouched, the panel is open on desktop and closed on phones (CSS decides); the first tap flips whichever that is */}
            <button onClick={() => setPanel(p => !(p ?? window.matchMedia('(min-width: 1024px)').matches))} aria-label="What's popping" title="What's popping" className={`btn shrink-0 ${panel ? 'btn-ink' : panel === null ? 'lg:bg-ink lg:text-white' : ''}`}>🔥</button>
          </div>
          {tools && <div className="pointer-events-auto mt-2 flex gap-1.5 overflow-x-auto pb-2 [scrollbar-width:none]">
            <button onClick={() => setOpenOnly(!openOnly)} aria-pressed={openOnly} className={`chip shadow-pop-sm ${openOnly ? 'bg-grass' : ''}`}>🟢 Open now</button>
            <button onClick={toggleEvents} aria-pressed={showEvents} title={showEvents ? 'Hide the event bubbles on the map' : 'Show the event bubbles on the map'} className={`chip shadow-pop-sm ${showEvents ? 'bg-sun' : 'opacity-70'}`}>{showEvents ? '🎟️ Events on' : '🎟️ Events off'}</button>
            {favourites.length > 0 && <button onClick={() => setFavsOnly(!favsOnly)} aria-pressed={favsOnly} className={`chip shadow-pop-sm ${favsOnly ? 'bg-bubble' : ''}`}>♥ My favourites</button>}
            <button onClick={() => setOutside(!outside)} aria-pressed={outside} className={`chip shadow-pop-sm ${outside ? 'bg-sun' : ''}`}>☀️ Sit outside</button>
            {CATEGORY_KEYS.map(k => (
              <button key={k} onClick={() => setCat(cat === k ? null : k)} aria-pressed={cat === k} className="chip shadow-pop-sm" style={cat === k ? { background: CATEGORIES[k].color } : undefined}>
                {CATEGORIES[k].emoji} {CATEGORIES[k].label}
              </button>
            ))}
          </div>}
          {matchToday && tools && (
            <Link href="/events" className="chip pointer-events-auto bg-tomato text-white shadow-pop-sm">⚽ Match day: {matchToday.title}, {formatTime(matchToday.starts_at)} — expect crowds</Link>
          )}
        </div>
      </div>

      {/* what's popping — toggled by the 🔥 button; sits above the zoom buttons, never over them */}
      <aside className={`card absolute right-2 bottom-60 z-20 w-80 max-w-[calc(100vw-1rem)] overflow-y-auto p-4 max-lg:max-h-[50dvh] lg:top-[176px] lg:right-3 ${panel ? '' : panel === null ? 'max-lg:hidden' : 'hidden'}`}>
        <button onClick={() => setPanel(false)} aria-label="Close what's popping" className="absolute top-1 right-1 grid size-11 place-items-center text-2xl font-bold">×</button>
        <h2 className="text-xl font-bold">🔥 What&apos;s popping</h2>
        <h3 className="muted mt-3 mb-1 text-xs font-bold tracking-wider uppercase">Coming up</h3>
        <ul className="space-y-1.5">
          {events.slice(0, 6).map(e => (
            <li key={e.id}><button onClick={() => pickVenue(venueKey(e))} className="flex w-full items-start gap-2 rounded-xl p-1.5 text-left hover:bg-sun/40">
              <span className="w-14 shrink-0 rounded-lg border-2 border-ink bg-white py-0.5 text-center text-xs leading-tight font-bold">{formatDay(e.starts_at).split(' ')[0]}<br />{formatDay(e.starts_at).split(' ').slice(1).join(' ')}</span>
              <span className="min-w-0"><b className="block truncate">{EVENT_KINDS[e.kind].emoji} {e.title}</b><span className="muted text-sm">{formatTime(e.starts_at)} · {e.venue_name}{e.price_pence != null && ` · ${formatPrice(e.price_pence)}`}</span></span>
            </button></li>
          ))}
        </ul>
        <Link href="/events" className="mt-1 inline-block py-1 text-sm font-bold underline">All events →</Link>
        {posts.length > 0 && <>
          <h3 className="muted mt-4 mb-1 text-xs font-bold tracking-wider uppercase">Fresh from the shops</h3>
          <ul className="space-y-1.5">
            {posts.map(p => (
              <li key={p.id}><Link href={`/place/${p.place!.slug}`} className="block rounded-xl p-1.5 hover:bg-sun/40">
                <b className="block truncate">{CATEGORIES[p.place!.category].emoji} {p.title}</b><span className="muted text-sm">{p.place!.name}</span>
              </Link></li>
            ))}
          </ul>
        </>}
        {topRated.length > 0 && <>
          <h3 className="muted mt-4 mb-1 text-xs font-bold tracking-wider uppercase">Neighbours rate</h3>
          <ul className="space-y-1.5">
            {topRated.map(p => (
              <li key={p.id}><button onClick={() => pickPlace(p.id)} className="block w-full rounded-xl p-1.5 text-left hover:bg-sun/40">
                <b className="block truncate">{CATEGORIES[p.category].emoji} {p.name}</b><Stars rating={p.rating} count={p.review_count} />
              </button></li>
            ))}
          </ul>
        </>}
      </aside>

      {/* the local guide: one button, bottom-left, out of the way of everything else */}
      {!asking && !place && !venueEvents && <button onClick={() => setAsking(true)} className="btn absolute bottom-8 left-2 z-10 sm:left-3">✨ Ask</button>}
      {asking && <AskPanel enabled={askEnabled} onClose={() => setAsking(false)} />}

      {/* selected place / venue */}
      {(place || venueEvents) && (
        <section className="card absolute inset-x-2 bottom-8 z-30 overflow-hidden sm:left-3 sm:w-96" aria-live="polite">
          <button onClick={closeCard} aria-label="Close" className="absolute top-1 right-1 z-10 grid size-11 place-items-center rounded-full bg-white/90 text-2xl leading-none font-bold">×</button>
          {place ? <>
            <Link href={`/place/${place.slug}`} aria-label={`Open ${place.name}`}><PlacePicture place={place} className="block h-28 w-full border-b-2 border-ink sm:h-32" /></Link>
            <div className="p-3 sm:p-4">
              <div className="mb-1.5 flex flex-wrap gap-1.5">
                <CategoryTag category={place.category} sub={place.subcategory} /><OpenBadge hours={place.hours} now={now} />
                {place.verified && <VerifiedTag />}{place.is_demo && <SampleTag />}{place.extra.outdoor_seating && <span className="tag bg-sun">☀️ Outdoor seats</span>}{favSet.has(place.id) && <span className="tag bg-bubble">♥ Favourite</span>}
              </div>
              <h2 className="text-2xl leading-tight font-bold">{place.name}</h2>
              {place.address && <p className="muted">{place.address}</p>}
              {place.extra.lines ? <div className="mt-1.5"><LinePills lines={place.extra.lines} /></div> : <div className="mt-1"><Stars rating={place.rating} count={place.review_count} /></div>}
              <div className="mt-3 flex gap-2">
                <Link href={`/place/${place.slug}`} className="btn flex-1">Open →</Link>
                <a href={directionsUrl(place)} target="_blank" rel="noreferrer" className="btn btn-white">🧭 Go</a>
                <a href={googleMapsUrl(place)} target="_blank" rel="noreferrer" className="btn btn-white text-sm whitespace-nowrap">Google Maps ↗</a>
              </div>
            </div>
          </> : <div className="p-4">
            <h2 className="pr-8 text-2xl leading-tight font-bold">🎟️ {venueEvents![0].venue_name}</h2>
            <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto">
              {venueEvents!.slice(0, 8).map(e => (
                <li key={e.id} className="flex items-start gap-2">
                  <span className="tag mt-0.5 shrink-0 bg-sun">{formatDay(e.starts_at)}</span>
                  <span><b>{EVENT_KINDS[e.kind].emoji} {e.title}</b> <span className="muted">{formatTime(e.starts_at)}</span> {e.price_pence != null && <span className="tag bg-grass">{formatPrice(e.price_pence)}</span>} {e.is_sample && <SampleTag />}</span>
                </li>
              ))}
            </ul>
            <Link href="/events" className="btn mt-3 w-full">See what&apos;s on →</Link>
          </div>}
        </section>
      )}
    </div>
  )
}
