import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import PlacePicture from '@/components/PlacePicture'
import SubmitButton from '@/components/SubmitButton'
import { Stars, CategoryTag, OpenBadge, VerifiedTag, SampleTag, LinePills, Flash, Empty } from '@/components/ui'
import { requireUser } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { googlePlace } from '@/lib/google'
import { googleMapsUrl, directionsUrl } from '@/lib/links'
import { lineStatus } from '@/lib/tfl'
import { sunTimes } from '@/lib/sun'
import { EVENT_KINDS } from '@/lib/config'
import { DAY_KEYS, DAY_LABELS, londonNow, formatPrice, formatDay, formatTime } from '@/lib/hours'
import { addReview, moderate } from '@/app/actions'

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ ok?: string; error?: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const place = await repo.place((await params).slug)
  return { title: place?.name ?? 'Not found' }
}

// Google asks for its name in this exact style next to anything that came from Google Maps.
const GoogleMapsCredit = () => <span style={{ fontFamily: 'Roboto, Arial, sans-serif', fontWeight: 400, color: '#5e5e5e', whiteSpace: 'nowrap' }}>Google Maps</span>

export default async function PlacePage({ params, searchParams }: Props) {
  const [user, { slug }, flash] = await Promise.all([requireUser(), params, searchParams])
  const place = await repo.place(slug)
  if (!place || (place.status === 'hidden' && !user.is_admin)) notFound()
  const lines = place.extra.lines
  const [menu, posts, events, reviews, isOwner, google, status] = await Promise.all([
    repo.menu(place.id), repo.posts(place.id), repo.events(place.id), repo.reviews(place.id, user.id), repo.isOwner(user.id, place.id),
    googlePlace(place), lines ? lineStatus(lines.map(l => l.id)) : undefined,
  ])
  const now = new Date(), today = londonNow(now).day
  const mine = reviews.find(r => r.user_id === user.id)
  const sections = [...new Set(menu.map(m => m.section))]
  const host = place.website?.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '')
  const linked = { ...place, google_place_id: google?.id ?? place.google_place_id }
  const mapsUrl = google?.googleMapsUri ?? googleMapsUrl(linked)
  const googleHours = google?.regularOpeningHours?.weekdayDescriptions
  const googlePhoto = !place.cover_url ? google?.photoUri : undefined
  const sun = place.extra.outdoor_seating ? sunTimes(now, place.lat, place.lng) : null

  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-3 pt-2 pb-16 sm:px-4">
        <Flash {...flash} />
        <header className="card overflow-hidden">
          <div className="relative">
            <PlacePicture place={place} googlePhoto={googlePhoto} className="block h-44 w-full sm:h-72" />
            {/* credit whoever the picture belongs to */}
            {googlePhoto ? <p className="absolute right-2 bottom-2 rounded-md bg-white/90 px-2 py-0.5 text-xs">Photo: {google!.photos![0].authorAttributions?.[0] ? <a className="underline" href={google!.photos![0].authorAttributions[0].uri} target="_blank" rel="noreferrer">{google!.photos![0].authorAttributions[0].displayName}</a> : 'a contributor'} · <GoogleMapsCredit /></p>
              : !place.cover_url && place.extra.photo && <a href={place.extra.photo.credit_url} target="_blank" rel="noreferrer" className="absolute right-2 bottom-2 rounded-md bg-white/90 px-2 py-0.5 text-xs underline">Photo: Wikimedia Commons (author &amp; licence)</a>}
          </div>
          <div className="border-t-2 border-ink p-4 sm:p-6">
            <div className="mb-2 flex flex-wrap gap-1.5">
              <CategoryTag category={place.category} sub={place.subcategory} />
              {place.hours ? <OpenBadge hours={place.hours} now={now} /> : google?.currentOpeningHours?.openNow != null && <span className={`tag ${google.currentOpeningHours.openNow ? 'bg-grass' : 'bg-ink/10'}`}>{google.currentOpeningHours.openNow ? 'Open now' : 'Closed now'}</span>}
              {place.verified && <VerifiedTag />}{place.is_demo && <SampleTag />}{place.extra.outdoor_seating && <span className="tag bg-sun">☀️ Outdoor seats</span>}
              {place.status === 'hidden' && <span className="tag bg-tomato text-white">Hidden from the map</span>}
            </div>
            <h1 className="text-3xl leading-tight font-bold sm:text-5xl">{place.name}</h1>
            {place.address && <p className="muted mt-1 text-lg">{place.address}</p>}
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <Stars rating={place.rating} count={place.review_count} />
              {google?.rating != null && <a href={mapsUrl} target="_blank" rel="noreferrer" className="text-sm" title={google.displayName ? `Google Maps listing: ${google.displayName.text}` : undefined}><b className="text-amber-500">★</b> <b>{google.rating.toFixed(1)}</b> <span className="muted">({google.userRatingCount?.toLocaleString()}) on</span> <GoogleMapsCredit /></a>}
            </div>
            {lines && <div className="mt-3"><LinePills lines={lines} status={status} /></div>}
            <div className="mt-4 flex flex-wrap gap-2">
              {place.booking_url && <a href={place.booking_url} target="_blank" rel="noreferrer nofollow" className="btn bg-grass">📅 Book</a>}
              <Link href={`/?place=${place.slug}`} className="btn">🗺️ Show on map</Link>
              <a href={directionsUrl(linked)} target="_blank" rel="noreferrer" className="btn btn-white">🧭 Directions</a>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn-white">📍 Open in Google Maps</a>
              {place.website && <a href={place.website} target="_blank" rel="noreferrer nofollow" className="btn btn-white">{place.category === 'culture' ? "🎭 What's on & tickets" : `🌐 ${host}`}</a>}
              {place.phone && <a href={`tel:${place.phone.replace(/[^+\d]/g, '')}`} className="btn btn-white">📞 {place.phone}</a>}
              {isOwner && <Link href={`/business/${place.id}`} className="btn btn-ink">✏️ Manage this page</Link>}
            </div>
          </div>
        </header>

        <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px]">
          <div className="space-y-8">
            {place.description && <section><h2 className="mb-2 text-2xl font-bold">About</h2><p className="text-lg whitespace-pre-line">{place.description}</p></section>}

            {lines && <section>
              <h2 className="mb-2 text-2xl font-bold">🚇 Trains from here</h2>
              <ul className="card divide-y-2 divide-dashed divide-ink/15 px-4">{lines.map(l => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 py-2.5"><LinePills lines={[l]} /><span className={`ml-auto font-bold ${status?.[l.id] && status[l.id] !== 'Good Service' ? 'text-tomato' : ''}`}>{status?.[l.id] ?? 'Status unavailable'}</span></li>
              ))}</ul>
              <p className="muted mt-2 text-sm">Live from TfL, refreshed every couple of minutes. <a className="underline" href="https://tfl.gov.uk/tube-dlr-overground/status/" target="_blank" rel="noreferrer">Full status &amp; planned works ↗</a></p>
            </section>}

            {posts.length > 0 && <section>
              <h2 className="mb-2 text-2xl font-bold">📣 What&apos;s new</h2>
              <ul className="space-y-3">{posts.map(p => (
                <li key={p.id} className="card bg-sun/30 p-4"><p className="muted text-xs font-bold">{formatDay(p.created_at)}</p><h3 className="text-lg font-bold">{p.title}</h3><p className="whitespace-pre-line">{p.body}</p></li>
              ))}</ul>
            </section>}

            {events.length > 0 && <section>
              <h2 className="mb-2 text-2xl font-bold">🎟️ Coming up here</h2>
              <ul className="space-y-2">{events.slice(0, 8).map(e => (
                <li key={e.id} className="card flex items-start gap-3 p-3">
                  <span className="tag shrink-0 bg-sun">{formatDay(e.starts_at)} · {formatTime(e.starts_at)}</span>
                  <span><b>{EVENT_KINDS[e.kind].emoji} {e.title}</b> {e.price_pence != null && <span className="tag bg-grass">{formatPrice(e.price_pence)}</span>} {e.is_sample && <SampleTag />}{e.description && <span className="muted block text-sm">{e.description}</span>}</span>
                </li>
              ))}</ul>
              <Link href="/events" className="mt-2 inline-block text-sm font-bold underline">Add these to your calendar →</Link>
            </section>}

            {menu.length > 0 && <section>
              <h2 className="mb-2 text-2xl font-bold">🍽️ Menu &amp; prices</h2>
              <div className="card divide-y-2 divide-dashed divide-ink/20 p-4">
                {sections.map(s => (
                  <div key={s} className="py-3 first:pt-0 last:pb-0">
                    <h3 className="mb-1 text-lg font-bold">{s}</h3>
                    <ul className="space-y-1">{menu.filter(m => m.section === s).map(m => (
                      <li key={m.id} className="flex items-baseline gap-2"><span><b>{m.name}</b>{m.description && <span className="muted"> — {m.description}</span>}</span><span className="flex-1 border-b-2 border-dotted border-ink/30" /><b>{formatPrice(m.price_pence)}</b></li>
                    ))}</ul>
                  </div>
                ))}
              </div>
            </section>}

            <section id="reviews">
              <h2 className="mb-2 text-2xl font-bold">⭐ What neighbours say</h2>
              <form action={addReview} className="card mb-4 space-y-3 p-4">
                <input type="hidden" name="place_id" value={place.id} /><input type="hidden" name="slug" value={place.slug} /><input type="hidden" name="_from" value={`/place/${place.slug}`} />
                <fieldset>
                  <legend className="label">{mine ? 'Update your rating' : 'Your rating'}</legend>
                  <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map(n => (
                    <label key={n} className="chip cursor-pointer has-checked:bg-sun"><input type="radio" name="rating" value={n} required defaultChecked={mine?.rating === n} className="sr-only" />{n} ★</label>
                  ))}</div>
                </fieldset>
                <div><label className="label" htmlFor="comment">Anything to add? <span className="muted font-normal">(optional)</span></label>
                  <textarea id="comment" name="comment" rows={2} maxLength={1000} defaultValue={mine?.comment ?? ''} className="input" placeholder="What should a neighbour know?" /></div>
                <SubmitButton>{mine ? 'Update review' : 'Post review'}</SubmitButton>
              </form>
              {reviews.length === 0 ? <Empty>No neighbour reviews yet — be the first.</Empty> : (
                <ul className="space-y-3">{reviews.map(r => (
                  <li key={r.id} className="card p-4">
                    <div className="flex flex-wrap items-center gap-2"><b>{r.author}</b><Stars rating={r.rating} /><span className="muted text-sm">{formatDay(r.created_at)}</span>
                      {r.status === 'hidden' && <span className="tag bg-ink/10">Hidden by a moderator</span>}
                      {user.is_admin && r.status === 'visible' && <form action={moderate} className="ml-auto"><input type="hidden" name="table" value="reviews" /><input type="hidden" name="id" value={r.id} /><button name="status" value="hidden" className="btn btn-white btn-sm">Hide</button></form>}
                    </div>
                    {r.comment && <p className="mt-1">{r.comment}</p>}
                  </li>
                ))}</ul>
              )}
            </section>

            {google?.reviews?.length ? <section>
              <h2 className="mb-1 text-2xl font-bold">Reviews from <GoogleMapsCredit /></h2>
              <p className="muted mb-3 text-sm">The most relevant reviews, as chosen by Google. Google doesn&apos;t verify reviews but removes fake ones it finds.</p>
              <ul className="space-y-3">{google.reviews.slice(0, 5).map((r, i) => (
                <li key={i} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Google-hosted avatar, shown as Google requires */}
                    {r.authorAttribution?.photoUri && <img src={r.authorAttribution.photoUri} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" />}
                    {r.authorAttribution && <a href={r.authorAttribution.uri} target="_blank" rel="noreferrer" className="font-bold underline">{r.authorAttribution.displayName}</a>}
                    <Stars rating={r.rating} /><span className="muted text-sm">{r.relativePublishTimeDescription}</span>
                  </div>
                  {r.text?.text && <p className="mt-1">{r.text.text}</p>}
                </li>
              ))}</ul>
              <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block font-bold underline">Read all {google.userRatingCount?.toLocaleString()} reviews on Google Maps ↗</a>
            </section> : null}
          </div>

          <aside className="space-y-4">
            <section className="card p-4">
              <h2 className="mb-2 text-xl font-bold">🕒 Opening hours</h2>
              {place.hours ? (
                <table className="w-full text-sm"><tbody>{DAY_KEYS.map((d, i) => (
                  <tr key={d} className={i === today ? 'bg-sun/50 font-bold' : ''}><th scope="row" className="py-0.5 pl-1 text-left font-[inherit]">{DAY_LABELS[d]}</th><td className="pr-1 text-right">{place.hours![d] ? `${place.hours![d]!.open} – ${place.hours![d]!.close}` : 'Closed'}</td></tr>
                ))}</tbody></table>
              ) : googleHours?.length ? <>
                <ul className="space-y-0.5 text-sm">{googleHours.map((line, i) => <li key={line} className={i === today ? 'bg-sun/50 px-1 font-bold' : 'px-1'}>{line}</li>)}</ul>
                <p className="mt-2 text-xs">Hours from <GoogleMapsCredit /></p>
              </> : <>
                <p className="muted">{place.hours_note ?? 'We don’t have these yet.'}</p>
                {place.category !== 'green' && <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn-white btn-sm mt-2">Check hours on Google Maps ↗</a>}
              </>}
              {place.hours && place.hours_note && <p className="muted mt-2 text-sm">{place.hours_note}</p>}
            </section>

            {sun && <section className="card bg-sun/40 p-4">
              <h2 className="text-xl font-bold">☀️ Sitting outside?</h2>
              <p className="mt-1 text-sm">{now > sun.sunrise && now < sun.sunset ? <>The sun is up until <b>{formatTime(sun.sunset.toISOString())}</b>.</> : <>The sun is down — back at <b>{formatTime((now < sun.sunrise ? sun.sunrise : sunTimes(new Date(now.getTime() + 86400000), place.lat, place.lng).sunrise).toISOString())}</b>.</>} This place has outdoor seating; whether your table catches it depends on the buildings around.</p>
            </section>}

            {!place.verified && !isOwner && (
              <section className="card bg-sky/40 p-4">
                <h2 className="text-xl font-bold">🏪 Is this your place?</h2>
                <p className="my-2 text-sm">Claim it for free to add your hours, menu, prices, booking link, news and events. We check every owner by hand.</p>
                <Link href={`/business/claim/${place.slug}`} className="btn w-full">Claim this page</Link>
              </section>
            )}
            {place.osm_id && <p className="muted text-xs">Basic details from <a className="underline" href={`https://www.openstreetmap.org/${place.osm_id}`} target="_blank" rel="noreferrer">OpenStreetMap</a> contributors{place.verified ? ', updated by the owner' : ''}. Spot a mistake? The owner can fix it by claiming the page.</p>}
            {user.is_admin && (
              <form action={moderate} className="card p-4"><input type="hidden" name="table" value="places" /><input type="hidden" name="id" value={place.id} />
                <p className="label">Admin</p>
                <button name="status" value={place.status === 'hidden' ? 'published' : 'hidden'} className="btn btn-white btn-sm">{place.status === 'hidden' ? 'Put back on the map' : 'Hide from the map'}</button>
              </form>
            )}
          </aside>
        </div>
      </main>
    </>
  )
}
