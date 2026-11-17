// The "which borough next?" poll's counting. .ts extensions: this file also runs under plain `node --test`.
import { LONDON_BOROUGHS } from './config.ts'
import type { BoroughTally } from './types'

/** Votes per borough, most first; typed-in names count with the listed ones regardless of case. */
export function tallyBoroughs(votes: string[]): BoroughTally[] {
  const n = new Map<string, BoroughTally>()
  for (const v of votes) { const k = v.trim().toLowerCase(); const t = n.get(k) ?? { borough: v.trim(), votes: 0 }; t.votes++; n.set(k, t) }
  return [...n.values()].sort((a, b) => b.votes - a.votes || a.borough.localeCompare(b.borough))
}

/** The tally safe to show the public: typed-in names that aren't a London borough are counted as "Other", never shown. */
export function publicTally(tally: BoroughTally[]): BoroughTally[] {
  const listed = new Map(LONDON_BOROUGHS.map(b => [b.toLowerCase(), b as string]))
  return tallyBoroughs(tally.flatMap(t => Array(t.votes).fill(listed.get(t.borough.toLowerCase()) ?? 'Other')))
}
