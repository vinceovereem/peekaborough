import Shell from '@/components/Shell'
import { Empty } from '@/components/ui'
import { headlines, GUIDES } from '@/lib/news'
import { HOOD } from '@/lib/config'
import { formatDay } from '@/lib/hours'

export const metadata = { title: 'News' }

export default async function NewsPage() {
  const news = await headlines(36)
  return (
    <Shell title={`${HOOD.name} news`} intro="The latest headlines from the local paper, local guides and neighbours, gathered automatically. Tap one to read it at the source.">
      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <section>
          {news.length === 0 ? <Empty>Couldn&apos;t reach the news feeds just now — try again in a few minutes.</Empty> : (
            <ul className="space-y-2">{news.map(h => (
              <li key={h.url}><a href={h.url} target="_blank" rel="noreferrer" className="card block p-3 transition-transform hover:-translate-y-0.5">
                <span className="mb-0.5 flex flex-wrap items-center gap-2 text-xs font-bold"><span className="tag bg-sun">{h.source}</span>{h.date && <span className="muted">{formatDay(h.date)}</span>}</span>
                <span className="font-display text-lg leading-snug font-semibold">{h.title} <span aria-hidden>↗</span></span>
              </a></li>
            ))}</ul>
          )}
        </section>
        <aside>
          <h2 className="mb-2 text-xl font-bold">More on {HOOD.name}</h2>
          <ul className="space-y-2">{GUIDES.map(g => (
            <li key={g.url}><a href={g.url} target="_blank" rel="noreferrer" className="card block p-3 hover:bg-sun/30"><b>{g.name} ↗</b><span className="muted block text-sm">{g.blurb}</span></a></li>
          ))}</ul>
        </aside>
      </div>
    </Shell>
  )
}
