import MapExplorer from '@/components/MapExplorer'
import Nav from '@/components/Nav'
import { requireVisitor } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { ASK_ENABLED } from '@/lib/assistant'
import type { MapPlace } from '@/lib/types'

/** Drops null/false/empty fields before the list is sent to the browser (roughly halves it). */
const slim = (p: MapPlace) => Object.fromEntries(Object.entries(p).filter(([, v]) => v != null && v !== false && v !== 0 && !(typeof v === 'object' && !Object.keys(v).length))) as unknown as MapPlace

export default async function MapPage({ searchParams }: { searchParams: Promise<{ place?: string; event?: string }> }) {
  const user = await requireVisitor()
  const [{ place, event }, places, events, posts, favourites] = await Promise.all([searchParams, repo.mapPlaces(), repo.events(), repo.latestPosts(3), user ? repo.favoriteIds(user.id) : []])
  // /?event=<id> (the venue links on What's on) opens the map on that event's venue, however far ahead it is
  const near = events.slice(0, 80), focus = events.find(e => e.id === event)
  return (
    <>
      <Nav user={user} floating />
      {/* ponytail: ships every place in the borough to the browser (~3,500, about 150 KB gzipped).
          Switch to vector tiles or a bounding-box API before covering several boroughs. */}
      <MapExplorer places={places.map(slim)} events={focus && !near.includes(focus) ? [...near, focus] : near} initialEvent={focus?.id} posts={posts} favourites={favourites} initialSlug={place} now={new Date().toISOString()} askEnabled={ASK_ENABLED} signedIn={!!user} />
    </>
  )
}
