import type { Metadata, Viewport } from 'next'
import { Fredoka, Nunito } from 'next/font/google'
import { APP_NAME, HOOD } from '@/lib/config'
import './globals.css'

const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' })

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — ${HOOD.name}`, template: `%s · ${APP_NAME}` },
  description: `The neighbourhood guide to ${HOOD.name}: every shop, café and pub on a hand-drawn 3D map, with what's on, what's new and what the area needs.`,
}
export const viewport: Viewport = { themeColor: '#fff8ea' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body>
        {children}
      </body>
    </html>
  )
}
