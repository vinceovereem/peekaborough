import Link from 'next/link'
import { APP_NAME, HOOD, DEMO } from '@/lib/config'
import type { User } from '@/lib/types'
import { signOut } from '@/app/login/actions'

const LINKS = [['/', '🗺️', 'Map'], ['/events', '🎟️', "What's on"], ['/news', '📰', 'News'], ['/trade', '🔁', 'Trade'], ['/needs', '💡', 'Needs']] as const

export default function Nav({ user, floating }: { user: User; floating?: boolean }) {
  return (
    <header className={floating ? 'pointer-events-none absolute inset-x-0 top-0 z-20 p-2 sm:p-3' : 'sticky top-0 z-20 p-2 sm:p-3'}>
      <div className="card pointer-events-auto mx-auto flex max-w-6xl items-center gap-2 px-3 py-2">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl border-2 border-ink bg-sun text-lg shadow-pop-sm">🏘️</span>
          <span className="hidden leading-none sm:block">
            <span className="font-display block text-lg font-bold">{APP_NAME}</span>
            <span className="muted text-xs font-bold">{HOOD.name}</span>
          </span>
        </Link>
        <nav className="flex flex-1 gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
          {/* residents get a profile; people with a verified business page get their dashboard */}
          {[...LINKS, user.is_owner ? ['/business', '🏪', 'My business'] as const : ['/profile', '👤', 'My profile'] as const].map(([href, emoji, label]) => (
            <Link key={href} href={href} className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-bold whitespace-nowrap hover:bg-sun/50">
              <span aria-hidden>{emoji}</span> {label}
            </Link>
          ))}
          {user.is_admin && <Link href="/admin" className="shrink-0 rounded-lg bg-ink px-2.5 py-1.5 text-sm font-bold whitespace-nowrap text-white">🛠️ Admin</Link>}
        </nav>
        <form action={signOut} className="flex shrink-0 items-center gap-2">
          <span className="hidden text-right text-xs leading-tight md:block">
            <Link href="/profile" className="block font-bold hover:underline">{user.name}</Link>
            {DEMO && <span className="muted">preview</span>}
          </span>
          <button className="btn btn-white btn-sm" title="Sign out">{DEMO ? 'Switch' : 'Sign out'}</button>
        </form>
      </div>
    </header>
  )
}
