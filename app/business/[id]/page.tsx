import Link from 'next/link'
import { notFound } from 'next/navigation'
import Shell from '@/components/Shell'
import SubmitButton from '@/components/SubmitButton'
import { Empty } from '@/components/ui'
import { requireUser } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { DEMO, EVENT_KINDS, type EventKind } from '@/lib/config'
import { DAY_KEYS, DAY_LABELS, formatPrice, formatDay, formatTime } from '@/lib/hours'
import { savePlace, addMenuItem, addPost, addPlaceEvent, removeFromPlace } from '@/app/actions'

export const metadata = { title: 'Manage your page' }

export default async function ManagePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [user, { id }, flash] = await Promise.all([requireUser(), params, searchParams])
  const place = /^[0-9a-f-]{36}$/.test(id) ? await repo.placeById(id) : null
  if (!place || !(await repo.isOwner(user.id, place.id))) notFound() // owners only — the actions and the database check again
  const [menu, posts, events] = await Promise.all([repo.menu(place.id), repo.posts(place.id), repo.events(place.id)])
  const from = `/business/${place.id}`
  const hidden = <><input type="hidden" name="place_id" value={place.id} /><input type="hidden" name="_from" value={from} /></>
  const remove = (what: 'menu' | 'post' | 'event', rowId: string, label: string) => (
    <form action={removeFromPlace}>{hidden}<input type="hidden" name="what" value={what} /><input type="hidden" name="id" value={rowId} /><button className="btn btn-white btn-sm" aria-label={`Remove ${label}`}>Remove</button></form>
  )

  return (
    <Shell title={place.name} intro="This is your page. Changes go live straight away." flash={flash}>
      <p className="-mt-3 mb-6 flex flex-wrap gap-x-5 gap-y-1"><Link href="/business" className="font-bold underline">← My businesses</Link><Link href={`/place/${place.slug}`} className="font-bold underline">See it as neighbours do →</Link></p>
      <div className="grid gap-6 lg:grid-cols-2">
        <form action={savePlace} id="basics" className="card grid scroll-mt-24 content-start gap-3 p-5">
          {hidden}
          <h2 className="text-2xl font-bold">The basics</h2>
          <div><label className="label" htmlFor="name">Name</label><input id="name" name="name" required maxLength={120} defaultValue={place.name} className="input" /></div>
          <div><label className="label" htmlFor="subcategory">What you are, in a few words</label><input id="subcategory" name="subcategory" maxLength={60} defaultValue={place.subcategory ?? ''} className="input" placeholder="Neapolitan pizza" /></div>
          <div><label className="label" htmlFor="description">About</label><textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={place.description ?? ''} className="input" /></div>
          <div><label className="label" htmlFor="address">Address</label><input id="address" name="address" maxLength={200} defaultValue={place.address ?? ''} className="input" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label" htmlFor="phone">Phone</label><input id="phone" name="phone" type="tel" maxLength={40} defaultValue={place.phone ?? ''} className="input" /></div>
            <div><label className="label" htmlFor="website">Website</label><input id="website" name="website" type="url" defaultValue={place.website ?? ''} className="input" placeholder="https://" /></div>
          </div>
          <div><label className="label" htmlFor="booking_url">Booking link <span className="muted font-normal">(optional)</span></label><input id="booking_url" name="booking_url" type="url" defaultValue={place.booking_url ?? ''} className="input" placeholder="https://" /><p className="muted mt-1 text-sm">Your Fresha, Treatwell, OpenTable, Resy or own booking page. Adds a green “Book” button.</p></div>
          <div><label className="label" htmlFor="cover">Cover photo</label><input id="cover" name="cover" type="file" accept="image/jpeg,image/png,image/webp" className="input" />
            <p className="muted mt-1 text-sm">{DEMO ? 'Uploads switch on once the database is connected.' : 'JPG, PNG or WebP, up to 4 MB. Landscape works best.'}</p></div>
          <fieldset>
            <legend className="label">Opening hours</legend>
            <div className="space-y-1.5">{DAY_KEYS.map(d => (
              <div key={d} className="grid grid-cols-[5.5rem_1fr_1fr_auto] items-center gap-2 text-sm">
                <span className="font-bold">{DAY_LABELS[d]}</span>
                <input type="time" name={`${d}_open`} defaultValue={place.hours?.[d]?.open ?? ''} aria-label={`${DAY_LABELS[d]} opens`} className="input !py-1" />
                <input type="time" name={`${d}_close`} defaultValue={place.hours?.[d]?.close === '24:00' ? '23:59' : place.hours?.[d]?.close ?? ''} aria-label={`${DAY_LABELS[d]} closes`} className="input !py-1" />
                <label className="flex items-center gap-1"><input type="checkbox" name={`${d}_closed`} defaultChecked={!!place.hours && !place.hours[d]} /> Closed</label>
              </div>
            ))}</div>
            <p className="muted mt-1 text-sm">Open past midnight? Just put the real closing time, e.g. 12:00 to 01:00.</p>
          </fieldset>
          <div><label className="label" htmlFor="hours_note">Hours note <span className="muted font-normal">(optional)</span></label><input id="hours_note" name="hours_note" maxLength={300} defaultValue={place.hours_note ?? ''} className="input" placeholder="Kitchen closes at 9. Open late on match days." /></div>
          <div><SubmitButton>Save changes</SubmitButton></div>
        </form>

        <div className="space-y-6">
          <section id="news" className="card scroll-mt-24 p-5">
            <h2 className="mb-2 text-2xl font-bold">📣 Post news</h2>
            <form action={addPost} className="grid gap-2">
              {hidden}<input name="title" required maxLength={120} className="input" placeholder="Headline — new menu, new hours, new puppy…" aria-label="Headline" />
              <textarea name="body" required rows={2} maxLength={2000} className="input" placeholder="Tell the neighbourhood" aria-label="News" />
              <div><SubmitButton>Post</SubmitButton></div>
            </form>
            <ul className="mt-3 space-y-2">{posts.map(p => (
              <li key={p.id} className="flex items-center gap-2 rounded-xl bg-paper p-2"><span className="min-w-0 flex-1"><b className="block truncate">{p.title}</b><span className="muted text-xs">{formatDay(p.created_at)}</span></span>{remove('post', p.id, p.title)}</li>
            ))}</ul>
          </section>

          <section id="events" className="card scroll-mt-24 p-5">
            <h2 className="mb-2 text-2xl font-bold">🎟️ Events</h2>
            <form action={addPlaceEvent} className="grid gap-2 sm:grid-cols-2">
              {hidden}<input name="title" required maxLength={120} className="input sm:col-span-2" placeholder="Quiz night, tasting, live music…" aria-label="Event title" />
              <select name="kind" className="input" aria-label="Type">{(Object.keys(EVENT_KINDS) as EventKind[]).filter(k => k !== 'football').map(k => <option key={k} value={k}>{EVENT_KINDS[k].label}</option>)}</select>
              <div className="flex gap-2"><input name="date" type="date" required className="input" aria-label="Date" /><input name="time" type="time" required className="input" aria-label="Start time" /></div>
              <input name="description" maxLength={2000} className="input" placeholder="Details (optional)" aria-label="Details" />
              <input name="price" inputMode="decimal" pattern="\d*\.?\d{0,2}" className="input" placeholder="Price £ (0 = free)" aria-label="Price in pounds, 0 for free" />
              <div><SubmitButton>Publish event</SubmitButton></div>
            </form>
            <ul className="mt-3 space-y-2">{events.map(e => (
              <li key={e.id} className="flex items-center gap-2 rounded-xl bg-paper p-2"><span className="min-w-0 flex-1"><b className="block truncate">{e.title}</b><span className="muted text-xs">{formatDay(e.starts_at)} · {formatTime(e.starts_at)}</span></span>{remove('event', e.id, e.title)}</li>
            ))}</ul>
          </section>
        </div>

        <section id="menu" className="card scroll-mt-24 p-5 lg:col-span-2">
          <h2 className="mb-2 text-2xl font-bold">🍽️ Menu &amp; prices</h2>
          <form action={addMenuItem} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_2fr_6rem_auto] sm:items-end">
            {hidden}
            <div><label className="label" htmlFor="section">Section</label><input id="section" name="section" required maxLength={60} className="input" placeholder="Mains" list="sections" /><datalist id="sections">{[...new Set(menu.map(m => m.section))].map(s => <option key={s} value={s} />)}</datalist></div>
            <div><label className="label" htmlFor="item">Item</label><input id="item" name="name" required maxLength={100} className="input" /></div>
            <div><label className="label" htmlFor="item-desc">Description</label><input id="item-desc" name="description" maxLength={300} className="input" /></div>
            <div><label className="label" htmlFor="item-price">Price £</label><input id="item-price" name="price" inputMode="decimal" pattern="\d*\.?\d{0,2}" className="input" /></div>
            <SubmitButton>Add</SubmitButton>
          </form>
          {menu.length === 0 ? <div className="mt-4"><Empty>No menu yet. Services and shops can use this as a price list too.</Empty></div> : (
            <ul className="mt-4 divide-y-2 divide-dashed divide-ink/15">{menu.map(m => (
              <li key={m.id} className="flex items-center gap-3 py-2"><span className="tag bg-paper">{m.section}</span><span className="min-w-0 flex-1"><b>{m.name}</b>{m.description && <span className="muted"> — {m.description}</span>}</span><b>{formatPrice(m.price_pence)}</b>{remove('menu', m.id, m.name)}</li>
            ))}</ul>
          )}
        </section>
      </div>
    </Shell>
  )
}
