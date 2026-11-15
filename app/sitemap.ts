import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/config'

// Only pages that open without signing in belong here. Add place and guide pages if they become public.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/privacy`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/terms`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/security`, changeFrequency: 'yearly', priority: 0.2 },
  ]
}
