import { repo } from '@/lib/repo'
import { publicTally } from '@/lib/poll'

// Public on purpose: the footer poll shows these to anyone. Counts only, and typed-in names are folded into "Other".
// ponytail: one small query per request, uncached so a fresh vote shows straight away. Add s-maxage if it gets busy.
export async function GET() {
  return Response.json(publicTally(await repo.boroughTally()))
}
