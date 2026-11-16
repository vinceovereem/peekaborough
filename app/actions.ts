'use server'
import { z } from 'zod'
import { redirect } from 'next/navigation'
import { getUser, requireUser, requireAdmin } from '@/lib/auth'
import { repo } from '@/lib/repo'
import { syncEvents } from '@/lib/sources'
import { HOOD, EVENT_KINDS, LISTING_KINDS, LONDON_BOROUGHS } from '@/lib/config'
import { DAY_KEYS, londonToISO } from '@/lib/hours'
import type { Hours, User } from '@/lib/types'

// ---------- plumbing ----------
const text = (max: number, what: string) => z.string().trim().min(1, `Please add ${what}`).max(max, `Keep ${what} under ${max} characters`)
const optional = (max: number) => z.string().trim().max(max).transform(v => v || null)
const price = z.string().trim().transform(v => v === '' ? null : Math.round(Number(v) * 100))
  .refine(v => v === null || (Number.isInteger(v) && v >= 0 && v <= 10_000_000), 'Enter a price like 4.50')
const id = z.uuid()
const slug = z.string().regex(/^[a-z0-9-]{1,140}$/)
const keys = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date')
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Pick a time')

function back(path: string, kind: 'ok' | 'error', message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`)
}

/** An error whose message is safe and useful to show to the person who caused it. */
class Friendly extends Error {}

/** Validate the form, run the change as the signed-in user, then bounce back with a message. */
async function act<S extends z.ZodType>(fd: FormData, schema: S, run: (data: z.output<S>, user: User) => Promise<{ path: string; ok: string }>): Promise<never> {
  const user = await requireUser()
  const from = String(fd.get('_from') ?? '') // where the form lives; only ever a plain internal path
  const errorPath = /^(\/[a-z0-9-]+)+$/.test(from) ? from : '/'
  const parsed = schema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) back(errorPath, 'error', parsed.error.issues[0].message)
  let result
  try { result = await run(parsed.data, user) }
  catch (e) { console.error(e); back(errorPath, 'error', e instanceof Friendly ? e.message : "That didn't save — please try again.") }
  back(result.path, 'ok', result.ok)
}

async function mustOwn(user: User, placeId: string) {
  if (!(await repo.isOwner(user.id, placeId))) throw new Error(`User ${user.id} does not own place ${placeId}`)
}

// ---------- residents ----------
export async function addReview(fd: FormData) {
  return act(fd, z.object({ place_id: id, slug, rating: z.coerce.number().int().min(1, 'Pick a star rating').max(5), comment: optional(1000) }), async (d, user) => {
    await repo.upsertReview(user, d.place_id, d.rating, d.comment)
    return { path: `/place/${d.slug}`, ok: 'Thanks — your review is up.' }
  })
}

export async function createListing(fd: FormData) {
  return act(fd, z.object({ kind: z.enum(keys(LISTING_KINDS)), title: text(100, 'a title'), description: text(1000, 'a description'), price, contact: text(200, 'a way to reach you') }), async (d, user) => {
    await repo.createListing(user, { kind: d.kind, title: d.title, description: d.description, price_pence: d.price, contact: d.contact })
    return { path: '/trade', ok: 'Your listing is live.' }
  })
}
export async function setListingStatus(fd: FormData) {
  return act(fd, z.object({ id, status: z.enum(['active', 'closed']) }), async (d, user) => {
    await repo.setListingStatus(user.id, d.id, d.status)
    return { path: '/trade', ok: d.status === 'closed' ? 'Listing closed.' : 'Listing reopened.' }
  })
}

export async function createWish(fd: FormData) {
  return act(fd, z.object({ title: text(100, 'what the area needs'), description: optional(600) }), async (d, user) => {
    await repo.createWish(user, d.title, d.description)
    return { path: '/needs', ok: 'Added — now get the neighbours to vote.' }
  })
}
export async function voteOnWish(fd: FormData) {
  const user = await requireUser()
  const vote = z.object({ id, value: z.enum(['1', '-1']) }).safeParse(Object.fromEntries(fd))
  if (vote.success) await repo.vote(user.id, vote.data.id, vote.data.value === '1' ? 1 : -1).catch(e => console.error(e))
  redirect('/needs')
}

export async function toggleFavorite(fd: FormData) {
  return act(fd, z.object({ place_id: id, slug }), async (d, user) => {
    await repo.toggleFavorite(user.id, d.place_id)
    return { path: `/place/${d.slug}`, ok: 'Favourites updated.' }
  })
}

export async function applyAsAdmin(fd: FormData) {
  const schema = z.object({
    full_name: text(120, 'your full name'), email: z.email('Enter an email we can reach you on'), phone: z.string().trim().min(5, 'Please add a phone number').max(40),
    address: z.string().trim().min(5, 'Please add your address').max(300), years_in_area: z.coerce.number('How many years have you lived here?').int().min(0).max(120),
    occupation: text(120, 'what you do for work'), favourite_thing: text(1000, 'your favourite thing about the area'),
  })
  return act(fd, schema, async (d, user) => {
    await repo.createApplication(user, d)
    return { path: '/apply', ok: 'Application sent. Book a call below so we can meet.' }
  })
}

export async function saveProfile(fd: FormData) {
  return act(fd, z.object({ name: text(60, 'your name') }), async (d, user) => {
    await repo.updateProfile(user.id, d.name)
    return { path: '/profile', ok: 'Saved.' }
  })
}

export async function suggestEvent(fd: FormData) {
  return act(fd, z.object({ title: text(120, 'a title'), description: optional(2000), kind: z.enum(keys(EVENT_KINDS)), venue: text(120, 'where it is'), date, time, price, url: z.union([z.url('That link does not look right'), z.literal('')]) }), async (d, user) => {
    // ponytail: pins the event on a place whose name matches the venue, else the middle of the
    // neighbourhood. Add a "drop a pin" picker when residents start suggesting lots of street events.
    const [match] = await repo.searchPlaces(d.venue)
    await repo.addEvent({ place_id: null, title: d.title, description: d.description, kind: d.kind, venue_name: match?.name ?? d.venue, lat: match?.lat ?? HOOD.center[1], lng: match?.lng ?? HOOD.center[0], starts_at: londonToISO(d.date, d.time), ends_at: null, url: d.url || null, price_pence: d.price, status: 'pending', created_by: user.id })
    return { path: '/events', ok: 'Thanks! We check every suggestion before it goes on the map.' }
  })
}

export async function submitClaim(fd: FormData) {
  return act(fd, z.object({ place_id: id, role: text(60, 'your role'), business_email: z.email('Enter a work email we can verify'), phone: optional(40), evidence: text(2000, 'how we can verify you') }), async (d, user) => {
    await repo.createClaim(user, d)
    return { path: '/business', ok: 'Claim sent. We verify every owner by hand — usually within two working days.' }
  })
}

export type PollState = { voted?: string; error?: string }
/** The footer's "which borough next?" poll: signed-in neighbours only, one vote each (the database enforces it). */
export async function voteForBorough(_: PollState, fd: FormData): Promise<PollState> {
  const user = await getUser()
  if (!user) return { error: 'Sign in to vote.' }
  const choice = String(fd.get('borough') ?? ''), other = String(fd.get('other') ?? '').trim().replace(/\s+/g, ' ')
  const borough = choice === 'other' ? other : (LONDON_BOROUGHS as readonly string[]).includes(choice) ? choice : ''
  if (choice === 'other' && (borough.length < 2 || borough.length > 60)) return { error: 'Type a place name (2 to 60 characters).' }
  if (!borough) return { error: 'Pick a borough first.' }
  try { return { voted: (await repo.addBoroughVote(user.id, borough)) ? borough : (await repo.myBoroughVote(user.id)) ?? borough } }
  catch (e) { console.error(e); return { error: "That didn't save — please try again." } }
}

// ---------- verified owners ----------
const placeId = z.object({ place_id: id })
const manage = (pid: string) => `/business/${pid}`

export async function savePlace(fd: FormData) {
  const schema = placeId.extend({ name: text(120, 'the name'), subcategory: optional(60), description: optional(2000), address: optional(200), phone: optional(40), website: z.union([z.url('That website address does not look right'), z.literal('')]), booking_url: z.union([z.url('That booking link does not look right'), z.literal('')]), hours_note: optional(300) })
  return act(fd, schema, async (d, user) => {
    await mustOwn(user, d.place_id)
    const hours = Object.fromEntries(DAY_KEYS.map(day => {
      const open = time.safeParse(fd.get(`${day}_open`)), close = time.safeParse(fd.get(`${day}_close`))
      return [day, fd.get(`${day}_closed`) || !open.success || !close.success ? null : { open: open.data, close: close.data }]
    })) as Hours
    const cover = fd.get('cover')
    let cover_url: string | null | undefined
    if (cover instanceof File && cover.size > 0) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(cover.type) || cover.size > 4_000_000) throw new Friendly('The photo must be a JPG, PNG or WebP under 4 MB.')
      cover_url = await repo.uploadCover(d.place_id, cover)
    }
    await repo.updatePlace(d.place_id, { name: d.name, subcategory: d.subcategory, description: d.description, address: d.address, phone: d.phone, website: d.website || null, booking_url: d.booking_url || null, hours_note: d.hours_note, hours, ...(cover_url && { cover_url }) })
    return { path: manage(d.place_id), ok: cover_url === null ? 'Saved. (Photo uploads switch on once the database is connected.)' : 'Saved — your page is updated.' }
  })
}
export async function addMenuItem(fd: FormData) {
  return act(fd, placeId.extend({ section: text(60, 'a section'), name: text(100, 'the item name'), description: optional(300), price }), async (d, user) => {
    await mustOwn(user, d.place_id)
    await repo.addMenuItem(d.place_id, { section: d.section, name: d.name, description: d.description, price_pence: d.price })
    return { path: manage(d.place_id), ok: `Added ${d.name}.` }
  })
}
export async function addPost(fd: FormData) {
  return act(fd, placeId.extend({ title: text(120, 'a headline'), body: text(2000, 'the news') }), async (d, user) => {
    await mustOwn(user, d.place_id)
    await repo.addPost(d.place_id, d.title, d.body)
    return { path: manage(d.place_id), ok: 'Posted — it now shows on the map under “What’s popping”.' }
  })
}
export async function addPlaceEvent(fd: FormData) {
  return act(fd, placeId.extend({ title: text(120, 'a title'), description: optional(2000), kind: z.enum(keys(EVENT_KINDS)), date, time, price }), async (d, user) => {
    await mustOwn(user, d.place_id)
    const place = (await repo.placeById(d.place_id))!
    await repo.addEvent({ place_id: place.id, title: d.title, description: d.description, kind: d.kind, venue_name: place.name, lat: place.lat, lng: place.lng, starts_at: londonToISO(d.date, d.time), ends_at: null, url: null, price_pence: d.price, status: 'published', created_by: user.id })
    return { path: manage(d.place_id), ok: 'Event published.' }
  })
}
export async function removeFromPlace(fd: FormData) {
  return act(fd, placeId.extend({ id, what: z.enum(['menu', 'post', 'event']) }), async (d, user) => {
    await mustOwn(user, d.place_id)
    await { menu: repo.deleteMenuItem, post: repo.deletePost, event: repo.deleteEvent }[d.what](d.place_id, d.id)
    return { path: manage(d.place_id), ok: 'Removed.' }
  })
}

// ---------- admin back office ----------
export async function decideClaim(fd: FormData) {
  await requireAdmin()
  return act(fd, z.object({ id, decision: z.enum(['approve', 'reject']), note: optional(500) }), async d => {
    await repo.decideClaim(d.id, d.decision === 'approve', d.note)
    return { path: '/admin', ok: d.decision === 'approve' ? 'Approved — they can now manage the page.' : 'Claim rejected.' }
  })
}
export async function decideApplication(fd: FormData) {
  await requireAdmin()
  return act(fd, z.object({ id, decision: z.enum(['approve', 'reject']), note: optional(500) }), async d => {
    await repo.decideApplication(d.id, d.decision === 'approve', d.note)
    return { path: '/admin', ok: d.decision === 'approve' ? 'Approved — they are now an admin.' : 'Application declined.' }
  })
}
export async function addAdmin(fd: FormData) {
  await requireAdmin()
  return act(fd, z.object({ email: z.email('Enter the email address they sign in with') }), async d => {
    const account = await repo.findAccountByEmail(d.email)
    if (!account) throw new Friendly('No account uses that email yet. Ask them to sign in to the site once, then try again.')
    await repo.setAdmin(account.id, true)
    return { path: '/admin', ok: `${account.name} is now an admin.` }
  })
}
export async function removeAdmin(fd: FormData) {
  const me = await requireAdmin()
  return act(fd, z.object({ id }), async d => {
    if (d.id === me.id) throw new Friendly('You can’t remove yourself — ask another admin to do it, so there is always at least one.')
    await repo.setAdmin(d.id, false)
    return { path: '/admin', ok: 'Admin access removed.' }
  })
}
export async function syncNow() {
  await requireAdmin()
  back('/admin', 'ok', await syncEvents())
}
const MODERATION = { reviews: ['visible', 'hidden'], listings: ['active', 'hidden'], wishes: ['visible', 'hidden'], events: ['published', 'rejected'], places: ['published', 'hidden'] } as const
export async function moderate(fd: FormData) {
  await requireAdmin()
  return act(fd, z.object({ id, table: z.enum(keys(MODERATION)), status: z.string() }), async d => {
    if (!(MODERATION[d.table] as readonly string[]).includes(d.status)) throw new Error('Bad status')
    await repo.moderate(d.table, d.id, d.status)
    return { path: '/admin', ok: 'Done.' }
  })
}
