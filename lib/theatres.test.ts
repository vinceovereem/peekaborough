// Run: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { THEATRES, performanceDays } from './theatres.ts'

test('theatre feed: only programme shows in a known room, one entry per show per day', () => {
  const now = Date.parse('2026-11-16T00:00:00Z'), park = THEATRES[0]
  const shows = [{ id: 'show', name: ' Goblin ', attribute_Season: 'Park Main Season' }, { id: 'pizza', name: '**Pizzas', attribute_Season: 'Supplementary Event' }]
  const plans = [{ id: 'p90', name: 'Park90' }, { id: 'none', name: '-' }, { id: 'away', name: 'Jacksons Lane' }]
  const at = (id: string, event: string, planId: string, start: string, more = {}) => ({ id, event: { id: event }, planId, start, startUtc: start, ...more })
  const out = performanceDays(park, shows, [
    at('1', 'show', 'p90', '2026-11-17T19:45:00'), at('2', 'show', 'p90', '2026-11-17T15:00:00'), // same day: one entry, earliest first
    at('3', 'show', 'p90', '2026-11-18T19:45:00', { cancelled: true }),
    at('4', 'show', 'away', '2026-11-19T19:45:00'), // on tour somewhere else
    at('5', 'pizza', 'none', '2026-11-17T18:00:00'), // an add-on, not a show
    at('6', 'show', 'p90', '2027-06-01T19:45:00'), // further than 60 days
    at('7', 'show', 'p90', '2026-11-20T19:45:00'),
  ], plans, now)
  assert.deepEqual(out.map(e => [e.source_id, e.title, e.starts_at, e.description]), [
    ['show:2026-11-17', 'Goblin', '2026-11-17T15:00:00.000Z', 'Performances at 3pm, 7:45pm.'],
    ['show:2026-11-20', 'Goblin', '2026-11-20T19:45:00.000Z', null],
  ])
  assert.equal(out[0].venue_name, 'Park Theatre')
})
