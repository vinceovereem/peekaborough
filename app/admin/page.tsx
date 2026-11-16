import Link from 'next/link'
import Shell from '@/components/Shell'
import { Stars, Empty, SampleTag } from '@/components/ui'
import { requireAdmin } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { EVENT_KINDS, LISTING_KINDS } from '@/lib/config'
import { formatDay, formatTime } from '@/lib/hours'
import SubmitButton from '@/components/SubmitButton'
import { decideClaim, moderate, syncNow, decideApplication, addAdmin, removeAdmin } from '@/app/actions'

export const metadata = { title: 'Back office' }

function Toggle({ table, id, on, onValue, offValue, labels }: { table: string; id: string; on: boolean; onValue: string; offValue: string; labels: [string, string] }) {
  return (
    <form action={moderate}><input type="hidden" name="_from" value="/admin" /><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} />
      <button name="status" value={on ? offValue : onValue} className={`btn btn-sm ${on ? 'btn-white' : 'bg-grass'}`}>{on ? labels[0] : labels[1]}</button></form>
  )
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const me = await requireAdmin()
  const [flash, data] = await Promise.all([searchParams, repo.adminData()])
  const pending = data.claims.filter(c => c.status === 'pending'), decided = data.claims.filter(c => c.status !== 'pending')
  const applying = data.applications.filter(a => a.status === 'pending'), applied = data.applications.filter(a => a.status !== 'pending')
  return (
    <Shell title="Back office" intro="Verify owners, approve events and keep the neighbourhood friendly." flash={flash}>
      <dl className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {([['Places', data.counts.places], ['Verified owners', data.counts.verified], ['Reviews', data.counts.reviews], ['Events live', data.counts.events], ['Listings live', data.counts.listings], ['Wishes', data.counts.wishes]] as const).map(([label, n]) => (
          <div key={label} className="card p-3"><dt className="muted text-xs font-bold uppercase">{label}</dt><dd className="font-display text-3xl font-bold">{n.toLocaleString()}</dd></div>
        ))}
      </dl>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-bold">🏪 Ownership claims <span className="tag bg-sun align-middle">{pending.length} waiting</span></h2>
        {pending.length === 0 ? <Empty>No claims waiting. Nice.</Empty> : (
          <ul className="space-y-4">{pending.map(c => (
            <li key={c.id} className="card p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="text-xl font-bold"><Link className="underline" href={`/place/${c.place?.slug}`}>{c.place?.name}</Link></h3>
                  <p className="muted text-sm">{c.place?.address}</p>
                  {c.place?.website && <p className="text-sm">Listed website: <a className="underline" href={c.place.website} target="_blank" rel="noreferrer nofollow">{c.place.website}</a></p>}
                  <dl className="mt-3 grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
                    <dt className="font-bold">Claimed by</dt><dd>{c.claimant?.name} · {c.role}</dd>
                    <dt className="font-bold">Signed in as</dt><dd>{c.claimant?.email ?? '—'}</dd>
                    <dt className="font-bold">Work email</dt><dd>{c.business_email}</dd>
                    <dt className="font-bold">Phone</dt><dd>{c.phone ?? '—'}</dd>
                    <dt className="font-bold">Sent</dt><dd>{formatDay(c.created_at)}</dd>
                  </dl>
                </div>
                <div>
                  <p className="label">How to verify</p><p className="rounded-xl bg-paper p-3 text-sm whitespace-pre-line">{c.evidence}</p>
                  <ul className="muted mt-2 list-inside list-disc text-xs"><li>Does the work email match the listed website&apos;s domain?</li><li>Call the listed number and ask for them by name.</li><li>If unsure, pop in before approving.</li></ul>
                </div>
              </div>
              <form action={decideClaim} className="mt-4 flex flex-wrap items-end gap-2 border-t-2 border-dashed border-ink/20 pt-4">
                <input type="hidden" name="_from" value="/admin" /><input type="hidden" name="id" value={c.id} />
                <div className="min-w-48 flex-1"><label className="label" htmlFor={`note-${c.id}`}>Note <span className="muted font-normal">(how you verified, or why not — the claimant sees this)</span></label><input id={`note-${c.id}`} name="note" maxLength={500} className="input" /></div>
                <button name="decision" value="approve" className="btn bg-grass">✓ Approve</button><button name="decision" value="reject" className="btn btn-white">✕ Reject</button>
              </form>
            </li>
          ))}</ul>
        )}
        {decided.length > 0 && <details className="mt-3"><summary className="cursor-pointer font-bold">Past decisions ({decided.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">{decided.map(c => <li key={c.id}><span className={`tag ${c.status === 'approved' ? 'bg-grass' : 'bg-ink/10'}`}>{c.status}</span> {c.place?.name} — {c.claimant?.name}{c.admin_note && <span className="muted"> · {c.admin_note}</span>}</li>)}</ul>
        </details>}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-bold">🛠️ Admin applications <span className="tag bg-sun align-middle">{applying.length} waiting</span></h2>
        {applying.length === 0 ? <Empty>Nobody is waiting to become an admin.</Empty> : (
          <ul className="space-y-4">{applying.map(a => (
            <li key={a.id} className="card p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
                  <dt className="font-bold">Name</dt><dd>{a.full_name}</dd>
                  <dt className="font-bold">Email</dt><dd>{a.email}</dd>
                  <dt className="font-bold">Phone</dt><dd>{a.phone}</dd>
                  <dt className="font-bold">Address</dt><dd>{a.address}</dd>
                  <dt className="font-bold">Lived here</dt><dd>{a.years_in_area} {a.years_in_area === 1 ? 'year' : 'years'}</dd>
                  <dt className="font-bold">Work</dt><dd>{a.occupation}</dd>
                  <dt className="font-bold">Account</dt><dd>{a.account?.name} · {a.account?.email ?? '—'}</dd>
                  <dt className="font-bold">Sent</dt><dd>{formatDay(a.created_at)}</dd>
                </dl>
                <div><p className="label">Favourite thing about the area</p><p className="rounded-xl bg-paper p-3 text-sm whitespace-pre-line">{a.favourite_thing}</p>
                  <p className="muted mt-2 text-xs">They are asked to book a call with you after applying. Approve only once you have spoken.</p></div>
              </div>
              <form action={decideApplication} className="mt-4 flex flex-wrap items-end gap-2 border-t-2 border-dashed border-ink/20 pt-4">
                <input type="hidden" name="_from" value="/admin" /><input type="hidden" name="id" value={a.id} />
                <div className="min-w-48 flex-1"><label className="label" htmlFor={`app-note-${a.id}`}>Note <span className="muted font-normal">(the applicant sees this if declined)</span></label><input id={`app-note-${a.id}`} name="note" maxLength={500} className="input" /></div>
                <button name="decision" value="approve" className="btn bg-grass">✓ Make admin</button><button name="decision" value="reject" className="btn btn-white">✕ Decline</button>
              </form>
            </li>
          ))}</ul>
        )}
        {applied.length > 0 && <details className="mt-3"><summary className="cursor-pointer font-bold">Past applications ({applied.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">{applied.map(a => <li key={a.id}><span className={`tag ${a.status === 'approved' ? 'bg-grass' : 'bg-ink/10'}`}>{a.status}</span> {a.full_name} · {formatDay(a.created_at)}{a.admin_note && <span className="muted"> · {a.admin_note}</span>}</li>)}</ul>
        </details>}
      </section>

      <section className="card mb-10 p-4">
        <h2 className="text-xl font-bold">👥 Admins</h2>
        <ul className="my-3 divide-y-2 divide-dashed divide-ink/15">{data.admins.map(a => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2"><b>{a.name}</b><span className="muted text-sm">{a.email ?? ''}</span>
            {a.id === me.id ? <span className="tag ml-auto bg-paper">you</span> : <form action={removeAdmin} className="ml-auto"><input type="hidden" name="_from" value="/admin" /><input type="hidden" name="id" value={a.id} /><button className="btn btn-white btn-sm">Remove admin</button></form>}</li>
        ))}</ul>
        <form action={addAdmin} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="_from" value="/admin" />
          <div className="min-w-56 flex-1"><label className="label" htmlFor="admin-email">Make someone an admin</label><input id="admin-email" name="email" type="email" required className="input" placeholder="the email they sign in with" /></div>
          <button className="btn">Add admin</button>
        </form>
        <p className="muted mt-2 text-sm">They need to have signed in to the site at least once. Admins can approve owners and events, hide content, and add or remove other admins.</p>
      </section>

      <section className="card mb-10 flex flex-wrap items-center gap-3 p-4">
        <div className="min-w-60 flex-1"><h2 className="text-xl font-bold">🔌 Automatic event sources</h2><p className="muted text-sm">Skiddle and Ticketmaster listings inside the borough, and the programmes of Park Theatre, King&apos;s Head Theatre and Little Angel Theatre, are fetched every morning. Residents and owners can still add events by hand.</p></div>
        <form action={syncNow}><SubmitButton className="btn btn-white" busy="Syncing… up to a minute">Sync now</SubmitButton></form>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-2xl font-bold">🎟️ Suggested events <span className="tag bg-sun align-middle">{data.pendingEvents.length} waiting</span></h2>
        {data.pendingEvents.length === 0 ? <Empty>Nothing to approve.</Empty> : (
          <ul className="space-y-2">{data.pendingEvents.map(e => (
            <li key={e.id} className="card flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1"><b>{EVENT_KINDS[e.kind].emoji} {e.title}</b> {e.is_sample && <SampleTag />}<p className="muted text-sm">{formatDay(e.starts_at)} {formatTime(e.starts_at)} · {e.venue_name}{e.description && ` — ${e.description}`}</p></div>
              <form action={moderate} className="flex gap-2"><input type="hidden" name="_from" value="/admin" /><input type="hidden" name="table" value="events" /><input type="hidden" name="id" value={e.id} />
                <button name="status" value="published" className="btn btn-sm bg-grass">Publish</button><button name="status" value="rejected" className="btn btn-white btn-sm">Reject</button></form>
            </li>
          ))}</ul>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-3">
        <section><h2 className="mb-3 text-xl font-bold">⭐ Latest reviews</h2>
          <ul className="space-y-2">{data.reviews.map(r => (
            <li key={r.id} className={`card p-3 text-sm ${r.status === 'hidden' ? 'opacity-50' : ''}`}><div className="flex items-start justify-between gap-2"><span><b>{r.author}</b> on <Link className="underline" href={`/place/${r.place?.slug}`}>{r.place?.name}</Link><br /><Stars rating={r.rating} /></span>
              <Toggle table="reviews" id={r.id} on={r.status === 'visible'} onValue="visible" offValue="hidden" labels={['Hide', 'Restore']} /></div>{r.comment && <p className="mt-1">{r.comment}</p>}</li>
          ))}</ul>
        </section>
        <section><h2 className="mb-3 text-xl font-bold">🔁 Latest listings</h2>
          <ul className="space-y-2">{data.listings.map(l => (
            <li key={l.id} className={`card p-3 text-sm ${l.status === 'hidden' ? 'opacity-50' : ''}`}><div className="flex items-start justify-between gap-2"><span><b>{LISTING_KINDS[l.kind].emoji} {l.title}</b><br /><span className="muted">{l.author} · {l.status}</span></span>
              {l.status !== 'closed' && <Toggle table="listings" id={l.id} on={l.status === 'active'} onValue="active" offValue="hidden" labels={['Hide', 'Restore']} />}</div><p className="mt-1">{l.description}</p></li>
          ))}</ul>
        </section>
        <section><h2 className="mb-3 text-xl font-bold">💡 Latest wishes</h2>
          <ul className="space-y-2">{data.wishes.map(w => (
            <li key={w.id} className={`card p-3 text-sm ${w.status === 'hidden' ? 'opacity-50' : ''}`}><div className="flex items-start justify-between gap-2"><span><b>{w.title}</b><br /><span className="muted">{w.author} · ▲ {w.ups} ▼ {w.downs}</span></span>
              <Toggle table="wishes" id={w.id} on={w.status === 'visible'} onValue="visible" offValue="hidden" labels={['Hide', 'Restore']} /></div></li>
          ))}</ul>
        </section>
      </div>
    </Shell>
  )
}
