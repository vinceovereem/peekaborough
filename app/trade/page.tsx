import Shell from '@/components/Shell'
import SubmitButton from '@/components/SubmitButton'
import { Empty } from '@/components/ui'
import { requireUser } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { LISTING_KINDS, type ListingKind } from '@/lib/config'
import { formatPrice, formatDay } from '@/lib/hours'
import { createListing, setListingStatus } from '@/app/actions'

export const metadata = { title: 'Trade' }
const COLOURS: Record<ListingKind, string> = { sell: 'bg-sun', free: 'bg-grass', swap: 'bg-sky', wanted: 'bg-bubble', service: 'bg-grape' }

export default async function TradePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [user, flash] = await Promise.all([requireUser(), searchParams])
  const listings = await repo.listings(user.id)
  return (
    <Shell title="Trade" intro="Sell it, swap it, lend it or give it away — to people who live round the corner." flash={flash}>
      <details className="card mb-8 p-4">
        <summary className="font-display cursor-pointer text-xl font-bold">➕ Post something</summary>
        <form action={createListing} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="_from" value="/trade" />
          <fieldset className="sm:col-span-2"><legend className="label">What kind?</legend>
            <div className="flex flex-wrap gap-1.5">{(Object.keys(LISTING_KINDS) as ListingKind[]).map((k, i) => (
              <label key={k} className="chip cursor-pointer has-checked:bg-sun"><input type="radio" name="kind" value={k} defaultChecked={i === 0} className="sr-only" />{LISTING_KINDS[k].emoji} {LISTING_KINDS[k].label}</label>
            ))}</div>
          </fieldset>
          <div><label className="label" htmlFor="title">Title</label><input id="title" name="title" required maxLength={100} className="input" /></div>
          <div><label className="label" htmlFor="price">Price in £ <span className="muted font-normal">(leave empty if none)</span></label><input id="price" name="price" inputMode="decimal" pattern="\d*\.?\d{0,2}" className="input" placeholder="15" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="description">Description</label><textarea id="description" name="description" required rows={3} maxLength={1000} className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="contact">How should people reach you?</label><input id="contact" name="contact" required maxLength={200} className="input" placeholder="Email, phone or “ask at the café”" /><p className="muted mt-1 text-sm">Only signed-in neighbours can see this.</p></div>
          <div><SubmitButton>Post listing</SubmitButton></div>
        </form>
      </details>

      {listings.length === 0 ? <Empty>Nothing listed yet. Got something gathering dust?</Empty> : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{listings.map(l => (
          <li key={l.id} className={`card flex flex-col p-4 ${l.status === 'closed' ? 'opacity-60' : ''}`}>
            <div className="mb-2 flex items-center justify-between gap-2"><span className={`tag ${COLOURS[l.kind]}`}>{LISTING_KINDS[l.kind].emoji} {LISTING_KINDS[l.kind].label}</span><b className="font-display text-lg">{l.kind === 'free' ? 'Free' : formatPrice(l.price_pence)}</b></div>
            <h2 className="text-lg leading-tight font-bold">{l.title}</h2>
            <p className="mt-1 flex-1 text-sm">{l.description}</p>
            <p className="mt-3 rounded-lg bg-paper px-2 py-1 text-sm"><b>Contact:</b> {l.contact}</p>
            <div className="muted mt-2 flex items-center justify-between text-xs"><span>{l.author} · {formatDay(l.created_at)}</span>
              {l.user_id === user.id && (
                <form action={setListingStatus}><input type="hidden" name="_from" value="/trade" /><input type="hidden" name="id" value={l.id} />
                  <button name="status" value={l.status === 'closed' ? 'active' : 'closed'} className="btn btn-white btn-sm">{l.status === 'closed' ? 'Reopen' : 'Mark as gone'}</button></form>
              )}
            </div>
          </li>
        ))}</ul>
      )}
    </Shell>
  )
}
