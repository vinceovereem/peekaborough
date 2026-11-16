// Supabase implementation of the Repo interface (see lib/memory.ts for the reference behaviour).
// User-level calls go through the caller's session so row-level security in
// supabase/migrations is the real gatekeeper; only the admin block uses the service role.
import type { PostgrestError } from '@supabase/supabase-js'
import { createClient, createAdminClient, createPublicClient } from './supabase/server'
import type { Repo } from './memory'
import type { Place, MapPlace, MenuItem, Post, Review, Event, Listing, Wish, Claim, AdminApplication } from './types'

function ok<T>({ data, error }: { data: T; error: PostgrestError | null }): NonNullable<T> {
  if (error) throw new Error(error.message)
  return data as NonNullable<T>
}
const author = (r: { profiles?: { display_name: string } | null }) => r.profiles?.display_name ?? 'Neighbour'
const tally = (r: { wish_votes: { user_id: string; value: number }[] }, userId: string | null) => ({
  ups: r.wish_votes.filter(v => v.value === 1).length, downs: r.wish_votes.filter(v => v.value === -1).length,
  mine: (r.wish_votes.find(v => v.user_id === userId)?.value ?? 0) as -1 | 0 | 1,
})
const soon = () => new Date(Date.now() - 3 * 3600_000).toISOString()
const MAP_COLS = 'id,slug,name,category,subcategory,address,lat,lng,hours,cover_url,extra,is_landmark,is_demo,verified,rating,review_count'

async function everyPlace(db: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createPublicClient>) {
  const all: MapPlace[] = []
  for (let from = 0; ; from += 1000) { // the Data API returns at most 1000 rows per request
    const page = ok(await db.from('places_view').select(MAP_COLS).eq('status', 'published').order('id').range(from, from + 999)) as MapPlace[]
    all.push(...page)
    if (page.length < 1000) return all
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any -- rows are untyped until `supabase gen types` is wired up */
export const supabaseRepo: Repo = {
  async mapPlaces() { return everyPlace(await createClient()) },
  async guidePlaces() { return everyPlace(createPublicClient()) },
  async place(slug) { return (await (await createClient()).from('places_view').select('*').eq('slug', slug).maybeSingle()).data as Place | null },
  async placeById(id) { return (await (await createClient()).from('places_view').select('*').eq('id', id).maybeSingle()).data as Place | null },
  async searchPlaces(q) {
    const s = q.trim().replace(/[%_,()]/g, ' ')
    if (s.length < 2) return []
    return ok(await (await createClient()).from('places_view').select('*').eq('status', 'published').ilike('name', `%${s}%`).limit(12)) as Place[]
  },
  async menu(placeId) { return ok(await (await createClient()).from('menu_items').select('*').eq('place_id', placeId).order('position')) as MenuItem[] },
  async posts(placeId) { return ok(await (await createClient()).from('posts').select('*').eq('place_id', placeId).order('created_at', { ascending: false })) as Post[] },
  async latestPosts(limit) {
    const rows = ok(await (await createClient()).from('posts').select('*, place:places(name,slug,category)').order('created_at', { ascending: false }).limit(limit))
    return rows as Post[]
  },
  async reviews(placeId) { // RLS already returns visible reviews plus the caller's own
    const rows = ok(await (await createClient()).from('reviews').select('*, profiles(display_name)').eq('place_id', placeId).order('created_at', { ascending: false }))
    return rows.map((r: any) => ({ ...r, author: author(r) })) as Review[]
  },
  async events(placeId) {
    let q = (await createClient()).from('events').select('*, place:places(slug)').eq('status', 'published').gte('starts_at', soon()).order('starts_at').limit(1000)
    if (placeId) q = q.eq('place_id', placeId)
    return ok(await q) as Event[]
  },
  async listings() {
    const rows = ok(await (await createClient()).from('listings').select('*, profiles(display_name)').in('status', ['active', 'closed']).order('created_at', { ascending: false }).limit(200))
    return rows.map((r: any) => ({ ...r, author: author(r) })) as Listing[]
  },
  async wishes(userId) {
    // wishes relate to profiles twice (the author, and voters through wish_votes), so the author link is named
    // ponytail: pulls every vote row to count them; move to a count view once wishes get hundreds of votes.
    const rows = ok(await (await createClient()).from('wishes').select('*, profiles!wishes_user_id_fkey(display_name), wish_votes(user_id, value)').eq('status', 'visible').limit(200))
    return rows.map((r: any): Wish => ({ id: r.id, user_id: r.user_id, title: r.title, description: r.description, status: r.status, created_at: r.created_at, author: author(r), ...tally(r, userId) }))
      .sort((a, b) => (b.ups - b.downs) - (a.ups - a.downs) || b.created_at.localeCompare(a.created_at))
  },
  async isOwner(userId, placeId) {
    return !!(await (await createClient()).from('place_owners').select('place_id').eq('place_id', placeId).eq('user_id', userId).maybeSingle()).data
  },
  async myPlaces(userId) {
    const db = await createClient()
    const ids = ok(await db.from('place_owners').select('place_id').eq('user_id', userId)).map((r: any) => r.place_id)
    return ids.length ? ok(await db.from('places_view').select('*').in('id', ids)) as Place[] : []
  },
  async myReviews(userId) {
    return ok(await (await createClient()).from('reviews').select('*, place:places(name,slug)').eq('user_id', userId).order('created_at', { ascending: false })).map((r: any) => ({ ...r, author: '' })) as Review[]
  },
  async updateProfile(userId, name) { ok(await (await createClient()).from('profiles').update({ display_name: name }).eq('id', userId).select('id')) },
  async favoriteIds(userId) { return ok(await (await createClient()).from('favorites').select('place_id').eq('user_id', userId)).map((r: any) => r.place_id) },
  async myFavorites(userId) {
    const ids = await supabaseRepo.favoriteIds(userId)
    return ids.length ? ok(await (await createClient()).from('places_view').select('*').in('id', ids).eq('status', 'published')) as Place[] : []
  },
  async toggleFavorite(userId, placeId) {
    const db = await createClient()
    const removed = ok(await db.from('favorites').delete().eq('user_id', userId).eq('place_id', placeId).select('place_id'))
    if (!removed.length) ok(await db.from('favorites').insert({ user_id: userId, place_id: placeId }).select('place_id'))
  },
  async myApplication(userId) {
    return (await (await createClient()).from('admin_applications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()).data as AdminApplication | null
  },
  async createApplication(user, a) {
    const { error } = await (await createClient()).from('admin_applications').insert({ ...a, user_id: user.id })
    if (error && error.code !== '23505') throw new Error(error.message) // 23505 = already has a pending application
  },
  async myClaims(userId) {
    return ok(await (await createClient()).from('claims').select('*, place:places(name,slug,address,website)').eq('user_id', userId).order('created_at', { ascending: false })) as Claim[]
  },

  async upsertReview(user, placeId, rating, comment) {
    ok(await (await createClient()).from('reviews').upsert({ place_id: placeId, user_id: user.id, rating, comment }, { onConflict: 'place_id,user_id' }).select('id'))
  },
  async createListing(user, l) { ok(await (await createClient()).from('listings').insert({ ...l, user_id: user.id }).select('id')) },
  async setListingStatus(userId, listingId, status) { ok(await (await createClient()).from('listings').update({ status }).eq('id', listingId).eq('user_id', userId).select('id')) },
  async createWish(user, title, description) {
    const db = await createClient()
    const [wish] = ok(await db.from('wishes').insert({ user_id: user.id, title, description }).select('id')) as { id: string }[]
    await db.from('wish_votes').insert({ wish_id: wish.id, user_id: user.id })
  },
  async vote(userId, wishId, value) {
    const db = await createClient()
    const mine = (await db.from('wish_votes').select('value').eq('wish_id', wishId).eq('user_id', userId).maybeSingle()).data
    if (mine?.value === value) ok(await db.from('wish_votes').delete().eq('wish_id', wishId).eq('user_id', userId).select('wish_id'))
    else ok(await db.from('wish_votes').upsert({ wish_id: wishId, user_id: userId, value }, { onConflict: 'wish_id,user_id' }).select('wish_id'))
  },
  async createClaim(user, c) {
    const { error } = await (await createClient()).from('claims').insert({ ...c, user_id: user.id })
    if (error && error.code !== '23505') throw new Error(error.message) // 23505 = already has a pending claim
  },
  async updatePlace(placeId, patch) { ok(await (await createClient()).from('places').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', placeId).select('id')) },
  async addMenuItem(placeId, m) { ok(await (await createClient()).from('menu_items').insert({ ...m, place_id: placeId, position: Math.floor(Date.now() / 1000) }).select('id')) },
  async deleteMenuItem(placeId, itemId) { ok(await (await createClient()).from('menu_items').delete().eq('id', itemId).eq('place_id', placeId).select('id')) },
  async addPost(placeId, title, body) { ok(await (await createClient()).from('posts').insert({ place_id: placeId, title, body }).select('id')) },
  async deletePost(placeId, postId) { ok(await (await createClient()).from('posts').delete().eq('id', postId).eq('place_id', placeId).select('id')) },
  async addEvent(e) { ok(await (await createClient()).from('events').insert(e).select('id')) },
  async importEvents(list) {
    if (list.length) ok(await createAdminClient().from('events').upsert(list.map(e => ({ ...e, status: 'published' })), { onConflict: 'source,source_id' }).select('id'))
  },
  async deleteEvent(placeId, eventId) { ok(await (await createClient()).from('events').delete().eq('id', eventId).eq('place_id', placeId).select('id')) },
  async setGooglePlaceId(placeId, googleId) { ok(await createAdminClient().from('places').update({ google_place_id: googleId }).eq('id', placeId).select('id')) },
  async uploadCover(placeId, file) {
    // Caller has verified ownership. The bucket is public-read; only the service role writes to it.
    const path = `${placeId}/cover-${Date.now()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`
    const storage = createAdminClient().storage.from('place-photos')
    const { error } = await storage.upload(path, file, { contentType: file.type })
    if (error) throw new Error(error.message)
    return storage.getPublicUrl(path).data.publicUrl
  },

  async adminData() {
    const db = createAdminClient()
    const count = async (table: string, filter?: [string, string | boolean]) => {
      let q = db.from(table).select('*', { count: 'exact', head: true })
      if (filter) q = q.eq(filter[0], filter[1])
      return (await q).count ?? 0
    }
    const [claims, pendingEvents, reviews, listings, wishes, applications, adminRows, emails] = await Promise.all([
      db.from('claims').select('*, place:places(name,slug,address,website), profiles(display_name)').order('created_at', { ascending: false }).limit(100),
      db.from('events').select('*').eq('status', 'pending').order('starts_at'),
      db.from('reviews').select('*, profiles(display_name), place:places(name,slug)').order('created_at', { ascending: false }).limit(30),
      db.from('listings').select('*, profiles(display_name)').order('created_at', { ascending: false }).limit(30),
      db.from('wishes').select('*, profiles!wishes_user_id_fkey(display_name), wish_votes(user_id, value)').order('created_at', { ascending: false }).limit(30),
      db.from('admin_applications').select('*, profiles(display_name)').order('created_at', { ascending: false }).limit(100),
      db.from('profiles').select('id, display_name').eq('is_admin', true).order('created_at'),
      db.auth.admin.listUsers({ perPage: 1000 }), // ponytail: fine below 1000 users; look claimants up one by one after that
    ])
    const emailOf = new Map(emails.data?.users.map(u => [u.id, u.email ?? null]))
    return {
      claims: ok(claims).map((c: any) => ({ ...c, claimant: { name: author(c), email: emailOf.get(c.user_id) ?? null } })) as Claim[],
      pendingEvents: ok(pendingEvents) as Event[],
      reviews: ok(reviews).map((r: any) => ({ ...r, author: author(r) })) as Review[],
      listings: ok(listings).map((r: any) => ({ ...r, author: author(r) })) as Listing[],
      wishes: ok(wishes).map((r: any) => ({ ...r, author: author(r), ...tally(r, null) })) as Wish[],
      applications: ok(applications).map((a: any) => ({ ...a, account: { name: author(a), email: emailOf.get(a.user_id) ?? null } })) as AdminApplication[],
      admins: ok(adminRows).map((p: any) => ({ id: p.id, name: p.display_name, email: emailOf.get(p.id) ?? null })),
      counts: {
        places: await count('places'), verified: await count('places', ['verified', true]), reviews: await count('reviews'),
        events: await count('events', ['status', 'published']), listings: await count('listings', ['status', 'active']), wishes: await count('wishes'),
      },
    }
  },
  async decideClaim(claimId, approve, note) {
    // ponytail: three writes, not one transaction. If this ever half-applies, re-approving is safe (upsert).
    const db = createAdminClient()
    const [claim] = ok(await db.from('claims').update({ status: approve ? 'approved' : 'rejected', admin_note: note, reviewed_at: new Date().toISOString() }).eq('id', claimId).eq('status', 'pending').select('place_id,user_id')) as { place_id: string; user_id: string }[]
    if (!claim || !approve) return
    ok(await db.from('place_owners').upsert({ place_id: claim.place_id, user_id: claim.user_id }).select('place_id'))
    ok(await db.from('places').update({ verified: true }).eq('id', claim.place_id).select('id'))
  },
  async decideApplication(applicationId, approve, note) {
    const db = createAdminClient()
    const [application] = ok(await db.from('admin_applications').update({ status: approve ? 'approved' : 'rejected', admin_note: note, reviewed_at: new Date().toISOString() }).eq('id', applicationId).eq('status', 'pending').select('user_id')) as { user_id: string }[]
    if (application && approve) await supabaseRepo.setAdmin(application.user_id, true)
  },
  async setAdmin(userId, isAdmin) { ok(await createAdminClient().from('profiles').update({ is_admin: isAdmin }).eq('id', userId).select('id')) },
  async findAccountByEmail(email) {
    const db = createAdminClient()
    const { data } = await db.auth.admin.listUsers({ perPage: 1000 }) // ponytail: same 1000-account ceiling as the claims list
    const user = data?.users.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!user) return null
    const profile = (await db.from('profiles').select('display_name').eq('id', user.id).maybeSingle()).data
    return { id: user.id, name: profile?.display_name ?? 'Neighbour', email: user.email ?? null }
  },
  async moderate(table, rowId, status) { ok(await createAdminClient().from(table).update({ status }).eq('id', rowId).select('id')) },
}
