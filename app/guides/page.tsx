import Link from 'next/link'
import PublicPage from '@/components/PublicPage'
import { APP_NAME, HOOD } from '@/lib/config'
import { GUIDES, STATIONS_GUIDE } from '@/lib/guides'
import { guidePlaces, guideMarkup, SOURCE_NOTE } from './data'

export const revalidate = 86400 // rebuilt once a day, so new places and ratings show up without a deploy (must be a plain number here)
const TITLE = `Guides to ${HOOD.name}`
const DESCRIPTION = `Free guides to the London Borough of ${HOOD.name}: pubs with outdoor seating, coffee shops, places to eat by cuisine, parks, theatres and what is near each station.`
export const metadata = { title: TITLE, description: DESCRIPTION, alternates: { canonical: '/guides' }, openGraph: { title: TITLE, description: DESCRIPTION, url: '/guides' } }

export default async function Guides() {
  const places = await guidePlaces()
  const stations = places.filter(p => p.category === 'transport').length
  const cards = [
    ...GUIDES.map(g => ({ slug: g.slug, title: g.title, blurb: g.blurb(places.filter(g.pick).length) })),
    { slug: STATIONS_GUIDE.slug, title: STATIONS_GUIDE.title, blurb: STATIONS_GUIDE.blurb(stations) },
  ]
  return (
    <PublicPage wide>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: guideMarkup(null, TITLE, DESCRIPTION) }} />
      <h1 className="text-3xl font-bold sm:text-4xl">{TITLE}</h1>
      <p className="mt-2 max-w-2xl text-lg">Lists made from the {places.length.toLocaleString('en-GB')} places on the {APP_NAME} map. No sign-in needed.</p>
      <p className="muted mt-1 max-w-2xl text-sm">{SOURCE_NOTE}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {cards.map(c => (
          <li key={c.slug}><Link href={`/guides/${c.slug}`} className="card block h-full p-4 hover:bg-sun/30">
            <b className="font-display text-lg leading-snug">{c.title}</b>
            <span className="muted mt-1 block text-sm">{c.blurb}</span>
          </Link></li>
        ))}
      </ul>
    </PublicPage>
  )
}
