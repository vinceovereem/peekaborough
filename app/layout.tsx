import type { Metadata, Viewport } from 'next'
import { Fredoka, Nunito } from 'next/font/google'
import { APP_NAME, HOOD, SITE_URL } from '@/lib/config'
import './globals.css'

const fredoka = Fredoka({ subsets: ['latin'], variable: '--font-fredoka' })
const nunito = Nunito({ subsets: ['latin'], variable: '--font-nunito' })

const DESCRIPTION = `The neighbourhood guide to ${HOOD.name}, London: every shop, café and pub on a hand-drawn 3D map, with what's on, local news and what the area needs.`

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME} — the neighbourhood guide to ${HOOD.name}, London`, template: `%s · ${APP_NAME}` },
  applicationName: APP_NAME,
  openGraph: { type: 'website', siteName: APP_NAME, locale: 'en_GB', title: `${APP_NAME} — the neighbourhood guide to ${HOOD.name}`, description: DESCRIPTION, url: '/' },
  twitter: { card: 'summary', title: `${APP_NAME} — the neighbourhood guide to ${HOOD.name}`, description: DESCRIPTION },
  description: DESCRIPTION,
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
