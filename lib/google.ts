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

/** Finds this place's Google listing by name near its coordinates; refuses matches more than ~250 m away or with a different name. */
async function findId(place: Place): Promise<string | null> {
  const res = await call('places:searchText', 'places.id,places.location,places.displayName', {
    method: 'POST',
    body: JSON.stringify({ textQuery: `${place.name}, ${place.address ?? 'London'}`, pageSize: 1, locationBias: { circle: { center: { latitude: place.lat, longitude: place.lng }, radius: 150 } } }),
  })
  const hit = res.ok ? (await res.json()).places?.[0] : null
  if (!hit?.location || !sameName(place.name, hit.displayName?.text ?? '')) return null
  const metres = Math.hypot((hit.location.latitude - place.lat) * 111320, (hit.location.longitude - place.lng) * 69500)
  return metres < 250 ? hit.id : null
}

export async function googlePlace(place: Place): Promise<GooglePlace | null> {
  if (!KEY || place.is_demo) return null
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
