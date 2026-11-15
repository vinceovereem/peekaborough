import type { Place } from './types'

const GENERIC = new Set(['the', 'and', 'cafe', 'coffee', 'restaurant', 'bar', 'pub', 'shop', 'store', 'london', 'islington', 'ltd', 'limited', 'house', 'park', 'road', 'street'])
// Words that say where a business is rather than which one it is. Neighbours share these all the time.
const LOCAL = new Set(['highbury', 'arsenal', 'angel', 'holloway', 'finsbury', 'canonbury', 'barnsbury', 'archway', 'clerkenwell', 'tufnell', 'caledonian', 'essex', 'upper', 'blackstock', 'chapel', 'exmouth', 'stroud', 'newington', 'kings', 'cross', 'farringdon', 'pentonville', 'drayton', 'gillespie', 'mildmay', 'hornsey', 'seven', 'sisters', 'city', 'north', 'south', 'east', 'west', 'old', 'new', 'green', 'market', 'corner', 'local', 'express'])
const words = (s: string) => [...new Set(s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/['’]/g, '').split(/[^a-z0-9]+/).filter(w => w.length > 2 && !GENERIC.has(w)))]

/** Same word, allowing one slip of the keyboard in longer words ("ciceak" ~ "cicek"). */
function alike(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, slips = 0 // one substitution, insertion or deletion
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++slips > 1) return false
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++ }
  }
  return slips + (a.length - i) + (b.length - j) <= 1
}

/**
 * Do two listings name the same place? Used to stop one business being shown another's Google
 * reviews, so when in doubt it says no.
 *
 * Yes when every distinctive word of the shorter name appears in the longer one, spelling slips
 * allowed: "Sadler's Wells" ~ "Sadler's Wells Theatre", "Sari Ciceak" ~ "Sari Çicek".
 * Also yes when just one word differs, provided at least two others match and one of those is the
 * business's own name rather than its location: "Maandli Hair & Beauty" ~ "Maandli Hair Salon".
 * No for neighbours that merely share the area or the trade: "Highbury Dental" vs "Highbury
 * Pharmacy", "Arsenal Barbers" vs "Blackstock Barbers". Names made only of everyday words must
 * match exactly.
 */
export function sameName(a: string, b: string): boolean {
  const A = words(a), B = words(b)
  if (!A.length || !B.length) return a.trim().toLowerCase() === b.trim().toLowerCase()
  const [small, large] = A.length <= B.length ? [A, B] : [B, A]
  const matched = small.filter(w => large.some(v => alike(w, v)))
  if (matched.length === small.length) return true
  return small.length - matched.length === 1 && matched.length >= 2 && matched.some(w => !LOCAL.has(w))
}

type P = Pick<Place, 'name' | 'address' | 'lat' | 'lng'> & { google_place_id?: string | null }
// Plain Google Maps URLs: free, no API key, and they open the Google Maps app on a phone.
export const googleMapsUrl = (p: P) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.address ?? 'Islington, London'}`)}${p.google_place_id ? `&query_place_id=${p.google_place_id}` : ''}`
export const directionsUrl = (p: P) =>
  `https://www.google.com/maps/dir/?api=1&destination=${p.google_place_id ? encodeURIComponent(p.name) + `&destination_place_id=${p.google_place_id}` : `${p.lat},${p.lng}`}`
