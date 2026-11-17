import area from '../data/area.json' with { type: 'json' }

export const APP_NAME = 'Peekaborough'

// One area for now: the London Borough of Islington. Adding a second = making this a table.
export const HOOD = {
  name: 'Islington',
  center: [-0.1035, 51.5462] as [number, number], // lng, lat — Highbury Corner, roughly the middle of the borough
  /** The real borough boundary (written by scripts/import-osm.mjs). Everything outside is greyed out. */
  ring: area.ring as [number, number][],
  /** Places just over the border that are let in anyway (Finsbury Park, Clissold Park), with their own outlines. */
  extras: area.extras as unknown as { name: string; ring: [number, number][] }[],
  /** How far the camera may wander: far enough that any edge of the borough can sit mid-screen. */
  bounds: [[area.bbox[0] - 0.09, area.bbox[1] - 0.06], [area.bbox[2] + 0.09, area.bbox[3] + 0.06]] as [[number, number], [number, number]],
}

/** Is this point inside the borough or one of the extra parks? (ray casting against each outline) */
export function inArea(lng: number, lat: number): boolean {
  return [HOOD.ring, ...HOOD.extras.map(e => e.ring)].some(r => {
    let inside = false
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      if ((r[i][1] > lat) !== (r[j][1] > lat) && lng < (r[j][0] - r[i][0]) * (lat - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) inside = !inside
    }
    return inside
  })
}

export const CATEGORIES = {
  eat: { label: 'Eat', emoji: '🍜', color: '#eb7366' },
  cafe: { label: 'Coffee', emoji: '☕', color: '#c19bcf' },
  drink: { label: 'Pubs & bars', emoji: '🍺', color: '#f7c03d' },
  groceries: { label: 'Food shops', emoji: '🥕', color: '#92cd96' },
  shop: { label: 'Shops', emoji: '🛍️', color: '#66b9df' },
  services: { label: 'Services', emoji: '✂️', color: '#f49fae' },
  health: { label: 'Health', emoji: '💊', color: '#7fcbc3' },
  culture: { label: 'Culture', emoji: '🎭', color: '#b082c5' },
  active: { label: 'Sport', emoji: '⚽', color: '#b3cd60' },
  green: { label: 'Parks', emoji: '🌳', color: '#83c6cf' },
  community: { label: 'Community', emoji: '🏛️', color: '#f3a77f' },
  transport: { label: 'Transport', emoji: '🚇', color: '#97aedb' },
} as const
export type Category = keyof typeof CATEGORIES

/** Dogs welcome, by OpenStreetMap or the venue's own website (lib/place-sync.ts). */
/** Folds a name or search into a plain form so "the hope and anchor" finds "Hope & Anchor" and "finks" finds "Fink's". */
export const searchKey = (s: string) => ` ${s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f'’.]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ')} `.replace(/ the /g, ' ').replace(/ +/g, ' ').trim()

export const dogFriendly = (p: { extra: { dogs?: boolean } }) => p.extra.dogs === true
/** A café whose website welcomes laptops, or one with customer Wi-Fi that doesn't ban them. */
export const laptopFriendly = (p: { category: Category; extra: { laptops?: boolean; wifi?: boolean } }) =>
  p.extra.laptops === true || (p.category === 'cafe' && p.extra.wifi === true && p.extra.laptops !== false)
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as Category[]

export const EVENT_KINDS = {
  football: { label: 'Football', emoji: '⚽' },
  music: { label: 'Music', emoji: '🎤' },
  market: { label: 'Markets', emoji: '🧺' },
  community: { label: 'Community', emoji: '🤝' },
  sport: { label: 'Get active', emoji: '🏃' },
  food: { label: 'Food & drink', emoji: '🍽️' },
  arts: { label: 'Theatre & comedy', emoji: '🎭' },
} as const
export type EventKind = keyof typeof EVENT_KINDS

export const LISTING_KINDS = {
  sell: { label: 'For sale', emoji: '🏷️' },
  free: { label: 'Free', emoji: '🎁' },
  swap: { label: 'Swap', emoji: '🔁' },
  wanted: { label: 'Wanted', emoji: '🔎' },
  service: { label: 'Skills & help', emoji: '🧰' },
} as const
export type ListingKind = keyof typeof LISTING_KINDS

/** Where the site lives, for links in calendars, sitemaps and search results. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')

/** London's 32 boroughs and the City, for the "which borough next?" poll in the footer. */
export const LONDON_BOROUGHS = [
  'Barking and Dagenham', 'Barnet', 'Bexley', 'Brent', 'Bromley', 'Camden', 'City of London', 'Croydon', 'Ealing', 'Enfield',
  'Greenwich', 'Hackney', 'Hammersmith and Fulham', 'Haringey', 'Harrow', 'Havering', 'Hillingdon', 'Hounslow', 'Islington',
  'Kensington and Chelsea', 'Kingston upon Thames', 'Lambeth', 'Lewisham', 'Merton', 'Newham', 'Redbridge', 'Richmond upon Thames',
  'Southwark', 'Sutton', 'Tower Hamlets', 'Waltham Forest', 'Wandsworth', 'Westminster',
] as const

/** The site's contact address; shown on the legal pages. */
export const OPERATOR = { email: 'peekaborough@v-cents.com' }
/** Where would-be admins book a call after applying. */
export const ADMIN_CALL_URL = 'https://calendar.app.google/Ft5quHyq8kgWm1zE7'

// Demo mode = no Supabase keys: data lives in memory, sign-in is one click. See README.
export const DEMO = !process.env.NEXT_PUBLIC_SUPABASE_URL
/** Stand-in accounts for trying signed-in features without a database. Only ever on a developer's own machine. */
export const TEST_ACCOUNTS = DEMO && process.env.NODE_ENV === 'development'
