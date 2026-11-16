'use client'
import { useActionState, useState, useSyncExternalStore } from 'react'
import { voteForBorough } from '@/app/actions'
import { APP_NAME, HOOD, LONDON_BOROUGHS } from '@/lib/config'

const noop = () => () => {}
const votedBefore = () => { const m = document.cookie.match(/(?:^|; )borough_vote=([^;]*)/); return m ? decodeURIComponent(m[1]) : null }

/** "Which borough should we cover next?" — one vote per browser, no account needed. */
export default function BoroughPoll() {
  const [state, vote, pending] = useActionState(voteForBorough, {})
  const [choice, setChoice] = useState('')
  // the vote cookie isn't httpOnly, so a returning visitor sees their answer instead of the form
  const earlier = useSyncExternalStore(noop, votedBefore, () => null)
  const voted = state.voted ?? earlier
  if (voted) return <p className="mt-3 text-xs font-bold">🗳️ Thanks! You voted for {voted} as the next borough on {APP_NAME}.</p>
  return (
    <form action={vote} className="mt-3 flex flex-wrap items-end gap-2 text-xs">
      <div className="min-w-48 flex-1">
        <label htmlFor="next-borough" className="font-bold">🗳️ Which borough do you want to see next on {APP_NAME}?</label>
        <select id="next-borough" name="borough" required value={choice} onChange={e => setChoice(e.target.value)} className="input mt-1 py-1.5 text-sm">
          <option value="" disabled>Choose a borough…</option>
          {LONDON_BOROUGHS.filter(b => b !== HOOD.name).map(b => <option key={b}>{b}</option>)}
          <option value="other">Other…</option>
        </select>
      </div>
      {choice === 'other' && <div className="min-w-40 flex-1">
        <label htmlFor="other-borough" className="font-bold">Which one?</label>
        <input id="other-borough" name="other" required minLength={2} maxLength={60} autoFocus className="input mt-1 py-1.5 text-sm" placeholder="Type any place" />
      </div>}
      <button className="btn btn-white btn-sm" disabled={pending}>{pending ? 'Sending…' : 'Vote'}</button>
      {state.error && <p role="alert" className="w-full font-bold text-tomato">{state.error}</p>}
    </form>
  )
}
