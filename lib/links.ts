import type { Place } from './types'

type P = Pick<Place, 'name' | 'address' | 'lat' | 'lng'> & { google_place_id?: string | null }
// Plain Google Maps URLs: free, no API key, and they open the Google Maps app on a phone.
export const googleMapsUrl = (p: P) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.address ?? 'Islington, London'}`)}${p.google_place_id ? `&query_place_id=${p.google_place_id}` : ''}`
export const directionsUrl = (p: P) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.google_place_id ? encodeURIComponent(p.name) + `&destination_place_id=${p.google_place_id}` : `${p.lat},${p.lng}`}`
