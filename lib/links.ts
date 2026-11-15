import type { Place } from './types'

const GENERIC = new Set(['the', 'and', 'cafe', 'coffee', 'restaurant', 'bar', 'pub', 'shop', 'store', 'london', 'islington', 'ltd', 'limited', 'house', 'park', 'road', 'street'])
const words = (s: string) => new Set(s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !GENERIC.has(w)))
/**
 * Do two listings name the same place? Every distinctive word of the shorter name must appear in the
 * longer one ("Sadler's Wells" ~ "Sadler's Wells Theatre", "Emirates Stadium" ~ "Arsenal - Emirates
 * Stadium"). Sharing just one word is not enough: neighbours often share the area name or the trade
 * ("Highbury Dental" vs "Highbury Pharmacy"). Names made only of everyday words must match exactly.
 * Used to stop one business being shown another's Google reviews, so it errs towards "no".
 */
export function sameName(a: string, b: string): boolean {
  const A = words(a), B = words(b)
  if (!A.size || !B.size) return a.trim().toLowerCase() === b.trim().toLowerCase()
  const [small, large] = A.size <= B.size ? [A, B] : [B, A]
  return [...small].every(w => large.has(w))
}

type P = Pick<Place, 'name' | 'address' | 'lat' | 'lng'> & { google_place_id?: string | null }
// Plain Google Maps URLs: free, no API key, and they open the Google Maps app on a phone.
export const googleMapsUrl = (p: P) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.address ?? 'Islington, London'}`)}${p.google_place_id ? `&query_place_id=${p.google_place_id}` : ''}`
export const directionsUrl = (p: P) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.google_place_id ? encodeURIComponent(p.name) + `&destination_place_id=${p.google_place_id}` : `${p.lat},${p.lng}`}`
