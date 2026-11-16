// Pulls real, named places inside the borough boundary from OpenStreetMap (ODbL) into
// data/places.json, adds station lines from TfL and free-licence photos from Wikimedia Commons,
// and writes the borough outline to data/area.json. Change AREA to cover somewhere else. Re-run any time: `node scripts/import-osm.mjs`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { overpass, toPlaces, UA } from '../lib/osm.ts' // the venue rules, shared with the monthly refresh (lib/place-sync.ts)

const file = name => new URL(`../data/${name}`, import.meta.url)
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

const metres = (a, b) => Math.hypot((a.lat - b.lat) * 111320, (a.lng - b.lng) * 69500)

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
const commonsPhoto = f => ({ url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(f.replace(/ /g, '_'))}?width=1000`, credit_url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(f.replace(/ /g, '_'))}` })
const commonsFile = t => [t.wikimedia_commons, t.image].map(v => v?.match(/(?:^|\/)File:(.+\.(?:jpe?g|png|webp))$/i)?.[1]).find(Boolean)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { ring, extras, bbox } = await boundary()
  const inside = (x, y) => inRing(ring, x, y) || extras.some(e => inRing(e.ring, x, y))
  const [W, S, E, N] = bbox
  const [elements, stations] = await Promise.all([overpass(`${S},${W},${N},${E}`), tflStations(bbox)])
  const p18 = await wikidataImages([...new Set(elements.map(e => e.tags?.wikidata).filter(q => /^Q\d+$/.test(q ?? '')))])
  const old = existsSync(file('places.json')) ? JSON.parse(readFileSync(file('places.json'), 'utf8')) : []
  const tags = new Map(elements.map(e => [`${e.type}/${e.id}`, e.tags]))
  const places = toPlaces(elements, inside, new Map(old.map(p => [p.osm_id, p.id])), new Set())
  const webFound = new Map(old.map(p => [p.osm_id, p.extra]))
  for (const p of places) {
    if (p.category === 'transport') {
      const lines = new Map(stations.filter(s => metres(s, p) < 250).flatMap(s => s.lines).map(l => [l.id, l]))
      if (lines.size) p.extra.lines = [...lines.values()]
    }
    const photo = commonsFile(tags.get(p.osm_id)) ?? p18[tags.get(p.osm_id).wikidata]
    if (photo) p.extra.photo = commonsPhoto(photo)
    // keep what the website scan found last time (lib/place-sync.ts); OpenStreetMap's own tags win
    const was = webFound.get(p.osm_id) ?? {}
    for (const k of ['laptops', 'web_checked', 'web_source']) if (was[k] !== undefined) p.extra[k] = was[k]
    if (p.extra.dogs === undefined && was.dogs !== undefined) p.extra.dogs = was.dogs
  }
  places.sort((a, b) => a.name.localeCompare(b.name))
  writeFileSync(file('places.json'), JSON.stringify(places).replace(/},\{"id"/g, '},\n{"id"'))
  writeFileSync(file('area.json'), JSON.stringify({ name: AREA, bbox, ring, extras }))
  const n = f => places.filter(f).length
  console.log(`${places.length} places | hours ${n(p => p.hours)} (+${n(p => p.hours_note)} as text) | photos ${n(p => p.extra.photo)} | outdoor seating ${n(p => p.extra.outdoor_seating)} | dogs welcome ${n(p => p.extra.dogs)} | wifi ${n(p => p.extra.wifi)} | booking links ${n(p => p.booking_url)} | stations with lines ${n(p => p.extra.lines)}`)
}
