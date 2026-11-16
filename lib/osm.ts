// Turning OpenStreetMap (ODbL) elements, and what venues' websites say, into places. Shared by scripts/import-osm.mjs (the full import that
// writes data/places.json) and the monthly refresh in lib/place-sync.ts (adds new places to the live database).
// No local imports with runtime code: the import script runs this file straight under Node.
import type { Category } from './config'
import type { Hours, PlaceExtra, PlaceIndexRow, PlacePatch } from './types'

export const UA = { 'User-Agent': 'neighbourhood-guide-prototype' }

/** Overpass QL for every named venue we list, inside a "S,W,N,E" box. */
export const query = (bbox: string) => `[out:json][timeout:120];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|pub|bar|biergarten|ice_cream|pharmacy|doctors|dentist|clinic|veterinary|theatre|cinema|arts_centre|library|community_centre|nightclub|place_of_worship|post_office|bank|music_venue|marketplace)$"]["name"](${bbox});
  nwr["shop"]["name"](${bbox});
  nwr["leisure"~"^(park|fitness_centre|sports_centre|swimming_pool|stadium|playground|garden)$"]["name"](${bbox});
  nwr["tourism"~"^(museum|gallery|attraction|hotel)$"]["name"](${bbox});
  nwr["railway"="station"]["name"](${bbox});
);
out center tags;`

export type OsmElement = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }

/** Gives up (throws) once `until` (a Date.now() value) has passed, so a scheduled job keeps time for its other work. */
export async function overpass(bbox: string, until = Infinity): Promise<OsmElement[]> {
  // Public Overpass servers are often busy — try mirrors, then back off and go round again.
  const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
  for (let attempt = 0; attempt < 9 && Date.now() < until; attempt++) {
    const res = await fetch(MIRRORS[attempt % 3], { method: 'POST', body: 'data=' + encodeURIComponent(query(bbox)), headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...UA }, signal: AbortSignal.timeout(Math.max(1000, Math.min(130_000, until - Date.now()))) }).catch(() => null) // a busy mirror can hang forever
    if (res?.ok) return (await res.json()).elements
    console.error(`${MIRRORS[attempt % 3]} -> ${res?.status ?? 'network error'}, retrying`)
    await new Promise(r => setTimeout(r, Math.min(4000 * (attempt + 1), Math.max(0, until - Date.now()))))
  }
  throw new Error('All Overpass mirrors failed — try again in a few minutes')
}

const EAT = ['restaurant', 'fast_food', 'ice_cream']
const DRINK = ['pub', 'bar', 'biergarten', 'nightclub']
const HEALTH = ['pharmacy', 'doctors', 'dentist', 'clinic', 'veterinary']
const CULTURE = ['theatre', 'cinema', 'arts_centre', 'library', 'music_venue']
const SERVICES = ['hairdresser', 'beauty', 'laundry', 'dry_cleaning', 'estate_agent', 'tailor', 'massage', 'tattoo', 'travel_agency', 'funeral_directors', 'locksmith', 'copyshop', 'optician', 'mobile_phone', 'shoe_repair', 'bookmaker', 'money_lender', 'pawnbroker', 'car_repair']
const GROCERIES = ['supermarket', 'convenience', 'greengrocer', 'butcher', 'bakery', 'deli', 'cheese', 'seafood', 'alcohol', 'wine', 'health_food', 'pastry', 'confectionery', 'chocolate', 'coffee', 'tea', 'farm', 'spices']

export function categorise(t: Record<string, string>): Category {
  if (t.railway === 'station') return 'transport'
  if (t.leisure === 'stadium') return 'active'
  if (t.amenity === 'cafe') return 'cafe'
  if (EAT.includes(t.amenity)) return 'eat'
  if (DRINK.includes(t.amenity)) return 'drink'
  if (HEALTH.includes(t.amenity)) return 'health'
  if (CULTURE.includes(t.amenity) || ['museum', 'gallery', 'attraction'].includes(t.tourism)) return 'culture'
  if (['park', 'garden', 'playground'].includes(t.leisure)) return 'green'
  if (t.leisure) return 'active'
  if (t.shop) return GROCERIES.includes(t.shop) ? 'groceries' : SERVICES.includes(t.shop) ? 'services' : 'shop'
  return 'community' // worship, community centre, post office, bank, marketplace, hotel
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const OSM_DAYS: Record<string, number> = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 }
// ponytail: understands weekly rules with one opening per day ("Mo-Fr 08:00-18:00; Sa,Su 09:00-17:00",
// comma-separated rules, "Su off", public-holiday tokens). Split shifts, seasons and "sunset" return
// null and the raw text is kept in hours_note rather than guessing an "open now" that could be wrong.
export function parseHours(input: string | undefined | null): Hours | null {
  if (!input) return null
  if (input.trim() === '24/7') return Object.fromEntries(DAYS.map(d => [d, { open: '00:00', close: '24:00' }])) as Hours
  const out = Object.fromEntries(DAYS.map(d => [d, null])) as Hours
  // a comma straight after a time (or "off") starts a new rule; a comma after a day is a day list
  const rules = input.replace(/(\d{2}|off|closed)\s*,\s*(?=[A-Za-z])/gi, '$1;').split(';').map(r => r.trim().replace(/\s+/g, ' ')).filter(Boolean)
  for (const rule of rules) {
    const m = rule.match(/^([A-Za-z ,-]*?)\s*(off|closed|(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2}))$/i)
    if (!m) return null
    const tokens = m[1].split(',').map(t => t.trim()).filter(Boolean), dayTokens = tokens.filter(t => !/^(PH|SH)$/i.test(t))
    if (tokens.length && !dayTokens.length) continue // holiday-only rule: not part of the normal week
    const days = dayTokens.length ? [] : [0, 1, 2, 3, 4, 5, 6]
    for (const part of dayTokens) {
      const d = part.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*-\s*(Mo|Tu|We|Th|Fr|Sa|Su))?$/)
      if (!d) return null
      for (let i = OSM_DAYS[d[1]], end = OSM_DAYS[d[2] ?? d[1]]; ; i = (i + 1) % 7) { days.push(i); if (i === end) break }
    }
    for (const i of days) out[DAYS[i]] = m[3] ? { open: m[3].padStart(5, '0'), close: m[4].padStart(5, '0') } : null
  }
  return out
}

/**
 * Yes/no facts mappers record on the venue itself. Only what's tagged is returned, so a refresh never
 * wipes something a website scan or a later edit found.
 */
export function osmFacts(t: Record<string, string>): Pick<PlaceExtra, 'outdoor_seating' | 'dogs' | 'wifi'> {
  const out: Pick<PlaceExtra, 'outdoor_seating' | 'dogs' | 'wifi'> = {}
  if (t.amenity === 'biergarten' || t.beer_garden === 'yes' || (t.outdoor_seating && t.outdoor_seating !== 'no')) out.outdoor_seating = true
  if (/^(yes|leashed|outside|unleashed|designated)$/.test(t.dog ?? '')) out.dogs = true
  else if (t.dog === 'no') out.dogs = false
  if (/^(wlan|yes|wifi|terminal;wlan)$/.test(t.internet_access ?? '')) out.wifi = true
  else if (t.internet_access === 'no') out.wifi = false
  return out
}

// The same kind of yes/no facts, read from a venue's own website by the weekly refresh (lib/place-sync.ts).
const DOGS_YES = /\b(dog[\s-]?friendly|dogs?\s+(are\s+)?(very\s+|always\s+|more\s+than\s+|most\s+)?welcome|well[\s-]behaved\s+dogs|dogs\s+(are\s+)?allowed|bring\s+(your|the)\s+(dog|pooch|pup)|pooch[\s-]friendly|four[\s-]legged\s+(friends?|guests?)\s+(are\s+)?(very\s+|always\s+)?welcome)/i
const DOGS_NO = /\b(no\s+dogs|dogs\s+(are\s+)?not\s+(allowed|permitted)|(assistance|guide)\s+dogs\s+only|(do\s+not|don'?t)\s+allow\s+dogs)/i
const LAPTOPS_YES = /\b(laptop[\s-]?friendly|laptops?\s+(are\s+)?(very\s+|always\s+)?welcome|work\s+from\s+(our|the)\s+(caf[eé]|coffee\s+shop|space)|remote\s+work(ers|ing)?\s+(are\s+)?welcome|co-?working|plug\s+sockets|power\s+(sockets|outlets|points)|charging\s+points)/i
const LAPTOPS_NO = /\b(no\s+laptops?|laptop[\s-]?free|laptops?\s+(are\s+)?not\s+(allowed|permitted)|no\s+screens)/i
const WIFI = /\b(free\s+wi-?fi|wi-?fi\s+(is\s+)?(free|available))/i

/**
 * What a venue's own page says about dogs and laptops. Only explicit statements count; a page that says
 * nothing gives nothing. "Not dog friendly" is a no, and a yes anywhere beats a partial no ("dogs welcome in
 * the bar, no dogs in the dining room").
 * ponytail: keyword rules, not a model; reads the home page only. Upgrade to an LLM over a few pages if the
 * hit rate is too low.
 */
export function readWebsite(text: string): Pick<PlaceExtra, 'dogs' | 'laptops' | 'wifi'> {
  const t = text.replace(/\bnot\s+dog[\s-]?friendly/gi, 'no dogs').replace(/\bnot\s+laptop[\s-]?friendly/gi, 'no laptops')
  const yesNo = (yes: RegExp, no: RegExp) => yes.test(t) ? true : no.test(t) ? false : undefined
  const out: Pick<PlaceExtra, 'dogs' | 'laptops' | 'wifi'> = {}
  const dogs = yesNo(DOGS_YES, DOGS_NO), laptops = yesNo(LAPTOPS_YES, LAPTOPS_NO)
  if (dogs !== undefined) out.dogs = dogs
  if (laptops !== undefined) out.laptops = laptops
  if (WIFI.test(t)) out.wifi = true
  return out
}

// Hand-picked local icons: always shown on the map, bigger pins. Keyed "name|category as imported".
// Descriptions here are plain, checkable facts (what it is, where it is) — no capacities, founding
// dates or superlatives. Anything richer should come from the owner or a cited source.
export const LANDMARKS: Record<string, { category?: Category; subcategory?: string; description?: string }> = {
  'Emirates Stadium|active': { description: 'Home of Arsenal Football Club.' },
  'Highbury Fields|green': { description: 'A large park with tennis courts, a playground and a swimming pool. A free 5k parkrun starts here every Saturday at 9am.' },
  'Finsbury Park|green': { description: 'A large park with a boating lake, an athletics track and cafés. Just over the border in Haringey.' },
  'Clissold Park|green': { description: 'A park with a deer enclosure, a paddling pool and a café in Clissold House. Just over the border in Hackney.' },
  'Caledonian Park|green': { description: 'A park around the clock tower of the former Metropolitan Cattle Market.' },
  'Whittington Park|green': {}, 'Barnard Park|green': {}, 'Spa Fields|green': {},
  'Union Chapel|community': { category: 'culture', subcategory: 'music venue', description: 'A working church that is also a live music venue.' },
  'The Garage|drink': { category: 'culture', subcategory: 'music venue', description: 'A live music venue at Highbury Corner.' },
  'O2 Academy Islington|drink': { category: 'culture', subcategory: 'music venue' }, 'Islington Assembly Hall|culture': {},
  "Sadler's Wells Theatre|culture": { description: 'A theatre dedicated to dance, on Rosebery Avenue.' }, "Sadler's Wells|culture": { description: 'A theatre dedicated to dance, on Rosebery Avenue.' },
  'Almeida Theatre|culture': { description: 'A theatre just off Upper Street.' },
  "King's Head Theatre|culture": {}, 'Little Angel Theatre|culture': {}, 'Screen on the Green|culture': {}, 'Business Design Centre|community': {},
  'Exmouth Market|community': {}, 'Camden Passage Antiques Market|community': {},
  'Chapel Market|community': { description: 'A street market near Angel.' },
  'Highbury & Islington|transport': {}, 'Arsenal|transport': {}, 'Finsbury Park|transport': {}, 'Angel|transport': {}, 'Archway|transport': {},
  'Farringdon|transport': {}, 'Old Street|transport': {}, 'Holloway Road|transport': {}, 'Caledonian Road|transport': {}, 'Tufnell Park|transport': {},
}

export const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export type OsmPlace = ReturnType<typeof toPlaces>[number]

/**
 * Named elements inside the area, as place rows (no station lines or photos: the full import adds those).
 * `known` maps osm_id -> our id so re-imports keep ids; `slugs` holds slugs already taken.
 */
export function toPlaces(elements: OsmElement[], inside: (lng: number, lat: number) => boolean, known: Map<string, string>, slugs: Set<string>) {
  const seen = new Set<string>(), places = []
  for (const e of elements) {
    const t = e.tags, lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon
    if (!t?.name || lat == null || lng == null || !inside(lng, lat)) continue
    const category = categorise(t)
    const dedupe = `${t.name.toLowerCase()}|${category}|${lat.toFixed(3)}|${lng.toFixed(3)}` // node+way doubles of the same place
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    const osm_id = `${e.type}/${e.id}`
    let slug = slugify(t.name) || 'place'
    if (slugs.has(slug)) slug += '-' + String(e.id).slice(-5)
    slugs.add(slug)
    const hours = parseHours(t.opening_hours), landmark = LANDMARKS[`${t.name}|${category}`] as (typeof LANDMARKS)[string] | undefined
    places.push({
      id: known.get(osm_id) ?? crypto.randomUUID(), osm_id, slug, name: t.name, category,
      subcategory: (t.cuisine?.split(';')[0] || t.shop || t.amenity || t.leisure || t.tourism || t.railway || '').replace(/_/g, ' '),
      description: (t.description ?? null) as string | null,
      address: [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), t['addr:postcode']].filter(Boolean).join(', ') || null,
      lat: +lat.toFixed(6), lng: +lng.toFixed(6),
      phone: (t.phone ?? t['contact:phone'] ?? null) as string | null,
      website: (t.website ?? t['contact:website'] ?? null) as string | null, // tags may be missing
      booking_url: [t['reservation:website'], t['website:booking'], t['booking']].find(v => /^https?:\/\//.test(v ?? '')) ?? null,
      hours, hours_note: hours ? null : t.opening_hours ?? null,
      cover_url: null, google_place_id: null, extra: osmFacts(t) as PlaceExtra, is_landmark: false, is_demo: false, verified: false, status: 'published' as const,
      ...(landmark && { is_landmark: true, ...landmark }),
    })
  }
  return places
}

// The database's own limits (supabase/migrations): a new row breaking one would sink its whole batch.
const clip = <T extends string | null>(s: T, max: number) => (s == null ? s : s.slice(0, max)) as T
const fits = (p: OsmPlace): OsmPlace => ({ ...p, name: p.name.slice(0, 120), subcategory: clip(p.subcategory, 60), description: clip(p.description, 2000), address: clip(p.address, 200),
  phone: clip(p.phone, 40), website: p.website && p.website.length <= 300 ? p.website : null, booking_url: p.booking_url && p.booking_url.length <= 300 ? p.booking_url : null, hours_note: clip(p.hours_note, 300) })

// What OpenStreetMap is the source of, for places no owner has claimed. The slug stays put so links keep working.
const OSM_FIELDS = ['name', 'category', 'subcategory', 'description', 'address', 'lat', 'lng', 'phone', 'website', 'booking_url', 'hours', 'hours_note', 'is_landmark'] as const

/**
 * What a fresh OpenStreetMap answer changes in the places we hold: rows to add, and per-place patches.
 * Unclaimed places take OpenStreetMap's latest details (a shop that closed and was replaced often keeps its map
 * point) and are hidden once they vanish from it (closed, or re-mapped under a new id, which arrives as new).
 * Claimed (verified) places and landmarks only ever get yes/no facts merged in.
 */
export function planRefresh(known: PlaceIndexRow[], answer: OsmPlace[]) {
  const found = answer.map(fits), byOsm = new Map(known.filter(p => p.osm_id).map(p => [p.osm_id!, p]))
  const fresh = found.filter(p => !byOsm.has(p.osm_id))
  const patches: [string, PlacePatch][] = []
  for (const p of found) {
    const row = byOsm.get(p.osm_id)
    if (!row) continue
    const patch: PlacePatch = {}, extra = { ...row.extra, ...p.extra }
    if (JSON.stringify(extra) !== JSON.stringify(row.extra)) patch.extra = extra
    if (!row.verified) for (const k of OSM_FIELDS) if (JSON.stringify(p[k]) !== JSON.stringify(row[k])) Object.assign(patch, { [k]: p[k] })
    if (Object.keys(patch).length) patches.push([row.id, patch])
  }
  // A short answer from a struggling server must not empty the map: nothing is hidden unless it is about as big as what we hold.
  const seen = new Set(found.map(p => p.osm_id)), listed = known.filter(p => p.osm_id && p.status === 'published')
  const gone = found.length >= listed.length * 0.9 ? listed.filter(p => !seen.has(p.osm_id!) && !p.verified && !p.is_landmark) : []
  for (const p of gone) patches.push([p.id, { status: 'hidden' }])
  return { fresh, patches, gone }
}
