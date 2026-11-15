'use client'
import Link from 'next/link'

// Shown if a page hits an unexpected problem. The details go to the server log, not to the visitor.
export default function Oops({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="card max-w-md p-6 text-center">
        <p className="text-5xl" aria-hidden>🧭</p>
        <h1 className="mt-2 text-3xl font-bold">We took a wrong turn</h1>
        <p className="muted my-3">Something didn&apos;t load properly. It&apos;s us, not you — please try again.</p>
        <div className="flex justify-center gap-2"><button onClick={reset} className="btn">Try again</button><Link href="/" className="btn btn-white">Back to the map</Link></div>
      </div>
    </main>
  )
}
