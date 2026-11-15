import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/config'
import { GUIDES, STATIONS_GUIDE } from '@/lib/guides'

// Only pages that open without signing in belong here. Add place pages if they become public.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/guides`, changeFrequency: 'weekly', priority: 0.8 },
    ...[...GUIDES, STATIONS_GUIDE].map(g => ({ url: `${SITE_URL}/guides/${g.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/security`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
