'use server'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DEMO } from '@/lib/config'
import { DEMO_USERS } from '@/data/demo'
import { createClient } from '@/lib/supabase/server'

/** One-click personas. Only exists while there are no Supabase keys — it cannot run against real data. */
export async function demoSignIn(formData: FormData) {
  const key = String(formData.get('as'))
  if (!DEMO || !DEMO_USERS.some(u => u.key === key)) redirect('/login')
  ;(await cookies()).set('demo_user', key, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 })
  redirect('/')
}

export async function googleSignIn() {
  const h = await headers()
  const origin = h.get('origin') ?? `https://${h.get('host')}`
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })
  redirect(error || !data.url ? '/login?error=Could not start Google sign-in' : data.url)
}

export async function signOut() {
  if (DEMO) (await cookies()).delete('demo_user')
  else await (await createClient()).auth.signOut()
  redirect('/login')
}
