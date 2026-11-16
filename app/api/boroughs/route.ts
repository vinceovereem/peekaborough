import { repo } from '@/lib/repo'
import { getUser } from '@/lib/auth'
import { publicTally } from '@/lib/poll'
import type { BoroughTally } from '@/lib/types'

export type PollData = { tally: BoroughTally[]; signedIn: boolean; mine: string | null }

// Public on purpose: the footer poll shows the results to anyone. Counts only, and typed-in names are folded
// into "Other". Also says whether the visitor may vote and what they picked, so pages that use the footer stay static.
// ponytail: two small queries per request, uncached so a fresh vote shows straight away. Add caching if it gets busy.
export async function GET() {
  const user = await getUser()
  const [tally, mine] = await Promise.all([repo.boroughTally(), user ? repo.myBoroughVote(user.id) : null])
  return Response.json({ tally: publicTally(tally), signedIn: !!user, mine } satisfies PollData)
}
