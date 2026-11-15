import PublicPage from './PublicPage'

/** Plain, readable layout for the public legal pages (no sign-in needed). */
export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <PublicPage>
      <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
      <p className="muted mt-1 mb-6 text-sm">Last updated {updated}</p>
      <div className="card space-y-4 p-5 leading-relaxed sm:p-7 [&_a]:font-bold [&_a]:underline [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_h2:first-child]:mt-0 [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </PublicPage>
  )
}
