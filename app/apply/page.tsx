import Link from 'next/link'
import Shell from '@/components/Shell'
import SubmitButton from '@/components/SubmitButton'
import { requireUser } from '@/lib/auth'
import { readFlash } from '@/lib/flash'
import { repo } from '@/lib/repo'
import { ADMIN_CALL_URL, APP_NAME, HOOD } from '@/lib/config'
import { formatDay } from '@/lib/hours'
import { applyAsAdmin } from '@/app/actions'

export const metadata = { title: 'Apply to be an admin' }

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ flash?: string }> }) {
  const [user, flash] = await Promise.all([requireUser(), searchParams.then(readFlash)])
  const application = await repo.myApplication(user.id)
  const pending = application?.status === 'pending'
  return (
    <Shell title="Apply to be an admin" intro={`Admins are neighbours who help run ${APP_NAME}: they check that business owners are who they say, approve events and keep things friendly.`} flash={flash}>
      {user.is_admin ? (
        <div className="card max-w-2xl bg-grass/40 p-5"><h2 className="text-xl font-bold">You&apos;re already an admin 🎉</h2><p className="my-2">Head to the back office to see what needs doing.</p><Link href="/admin" className="btn">Open Admin</Link></div>
      ) : pending ? (
        <div className="card max-w-2xl p-5">
          <h2 className="text-2xl font-bold">Thanks — we have your application</h2>
          <p className="muted mt-1">Sent {formatDay(application.created_at)}. The next step is a short call so we can meet.</p>
          <a href={ADMIN_CALL_URL} target="_blank" rel="noreferrer" className="btn mt-4 text-lg">📅 Book a call</a>
          <p className="muted mt-3 text-sm">Already booked? There&apos;s nothing else to do; we&apos;ll confirm after the call.</p>
        </div>
      ) : (
        <form action={applyAsAdmin} className="card grid max-w-2xl gap-4 p-5">
          <input type="hidden" name="_from" value="/apply" />
          {application?.status === 'rejected' && <p className="rounded-xl bg-paper p-3 text-sm">Your earlier application wasn&apos;t taken forward{application.admin_note ? `: ${application.admin_note}` : '.'} You&apos;re welcome to apply again.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="full_name">Full name</label><input id="full_name" name="full_name" required maxLength={120} autoComplete="name" defaultValue={user.name} className="input" /></div>
            <div><label className="label" htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" defaultValue={user.email ?? ''} className="input" /></div>
            <div><label className="label" htmlFor="phone">Phone number</label><input id="phone" name="phone" type="tel" required minLength={5} maxLength={40} autoComplete="tel" className="input" /></div>
            <div><label className="label" htmlFor="years_in_area">Years you&apos;ve lived in {HOOD.name}</label><input id="years_in_area" name="years_in_area" type="number" required min={0} max={120} inputMode="numeric" className="input" /></div>
          </div>
          <div><label className="label" htmlFor="address">Home address</label><input id="address" name="address" required minLength={5} maxLength={300} autoComplete="street-address" className="input" /></div>
          <div><label className="label" htmlFor="occupation">What do you do for work?</label><input id="occupation" name="occupation" required maxLength={120} className="input" /></div>
          <div><label className="label" htmlFor="favourite_thing">What&apos;s your favourite thing about {HOOD.name}?</label><textarea id="favourite_thing" name="favourite_thing" required rows={3} maxLength={1000} className="input" /></div>
          <p className="muted text-sm">Your phone number and address are only seen by {APP_NAME}&apos;s admins and are used only to consider this application. See the <Link href="/privacy" className="underline">privacy notice</Link>.</p>
          <div><SubmitButton>Send application</SubmitButton> <span className="muted ml-2 text-sm">Next you&apos;ll be able to book a call.</span></div>
        </form>
      )}
    </Shell>
  )
}
