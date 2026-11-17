// The one-line banner a page shows after a save ("Saved.", "Please add a title").
// The words travel in a short-lived cookie and the address carries only their id, so a link someone
// else made up cannot put words in the site's mouth.
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type FlashMessage = { ok?: string; error?: string }

/** Go to `path` and show `message` there. Only callable from a server action. */
export async function flashTo(path: string, kind: 'ok' | 'error', message: string): Promise<never> {
  const id = crypto.randomUUID().slice(0, 8)
  ;(await cookies()).set('flash', JSON.stringify({ id, [kind]: message }), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 })
  redirect(`${path}?flash=${id}`)
}

/** The banner for this page view, if the address names the message waiting in the visitor's cookie. */
export async function readFlash({ flash }: { flash?: string }): Promise<FlashMessage> {
  if (!flash) return {}
  try {
    const { id, ok, error } = JSON.parse((await cookies()).get('flash')?.value ?? '{}')
    if (id !== flash) return {}
    return { ...(typeof ok === 'string' && { ok }), ...(typeof error === 'string' && { error }) }
  } catch { return {} }
}
