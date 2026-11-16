import type { Category, EventKind, ListingKind } from './config'

export type DayHours = { open: string; close: string } | null
export type Hours = Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayHours>

export type User = { id: string; name: string; email: string | null; avatar_url: string | null; is_admin: boolean; /** has at least one verified business page */ is_owner: boolean }

/** Facts that come from imports rather than the owner. */
export type PlaceExtra = { lines?: { id: string; name: string }[]; outdoor_seating?: boolean; photo?: { url: string; credit_url: string } }

export type Place = {
  id: string; osm_id: string | null; slug: string; name: string; category: Category; subcategory: string | null
  description: string | null; address: string | null; lat: number; lng: number
  phone: string | null; website: string | null; booking_url: string | null; hours: Hours | null; hours_note: string | null
  cover_url: string | null; google_place_id: string | null; extra: PlaceExtra; is_landmark: boolean; is_demo: boolean; verified: boolean
  status: 'published' | 'hidden'
  rating: number | null; review_count: number
}
export type MapPlace = Pick<Place, 'id' | 'slug' | 'name' | 'category' | 'subcategory' | 'address' | 'lat' | 'lng' | 'hours' | 'cover_url' | 'extra' | 'is_landmark' | 'is_demo' | 'verified' | 'rating' | 'review_count'>

export type MenuItem = { id: string; place_id: string; section: string; name: string; description: string | null; price_pence: number | null; position: number }
export type Post = { id: string; place_id: string; title: string; body: string; created_at: string; place?: { name: string; slug: string; category: Category } }
export type Event = {
  id: string; place_id: string | null; title: string; description: string | null; kind: EventKind
  venue_name: string; lat: number; lng: number; starts_at: string; ends_at: string | null; url: string | null; price_pence: number | null
  /** The dearest ticket, when a source gives a range. */
  price_max_pence?: number | null
  /** True only when the source says no tickets are left. */
  sold_out?: boolean
  is_sample: boolean; status: 'published' | 'pending' | 'rejected'; created_by: string | null
  /** Set when the event was pulled in automatically (e.g. "Skiddle"); null for ones people added. */
  source: string | null
  place?: { slug: string } | null
}
export type Review = { id: string; place_id: string; user_id: string; rating: number; comment: string | null; status: 'visible' | 'hidden'; created_at: string; author: string; place?: { name: string; slug: string } }
export type Listing = { id: string; user_id: string; kind: ListingKind; title: string; description: string; price_pence: number | null; contact: string; status: 'active' | 'closed' | 'hidden'; created_at: string; author: string }
export type Wish = { id: string; user_id: string; title: string; description: string | null; status: 'visible' | 'hidden'; created_at: string; author: string; ups: number; downs: number; mine: -1 | 0 | 1 }
export type AdminApplication = {
  id: string; user_id: string; full_name: string; email: string; phone: string; address: string
  years_in_area: number; occupation: string; favourite_thing: string
  status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string
  /** the account that applied, as it appears on the site */
  account?: { name: string; email: string | null }
}
export type AdminUser = { id: string; name: string; email: string | null }

export type Claim = {
  id: string; place_id: string; user_id: string; role: string; business_email: string; phone: string | null; evidence: string
  status: 'pending' | 'approved' | 'rejected'; admin_note: string | null; created_at: string
  place?: { name: string; slug: string; address: string | null; website: string | null }; claimant?: { name: string; email: string | null }
}
