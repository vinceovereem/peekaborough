import { requireVisitor } from '@/lib/auth'
import Nav from './Nav'
import { Flash } from './ui'
import Footer from './Footer'

export default async function Shell({ title, intro, flash, children }: { title: string; intro?: string; flash?: { ok?: string; error?: string }; children: React.ReactNode }) {
  const user = await requireVisitor() // pages that need an account check requireUser() themselves, before rendering this
  return (
    <>
      <Nav user={user} />
      <main className="mx-auto max-w-5xl px-3 pt-4 pb-16 sm:px-4">
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {intro && <p className="muted mt-1 mb-6 max-w-2xl text-lg">{intro}</p>}
        <Flash {...flash} />
        {children}
      </main>
      <Footer />
    </>
  )
}
