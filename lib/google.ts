// Optional live link to Google Maps (Places API). Off unless GOOGLE_MAPS_API_KEY is set.
//
// Google's rules shape this file: Places content (ratings, reviews, hours, photos) may be shown
// with attribution but must not be stored — only the place ID may be kept. So we save the ID once
// and fetch everything else fresh on each place-page view. It also may not be drawn on a
// non-Google map, which is why none of this appears on the map pins.
import { repo } from './repo'
import { sameName } from './links'
import type { Place } from './types'

const KEY = process.env.GOOGLE_MAPS_API_KEY
const API = 'https://places.googleapis.com/v1'
const FIELDS = 'id,displayName,googleMapsUri,rating,userRatingCount,regularOpeningHours.weekdayDescriptions,currentOpeningHours.openNow,reservable,photos,reviews'

export type GooglePlace = {
  id: string; displayName?: { text: string }; googleMapsUri?: string; rating?: number; userRatingCount?: number; reservable?: boolean
  regularOpeningHours?: { weekdayDescriptions?: string[] }; currentOpeningHours?: { openNow?: boolean }
  photos?: { name: string; authorAttributions?: { displayName: string; uri: string }[] }[]
  reviews?: { rating: number; text?: { text: string }; relativePublishTimeDescription?: string; authorAttribution?: { displayName: string; uri: string; photoUri: string } }[]
  /** Short-lived image URL for the first photo. */
  photoUri?: string
}

const call = (path: string, mask: string, init?: RequestInit) =>
  fetch(`${API}/${path}`, { ...init, cache: 'no-store', headers: { 'X-Goog-Api-Key': KEY!, 'X-Goog-FieldMask': mask, 'Content-Type': 'application/json' } })

type Candidate = { id: string; displayName?: { text: string }; location?: { latitude: number; longitude: number } }

/**
 * Finds this place's Google listing by name near its coordinates. Google's top result is sometimes a
 * neighbour at the same address (the club shop rather than the stadium), so we take the first of
 * several candidates that is both within ~250 m and shares our name, and refuse the rest.
 */
async function findId(place: Place): Promise<string | null> {
  const res = await call('places:searchText', 'places.id,places.location,places.displayName', {
    method: 'POST',
    body: JSON.stringify({ textQuery: `${place.name}, ${place.address ?? 'London'}`, pageSize: 5, locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 150 } } }),
  })
  const candidates: Candidate[] = res.ok ? (await res.json()).places ?? [] : []
  const metres = (c: Candidate) => c.location ? Math.hypot((c.location.latitude - place.lat) * 111320, (c.location.longitude - place.lng) * 69500) : Infinity
  const match = candidates.find(c => metres(c) < 250 && sameName(place.name, c.displayName?.text ?? ''))
  // Leave a trail when nothing fits, so "why has this place no Google details?" can be answered from the logs.
  if (!match) console.info(`No Google listing accepted for "${place.name}"${res.ok ? '' : ` (search answered ${res.status})`}: ${candidates.map(c => `${c.displayName?.text} at ${Math.round(metres(c))} m`).join('; ') || 'no candidates'}`)
  return match?.id ?? null
}

export async function googlePlace(place: Place): Promise<GooglePlace | null> {
  // Stations are skipped: their pages already carry live TfL information, and searching Google for
  // "Angel" by name and address returns the street or the shopping centre, not the station.
  if (!KEY || place.is_demo || place.category === 'transport') return null
  try {
    let id = place.google_place_id
    if (!id) {
      id = await findId(place)
      if (!id) return null
      await repo.setGooglePlaceId(place.id, id)
    }
    const res = await call(`places/${id}?languageCode=en-GB&regionCode=GB`, FIELDS) // UK spellings and 24-hour-friendly times
    if (!res.ok) return null
    const g = await res.json() as GooglePlace
    if (g.photos?.[0] && !place.cover_url) { // one photo, fetched server-side so the API key never reaches the browser
      const photo = await fetch(`${API}/${g.photos[0].name}/media?maxWidthPx=1200&skipHttpRedirect=true&key=${KEY}`, { cache: 'no-store' })
      if (photo.ok) g.photoUri = (await photo.json()).photoUri
    }
    return g
  } catch (e) {
    console.error('Google Places lookup failed', e)
    return null // the page works without it
  }
}
