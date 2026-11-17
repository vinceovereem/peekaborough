// Run: npm test
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { tallyBoroughs, publicTally } from './poll.ts'

test('borough poll tally', () => {
  const votes = ['Camden', ' camden ', 'Hackney', 'Hertsmere', 'something rude', 'Hackney', 'CAMDEN']
  assert.deepEqual(tallyBoroughs(votes), [
    { borough: 'Camden', votes: 3 }, { borough: 'Hackney', votes: 2 }, { borough: 'Hertsmere', votes: 1 }, { borough: 'something rude', votes: 1 },
  ], 'case and spaces merge; most votes first, then A–Z')
  assert.deepEqual(publicTally(tallyBoroughs(votes)), [
    { borough: 'Camden', votes: 3 }, { borough: 'Hackney', votes: 2 }, { borough: 'Other', votes: 2 },
  ], 'typed-in names never reach the public: they become "Other"')
})
