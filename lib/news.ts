// Local headlines, pulled from feeds that publishers put out for exactly this purpose (RSS/Atom).
// We show the headline, the source and a link to the original — never the article itself.
export type Headline = { title: string; url: string; source: string; date: string | null }

const FEEDS = [
  { source: 'Islington Gazette', url: 'https://www.islingtongazette.co.uk/news/rss/' },
  { source: 'Islington Local Guide', url: 'https://islingtonlocalguide.co.uk/feed/' },
  { source: 'r/islington', url: 'https://www.reddit.com/r/islington/.rss' },
]

/** Places worth reading that don't offer a feed: we link out, we don't copy. */
export const GUIDES = [
  { name: 'Islington Local Guide', blurb: 'What to do, eat and see, written by locals', url: 'https://islingtonlocalguide.co.uk/' },
  { name: 'Islington Gazette', blurb: 'The local paper', url: 'https://www.islingtongazette.co.uk/' },
  { name: 'The Standard: Islington', blurb: 'London-wide paper, Islington stories', url: 'https://www.standard.co.uk/topic/islington' },
  { name: 'Time Out: Islington area guide', blurb: 'Restaurants, pubs and things to do', url: 'https://www.timeout.com/london/things-to-do/islington-area-guide' },
  { name: 'Visit London: Islington', blurb: 'The tourist-board view', url: 'https://www.visitlondon.com/things-to-do/london-areas/islington' },
  { name: 'Islington Life', blurb: "The council's what's-on guide", url: 'https://www.islingtonlife.london/' },
  { name: 'r/islington', blurb: 'Neighbours talking on Reddit', url: 'https://www.reddit.com/r/islington/' },
  { name: 'Eventbrite: Islington', blurb: 'Classes, talks and community events', url: 'https://www.eventbrite.co.uk/d/united-kingdom--islington/events/' },
  { name: 'Skiddle: Islington', blurb: 'Gigs and club nights', url: 'https://www.skiddle.com/whats-on/London/Islington/' },
]

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }
const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITIES[e] ?? m).replace(/\s+/g, ' ').trim()
const tag = (xml: string, name: string) => xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1]

/** Reads both RSS (<item>, <link>url</link>) and Atom (<entry>, <link href="url"/>). */
export function parseFeed(xml: string, source: string): Headline[] {
  return [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/g)].flatMap(([block]) => {
    const title = decode(tag(block, 'title') ?? '')
    const url = decode(tag(block, 'link') ?? '') || block.match(/<link[^>]*href="([^"]+)"/)?.[1]?.replace(/&amp;/g, '&') || ''
    const when = Date.parse(decode(tag(block, 'pubDate') ?? tag(block, 'published') ?? tag(block, 'updated') ?? ''))
    return title && /^https?:\/\//.test(url) ? [{ title, url, source, date: Number.isNaN(when) ? null : new Date(when).toISOString() }] : []
  })
}

/** Newest first across all feeds; a feed that is down is simply skipped. Cached for 15 minutes. */
export async function headlines(limit = 30): Promise<Headline[]> {
  const all = await Promise.all(FEEDS.map(async f => {
    try {
      const res = await fetch(f.url, { headers: { 'User-Agent': 'Peekaborough/0.1 (neighbourhood guide; headlines with links)' }, next: { revalidate: 900 }, signal: AbortSignal.timeout(8000) })
      return res.ok ? parseFeed(await res.text(), f.source).slice(0, 12) : []
    } catch { return [] }
  }))
  return all.flat().sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, limit)
}
