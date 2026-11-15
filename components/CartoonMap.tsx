'use client'
import { useEffect, useRef } from 'react'
import type { Map as MLMap, Marker as MLMarker, GeoJSONSource, GeoJSONFeature } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { CATEGORIES, CATEGORY_KEYS, HOOD } from '@/lib/config'
import { cartoonStyle, INK } from '@/lib/map-style'
import type { MapPlace } from '@/lib/types'

export type MapPin = { id: string; lng: number; lat: number; label: string; today: boolean }
type Props = {
  places?: MapPlace[]
  pins?: MapPin[]
  /** Where to fly to; `id` (a place) also gets its pin enlarged. */
  selected?: { lng: number; lat: number; id?: string } | null
  onPlace?: (id: string) => void
  onPin?: (id: string) => void
  /** Decorative mode for the login page: no data, no interaction, slow spin. */
  hero?: boolean
}

const PIN_SCALE = 4 // pins are drawn at 4x so the biggest (the selected place) stays sharp on phone screens
const loadIcon = (key: string) => new Promise<HTMLImageElement | null>(done => {
  const i = new Image()
  i.onload = () => done(i); i.onerror = () => done(null) // no picture: the pin falls back to the emoji
  i.src = `/icons/${key}.webp`
})

/** Draws a cartoon map pin (clay badge with an ink outline and pointer) to use as a symbol icon. */
function pinImage(icon: HTMLImageElement | null, emoji: string, colour: string) {
  const s = 160, h = 196, c = document.createElement('canvas')
  c.width = s; c.height = h
  const x = c.getContext('2d')!, r = s / 2 - 8
  x.fillStyle = INK
  x.beginPath(); x.moveTo(s / 2 - r * 0.6, s / 2 + r * 0.7); x.lineTo(s / 2, h - 4); x.lineTo(s / 2 + r * 0.6, s / 2 + r * 0.7); x.fill()
  x.beginPath(); x.arc(s / 2, s / 2, r, 0, Math.PI * 2); x.fillStyle = colour; x.fill()
  if (icon) x.drawImage(icon, s / 2 - r, s / 2 - r, r * 2, r * 2)
  else {
    x.font = '76px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(emoji, s / 2, s / 2 + 6)
  }
  x.lineWidth = 8; x.strokeStyle = INK; x.stroke()
  return x.getImageData(0, 0, s, h)
}

/**
 * Homes stay grey; a building gets its venue's colour. The base tiles don't say what is inside a
 * building (and reuse feature ids, so they can't be tagged), so as tiles load we find the footprint
 * each venue sits in and redraw it, a whisker larger, in a coloured layer of our own.
 */
function colourVenueBuildings(m: MLMap, places: MapPlace[]) {
  const CELL = 0.001 // ~70-110 m buckets, so a footprint is only tested against nearby venues
  const grid = new Map<string, MapPlace[]>()
  for (const p of [...places].sort((a, b) => +b.is_landmark - +a.is_landmark)) {
    const k = `${Math.floor(p.lng / CELL)},${Math.floor(p.lat / CELL)}`
    grid.set(k, [...(grid.get(k) ?? []), p])
  }
  const inside = (ring: number[][], x: number, y: number) => {
    let hit = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) if ((ring[i][1] > y) !== (ring[j][1] > y) && x < (ring[j][0] - ring[i][0]) * (y - ring[i][1]) / (ring[j][1] - ring[i][1]) + ring[i][0]) hit = !hit
    return hit
  }
  const stadiums = places.filter(p => p.is_landmark && p.category === 'active')
  const seen = new Set<string>(), found: GeoJSON.Feature[] = []
  m.on('idle', () => {
    if (m.getZoom() < 14) return
    const before = found.length
    for (const f of m.querySourceFeatures('omt', { sourceLayer: 'building' }) as GeoJSONFeature[]) {
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []
      for (const poly of polys) {
        const ring = poly[0], id = `${ring.length}|${ring[0]}`
        if (seen.has(id)) continue
        seen.add(id)
        const xs = ring.map(c => c[0]), ys = ring.map(c => c[1])
        let venue: MapPlace | undefined
        for (let gx = Math.floor(Math.min(...xs) / CELL); gx <= Math.floor(Math.max(...xs) / CELL) && !venue; gx++)
          for (let gy = Math.floor(Math.min(...ys) / CELL); gy <= Math.floor(Math.max(...ys) / CELL) && !venue; gy++)
            venue = grid.get(`${gx},${gy}`)?.find(p => inside(ring, p.lng, p.lat))
        // a stadium's pin sits on the pitch, not in the stands: colour whatever is built around it
        venue ??= stadiums.find(p => Math.hypot((p.lng - (Math.min(...xs) + Math.max(...xs)) / 2) * 69500, (p.lat - (Math.min(...ys) + Math.max(...ys)) / 2) * 111320) < 120)
        if (!venue) continue
        // grow 2% about the middle so the coloured walls sit just outside the grey ones (no flicker)
        const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2
        found.push({ type: 'Feature', properties: { cat: venue.category, h: (f.properties.render_height ?? 8) + 0.6, base: f.properties.render_min_height ?? 0 },
          geometry: { type: 'Polygon', coordinates: poly.map(r => r.map(([x, y]) => [cx + (x - cx) * 1.02, cy + (y - cy) * 1.02])) } })
      }
    }
    if (found.length > before) (m.getSource('venue-buildings') as GeoJSONSource).setData({ type: 'FeatureCollection', features: found })
  })
}

const toGeoJSON = (places: MapPlace[]) => ({
  type: 'FeatureCollection' as const,
  features: places.map(p => ({
    type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
    // rank: who wins the space when pins collide — verified/demo businesses, then reviewed, then the rest
    properties: { id: p.id, name: p.name, category: p.category, lm: p.is_landmark, rank: p.verified ? 0 : p.review_count ? 1 : 2 },
  })),
})

export default function CartoonMap({ places, pins, selected, onPlace, onPin, hero }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<MLMap | null>(null)
  const lib = useRef<typeof import('maplibre-gl') | null>(null)
  const pinMarkers = useRef<MLMarker[]>([])
  const latest = useRef({ places, pins, selected, onPlace, onPin })
  useEffect(() => { latest.current = { places, pins, selected, onPlace, onPin } })

  const syncPlaces = () => (map.current?.getSource('places') as GeoJSONSource | undefined)?.setData(toGeoJSON(latest.current.places ?? []))
  const syncPins = () => {
    if (!map.current || !lib.current) return
    pinMarkers.current.forEach(m => m.remove())
    pinMarkers.current = (latest.current.pins ?? []).map(pin => {
      const b = document.createElement('button')
      b.className = `event-pin${pin.today ? ' today' : ''}`; b.textContent = pin.label
      b.onclick = e => { e.stopPropagation(); latest.current.onPin?.(pin.id) }
      return new lib.current!.Marker({ element: b, anchor: 'bottom', offset: [0, -52] }).setLngLat([pin.lng, pin.lat]).addTo(map.current!)
    })
  }
  const syncSelected = () => {
    const m = map.current, sel = latest.current.selected
    if (!m?.getLayer('selected')) return
    m.setFilter('selected', ['==', ['get', 'id'], sel?.id ?? ''])
    if (sel) m.flyTo({ center: [sel.lng, sel.lat], zoom: Math.max(m.getZoom(), 16.6), duration: 1400, essential: true })
  }

  useEffect(() => {
    let dead = false, spin = 0
    const icons = hero ? null : Promise.all(CATEGORY_KEYS.map(loadIcon))
    import('maplibre-gl').then(ml => {
      if (dead || !el.current) return
      lib.current = ml
      ml.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs') // copied from node_modules by `npm install`
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches
      const m = map.current = new ml.Map({
        container: el.current, style: cartoonStyle(), center: HOOD.center, maxBounds: HOOD.bounds,
        zoom: hero ? 15.8 : 14.2, pitch: hero ? 62 : 25, bearing: hero ? 20 : 0, minZoom: 11, maxPitch: 72,
        interactive: !hero, attributionControl: { compact: true },
      })
      if (hero) {
        const turn = () => { m.setBearing(m.getBearing() + 0.025); spin = requestAnimationFrame(turn) }
        if (!still) m.once('load', turn)
        return
      }
      m.addControl(new ml.NavigationControl({ showCompass: false }), 'bottom-right')
      // One button, two states: straight down, or back to the tilted view you were in.
      m.addControl({
        onAdd() {
          const box = document.createElement('div'), b = document.createElement('button')
          box.className = 'maplibregl-ctrl maplibregl-ctrl-group'; b.type = 'button'; b.className = 'view-toggle'
          let tilted = { pitch: 60, bearing: -18 }
          const label = () => { const flat = m.getPitch() < 5; b.textContent = flat ? '3D' : '2D'; b.title = flat ? 'Back to the 3D view' : 'Look straight down'; b.setAttribute('aria-label', b.title) }
          b.onclick = () => {
            if (m.getPitch() < 5) return m.easeTo({ ...tilted, duration: 700 })
            tilted = { pitch: m.getPitch(), bearing: m.getBearing() }
            m.easeTo({ pitch: 0, bearing: 0, duration: 700 })
          }
          m.on('moveend', label); label(); box.append(b)
          return box
        },
        onRemove() {},
      }, 'bottom-right')
      m.addControl(new ml.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }), 'bottom-right')
      m.on('load', () => {
        // the layers below name these images before they exist; MapLibre draws the pins as each one arrives
        icons?.then(loaded => { if (!dead) CATEGORY_KEYS.forEach((key, i) => m.addImage(`pin-${key}`, pinImage(loaded[i], CATEGORIES[key].emoji, CATEGORIES[key].color), { pixelRatio: PIN_SCALE })) })
        m.addSource('places', { type: 'geojson', data: toGeoJSON(latest.current.places ?? []) })
        const text = { 'text-font': ['Noto Sans Bold'], 'text-anchor': 'top' as const, 'text-offset': [0, 0.15] as [number, number], 'text-max-width': 8, 'text-optional': true }
        const paint = { 'text-color': INK, 'text-halo-color': '#fff8ea', 'text-halo-width': 2 }
        m.addLayer({ id: 'places', type: 'symbol', source: 'places', filter: ['!', ['get', 'lm']], layout: {
          'icon-image': ['concat', 'pin-', ['get', 'category']], 'icon-anchor': 'bottom', 'icon-padding': 1,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.4, 16, 0.75, 18.5, 1.05],
          'symbol-sort-key': ['get', 'rank'],
          'text-field': ['step', ['zoom'], '', 16.2, ['get', 'name']], 'text-size': 12, ...text,
        }, paint })
        m.addLayer({ id: 'landmarks', type: 'symbol', source: 'places', filter: ['get', 'lm'], layout: {
          'icon-image': ['concat', 'pin-', ['get', 'category']], 'icon-anchor': 'bottom', 'icon-allow-overlap': true,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.85, 17, 1.45],
          'text-field': ['get', 'name'], 'text-size': ['interpolate', ['linear'], ['zoom'], 13, 12, 17, 16], ...text,
        }, paint })
        // the place you picked: same pin, bigger, always labelled
        m.addLayer({ id: 'selected', type: 'symbol', source: 'places', filter: ['==', ['get', 'id'], ''], layout: {
          'icon-image': ['concat', 'pin-', ['get', 'category']], 'icon-anchor': 'bottom', 'icon-size': 1.6, 'icon-allow-overlap': true,
          'text-field': ['get', 'name'], 'text-size': 15, 'text-allow-overlap': true, ...text,
        }, paint })
        for (const layer of ['places', 'landmarks']) {
          m.on('click', layer, e => { const id = e.features?.[0]?.properties.id; if (id) latest.current.onPlace?.(id) })
          m.on('mouseenter', layer, () => { m.getCanvas().style.cursor = 'pointer' })
          m.on('mouseleave', layer, () => { m.getCanvas().style.cursor = '' })
        }
        colourVenueBuildings(m, latest.current.places ?? [])
        syncPins()
        syncSelected()
        if (!latest.current.selected) m.easeTo({ zoom: 15.6, pitch: 60, bearing: -18, duration: still ? 0 : 3200 }) // swoop in from above
      })
    })
    return () => { dead = true; cancelAnimationFrame(spin); map.current?.remove(); map.current = null }
  }, [hero])

  useEffect(() => { syncPlaces() }, [places])
  useEffect(syncPins, [pins])
  useEffect(syncSelected, [selected])

  return <div ref={el} className="h-full w-full" aria-label={`3D map of ${HOOD.name}`} />
}
