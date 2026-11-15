'use client'
import Link from 'next/link'
import { useState } from 'react'

/** Phones and tablets: the pages drop down from one button instead of scrolling sideways in the bar. */
export default function MenuButton({ links }: { links: (readonly [href: string, emoji: string, label: string])[] }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative flex-1 lg:hidden">
      <button onClick={() => setOpen(!open)} aria-expanded={open} className="btn btn-white btn-sm">☰ Menu</button>
      {open && <>
        {/* a tap anywhere else closes it */}
        <button aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 cursor-default" />
        <nav className="card absolute top-full left-0 mt-3 w-60 p-1.5">
          {links.map(([href, emoji, label]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 font-bold hover:bg-sun/50"><span aria-hidden>{emoji}</span> {label}</Link>
          ))}
        </nav>
      </>}
    </div>
  )
}
