'use client'
import Link from 'next/link'
import { useActionState, useEffect, useState } from 'react'
import { voteForBorough } from '@/app/actions'
import type { PollData } from '@/app/api/boroughs/route'
import { APP_NAME, HOOD, LONDON_BOROUGHS } from '@/lib/config'

/**
 * "Which borough should we cover next?" — signed-in neighbours vote once each; anyone can see the results.
 * Who's asking is fetched from /api/boroughs, so the pages around this footer can stay static.
 */
export default function BoroughPoll() {
  const [state, vote, pending] = useActionState(voteForBorough, {})
  const [data, setData] = useState<PollData | null>(null)
  const [choice, setChoice] = useState('')
  const [peek, setPeek] = useState(false)
  useEffect(() => { // again after a vote, so the results include it
    fetch('/api/boroughs').then(r => r.ok ? r.json() : null).then(setData, () => setData(null))
  }, [state.voted])
  const question = <>🗳️ Which borough do you want to see next on {APP_NAME}?</>
  const voted = state.voted ?? data?.mine
  if (voted) return <div className="mt-3 text-xs"><p className="font-bold">🗳️ Thanks! You voted for {voted} as the next borough on {APP_NAME}.</p><Results data={data} /></div>
  const results = <button type="button" className="py-1 font-bold underline" aria-expanded={peek} onClick={() => setPeek(!peek)}>{peek ? 'Hide results' : 'See results'}</button>
  return (
    <div className="mt-3 text-xs">
      {!data?.signedIn ? <p className="flex flex-wrap items-center gap-x-3 gap-y-1"><b>{question}</b><Link href="/login" className="btn btn-white btn-sm">Sign in to vote</Link>{results}</p> : (
        <form action={vote} className="flex flex-wrap items-end gap-2">
          <div className="min-w-48 flex-1">
            <label htmlFor="next-borough" className="font-bold">{question}</label>
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
          {results}
          {state.error && <p role="alert" className="w-full font-bold text-tomato">{state.error}</p>}
        </form>
      )}
      {peek && <Results data={data} />}
    </div>
  )
}

/** The top five so far, as little bars. Typed-in names are counted as "Other" (see /api/boroughs). */
function Results({ data }: { data: PollData | null }) {
  if (!data) return <p className="muted mt-2">Loading results…</p>
  const total = data.tally.reduce((n, t) => n + t.votes, 0)
  if (!total) return <p className="muted mt-2">No votes yet — be the first.</p>
  return (
    <div className="mt-2 max-w-md">
      <ol className="space-y-1">{data.tally.slice(0, 5).map(t => (
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
