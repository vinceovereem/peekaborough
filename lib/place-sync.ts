// Keeps the venue list fresh without a redeploy. Runs weekly (vercel.json cron -> /api/sync/places) and from the
// back office:
//  1. OpenStreetMap: new venues are added. Places no owner has claimed take OpenStreetMap's latest details (a shop
//     that closed and was replaced often keeps its map point), and are hidden once they vanish from it. Claimed
//     places only get yes/no facts, so an owner's edits to name, hours or description are never overwritten.
//  2. Cafés, pubs and restaurants with a website have their home page read about once a month for what they say
//     about dogs and laptops. Only what the venue itself says is kept, with the page it came from.
// Google reviews are deliberately not used: Google's terms forbid storing anything derived from them.
import area from '../data/area.json' with { type: 'json' }
import { APP_NAME, SITE_URL, inArea } from './config'
import { overpass, planRefresh, readWebsite, toPlaces } from './osm'
import { repo } from './repo'
import type { Place, PlaceExtra } from './types'

async function pageText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': `${APP_NAME}/1.0 (+${SITE_URL})`, Accept: 'text/html' } })
    if (!res.ok || !/html/.test(res.headers.get('content-type') ?? '')) return null
    return (await res.text()).slice(0, 500_000)
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&#39;|&rsquo;/g, "'").replace(/\s+/g, ' ')
  } catch { return null }
}

const RECHECK_DAYS = 25
const WEB_CATEGORIES: Place['category'][] = ['cafe', 'drink', 'eat']

/** `deadline` is a Date.now() value; website reading stops starting new pages after it. */
export async function syncPlaces(deadline: number): Promise<string> {
  const known = await repo.placeIndex()
  const report: string[] = []

  // 1. OpenStreetMap
  try {
    const [W, S, E, N] = area.bbox
    const found = toPlaces(await overpass(`${S},${W},${N},${E}`, Date.now() + 90_000), inArea, new Map(known.flatMap(p => p.osm_id ? [[p.osm_id, p.id]] : [])), new Set(known.map(p => p.slug)))
    const { fresh, patches, gone } = planRefresh(known, found)
    await repo.addPlaces(fresh)
    for (let i = 0; i < patches.length; i += 10) await Promise.all(patches.slice(i, i + 10).map(([id, patch]) => repo.patchPlace(id, patch)))
    report.push(`OpenStreetMap: ${fresh.length} new places, ${patches.length - gone.length} updated, ${gone.length} hidden as gone`)
  } catch (e) {
    console.error('OpenStreetMap refresh failed', e)
    report.push(`OpenStreetMap: failed (${e instanceof Error ? e.message : 'unknown error'})`)
  }

  // 2. Venues' own websites, least recently read first
  const cutoff = new Date(Date.now() - RECHECK_DAYS * 86400_000).toISOString()
  const due = (await repo.placeIndex()).filter(p => p.status === 'published' && p.website && WEB_CATEGORIES.includes(p.category) && (p.extra.web_checked ?? '') < cutoff)
    .sort((a, b) => (a.extra.web_checked ?? '').localeCompare(b.extra.web_checked ?? ''))
  let read = 0, answers = 0
  for (let i = 0; i < due.length && Date.now() < deadline; i += 8) await Promise.all(due.slice(i, i + 8).map(async p => {
    const text = await pageText(p.website!)
    const said = text ? readWebsite(text) : {}
    if (p.category !== 'cafe') delete said.laptops // a pub's "plug sockets" is not an invitation to work there
    const extra: PlaceExtra = { ...p.extra, ...said, web_checked: new Date().toISOString().slice(0, 10) }
    if (said.dogs !== undefined || said.laptops !== undefined) { extra.web_source = p.website!; answers++ }
    await repo.patchPlace(p.id, { extra })
    read++
  }))
  report.push(`Websites: ${read} read, ${answers} said something about dogs or laptops, ${due.length - read} left for next time`)
  return report.join(' · ')
}
