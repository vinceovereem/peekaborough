import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Google sends the user back here with a one-time code; swap it for a session cookie.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL('/', request.url))
  }
  return NextResponse.redirect(new URL('/login?error=Sign-in did not complete, please try again', request.url))
}
