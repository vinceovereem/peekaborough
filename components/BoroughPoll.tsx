'use client'
import { useActionState, useEffect, useState, useSyncExternalStore } from 'react'
import { voteForBorough } from '@/app/actions'
import { APP_NAME, HOOD, LONDON_BOROUGHS } from '@/lib/config'
import type { BoroughTally } from '@/lib/types'

const noop = () => () => {}
const votedBefore = () => { const m = document.cookie.match(/(?:^|; )borough_vote=([^;]*)/); return m ? decodeURIComponent(m[1]) : null }

/** "Which borough should we cover next?" — one vote per browser, no account needed. Results show once you vote, or on request. */
export default function BoroughPoll() {
  const [state, vote, pending] = useActionState(voteForBorough, {})
  const [choice, setChoice] = useState('')
  const [peek, setPeek] = useState(false)
  // the vote cookie isn't httpOnly, so a returning visitor sees their answer instead of the form
  const earlier = useSyncExternalStore(noop, votedBefore, () => null)
  const voted = state.voted ?? earlier
  if (voted) return <div className="mt-3 text-xs"><p className="font-bold">🗳️ Thanks! You voted for {voted} as the next borough on {APP_NAME}.</p><Results key={voted} /></div>
  return (
    <div className="mt-3 text-xs">
      <form action={vote} className="flex flex-wrap items-end gap-2">
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
        <button type="button" className="py-1 font-bold underline" aria-expanded={peek} onClick={() => setPeek(!peek)}>{peek ? 'Hide results' : 'See results'}</button>
        {state.error && <p role="alert" className="w-full font-bold text-tomato">{state.error}</p>}
      </form>
      {peek && <Results />}
    </div>
  )
}

/** The top five so far, as little bars. Typed-in names are counted as "Other" (see /api/boroughs). */
function Results() {
  const [tally, setTally] = useState<BoroughTally[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    fetch('/api/boroughs').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(setTally, () => setFailed(true))
  }, [])
  if (failed) return <p className="muted mt-2">Couldn&apos;t load the results just now.</p>
  if (!tally) return <p className="muted mt-2">Loading results…</p>
  const total = tally.reduce((n, t) => n + t.votes, 0)
  if (!total) return <p className="muted mt-2">No votes yet — be the first.</p>
  return (
    <div className="mt-2 max-w-md">
      <ol className="space-y-1">{tally.slice(0, 5).map(t => (
        <li key={t.borough} className="grid grid-cols-[8rem_1fr_2.5rem] items-center gap-2">
          <span className="truncate">{t.borough}</span>
          <span className="h-2.5 overflow-hidden rounded-full border border-ink/40 bg-white"><span className="block h-full bg-sun" style={{ width: `${Math.round(t.votes / total * 100)}%` }} /></span>
          <span className="text-right font-bold">{Math.round(t.votes / total * 100)}%</span>
        </li>
      ))}</ol>
      <p className="muted mt-1">{total} {total === 1 ? 'vote' : 'votes'} so far</p>
    </div>
  )
}
