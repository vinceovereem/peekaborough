import assert from 'node:assert/strict'
import { test } from 'node:test'
import { answerProblem, osmFacts, planRefresh, readWebsite, web } from './osm.ts'

test('reads what a venue says about dogs and laptops', () => {
  assert.deepEqual(readWebsite('Well-behaved dogs are always welcome in the bar.'), { dogs: true })
  assert.deepEqual(readWebsite('Dog friendly pub with free WiFi'), { dogs: true, wifi: true })
  assert.deepEqual(readWebsite('Sorry, we are not dog friendly. Assistance dogs only.'), { dogs: false })
  assert.deepEqual(readWebsite('Dogs welcome in the garden, no dogs in the dining room'), { dogs: true })
  assert.deepEqual(readWebsite('Laptops welcome — plenty of plug sockets'), { laptops: true })
  assert.deepEqual(readWebsite('Free wifi. No laptops at weekends please.'), { laptops: false, wifi: true })
  assert.deepEqual(readWebsite('Hot coffee, cold drinks, good times.'), {})
})

test('takes yes/no facts from OpenStreetMap tags, and nothing that is untagged', () => {
  assert.deepEqual(osmFacts({ dog: 'leashed', internet_access: 'wlan' }), { dogs: true, wifi: true })
  assert.deepEqual(osmFacts({ dog: 'no', internet_access: 'no', outdoor_seating: 'yes' }), { outdoor_seating: true, dogs: false, wifi: false })
  assert.deepEqual(osmFacts({ amenity: 'cafe' }), {})
})

test('a refresh updates unclaimed places, keeps owners\' edits, and hides what has gone', () => {
  const row = (osm_id: string, name: string, more = {}) => ({ id: osm_id, osm_id, slug: name, name, category: 'eat' as const, subcategory: 'pizza', description: null, address: null, lat: 51.5, lng: -0.1,
    phone: null, website: null, booking_url: null, hours: null, hours_note: null, extra: {}, is_landmark: false, verified: false, status: 'published' as const, ...more })
  const known = [row('node/1', 'Gourmet Sushi'), row('node/2', 'Owner Cafe', { verified: true }), ...Array.from({ length: 9 }, (_, i) => row(`node/${10 + i}`, `Same ${i}`)), row('node/3', 'Closed Shop')]
  const answer = [{ ...row('node/1', 'Al Dente Pastificio'), extra: { dogs: true } }, { ...row('node/2', 'Renamed by mapper'), extra: { wifi: true } },
    ...Array.from({ length: 9 }, (_, i) => row(`node/${10 + i}`, `Same ${i}`)), row('way/4', 'New Bakery')]
  const { fresh, patches, gone } = planRefresh(known, answer as never)
  assert.deepEqual(fresh.map(p => p.name), ['New Bakery'])
  assert.deepEqual(Object.fromEntries(patches), {
    'node/1': { name: 'Al Dente Pastificio', extra: { dogs: true } }, // unclaimed: takes the new name
    'node/2': { extra: { wifi: true } }, // claimed: only the yes/no fact
    'node/3': { status: 'hidden' },
  })
  assert.deepEqual(gone.map(p => p.name), ['Closed Shop'])
  assert.equal(planRefresh(known, answer.slice(0, 3) as never).gone.length, 0, 'a short answer hides nothing')
})

test('turns down stale or cut-short Overpass answers', () => {
  const now = Date.parse('2026-11-16T12:00:00Z'), fresh = { timestamp_osm_base: '2026-11-16T11:58:00Z' }
  assert.equal(answerProblem({ elements: [], osm3s: fresh }, now), null)
  assert.match(answerProblem({ elements: [], osm3s: { timestamp_osm_base: '2025-10-20T00:00:00Z' } }, now)!, /stale/)
  assert.match(answerProblem({ elements: [] }, now)!, /stale/)
  assert.match(answerProblem({ elements: [], remark: 'runtime error: Query timed out', osm3s: fresh }, now)!, /incomplete/)
  assert.match(answerProblem(null, now)!, /unreadable/)
})

test('websites become web addresses the database accepts, or nothing', () => {
  assert.equal(web('www.example.co.uk'), 'https://www.example.co.uk')
  assert.equal(web('http://example.com/a'), 'http://example.com/a')
  for (const bad of [undefined, '', 'javascript:alert(1)', 'mailto:a@example.com', 'example.com/a b']) assert.equal(web(bad), null)
})
