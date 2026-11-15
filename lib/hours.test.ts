// Run: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isOpenNow, londonToISO } from './hours.ts'
import type { Hours } from './types.ts'
import { parseHours } from '../scripts/import-osm.mjs'
import { sunTimes } from './sun.ts'
import { toICS } from './calendar.ts'
import { parseFeed } from './news.ts'
import { sameName } from './links.ts'
import { GUIDES, guideSections, metresBetween, nearStations } from './guides.ts'
import type { MapPlace } from './types.ts'
import { readFileSync } from 'node:fs'

const closed = { mon: null, tue: null, wed: null, thu: null, fri: null, sat: null, sun: null }
const cafe: Hours = { ...closed, mon: { open: '08:00', close: '17:00' } }
const pub: Hours = { ...closed, fri: { open: '12:00', close: '01:00' } }

test('opening hours', () => {
  assert.equal(isOpenNow(null), null)
  // 16 Nov 2026 is a Monday; London is on GMT.
  assert.equal(isOpenNow(cafe, new Date('2026-11-16T09:00:00Z')), true)
  assert.equal(isOpenNow(cafe, new Date('2026-11-16T17:00:00Z')), false)
  assert.equal(isOpenNow(cafe, new Date('2026-11-17T09:00:00Z')), false)
  // Friday-night pub is still open at 00:30 on Saturday, shut by 01:30.
  assert.equal(isOpenNow(pub, new Date('2026-11-21T00:30:00Z')), true)
  assert.equal(isOpenNow(pub, new Date('2026-11-21T01:30:00Z')), false)
  // BST: 08:30 London on Mon 6 Jul 2026 is 07:30 UTC.
  assert.equal(isOpenNow(cafe, new Date('2026-07-06T07:30:00Z')), true)
})

test('london wall time to ISO', () => {
  assert.equal(londonToISO('2026-11-28', '15:00'), '2026-11-28T15:00:00.000Z')
  assert.equal(londonToISO('2027-05-08', '15:00'), '2027-05-08T14:00:00.000Z')
})

test('OpenStreetMap opening_hours strings', () => {
  const h = (s: string) => parseHours(s) as Hours | null
  assert.deepEqual(h('Mo-Fr 08:00-18:00; Sa,Su 9:00-17:00')?.sat, { open: '09:00', close: '17:00' })
  assert.equal(h('Mo-Sa 10:00-18:00; Su Off')?.sun, null)
  assert.deepEqual(h('Mo-Fr 10:00-20:00, Sa 10:00-18:00, Su 10:00-17:00')?.sun, { open: '10:00', close: '17:00' }) // commas between rules
  assert.deepEqual(h('Mo-We 17:00-24:00, Th 17:00-01:00, Fr,Sa 17:00-03:00; Su off')?.sat, { open: '17:00', close: '03:00' }) // comma inside a day list
  assert.deepEqual(h('PH,Mo-Su 07:00-23:00')?.wed, { open: '07:00', close: '23:00' })
  assert.deepEqual(h('Mo-Fr 09:00-16:00; PH 10:00-16:00')?.mon, { open: '09:00', close: '16:00' }) // holiday rule must not overwrite the week
  assert.equal(h('Mo-Fr 09:00-16:00; PH 10:00-16:00')?.sun, null)
  assert.deepEqual(h('Fr-Mo 12:00-23:00')?.sun, { open: '12:00', close: '23:00' }) // range wrapping the weekend
  // Anything we can't represent exactly is refused rather than guessed.
  for (const s of ['Fr-Sa 12:00-15:00, 17:00-22:30', 'Mo-Su 08:00-sunset', '"by appointment"', 'Until 12am']) assert.equal(h(s), null, s)
})

test('sunrise and sunset in Highbury', () => {
  const near = (d: Date, iso: string) => assert.ok(Math.abs(d.getTime() - Date.parse(iso)) < 4 * 60000, `${d.toISOString()} vs ${iso}`)
  const june = sunTimes(new Date('2026-06-21T12:00:00Z'), 51.55, -0.1) // longest day: 04:43 / 21:21 BST
  near(june.sunrise, '2026-06-21T03:43:00Z'); near(june.sunset, '2026-06-21T20:21:00Z')
  const dec = sunTimes(new Date('2026-12-21T12:00:00Z'), 51.55, -0.1) // shortest day: 08:04 / 15:53 GMT
  near(dec.sunrise, '2026-12-21T08:04:00Z'); near(dec.sunset, '2026-12-21T15:53:00Z')
})

test('calendar file', () => {
  const ics = toICS([{ id: 'abc', title: 'Arsenal v Leeds, at home; big one', description: 'Line one\nLine two', kind: 'football', venue_name: 'Emirates Stadium', lat: 51.555, lng: -0.108, starts_at: '2026-11-28T15:00:00.000Z', ends_at: null, url: null, price_pence: 0 }], 'Test', new Date('2026-11-15T10:00:00Z'))
  const unfolded = ics.replace(/\r\n /g, '')
  assert.match(unfolded, /DTSTART:20261128T150000Z\r\nDTEND:20261128T170000Z/) // two hours assumed
  assert.match(unfolded, /SUMMARY:Arsenal v Leeds\\, at home\\; big one/)      // commas and semicolons escaped
  assert.match(unfolded, /DESCRIPTION:Line one\\nLine two\\n\\nPrice: Free/)
  assert.ok(ics.split('\r\n').every(l => Buffer.byteLength(l) <= 75), 'no line over 75 bytes')
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n') && ics.endsWith('END:VCALENDAR\r\n'))
})

test('news feeds: RSS and Atom', () => {
  const rss = `<rss><channel><title>Paper</title><item><title><![CDATA[Caf&eacute; wins &amp; "best" award]]></title><link>https://example.com/a?ref=rss</link><pubDate>Sun, 15 Nov 2026 12:50:54 +0000</pubDate><description>Body we never show</description></item><item><title>No link</title></item></channel></rss>`
  assert.deepEqual(parseFeed(rss, 'Paper'), [{ title: 'Caf&eacute; wins & "best" award', url: 'https://example.com/a?ref=rss', source: 'Paper', date: '2026-11-15T12:50:54.000Z' }])
  const atom = `<feed><title>Sub</title><entry><title>Free sofa &amp; chair</title><link href="https://example.com/p?a=1&amp;b=2" /><updated>2026-11-15T13:07:46+00:00</updated><content type="html">&lt;b&gt;x&lt;/b&gt;</content></entry></feed>`
  assert.deepEqual(parseFeed(atom, 'Sub'), [{ title: 'Free sofa & chair', url: 'https://example.com/p?a=1&b=2', source: 'Sub', date: '2026-11-15T13:07:46.000Z' }])
  assert.deepEqual(parseFeed('<html>not a feed</html>', 'x'), [])
})

test('matching a place to its Google listing by name', () => {
  const same = (a: string, b: string) => assert.ok(sameName(a, b), `"${a}" should match "${b}"`)
  const different = (a: string, b: string) => assert.ok(!sameName(a, b), `"${a}" should NOT match "${b}"`)
  // the whole of the shorter name is in the longer one
  same("Sadler's Wells", 'Sadler’s Wells Theatre')
  same('Beam', 'Beam Highbury')
  same('Emirates Stadium', 'Arsenal - Emirates Stadium')
  same('Costa', 'Costa Coffee')
  same('Café Olé', 'Cafe Ole Islington')
  same('The Coffee House', 'the coffee house') // only everyday words: must match exactly
  // spelling slips (seen on the live site)
  same('Sari Ciceak Supermarket', 'Sari Çicek Supermarket London')
  same('Fryingdon Fish Bar', 'Fryingdon')
  // one word differs, two others match and one of them is the business's own name (seen on the live site)
  same('Maandli Hair & Beauty', 'Maandli Hair Salon')
  // neighbours that share only the area, the trade, or both
  different('The Coffee House', 'The Coffee Shop')
  different('Arsenal Barbers', 'Blackstock Dry Cleaners')
  different('Arsenal Barbers', 'Blackstock Barbers')
  different('Highbury Dental', 'Highbury Pharmacy')
  different('Highbury Corner Dental', 'Highbury Corner Pharmacy') // two shared words, but both are locations
  different('Turkish Kitchen', 'Turkish Grill')
  different('Angel', 'Islington High Street')
  different('Piccolo Olivio', 'Piccolo Mondo')
  different('Screen on the Green', 'Everyman') // a rebranded listing is refused rather than guessed
  different('Union Chapel', '')
  // a slip is only forgiven in longer words
  different('Wine Rack', 'Wing Rack')
})

test('guides: every guide lists real places, in A-Z sections, and stations count what is near', () => {
  const places = JSON.parse(readFileSync(new URL('../data/places.json', import.meta.url), 'utf8')).map((p: object) => ({ ...p, rating: null, review_count: 0 })) as MapPlace[]
  for (const guide of GUIDES) {
    const sections = guideSections(guide, places), listed = sections.flatMap(s => s.places)
    assert.ok(listed.length >= 5, `${guide.slug} lists only ${listed.length} places`)
    assert.equal(listed.length, places.filter(guide.pick).length, `${guide.slug} drops places`)
    assert.ok(sections.every(s => s.heading !== undefined && s.heading !== 'undefined'), `${guide.slug} has an unnamed section`)
    for (const s of sections) assert.deepEqual(s.places.map(p => p.name), [...s.places.map(p => p.name)].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' })))
  }
  assert.ok(guideSections(GUIDES[0], places).flatMap(s => s.places).every(p => p.category === 'drink' && p.extra.outdoor_seating))

  // Angel to Highbury & Islington stations are about 1.5 km apart
  const at = (name: string) => places.find(p => p.category === 'transport' && p.name === name)!
  const gap = metresBetween(at('Angel'), at('Highbury & Islington'))
  assert.ok(gap > 1300 && gap < 1700, `Angel to Highbury & Islington came out as ${Math.round(gap)} m`)
  const mk = (category: string, lat: number, lng: number) => ({ category, lat, lng, name: category, extra: {} }) as unknown as MapPlace
  const [row] = nearStations([mk('transport', 51.5, -0.1), mk('cafe', 51.5045, -0.1), mk('cafe', 51.506, -0.1), mk('drink', 51.5, -0.1), mk('shop', 51.5, -0.1)])
  assert.deepEqual(row.counts, { eat: 0, cafe: 1, drink: 1, groceries: 0, green: 0 }) // 500 m counts, 670 m does not, shops are not compared
})
