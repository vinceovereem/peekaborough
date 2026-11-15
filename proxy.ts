import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

// Three kinds of visitor: signed in (everything their account allows), a viewer who pressed "Skip"
// on the front page (may read, never the business, admin or application pages), and everyone else
// (front page, guides and legal pages only). This is the quick first check; pages re-check with
// requireUser()/requireVisitor()/requireAdmin() and the database enforces row-level security.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  let signedIn: boolean

  // no database: stand-in test accounts exist on a developer's machine only (see TEST_ACCOUNTS)
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) signedIn = process.env.NODE_ENV === 'development' && request.cookies.has('demo_user')
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
  // Readable by anyone, signed in or not: the guides, the legal pages and the files search engines ask for.
  if (['/privacy', '/terms', '/security', '/robots.txt', '/sitemap.xml', '/guides'].includes(pathname) || pathname.startsWith('/guides/')) return response
  // Signed-out visitors (and search engines) get the front page at the site's own address, not a redirect.
  const viewer = !signedIn && request.cookies.has('viewer')
  if (!signedIn && !viewer && pathname === '/') return NextResponse.rewrite(new URL('/login', request.url))
  const isPublic = pathname === '/login' || pathname.startsWith('/auth/')
  if (viewer && !isPublic && !/^\/(admin|business|apply)(\/|$)/.test(pathname)) return response // looking around
  if (signedIn === isPublic && pathname !== '/auth/callback') {
    const url = request.nextUrl.clone()
    url.pathname = signedIn ? '/' : '/login'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return response
}

export const config = { matcher: ['/((?!_next/|maplibre/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'] }
