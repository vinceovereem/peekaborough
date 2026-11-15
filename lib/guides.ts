// Public guide pages: each one is a filter over the real places, never hand-written listings.
// Nothing here may claim more than the data shows (what a place is, where it is, a mapped feature).
import type { MapPlace } from './types.ts'

export type Guide = {
  slug: string
  title: string
  /** One plain sentence for the page and for search results; `n` is how many places it lists. */
  blurb: (n: number) => string
  pick: (p: MapPlace) => boolean
  /** Section heading for a place; guides without it are one A–Z list. */
  group?: (p: MapPlace) => string
  /** Heading that gathers sections with fewer than SMALL places, so a page is not a wall of one-place sections. */
  rest?: string
}

const sub = (p: MapPlace) => p.subcategory ?? ''
const title = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const outdoors = (p: MapPlace) => p.extra.outdoor_seating === true
const FOOD_SHOPS: Record<string, string> = { bakery: 'Bakeries', pastry: 'Bakeries', butcher: 'Butchers', deli: 'Delis', greengrocer: 'Greengrocers', seafood: 'Fishmongers', cheese: 'Cheese shops', 'health food': 'Health food shops' }
const CULTURE: Record<string, string> = { theatre: 'Theatres', cinema: 'Cinemas', museum: 'Museums', gallery: 'Galleries', 'arts centre': 'Arts centres', 'music venue': 'Music venues', library: 'Libraries' }
const GREEN: Record<string, string> = { park: 'Parks', garden: 'Gardens', playground: 'Playgrounds' }
const ACTIVE: Record<string, string> = { 'fitness centre': 'Gyms and fitness centres', 'sports centre': 'Sports centres', 'swimming pool': 'Swimming pools', stadium: 'Stadiums' }

export const GUIDES: Guide[] = [
  { slug: 'pubs-with-outdoor-seating', title: 'Pubs and bars with outdoor seating in Islington',
    blurb: n => `${n} pubs and bars in Islington that are mapped as having seats outside.`,
    pick: p => p.category === 'drink' && outdoors(p) },
  { slug: 'cafes-and-restaurants-with-outdoor-seating', title: 'Cafés and restaurants with outdoor seating in Islington',
    blurb: n => `${n} cafés and places to eat in Islington that are mapped as having seats outside.`,
    pick: p => (p.category === 'cafe' || p.category === 'eat') && outdoors(p), group: p => p.category === 'cafe' ? 'Cafés' : 'Places to eat' },
  { slug: 'pubs-and-bars', title: 'Pubs and bars in Islington',
    blurb: n => `All ${n} pubs, bars and nightclubs on the Islington map, from A to Z.`,
    pick: p => p.category === 'drink', group: p => sub(p) === 'pub' ? 'Pubs' : sub(p) === 'nightclub' ? 'Nightclubs' : 'Bars' },
  { slug: 'coffee-shops', title: 'Coffee shops and cafés in Islington',
    blurb: n => `All ${n} cafés and coffee shops on the Islington map, from A to Z.`,
    pick: p => p.category === 'cafe' },
  { slug: 'places-to-eat-by-cuisine', title: 'Places to eat in Islington, by cuisine',
    blurb: n => `${n} restaurants and takeaways in Islington, grouped by the kind of food they serve.`,
    // "vacant" is a mapper's note that the unit is empty, not a cuisine
    pick: p => p.category === 'eat' && sub(p) !== 'vacant', group: p => !p.subcategory || sub(p) === 'restaurant' ? 'Restaurants (cuisine not listed)' : title(sub(p)), rest: 'Other cuisines' },
  { slug: 'bakeries-butchers-delis-and-greengrocers', title: 'Bakeries, butchers, delis and greengrocers in Islington',
    blurb: n => `${n} specialist food shops in Islington: bakeries, butchers, delis, greengrocers, fishmongers and more.`,
    pick: p => p.category === 'groceries' && sub(p) in FOOD_SHOPS, group: p => FOOD_SHOPS[sub(p)] },
  { slug: 'parks-gardens-and-playgrounds', title: 'Parks, gardens and playgrounds in and around Islington',
    blurb: n => `${n} parks, gardens and playgrounds in Islington and in Finsbury Park and Clissold Park next door.`,
    pick: p => p.category === 'green' && sub(p) in GREEN, group: p => GREEN[sub(p)] },
  { slug: 'theatres-cinemas-museums-and-galleries', title: 'Theatres, cinemas, museums and galleries in Islington',
    blurb: n => `${n} theatres, cinemas, museums, galleries, arts centres, music venues and libraries in Islington.`,
    pick: p => p.category === 'culture' && sub(p) in CULTURE, group: p => CULTURE[sub(p)] },
  { slug: 'gyms-and-sports-centres', title: 'Gyms, pools and sports centres in Islington',
    blurb: n => `${n} gyms, sports centres, pools and stadiums in Islington.`,
    pick: p => p.category === 'active' && sub(p) in ACTIVE, group: p => ACTIVE[sub(p)] },
]

/** The comparison page: what is mapped near each station. */
export const STATIONS_GUIDE = {
  slug: 'around-the-stations', title: 'Islington station by station: what is near each one',
  blurb: (n: number) => `Places to eat, cafés, pubs, food shops and parks within ${NEAR_M} metres of each of Islington's ${n} tube and rail stations, side by side.`,
}
export const NEAR_M = 600
export const NEAR_CATEGORIES = ['eat', 'cafe', 'drink', 'groceries', 'green'] as const

const SMALL = 5
const byName = (a: MapPlace, b: MapPlace) => a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })

/** A guide's places, A–Z, in sections (biggest section first; one unnamed section when the guide has no grouping). */
export function guideSections(guide: Guide, places: MapPlace[]): { heading: string | null; places: MapPlace[] }[] {
  const picked = places.filter(guide.pick).sort(byName)
  if (!guide.group) return picked.length ? [{ heading: null, places: picked }] : []
  const groups = new Map<string, MapPlace[]>()
  for (const p of picked) groups.set(guide.group(p), [...(groups.get(guide.group(p)) ?? []), p])
  const sections = [...groups].map(([heading, places]) => ({ heading, places })).sort((a, b) => b.places.length - a.places.length || a.heading.localeCompare(b.heading))
  if (!guide.rest) return sections
  const rest = sections.filter(s => s.places.length < SMALL).flatMap(s => s.places).sort(byName)
  return [...sections.filter(s => s.places.length >= SMALL), ...(rest.length ? [{ heading: guide.rest, places: rest }] : [])]
}

/** Straight-line distance in metres (fine at borough scale). */
export function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = Math.PI / 180, x = (b.lng - a.lng) * rad * Math.cos((a.lat + b.lat) / 2 * rad), y = (b.lat - a.lat) * rad
  return Math.hypot(x, y) * 6_371_000
}

/** For every station: how many places of each compared kind are within NEAR_M metres in a straight line. */
export function nearStations(places: MapPlace[]) {
  const compared = places.filter(p => (NEAR_CATEGORIES as readonly string[]).includes(p.category))
  return places.filter(p => p.category === 'transport').sort(byName).map(station => {
    const near = compared.filter(p => metresBetween(station, p) <= NEAR_M)
    return { station, counts: Object.fromEntries(NEAR_CATEGORIES.map(c => [c, near.filter(p => p.category === c).length])) as Record<typeof NEAR_CATEGORIES[number], number> }
  })
}
