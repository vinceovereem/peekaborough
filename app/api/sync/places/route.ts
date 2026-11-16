import type { NextRequest } from 'next/server'
import { syncPlaces } from '@/lib/place-sync'

export const maxDuration = 300

// Called by the weekly Vercel cron (vercel.json), which sends "Authorization: Bearer $CRON_SECRET".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  return Response.json({ result: await syncPlaces(Date.now() + 200_000) }) // leaves time to save before the 300 s limit
}
