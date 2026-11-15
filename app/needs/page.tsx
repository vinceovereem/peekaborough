import Shell from '@/components/Shell'
import SubmitButton from '@/components/SubmitButton'
import { Empty, SignInPrompt } from '@/components/ui'
import { requireVisitor } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { HOOD } from '@/lib/config'
import { formatDay } from '@/lib/hours'
import { createWish, voteOnWish } from '@/app/actions'

export const metadata = { title: 'What the area needs' }

export default async function NeedsPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const [user, flash] = await Promise.all([requireVisitor(), searchParams])
  const wishes = await repo.wishes(user?.id ?? null)
  return (
    <Shell title={`What ${HOOD.name} needs`} intro="Is something missing round here? Say it, then vote ideas up or down — a ranked list the council and new businesses can act on." flash={flash}>
      {!user ? <div className="mb-8"><SignInPrompt>Sign in to add an idea or to vote.</SignInPrompt></div> : <form action={createWish} className="card mb-8 grid gap-3 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <input type="hidden" name="_from" value="/needs" />
        <div><label className="label" htmlFor="title">We need…</label><input id="title" name="title" required maxLength={100} className="input" placeholder="e.g. more bike parking" /></div>
        <div><label className="label" htmlFor="description">Why? <span className="muted font-normal">(optional)</span></label><input id="description" name="description" maxLength={600} className="input" /></div>
        <SubmitButton>Add it</SubmitButton>
      </form>}
      {wishes.length === 0 ? <Empty>No ideas yet — what is missing round here?</Empty> : (
        <ol className="space-y-3">{wishes.map((w, i) => (
          <li key={w.id} className="card flex items-center gap-3 p-3 sm:gap-4 sm:p-4">
            {/* agree / disagree: tapping your current choice again takes it back */}
            {!user ? <p className="flex w-20 shrink-0 flex-col gap-1.5 text-center font-bold" aria-label={`${w.ups} agree, ${w.downs} disagree`}><span className="rounded-xl border-2 border-ink/20 py-1"><span aria-hidden>▲</span> {w.ups}</span><span className="rounded-xl border-2 border-ink/20 py-1"><span aria-hidden>▼</span> {w.downs}</span></p> : <form action={voteOnWish} className="flex shrink-0 flex-col gap-1.5">
              <input type="hidden" name="id" value={w.id} />
              <button name="value" value="1" aria-pressed={w.mine === 1} aria-label={`Agree with “${w.title}” (${w.ups} so far)`} className={`btn btn-sm w-20 ${w.mine === 1 ? 'bg-grass' : 'btn-white'}`}><span aria-hidden>▲</span> {w.ups}</button>
              <button name="value" value="-1" aria-pressed={w.mine === -1} aria-label={`Disagree with “${w.title}” (${w.downs} so far)`} className={`btn btn-sm w-20 ${w.mine === -1 ? 'bg-tomato text-white' : 'btn-white'}`}><span aria-hidden>▼</span> {w.downs}</button>
            </form>}
            <div className="min-w-0"><h2 className="text-xl leading-tight font-bold">{i < 3 && w.ups > w.downs && <span aria-hidden>{['🥇', '🥈', '🥉'][i]} </span>}{w.title}</h2>
              {w.description && <p>{w.description}</p>}<p className="muted text-xs">{w.author} · {formatDay(w.created_at)} · {w.ups + w.downs} {w.ups + w.downs === 1 ? 'vote' : 'votes'}</p></div>
          </li>
        ))}</ol>
      )}
    </Shell>
  )
}
