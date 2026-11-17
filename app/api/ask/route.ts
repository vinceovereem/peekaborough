import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { getUser } from '@/lib/auth'
import { ask, ASK_ENABLED } from '@/lib/assistant'
import { repo } from '@/lib/repo'

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(4000) })).min(1).max(20)
    .refine(m => m[m.length - 1].role === 'user', 'The last message must be a question'),
})

const say = (error: string, status: number) => Response.json({ error }, { status })
// What visitors see when the guide can't answer. The real reason goes to the server log, never to them.
const SOON = 'The local guide is coming soon — it isn’t available just yet.'
const LATER = 'The local guide can’t answer right now — please try again in a little while.'

export async function POST(request: Request) {
  const user = await getUser()
  if (!user) return say('Please sign in first.', 401)
  if (!ASK_ENABLED) return say(SOON, 503)
  const body = Body.safeParse(await request.json().catch(() => null))
  if (!body.success) return say('Ask a question of up to 4,000 characters.', 400)
  try {
    // Every question costs money, so each person gets 30 an hour, counted in the database (take_ask_turn).
    if (!(await repo.takeAskTurn(user.id))) return say('That’s a lot of questions — give it a little while and try again.', 429)
    return Response.json({ answer: await ask(body.data.messages, user) })
  } catch (e) {
    console.error('Ask failed', e)
    if (e instanceof Anthropic.AuthenticationError) return say(SOON, 503) // key missing or rejected: not the visitor's problem
    if (e instanceof Anthropic.RateLimitError) return say('The local guide is busy right now — try again in a moment.', 429)
    return say(LATER, 502)
  }
}
