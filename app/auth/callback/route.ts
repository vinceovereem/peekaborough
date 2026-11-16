import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

// Google sends the user back here with a one-time code; swap it for a session cookie.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    const { error } = await (await createClient()).auth.exchangeCodeForSession(code)
    if (!error) {
      // someone who came to sign in so they could apply to be an admin goes on to the form (only ever this one fixed path)
      const jar = await cookies(), applying = jar.get('after_sign_in')?.value === '/apply'
      jar.delete('after_sign_in')
      return NextResponse.redirect(new URL(applying ? '/apply' : '/', request.url))
    }
  }
  return NextResponse.redirect(new URL('/login?error=Sign-in did not complete, please try again', request.url))
}
