import Link from 'next/link'
import Footer from './Footer'
import { Logo } from './ui'
import { APP_NAME } from '@/lib/config'

/** Frame for pages anyone can read without signing in (guides, legal pages): no account, no map. */
export default function PublicPage({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const width = wide ? 'max-w-5xl' : 'max-w-3xl'
  return (
    <>
      <header className="p-2 sm:p-3"><div className={`card mx-auto flex ${width} items-center gap-3 px-3 py-2`}>
        <Link href="/" className="flex items-center gap-2"><Logo /><b className="font-display text-lg">{APP_NAME}</b></Link>
        <Link href="/" className="btn btn-white btn-sm ml-auto">Back to the site</Link>
      </div></header>
      <main className={`mx-auto ${width} px-3 pt-4 pb-10 sm:px-4`}>{children}</main>
      <Footer />
    </>
  )
}
