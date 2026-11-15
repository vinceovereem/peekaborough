import Link from 'next/link'
import { notFound } from 'next/navigation'
import PublicPage from '@/components/PublicPage'
import { CategoryIcon, LinePills, Stars } from '@/components/ui'
import { APP_NAME, CATEGORIES } from '@/lib/config'
import { GUIDES, STATIONS_GUIDE, NEAR_M, NEAR_CATEGORIES, guideSections, nearStations } from '@/lib/guides'
import { googleMapsUrl } from '@/lib/links'
import type { MapPlace } from '@/lib/types'
import { guidePlaces, guideMarkup, SOURCE_NOTE } from '../data'

export const revalidate = 86400 // rebuilt once a day, so new places and ratings show up without a deploy (must be a plain number here)
export const dynamicParams = false
export const generateStaticParams = () => [...GUIDES, STATIONS_GUIDE].map(g => ({ slug: g.slug }))

async function load(slug: string) {
  const places = await guidePlaces()
  if (slug === STATIONS_GUIDE.slug) {
    const rows = nearStations(places)
    return { slug, title: STATIONS_GUIDE.title, blurb: STATIONS_GUIDE.blurb(rows.length), rows, sections: null }
  }
  const guide = GUIDES.find(g => g.slug === slug)
  if (!guide) return null
  const sections = guideSections(guide, places)
  return { slug, title: guide.title, blurb: guide.blurb(sections.reduce((n, s) => n + s.places.length, 0)), rows: null, sections }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const guide = await load((await params).slug)
  if (!guide) return {}
  return { title: guide.title, description: guide.blurb, alternates: { canonical: `/guides/${guide.slug}` }, openGraph: { title: guide.title, description: guide.blurb, url: `/guides/${guide.slug}` } }
}

function PlaceRow({ place, showKind }: { place: MapPlace; showKind: boolean }) {
  const kind = showKind ? place.subcategory : null
  return (
    <li className="flex items-start gap-2.5 py-2.5">
      <CategoryIcon category={place.category} className="mt-0.5 size-7" />
      <div className="min-w-0 flex-1">
        <Link href={`/place/${place.slug}`} className="font-bold underline decoration-ink/30 hover:decoration-ink">{place.name}</Link>
        <p className="muted text-sm">{[kind, place.address].filter(Boolean).join(' · ') || CATEGORIES[place.category].label}</p>
        {place.review_count > 0 && <Stars rating={place.rating} count={place.review_count} />}
      </div>
      <a href={googleMapsUrl(place)} target="_blank" rel="noopener noreferrer" className="btn btn-white btn-sm shrink-0" aria-label={`${place.name} on Google Maps`}>Map ↗</a>
    </li>
  )
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = await load((await params).slug)
  if (!guide) notFound()
  const others = [...GUIDES, STATIONS_GUIDE].filter(g => g.slug !== guide.slug)
  return (
    <PublicPage wide={!!guide.rows}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: guideMarkup(guide.slug, guide.title, guide.blurb) }} />
      <nav aria-label="Breadcrumb" className="muted text-sm font-bold"><Link href="/guides" className="underline">Guides</Link> ›</nav>
      <h1 className="mt-1 text-3xl leading-tight font-bold sm:text-4xl">{guide.title}</h1>
      <p className="mt-2 text-lg">{guide.blurb}</p>
      <p className="muted mt-1 text-sm">{SOURCE_NOTE}</p>

      {guide.sections && guide.sections.length > 1 && (
        <nav aria-label="Sections" className="mt-4 flex flex-wrap gap-1.5">
          {guide.sections.map(s => <a key={s.heading} href={`#${encodeURIComponent(s.heading!)}`} className="chip">{s.heading} <span className="muted font-normal">{s.places.length}</span></a>)}
        </nav>
      )}
      {guide.sections?.map(s => (
        <section key={s.heading ?? 'all'} id={s.heading ?? undefined} className="card mt-5 scroll-mt-4 px-4 py-2 sm:px-5">
          {s.heading && <h2 className="pt-2 text-xl font-bold">{s.heading} <span className="muted text-base font-normal">({s.places.length})</span></h2>}
          {/* the kind of place is only worth a line where a section mixes several kinds */}
          <ul className="divide-y divide-ink/10">{s.places.map(p => <PlaceRow key={p.id} place={p} showKind={new Set(s.places.map(x => x.subcategory)).size > 1} />)}</ul>
        </section>
      ))}

      {guide.rows && <>
        {/* on a phone the column headings are icons only, so the key sits above the table */}
        <ul aria-hidden className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm font-bold sm:hidden">{NEAR_CATEGORIES.map(c => <li key={c}><CategoryIcon category={c} /> {CATEGORIES[c].label}</li>)}</ul>
        <div className="card mt-3 overflow-x-auto sm:mt-5">
          <table className="w-full text-left">
            <caption className="sr-only">Number of places within {NEAR_M} metres of each station</caption>
            <thead><tr className="border-b-2 border-ink text-sm">
              <th scope="col" className="px-3 py-3 sm:px-4">Station</th>
              {NEAR_CATEGORIES.map(c => <th key={c} scope="col" className="px-1 py-3 text-center sm:px-2"><CategoryIcon category={c} className="mx-auto block size-7" /><span className="mt-1 block max-sm:sr-only">{CATEGORIES[c].label}</span></th>)}
            </tr></thead>
            <tbody className="divide-y divide-ink/10">
              {guide.rows.map(({ station, counts }) => (
                <tr key={station.id}>
                  <th scope="row" className="px-3 py-3 font-normal sm:px-4">
                    <Link href={`/place/${station.slug}`} className="font-bold underline decoration-ink/30 hover:decoration-ink">{station.name}</Link>
                    {station.extra.lines && <div className="mt-1.5"><LinePills lines={station.extra.lines} /></div>}
                  </th>
                  {NEAR_CATEGORIES.map(c => <td key={c} className="font-display px-1 py-3 text-center text-lg font-bold sm:px-2 sm:text-xl">{counts[c]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted mt-3 text-sm">How this is counted: every place on the {APP_NAME} map within {NEAR_M} metres of the station in a straight line. Walking routes are longer than straight lines, and a place can be near more than one station. Lines are from Transport for London.</p>
      </>}

      <aside className="card mt-6 bg-sun/40 p-5">
        <b className="font-display text-xl">See all of this on the map</b>
        <p className="mt-1">{APP_NAME} puts every one of these places on a 3D map of the borough, with opening hours, what&apos;s on and neighbours&apos; reviews. It is free; you sign in with Google.</p>
        <Link href="/" className="btn btn-ink mt-3">Open {APP_NAME} →</Link>
      </aside>

      <h2 className="mt-8 text-xl font-bold">More guides</h2>
      <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">{others.map(g => <li key={g.slug}><Link href={`/guides/${g.slug}`} className="font-bold underline">{g.title}</Link></li>)}</ul>
    </PublicPage>
  )
}
