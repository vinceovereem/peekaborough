import type { Hours } from './types'

export const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' }
const TZ = 'Europe/London'

const mins = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

/** London wall-clock day index (0 = Monday) and minutes since midnight. */
export function londonNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)!.value
  return { day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')), minutes: +get('hour') * 60 + +get('minute') }
}

/** null = we don't know the hours. Handles closing after midnight (e.g. pubs 12:00–01:00). */
export function isOpenNow(hours: Hours | null, now = new Date()): boolean | null {
  if (!hours) return null
  const { day, minutes } = londonNow(now)
  const today = hours[DAY_KEYS[day]], yesterday = hours[DAY_KEYS[(day + 6) % 7]]
  if (today) {
    const o = mins(today.open), c = mins(today.close)
    if (c > o ? minutes >= o && minutes < c : minutes >= o) return true
  }
  if (yesterday && mins(yesterday.close) <= mins(yesterday.open) && minutes < mins(yesterday.close)) return true
  return false
}

export const formatPrice = (pence: number | null) => pence == null ? '' : pence === 0 ? 'Free' : `£${(pence / 100).toFixed(2).replace(/\.00$/, '')}`

const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
export const formatDay = (iso: string) => dateFmt.format(new Date(iso))
export const formatTime = (iso: string) => timeFmt.format(new Date(iso)).replace(':00', '').replace(' ', '')
export const dayKey = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(iso))

/** "2026-11-28" + "15:00" London wall time -> UTC ISO string (correct across GMT/BST). */
export function londonToISO(date: string, time: string) {
  const guess = new Date(`${date}T${time}:00Z`)
  const shown = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(guess)
  return new Date(guess.getTime() - (mins(shown) - mins(time)) * 60000).toISOString()
}
