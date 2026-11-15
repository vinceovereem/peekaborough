import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Everything except the login page needs a signed-in neighbour. This is the quick first check;
// pages re-check with requireUser()/requireAdmin() and the database enforces row-level security.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  let signedIn: boolean

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) signedIn = request.cookies.has('demo_user')
  else {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) { // keeps the session fresh: pass refreshed tokens to both the page and the browser
          for (const { name, value } of list) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of list) response.cookies.set(name, value, options)
        },
      },
    })
    signedIn = !!(await supabase.auth.getClaims()).data?.claims
  }

  const { pathname } = request.nextUrl
  // .ics feeds are fetched by calendar apps (published events only); the sync endpoint checks its own secret
  if (pathname === '/calendar' || pathname === '/api/sync') return response
  // Readable by anyone, signed in or not: the legal pages and the files search engines ask for.
  if (['/privacy', '/terms', '/security', '/robots.txt', '/sitemap.xml'].includes(pathname)) return response
  // Signed-out visitors (and search engines) get the front page at the site's own address, not a redirect.
  if (!signedIn && pathname === '/') return NextResponse.rewrite(new URL('/login', request.url))
  const isPublic = pathname === '/login' || pathname.startsWith('/auth/')
  if (signedIn === isPublic && pathname !== '/auth/callback') {
    const url = request.nextUrl.clone()
    url.pathname = signedIn ? '/' : '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}

export const config = { matcher: ['/((?!_next/|maplibre/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'] }
