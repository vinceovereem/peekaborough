import { createServerClient } from '@supabase/ssr'
import { createClient as createPlainClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

/** Per-request client acting as the signed-in user; row-level security applies. */
export async function createClient() {
  const store = await cookies()
  return createServerClient(URL, KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try { for (const { name, value, options } of list) store.set(name, value, options) }
        catch { /* called from a Server Component: proxy.ts refreshes the session instead */ }
      },
    },
  })
}

/** Service-role client: bypasses row-level security. Server-only, and only after requireAdmin()/owner checks. */
export function createAdminClient() {
  return createPlainClient(URL, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
}
