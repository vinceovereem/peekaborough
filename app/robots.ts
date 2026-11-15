import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/config'

// Search engines may read the public pages; everything behind sign-in is of no use to them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/', '/auth/', '/business', '/profile', '/apply', '/trade', '/needs'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
