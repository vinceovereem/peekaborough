import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DEMO, TEST_ACCOUNTS } from './config'
import { DEMO_USERS } from '@/data/demo'
import { createClient } from './supabase/server'
import { memoryRepo } from './memory'
import type { User } from './types'

export const getUser = cache(async (): Promise<User | null> => {
  if (DEMO) {
    if (!TEST_ACCOUNTS) return null // no database and not a developer's machine: everyone is a viewer
    const key = (await cookies()).get('demo_user')?.value
    const demo = DEMO_USERS.find(u => u.key === key)
    return demo ? { ...demo, is_owner: (await memoryRepo.myPlaces(demo.id)).length > 0 } : null
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser() // verified with the auth server, not just read from the cookie
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url, is_admin, place_owners(place_id)').eq('id', user.id).maybeSingle()
  return { id: user.id, name: profile?.display_name ?? 'Neighbour', email: user.email ?? null, avatar_url: profile?.avatar_url ?? null, is_admin: !!profile?.is_admin, is_owner: !!profile?.place_owners?.length }
})

export async function requireUser(): Promise<User> {
  return (await getUser()) ?? redirect('/login')
}
/**
 * For pages anyone may read: the signed-in neighbour, or null for someone who chose "Skip" and is
 * only looking around (they can read, never write). Anyone else is sent to the front page first.
 */
export async function requireVisitor(): Promise<User | null> {
  const user = await getUser()
  if (user) return user
  if ((await cookies()).has('viewer')) return null
  redirect('/login')
}
export async function requireAdmin(): Promise<User> {
  const user = await requireUser()
  if (!user.is_admin) redirect('/')
  return user
}
