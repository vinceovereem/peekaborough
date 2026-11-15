import { CATEGORIES } from '@/lib/config'
import type { Place } from '@/lib/types'

type P = Pick<Place, 'id' | 'name' | 'category' | 'cover_url' | 'extra'>
const FACADES = ['#f6e2c6', '#f3d2c1', '#e4e9f2', '#efe6d4', '#e7dccd', '#f4ecdc']
const INK = '#25223a'
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7)

/** A little hand-drawn frontage with the place's own name on the sign, so nothing is ever picture-less. */
export function Doodle({ place, className }: { place: P; className?: string }) {
  const c = CATEGORIES[place.category], h = hash(place.id)
  const name = place.name.length > 24 ? place.name.slice(0, 23) + '…' : place.name
  const sign = <text x="200" y="71" textAnchor="middle" fontSize={name.length > 16 ? 15 : 20} fontWeight="700" fill="#fff" style={{ fontFamily: 'var(--font-display)' }}>{name}</text>
  if (place.category === 'green') return (
    <svg viewBox="0 0 400 200" className={className} role="img" aria-label={`Drawing of ${place.name}`} preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="200" fill="#cfeeff" /><circle cx="330" cy="45" r="22" fill="#ffd23f" stroke={INK} strokeWidth="3" />
      <path d="M0 150 Q100 95 200 140 T400 120 V200 H0Z" fill="#9bdc8b" stroke={INK} strokeWidth="3" />
      {[60, 120, 300, 350].map((x, i) => <g key={x}><rect x={x - 4} y={118 + (i % 2) * 8} width="8" height="34" fill="#9a6b43" stroke={INK} strokeWidth="2" /><circle cx={x} cy={104 + (i % 2) * 8} r={24 - (i % 3) * 3} fill={i % 2 ? '#5fbf6c' : '#7bd389'} stroke={INK} strokeWidth="3" /></g>)}
      <rect x="110" y="50" width="180" height="32" rx="6" fill="#9a6b43" stroke={INK} strokeWidth="3" /><rect x="196" y="82" width="8" height="60" fill="#9a6b43" stroke={INK} strokeWidth="2" />{sign}
    </svg>
  )
  const doorLeft = h % 2 === 0
  return (
    <svg viewBox="0 0 400 200" className={className} role="img" aria-label={`Drawing of ${place.name}`} preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="200" fill="#dff3ff" /><rect y="172" width="400" height="28" fill="#d9d2c4" /><path d="M0 172H400" stroke={INK} strokeWidth="3" />
      <rect x="-10" y="40" width="80" height="132" fill="#e9e6e1" stroke={INK} strokeWidth="3" /><rect x="330" y="26" width="80" height="146" fill="#e9e6e1" stroke={INK} strokeWidth="3" />
      <rect x="70" y="12" width="260" height="160" fill={FACADES[h % FACADES.length]} stroke={INK} strokeWidth="3" />
      {[100, 180, 260].map(x => <rect key={x} x={x} y="22" width="40" height="22" rx="3" fill="#bfe3ff" stroke={INK} strokeWidth="2.5" />)}
      <rect x="82" y="50" width="236" height="30" rx="5" fill={INK} />{sign}
      {/* striped awning in the category colour */}
      <path d="M78 84H322L334 106H66Z" fill="#fff" stroke={INK} strokeWidth="3" />
      {[0, 2, 4, 6].map(i => <path key={i} d={`M${78 + i * 30.5} 84L${78 + (i + 1) * 30.5} 84L${66 + (i + 1) * 33.5} 106L${66 + i * 33.5} 106Z`} fill={c.color} stroke={INK} strokeWidth="2" />)}
      <rect x={doorLeft ? 92 : 268} y="114" width="40" height="58" rx="3" fill="#7a5a44" stroke={INK} strokeWidth="3" /><circle cx={doorLeft ? 124 : 276} cy="145" r="2.5" fill="#ffd23f" />
      <rect x={doorLeft ? 146 : 92} y="114" width="162" height="46" rx="3" fill="#cfeeff" stroke={INK} strokeWidth="3" />
      <image href={`/icons/${place.category}.webp`} x={(doorLeft ? 227 : 173) - 20} y="117" width="40" height="40" />
    </svg>
  )
}

/** Best picture we are allowed to show: the owner's photo, else a free-licence photo, else a drawing. */
export default function PlacePicture({ place, googlePhoto, className }: { place: P; googlePhoto?: string; className?: string }) {
  const src = place.cover_url ?? googlePhoto ?? place.extra.photo?.url
  // eslint-disable-next-line @next/next/no-img-element -- photos come from owners, Commons or Google at any size
  return src ? <img src={src} alt={`Photo of ${place.name}`} className={`${className} object-cover`} /> : <Doodle place={place} className={className} />
}
