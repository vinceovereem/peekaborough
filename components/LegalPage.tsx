import Link from 'next/link'
import Footer from './Footer'
import { APP_NAME } from '@/lib/config'

/** Plain, readable layout for the public legal pages (no sign-in needed). */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <header className="p-2 sm:p-3"><div className="card mx-auto flex max-w-3xl items-center gap-3 px-3 py-2">
        <Link href="/" className="flex items-center gap-2"><span className="grid size-9 place-items-center rounded-xl border-2 border-ink bg-sun text-lg shadow-pop-sm">🏘️</span><b className="font-display text-lg">{APP_NAME}</b></Link>
        <Link href="/" className="btn btn-white btn-sm ml-auto">Back to the site</Link>
      </div></header>
      <main className="mx-auto max-w-3xl px-3 pt-4 pb-10 sm:px-4">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        <p className="muted mt-1 mb-6 text-sm">Last updated {updated}</p>
        <div className="card space-y-4 p-5 leading-relaxed sm:p-7 [&_a]:font-bold [&_a]:underline [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h2:first-child]:mt-0 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
      </main>
      <Footer />
    </>
  )
}
