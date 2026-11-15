import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <div className="card max-w-md p-6 text-center">
        <p className="text-5xl" aria-hidden>🗺️</p>
        <h1 className="mt-2 text-3xl font-bold">That&apos;s off the map</h1>
        <p className="muted my-3">We couldn&apos;t find that page. It may have moved, or the place may have closed.</p>
        <Link href="/" className="btn">Back to the map</Link>
      </div>
    </main>
  )
}
