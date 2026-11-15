import { Logo } from '@/components/ui'

// Shown while a page's data streams in. Every page reads the signed-in user, so each one streams.
export default function Loading() {
  return <p className="font-display grid h-dvh place-items-center text-2xl font-bold"><span className="flex items-center gap-3"><Logo className="size-12" /> Sketching the neighbourhood…</span></p>
}
