// Data store used before a database is connected: the real places from data/places.json and the
// real events, held in memory. It starts with no reviews, listings, wishes or claims — only what
// visitors add themselves.
// ponytail: writes vanish on restart and aren't shared between server instances. Add Supabase keys
// and lib/supabase-repo.ts takes over with the same interface.
import rawPlaces from '@/data/places.json'
import { DEMO_USERS, realEvents } from '@/data/demo'
import type { Place, MapPlace, MenuItem, Post, Review, Event, Listing, Wish, Claim, AdminApplication, AdminUser } from './types'
import type { ExternalEvent } from './sources'

type Row = Omit<Place, 'rating' | 'review_count'>
type WishRow = Omit<Wish, 'author' | 'ups' | 'downs' | 'mine'> & { votes: Record<string, 1 | -1> }
function init() {
  return {
    places: rawPlaces as Row[],
    owners: new Set<string>(), menu: [] as MenuItem[], posts: [] as Post[], reviews: [] as Review[],
    events: realEvents(), listings: [] as Listing[], wishes: [] as WishRow[], claims: [] as Claim[],
    names: Object.fromEntries(DEMO_USERS.map(u => [u.id, u.name])) as Record<string, string>,
    favorites: new Set<string>(), applications: [] as AdminApplication[],
  }
}
const g = globalThis as unknown as { __patch?: ReturnType<typeof init> }
const db = () => (g.__patch ??= init())
const id = () => crypto.randomUUID()
const now = () => new Date().toISOString()
const newest = <T extends { created_at: string }>(a: T[]) => [...a].sort((x, y) => y.created_at.localeCompare(x.created_at))

function withRating(p: Row): Place {
  const rs = db().reviews.filter(r => r.place_id === p.id && r.status === 'visible')
  return { ...p, review_count: rs.length, rating: rs.length ? Math.round(rs.reduce((s, r) => s + r.rating, 0) / rs.length * 10) / 10 : null }
}
const placeRef = (place_id: string) => { const p = db().places.find(p => p.id === place_id)!; return { name: p.name, slug: p.slug, category: p.category, address: p.address, website: p.website } }
const toWish = (w: WishRow, userId: string | null): Wish =>
  ({ id: w.id, user_id: w.user_id, title: w.title, description: w.description, status: w.status, created_at: w.created_at, author: db().names[w.user_id] ?? 'Neighbour',
    ups: Object.values(w.votes).filter(v => v === 1).length, downs: Object.values(w.votes).filter(v => v === -1).length, mine: (userId && w.votes[userId]) || 0 })
const toClaim = (c: Claim): Claim => ({ ...c, place: placeRef(c.place_id), claimant: { name: db().names[c.user_id] ?? 'Neighbour', email: DEMO_USERS.find(u => u.id === c.user_id)?.email ?? null } })
// ponytail: the preview copy counts Ask questions per server instance; the live site counts them in the database.
const asked = new Map<string, number[]>()
const upcoming = (e: Event) => new Date(e.ends_at ?? e.starts_at).getTime() > Date.now() - 3 * 3600_000

export const memoryRepo = {
  async mapPlaces(): Promise<MapPlace[]> {
    return db().places.filter(p => p.status === 'published').map(withRating)
      .map(({ id, slug, name, category, subcategory, address, lat, lng, hours, cover_url, extra, is_landmark, is_demo, verified, rating, review_count }) => ({ id, slug, name, category, subcategory, address, lat, lng, hours, cover_url, extra, is_landmark, is_demo, verified, rating, review_count }))
  },
  /** The same list for the public guide pages, read without a signed-in visitor. */
  async guidePlaces(): Promise<MapPlace[]> { return memoryRepo.mapPlaces() },
  async place(slug: string): Promise<Place | null> { const p = db().places.find(p => p.slug === slug); return p ? withRating(p) : null },
  async placeById(pid: string): Promise<Place | null> { const p = db().places.find(p => p.id === pid); return p ? withRating(p) : null },
  async searchPlaces(q: string): Promise<Place[]> {
    const s = q.trim().toLowerCase()
    return s.length < 2 ? [] : db().places.filter(p => p.status === 'published' && p.name.toLowerCase().includes(s)).slice(0, 12).map(withRating)
  },
  async menu(placeId: string): Promise<MenuItem[]> { return db().menu.filter(m => m.place_id === placeId).sort((a, b) => a.position - b.position) },
  async posts(placeId: string): Promise<Post[]> { return newest(db().posts.filter(p => p.place_id === placeId)) },
  async latestPosts(limit: number): Promise<Post[]> { return newest(db().posts).slice(0, limit).map(p => ({ ...p, place: placeRef(p.place_id) })) },
  async reviews(placeId: string, userId: string | null): Promise<Review[]> { return newest(db().reviews.filter(r => r.place_id === placeId && (r.status === 'visible' || r.user_id === userId))) },
  async events(placeId?: string): Promise<Event[]> {
    return db().events.filter(e => e.status === 'published' && upcoming(e) && (!placeId || e.place_id === placeId))
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
      .map(e => ({ ...e, place: e.place_id ? { slug: placeRef(e.place_id).slug } : null }))
  },
  async listings(userId: string | null): Promise<Listing[]> { return newest(db().listings.filter(l => l.status === 'active' || (l.user_id === userId && l.status === 'closed'))) },
  async wishes(userId: string | null): Promise<Wish[]> { return db().wishes.filter(w => w.status === 'visible').map(w => toWish(w, userId)).sort((a, b) => (b.ups - b.downs) - (a.ups - a.downs) || b.created_at.localeCompare(a.created_at)) },
  async isOwner(userId: string, placeId: string) { return db().owners.has(`${placeId}|${userId}`) },
  async myPlaces(userId: string): Promise<Place[]> { return db().places.filter(p => db().owners.has(`${p.id}|${userId}`)).map(withRating) },
  async myReviews(userId: string): Promise<Review[]> { return newest(db().reviews.filter(r => r.user_id === userId)).map(r => ({ ...r, place: placeRef(r.place_id) })) },
  async updateProfile(userId: string, name: string) {
    db().names[userId] = name
    for (const row of [...db().reviews, ...db().listings]) if (row.user_id === userId) row.author = name
    const demo = DEMO_USERS.find(u => u.id === userId); if (demo) demo.name = name
  },
  async favoriteIds(userId: string): Promise<string[]> { return [...db().favorites].filter(k => k.startsWith(userId + '|')).map(k => k.split('|')[1]) },
  async myFavorites(userId: string): Promise<Place[]> { const ids = new Set(await memoryRepo.favoriteIds(userId)); return db().places.filter(p => ids.has(p.id) && p.status === 'published').map(withRating) },
  /** Saves a place to someone's favourites, or removes it if it is already there. */
  async toggleFavorite(userId: string, placeId: string) { const k = `${userId}|${placeId}`; if (!db().favorites.delete(k)) db().favorites.add(k) },
  /** The person's most recent application to become an admin, if any. */
  async myApplication(userId: string): Promise<AdminApplication | null> { return newest(db().applications.filter(a => a.user_id === userId))[0] ?? null },
  async createApplication(user: { id: string }, a: Pick<AdminApplication, 'full_name' | 'email' | 'phone' | 'address' | 'years_in_area' | 'occupation' | 'favourite_thing'>) {
    if (db().applications.some(x => x.user_id === user.id && x.status === 'pending')) return
    db().applications.push({ ...a, id: id(), user_id: user.id, status: 'pending', admin_note: null, created_at: now() })
  },
  async myClaims(userId: string): Promise<Claim[]> { return newest(db().claims.filter(c => c.user_id === userId)).map(toClaim) },

  async upsertReview(user: { id: string; name: string }, placeId: string, rating: number, comment: string | null) {
    db().names[user.id] = user.name
    const mine = db().reviews.find(r => r.place_id === placeId && r.user_id === user.id)
    if (mine) { if (mine.status === 'visible') Object.assign(mine, { rating, comment }) }
    else db().reviews.push({ id: id(), place_id: placeId, user_id: user.id, rating, comment, status: 'visible', created_at: now(), author: user.name })
  },
  async createListing(user: { id: string; name: string }, l: Pick<Listing, 'kind' | 'title' | 'description' | 'price_pence' | 'contact'>) {
    db().listings.push({ ...l, id: id(), user_id: user.id, status: 'active', created_at: now(), author: user.name })
  },
  async setListingStatus(userId: string, listingId: string, status: 'active' | 'closed') {
    const l = db().listings.find(l => l.id === listingId && l.user_id === userId && l.status !== 'hidden'); if (l) l.status = status
  },
  async createWish(user: { id: string; name: string }, title: string, description: string | null) {
    db().names[user.id] = user.name
    db().wishes.push({ id: id(), user_id: user.id, title, description, status: 'visible', created_at: now(), votes: { [user.id]: 1 } })
  },
  /** Agree (+1) or disagree (-1) with a wish; voting the same way twice takes the vote back. */
  async vote(userId: string, wishId: string, value: 1 | -1) {
    const w = db().wishes.find(w => w.id === wishId); if (!w) return
    if (w.votes[userId] === value) delete w.votes[userId]
    else w.votes[userId] = value
  },
  async createClaim(user: { id: string; name: string }, c: Pick<Claim, 'place_id' | 'role' | 'business_email' | 'phone' | 'evidence'>) {
    db().names[user.id] = user.name
    if (db().claims.some(x => x.place_id === c.place_id && x.user_id === user.id && x.status === 'pending')) return
    db().claims.push({ ...c, id: id(), user_id: user.id, status: 'pending', admin_note: null, created_at: now() })
  },
  async updatePlace(placeId: string, patch: Partial<Pick<Place, 'name' | 'subcategory' | 'description' | 'address' | 'phone' | 'website' | 'booking_url' | 'hours' | 'hours_note'>>) {
    Object.assign(db().places.find(p => p.id === placeId)!, patch)
  },
  async addMenuItem(placeId: string, m: Pick<MenuItem, 'section' | 'name' | 'description' | 'price_pence'>) { db().menu.push({ ...m, id: id(), place_id: placeId, position: db().menu.length }) },
  async deleteMenuItem(placeId: string, itemId: string) { db().menu = db().menu.filter(m => !(m.id === itemId && m.place_id === placeId)) },
  async addPost(placeId: string, title: string, body: string) { db().posts.push({ id: id(), place_id: placeId, title, body, created_at: now() }) },
  async deletePost(placeId: string, postId: string) { db().posts = db().posts.filter(p => !(p.id === postId && p.place_id === placeId)) },
  async addEvent(e: Omit<Event, 'id' | 'place' | 'is_sample' | 'source'>) { db().events.push({ ...e, id: id(), is_sample: false, source: null }) },
  /** Saves automatically fetched events; one already known (same source + id) is updated, not duplicated. */
  async importEvents(list: ExternalEvent[]) {
    for (const { source_id, ...e } of list) {
      const key = `${e.source}:${source_id}`, known = db().events.find(x => x.id === key)
      if (known) Object.assign(known, e)
      else db().events.push({ ...e, id: key, place_id: null, is_sample: false, status: 'published', created_by: null })
    }
  },
  async deleteEvent(placeId: string, eventId: string) { db().events = db().events.filter(e => !(e.id === eventId && e.place_id === placeId)) },
  /** Counts one Ask question against the person's 30 an hour; false when they have used them up. */
  async takeAskTurn(userId: string): Promise<boolean> {
    const times = (asked.get(userId) ?? []).filter(t => t > Date.now() - 3600_000)
    if (times.length >= 30) return false
    asked.set(userId, [...times, Date.now()])
    return true
  },
  /** Remembers which Google Maps listing a place is, so it's only looked up once. */
  async setGooglePlaceId(placeId: string, googleId: string) { db().places.find(p => p.id === placeId)!.google_place_id = googleId },
  /** Stores the photo and puts it on the place's page. Returns its public URL, or null when photo storage isn't available (demo mode). */
  async uploadCover(placeId: string, file: File): Promise<string | null> { void placeId; void file; return null },

  // --- admin (callers must check requireAdmin first) ---
  async adminData(): Promise<{ claims: Claim[]; pendingEvents: Event[]; reviews: Review[]; listings: Listing[]; wishes: Wish[]; applications: AdminApplication[]; admins: AdminUser[]; counts: Record<'places' | 'verified' | 'reviews' | 'events' | 'listings' | 'wishes', number> }> {
    const d = db()
    return {
      claims: newest(d.claims).map(toClaim),
      pendingEvents: d.events.filter(e => e.status === 'pending'),
      reviews: newest(d.reviews).slice(0, 30).map(r => ({ ...r, place: placeRef(r.place_id) })),
      listings: newest(d.listings).slice(0, 30),
      wishes: newest(d.wishes).slice(0, 30).map(w => toWish(w, null)),
      applications: newest(d.applications).map(a => ({ ...a, account: { name: d.names[a.user_id] ?? 'Neighbour', email: null } })),
      admins: DEMO_USERS.filter(u => u.is_admin).map(u => ({ id: u.id, name: u.name, email: u.email })),
      counts: { places: d.places.length, verified: d.places.filter(p => p.verified).length, reviews: d.reviews.length, events: d.events.filter(e => e.status === 'published' && upcoming(e)).length, listings: d.listings.filter(l => l.status === 'active').length, wishes: d.wishes.length },
    }
  },
  async decideClaim(claimId: string, approve: boolean, note: string | null) {
    const c = db().claims.find(c => c.id === claimId && c.status === 'pending'); if (!c) return
    Object.assign(c, { status: approve ? 'approved' : 'rejected', admin_note: note })
    if (approve) { db().owners.add(`${c.place_id}|${c.user_id}`); db().places.find(p => p.id === c.place_id)!.verified = true }
  },
  /** Approving makes the applicant's account an admin. */
  async decideApplication(applicationId: string, approve: boolean, note: string | null) {
    const a = db().applications.find(a => a.id === applicationId && a.status === 'pending'); if (!a) return
    Object.assign(a, { status: approve ? 'approved' : 'rejected', admin_note: note })
    if (approve) await memoryRepo.setAdmin(a.user_id, true)
  },
  async setAdmin(userId: string, isAdmin: boolean) { const u = DEMO_USERS.find(u => u.id === userId); if (u) u.is_admin = isAdmin },
  /** Looks an account up by its sign-in email, so an existing member can be made an admin. */
  async findAccountByEmail(email: string): Promise<AdminUser | null> { const u = DEMO_USERS.find(u => u.email?.toLowerCase() === email.toLowerCase()); return u ? { id: u.id, name: u.name, email: u.email } : null },
  async moderate(table: 'reviews' | 'listings' | 'wishes' | 'events' | 'places', rowId: string, status: string) {
    const row = (db()[table] as { id: string; status: string }[]).find(r => r.id === rowId); if (row) row.status = status
  },
}
export type Repo = typeof memoryRepo
