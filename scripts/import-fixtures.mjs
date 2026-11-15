// Arsenal home league fixtures from openfootball (public domain) -> data/fixtures.json.
// Kick-off times move for TV; re-run to refresh: `node scripts/import-fixtures.mjs`
import { writeFileSync } from 'node:fs'
const SEASON = '2026-27'
const d = await (await fetch(`https://raw.githubusercontent.com/openfootball/football.json/master/${SEASON}/en.1.json`)).json()
const out = d.matches.filter(m => m.team1.startsWith('Arsenal') && !m.score)
  .map(m => ({ date: m.date, time: m.time ?? '15:00', opponent: m.team2.replace(/ (FC|AFC)$/, '').replace(/^AFC /, ''), round: m.round }))
writeFileSync(new URL('../data/fixtures.json', import.meta.url), JSON.stringify(out, null, 1))
console.log(out.length, 'upcoming home fixtures', out.slice(0, 3))
