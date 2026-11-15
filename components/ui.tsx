import Link from 'next/link'
import { CATEGORIES, type Category } from '@/lib/config'
import { isOpenNow } from '@/lib/hours'
import { LINE_COLOURS, PALE_LINES } from '@/lib/tfl'
import type { Hours } from '@/lib/types'

export function Stars({ rating, count }: { rating: number | null; count?: number }) {
  if (rating == null) return <span className="muted text-sm">No reviews yet</span>
  return (
    <span className="inline-flex items-center gap-1 text-sm font-bold" aria-label={`Rated ${rating} out of 5`}>
      <span className="text-amber-500">{'★'.repeat(Math.round(rating))}<span className="text-ink/20">{'★'.repeat(5 - Math.round(rating))}</span></span>
      {rating.toFixed(1)}{count != null && <span className="muted font-normal">({count})</span>}
    </span>
  )
}

/** The clay badge for a place category: public/icons, cut from one modelled sheet by scripts/cut-icons.py. */
export function CategoryIcon({ category, className = 'size-5' }: { category: Category; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- twelve tiny static files; the image optimiser would only add a round trip
  return <img src={`/icons/${category}.webp`} alt="" className={`inline-block shrink-0 align-[-0.25em] ${className}`} />
}

export function CategoryTag({ category, sub }: { category: Category; sub?: string | null }) {
  const c = CATEGORIES[category]
  return <span className="tag" style={{ background: c.color }}><CategoryIcon category={category} className="size-4" /> {sub || c.label}</span>
}

export function OpenBadge({ hours, now }: { hours: Hours | null; now: Date }) {
  const open = isOpenNow(hours, now)
  if (open == null) return null
  return <span className={`tag ${open ? 'bg-grass' : 'bg-ink/10'}`}>{open ? 'Open now' : 'Closed now'}</span>
}

/** Line "roundels" for a station. */
export function LinePills({ lines, status }: { lines: { id: string; name: string }[]; status?: Record<string, string> }) {
  return (
    <ul className="flex flex-wrap gap-1.5">{lines.map(l => (
      <li key={l.id} className={`inline-flex items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-0.5 text-sm font-bold ${PALE_LINES.has(l.id) ? 'text-ink' : 'text-white'}`} style={{ background: LINE_COLOURS[l.id] ?? '#555' }}>
        {l.name}{status?.[l.id] && <span className={`rounded-full px-1.5 text-xs ${status[l.id] === 'Good Service' ? 'bg-white/30' : 'bg-white text-ink'}`}>{status[l.id]}</span>}
      </li>
    ))}</ul>
  )
}

export const VerifiedTag = () => <span className="tag bg-sky" title="The owner has been checked by our team">✓ Verified owner</span>
export const SampleTag = () => <span className="tag border-dashed bg-white" title="Made-up content to show how this works">Sample</span>

export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null
  return <p role="status" className={`card mb-5 px-4 py-3 font-bold ${error ? 'bg-tomato text-white' : 'bg-grass'}`}>{error ?? ok}</p>
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="muted rounded-2xl border-2 border-dashed border-ink/30 p-6 text-center">{children}</p>
}

export function BackToMap() {
  return <Link href="/" className="btn btn-white btn-sm">← Map</Link>
}
