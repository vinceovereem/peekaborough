import Link from 'next/link'
import { APP_NAME } from '@/lib/config'

/** Site-wide footnote: the legal pages, how to get involved, and where the data comes from. */
export default function Footer({ inCard }: { inCard?: boolean }) {
  return (
    <footer className={inCard ? 'mt-5 border-t-2 border-dashed border-ink/20 pt-3 text-sm' : 'mx-auto max-w-5xl px-3 pb-8 text-sm sm:px-4'}>
      <nav aria-label="About this site" className="flex flex-wrap gap-x-4 gap-y-1 font-bold">
        <Link href="/privacy" className="underline">Privacy</Link>
        <Link href="/terms" className="underline">Terms</Link>
        <Link href="/security" className="underline">Security</Link>
        <Link href="/apply" className="underline">Apply to be an admin</Link>
      </nav>
      <p className="muted mt-1.5 text-xs">© {new Date().getFullYear()} {APP_NAME}. Place data © OpenStreetMap contributors. Map © OpenFreeMap. Station information from TfL.</p>
    </footer>
  )
}
