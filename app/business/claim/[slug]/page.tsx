import { notFound, redirect } from 'next/navigation'
import Shell from '@/components/Shell'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { submitClaim } from '@/app/actions'

export const metadata = { title: 'Claim your page' }

export default async function ClaimPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [user, { slug }, flash] = await Promise.all([requireUser(), params, searchParams])
  const place = await repo.place(slug)
  if (!place) notFound()
  if (await repo.isOwner(user.id, place.id)) redirect(`/business/${place.id}`)
  return (
    <Shell title={`Claim ${place.name}`} intro="Tell us who you are and how we can check. Nothing changes on the page until a real person has verified you." flash={flash}>
      <form action={submitClaim} className="card grid max-w-2xl gap-4 p-5">
        <input type="hidden" name="place_id" value={place.id} /><input type="hidden" name="_from" value={`/business/claim/${place.slug}`} />
        <p className="rounded-xl bg-paper p-3"><b>{place.name}</b><br /><span className="muted">{place.address ?? 'Islington'}</span></p>
        <div><label className="label" htmlFor="role">Your role</label><input id="role" name="role" required maxLength={60} className="input" placeholder="Owner, manager, director…" /></div>
        <div><label className="label" htmlFor="business_email">Work email</label><input id="business_email" name="business_email" type="email" required className="input" defaultValue={user.email ?? ''} /><p className="muted mt-1 text-sm">An address at the business&apos;s own domain is the quickest to verify.</p></div>
        <div><label className="label" htmlFor="phone">Business phone <span className="muted font-normal">(optional)</span></label><input id="phone" name="phone" type="tel" maxLength={40} className="input" /></div>
        <div><label className="label" htmlFor="evidence">How can we confirm it&apos;s you?</label><textarea id="evidence" name="evidence" required rows={4} maxLength={2000} className="input" placeholder="e.g. I'm named on the website / Companies House, or pop in — I'm behind the counter most mornings." /></div>
        <div><SubmitButton>Send claim</SubmitButton></div>
      </form>
    </Shell>
  )
}
