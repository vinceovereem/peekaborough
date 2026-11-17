// Pulls real, named places inside the borough boundary from OpenStreetMap (ODbL) into
// data/places.json, adds station lines from TfL and free-licence photos from Wikimedia Commons,
// and writes the borough outline to data/area.json. Change AREA to cover somewhere else. Re-run any time: `node scripts/import-osm.mjs`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const file = name => new URL(`../data/${name}`, import.meta.url)
const UA = { 'User-Agent': 'neighbourhood-guide-prototype' }
const AREA = 'London Borough of Islington'

// Two big parks sit just over the border but are part of everyday life here, so they are let in too.
const EXTRA_PARKS = ['Finsbury Park', 'Clissold Park']

const nominatim = async q => {
  await new Promise(r => setTimeout(r, 1100)) // their usage policy: at most one request a second
  return (await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&polygon_geojson=1&polygon_threshold=0.0001&limit=8`, { headers: UA })).json()
}
const outerRing = g => (g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map(p => p[0])).sort((x, y) => y.length - x.length)[0].map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)])

/** The real administrative boundary plus the extra parks' outlines, from OpenStreetMap via Nominatim. */
async function boundary() {
  const borough = (await nominatim(AREA)).find(h => h.class === 'boundary')
  if (!borough) throw new Error(`No boundary found for ${AREA}`)
  const ring = outerRing(borough.geojson), extras = []
  for (const name of EXTRA_PARKS) {
    const park = (await nominatim(`${name}, London`)).find(h => h.class === 'leisure' && h.type === 'park' && /Polygon/.test(h.geojson?.type))
    if (park) extras.push({ name, ring: outerRing(park.geojson) })
    else console.error(`No outline found for ${name}; it will be left out`)
  }
  const all = [ring, ...extras.map(e => e.ring)].flat(), xs = all.map(c => c[0]), ys = all.map(c => c[1])
  return { ring, extras, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] } // W, S, E, N
}
const inRing = (ring, x, y) => { // ray casting
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const query = BBOX => `[out:json][timeout:120];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|pub|bar|biergarten|ice_cream|pharmacy|doctors|dentist|clinic|veterinary|theatre|cinema|arts_centre|library|community_centre|nightclub|place_of_worship|post_office|bank|music_venue|marketplace)$"]["name"](${BBOX});
  nwr["shop"]["name"](${BBOX});
  nwr["leisure"~"^(park|fitness_centre|sports_centre|swimming_pool|stadium|playground|garden)$"]["name"](${BBOX});
  nwr["tourism"~"^(museum|gallery|attraction|hotel)$"]["name"](${BBOX});
  nwr["railway"="station"]["name"](${BBOX});
);
out center tags;`

const EAT = ['restaurant', 'fast_food', 'ice_cream']
const DRINK = ['pub', 'bar', 'biergarten', 'nightclub']
const HEALTH = ['pharmacy', 'doctors', 'dentist', 'clinic', 'veterinary']
const CULTURE = ['theatre', 'cinema', 'arts_centre', 'library', 'music_venue']
const SERVICES = ['hairdresser', 'beauty', 'laundry', 'dry_cleaning', 'estate_agent', 'tailor', 'massage', 'tattoo', 'travel_agency', 'funeral_directors', 'locksmith', 'copyshop', 'optician', 'mobile_phone', 'shoe_repair', 'bookmaker', 'money_lender', 'pawnbroker', 'car_repair']
const GROCERIES = ['supermarket', 'convenience', 'greengrocer', 'butcher', 'bakery', 'deli', 'cheese', 'seafood', 'alcohol', 'wine', 'health_food', 'pastry', 'confectionery', 'chocolate', 'coffee', 'tea', 'farm', 'spices']

function categorise(t) {
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

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const OSM_DAYS = { Mo: 0, Tu: 1, We: 2, Th: 3, Fr: 4, Sa: 5, Su: 6 }
// ponytail: understands weekly rules with one opening per day ("Mo-Fr 08:00-18:00; Sa,Su 09:00-17:00",
// comma-separated rules, "Su off", public-holiday tokens). Split shifts, seasons and "sunset" return
// null and the raw text is kept in hours_note rather than guessing an "open now" that could be wrong.
export function parseHours(input) {
  if (!input) return null
  if (input.trim() === '24/7') return Object.fromEntries(DAYS.map(d => [d, { open: '00:00', close: '24:00' }]))
  const out = Object.fromEntries(DAYS.map(d => [d, null]))
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

// Hand-picked local icons: always shown on the map, bigger pins. Keyed "name|category as imported".
// Descriptions here are plain, checkable facts (what it is, where it is) — no capacities, founding
// dates or superlatives. Anything richer should come from the owner or a cited source.
const LANDMARKS = {
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

const slugify = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const metres = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 69500)

async function overpass(bbox) {
  // Public Overpass servers are often busy — try mirrors, then back off and go round again.
  const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
  for (let attempt = 0; attempt < 9; attempt++) {
    const res = await fetch(MIRRORS[attempt % 3], { method: 'POST', body: 'data=' + encodeURIComponent(query(bbox)), headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...UA } }).catch(() => null)
    if (res?.ok) return (await res.json()).elements
    console.error(`${MIRRORS[attempt % 3]} -> ${res?.status ?? 'network error'}, retrying`)
    await new Promise(r => setTimeout(r, 4000 * (attempt + 1)))
  }
  throw new Error('All Overpass mirrors failed — try again in a few minutes')
}

/** Which lines call at each station (TfL, free, no key). */
async function tflStations([W, S, E, N]) {
  // TfL times out on one borough-sized circle, so cover it with three smaller ones, north to south.
  const stops = []
  for (const f of [1 / 6, 3 / 6, 5 / 6]) {
    const url = `https://api.tfl.gov.uk/StopPoint?lat=${S + (N - S) * f}&lon=${(W + E) / 2}&radius=2600&stopTypes=NaptanMetroStation,NaptanRailStation&modes=tube,overground,national-rail,elizabeth-line`
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(40000) }).catch(() => null)
    if (!res?.ok) { console.error('TfL lookup failed for one slice; some stations will have no lines'); continue }
    stops.push(...((await res.json()).stopPoints ?? []))
  }
  return stops.map(s => ({ lat: s.lat, lng: s.lon, lines: s.lines.map(l => ({ id: l.id, name: l.name })) }))
}

/** Wikidata ids -> Commons file names of their main image (P18). */
async function wikidataImages(ids) {
  const out = {}
  for (let i = 0; i < ids.length; i += 50) {
    const res = await fetch(`https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims&format=json&ids=${ids.slice(i, i + 50).join('|')}`, { headers: UA })
    for (const [id, e] of Object.entries((await res.json()).entities ?? {})) {
      const f = e.claims?.P18?.[0]?.mainsnak?.datavalue?.value
      if (f) out[id] = f
    }
  }
  return out
}
// Commons serves any file at a given width from this stable URL; the file page carries author + licence.
// Mappers sometimes leave off the "https://". The database only accepts web addresses, so add it or drop the value.
const web = v => !v || /\s/.test(v) ? null : /^https?:\/\//i.test(v) ? v : /^[a-z][a-z0-9+.-]*:/i.test(v) ? null : `https://${v}`
const commonsPhoto = f => ({ url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/ /g, '_'))}?width=1000`, credit_url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, '_'))}` })
const commonsFile = t => [t.wikimedia_commons, t.image].map(v => v?.match(/(?:^|\/)File:(.+\.(?:jpe?g|png|webp))$/i)?.[1]).find(Boolean)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ring, extras, bbox } = await boundary()
  const inside = (x, y) => inRing(ring, x, y) || extras.some(e => inRing(e.ring, x, y))
  const [W, S, E, N] = bbox
  const [elements, stations] = await Promise.all([overpass(`${S},${W},${N},${E}`), tflStations(bbox)])
  const p18 = await wikidataImages([...new Set(elements.map(e => e.tags?.wikidata).filter(q => /^Q\d+$/.test(q ?? '')))])
  const old = existsSync(file('places.json')) ? JSON.parse(readFileSync(file('places.json'), 'utf8')) : []
  const idByOsm = new Map(old.map(p => [p.osm_id, p.id]))
  const seen = new Set(), slugs = new Set(), places = []
  for (const e of elements) {
    const t = e.tags, lat = e.lat ?? e.center?.lat, lng = e.lon ?? e.center?.lon
    if (!t?.name || lat == null || !inside(lng, lat)) continue
    const category = categorise(t)
    const dedupe = `${t.name.toLowerCase()}|${category}|${lat.toFixed(3)}|${lng.toFixed(3)}` // node+way doubles of the same place
    if (seen.has(dedupe)) continue
    seen.add(dedupe)
    let slug = slugify(t.name) || 'place'
    if (slugs.has(slug)) slug += '-' + String(e.id).slice(-5)
    slugs.add(slug)
    const osm_id = `${e.type}/${e.id}`
    const hours = parseHours(t.opening_hours)

    const extra = {}
    if (category === 'transport') {
      const lines = new Map(stations.filter(s => metres(s, { lat, lng }) < 250).flatMap(s => s.lines).map(l => [l.id, l]))
      if (lines.size) extra.lines = [...lines.values()]
    }
    if (t.amenity === 'biergarten' || t.beer_garden === 'yes' || (t.outdoor_seating && t.outdoor_seating !== 'no')) extra.outdoor_seating = true
    const photo = commonsFile(t) ?? p18[t.wikidata]
    if (photo) extra.photo = commonsPhoto(photo)

    places.push({
      id: idByOsm.get(osm_id) ?? randomUUID(), osm_id, slug, name: t.name, category,
      subcategory: (t.cuisine?.split(';')[0] || t.shop || t.amenity || t.leisure || t.tourism || t.railway || '').replace(/_/g, ' '),
      description: t.description ?? null,
      address: [[t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' '), t['addr:postcode']].filter(Boolean).join(', ') || null,
      lat: +lat.toFixed(6), lng: +lng.toFixed(6),
      phone: t.phone ?? t['contact:phone'] ?? null,
      website: web(t.website ?? t['contact:website']),
      booking_url: [t['reservation:website'], t['website:booking'], t['booking']].find(v => /^https?:\/\//.test(v ?? '')) ?? null,
      hours, hours_note: hours ? null : t.opening_hours ?? null,
      cover_url: null, google_place_id: null, extra, is_landmark: false, is_demo: false, verified: false, status: 'published',
      ...(LANDMARKS[`${t.name}|${category}`] && { is_landmark: true, ...LANDMARKS[`${t.name}|${category}`] }),
    })
  }
  places.sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(file('places.json'), JSON.stringify(places).replace(/},\{"id"/g, '},\n{"id"'))
  writeFileSync(file('area.json'), JSON.stringify({ name: AREA, bbox, ring, extras }))
  const n = f => places.filter(f).length
  console.log(`${places.length} places | hours ${n(p => p.hours)} (+${n(p => p.hours_note)} as text) | photos ${n(p => p.extra.photo)} | outdoor seating ${n(p => p.extra.outdoor_seating)} | booking links ${n(p => p.booking_url)} | stations with lines ${n(p => p.extra.lines)}`)
}
