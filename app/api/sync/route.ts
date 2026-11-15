import type { NextRequest } from 'next/server'
import { syncEvents } from '@/lib/sources'

// Called by the daily Vercel cron (vercel.json), which sends "Authorization: Bearer $CRON_SECRET".
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  return Response.json({ result: await syncEvents() })
}
