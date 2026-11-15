'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { HOOD } from '@/lib/config'

type Turn = { role: 'user' | 'assistant'; content: string; failed?: boolean }
const STARTERS = ["What's popping this weekend?", 'Where can I sit outside with a coffee?', "What's on tonight?", 'What does the area need most?']

/** Renders the small subset of markdown the assistant uses: [links](/path), **bold**, and "- " lists. */
function Rich({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*)/g).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/), bold = part.match(/^\*\*([^*]+)\*\*$/)
    if (link) return link[2].startsWith('/') ? <Link key={i} href={link[2]} className="font-bold underline">{link[1]}</Link>
      : /^https:\/\//.test(link[2]) ? <a key={i} href={link[2]} target="_blank" rel="noreferrer" className="font-bold underline">{link[1]}</a> : link[1]
    return bold ? <b key={i}>{bold[1]}</b> : part
  })
  return <>{text.split(/\n+/).filter(l => l.trim()).map((line, i) => {
    const item = line.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)$/)
    return item ? <p key={i} className="pl-4 -indent-4">• {inline(item[1])}</p> : <p key={i}>{inline(line.replace(/^#+\s*/, ''))}</p>
  })}</>
}

export default function AskPanel({ enabled, onClose }: { enabled: boolean; onClose: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [turns, busy])

  async function send(question: string) {
    const q = question.trim()
    if (!q || busy) return
    const next: Turn[] = [...turns.filter(t => !t.failed), { role: 'user', content: q }]
    setTurns(next); setDraft(''); setBusy(true)
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next.slice(-12).map(({ role, content }) => ({ role, content })) }) })
      const data = await res.json().catch(() => ({}))
      setTurns([...next, res.ok && data.answer ? { role: 'assistant', content: data.answer } : { role: 'assistant', content: data.error ?? 'The local guide can’t answer right now — please try again in a little while.', failed: true }])
    } catch {
      setTurns([...next, { role: 'assistant', content: 'You seem to be offline — check your connection and try again.', failed: true }])
    } finally { setBusy(false) }
  }

  return (
    <section className="card absolute inset-x-2 bottom-8 z-40 flex max-h-[70dvh] flex-col sm:left-3 sm:w-[26rem]" aria-label="Ask the local guide">
      <header className="flex items-center gap-2 border-b-2 border-ink px-4 py-2">
        <h2 className="flex-1 text-xl font-bold">✨ Ask about {HOOD.name}</h2>
        <button onClick={onClose} aria-label="Close" className="grid size-11 place-items-center text-2xl font-bold">×</button>
      </header>
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {!enabled ? <div className="py-4 text-center">
          <p className="text-4xl" aria-hidden>🛠️</p>
          <p className="font-display mt-1 text-xl font-bold">Coming soon</p>
          <p className="muted mt-1">Soon you&apos;ll be able to ask things like “{STARTERS[0]}” and get an answer from what&apos;s on the map. For now, try 🔥 What&apos;s popping or the search.</p>
        </div> : turns.length === 0 && <>
          <p className="muted">Ask me anything about the area — I answer from what&apos;s on the map, the events diary and local news.</p>
          <div className="flex flex-wrap gap-1.5">{STARTERS.map(s => <button key={s} onClick={() => send(s)} className="chip text-left whitespace-normal">{s}</button>)}</div>
        </>}
        {turns.map((t, i) => t.role === 'user'
          ? <p key={i} className="ml-8 rounded-2xl rounded-br-sm border-2 border-ink bg-sun px-3 py-2 font-bold">{t.content}</p>
          : <div key={i} className={`mr-4 space-y-1.5 rounded-2xl rounded-bl-sm border-2 border-ink px-3 py-2 ${t.failed ? 'bg-tomato/20' : 'bg-paper'}`}><Rich text={t.content} /></div>)}
        {busy && <p className="muted mr-4 animate-pulse rounded-2xl border-2 border-dashed border-ink/40 px-3 py-2">Having a look around…</p>}
        <div ref={end} />
      </div>
      {enabled && <><form onSubmit={e => { e.preventDefault(); send(draft) }} className="flex gap-2 border-t-2 border-ink p-3">
        <input value={draft} onChange={e => setDraft(e.target.value)} maxLength={500} placeholder="Where's good for…?" aria-label="Your question" className="input" />
        <button className="btn" disabled={busy || !draft.trim()}>Ask</button>
      </form>
      <p className="muted px-3 pb-2 text-center text-xs">AI answers can be wrong — check details on the place&apos;s page.</p></>}
    </section>
  )
}
