import assert from 'node:assert/strict'
import { test } from 'node:test'
import { searchKey } from './config.ts'

test('search ignores &/and, apostrophes, accents and a leading "the"', () => {
  assert.ok(searchKey('Hope & Anchor').includes(searchKey('the hope and anchor')))
  assert.ok(searchKey("Fink's").includes(searchKey('finks')))
  assert.ok(searchKey('Café Oto').includes(searchKey('cafe oto')))
  assert.equal(searchKey('Theatre'), 'theatre')
})
