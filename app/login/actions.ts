'use server'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DEMO, TEST_ACCOUNTS } from '@/lib/config'
import { DEMO_USERS } from '@/data/demo'
import { createClient } from '@/lib/supabase/server'

/** Stand-in test accounts. Only on a developer's machine with no database — it cannot run against real data. */
export async function demoSignIn(formData: FormData) {
  const key = String(formData.get('as'))
  if (!TEST_ACCOUNTS || !DEMO_USERS.some(u => u.key === key)) redirect('/login')
  ;(await cookies()).set('demo_user', key, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  redirect('/')
}

/** "Skip": look around without an account. Remembered for a year; reading only, enforced by every page and action. */
export async function skipSignIn() {
  ;(await cookies()).set('viewer', '1', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 })
  redirect('/')
}

export async function googleSignIn(formData: FormData) {
  if (DEMO) redirect('/login?error=Signing in is not available on this preview yet — you can still look around.')
  // a cookie, not a query string, so the return address Google is given stays exactly the registered one
  if (formData.get('next') === '/apply') (await cookies()).set('after_sign_in', '/apply', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 600 })
  const h = await headers()
  const origin = h.get('origin') ?? `https://${h.get('host')}`
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })
  redirect(error || !data.url ? '/login?error=Could not start Google sign-in' : data.url)
}

export async function signOut() {
  const store = await cookies()
  store.delete('viewer') // back to the front page, not straight into viewer mode
  if (DEMO) store.delete('demo_user')
  else await (await createClient()).auth.signOut()
  redirect('/login')
}
