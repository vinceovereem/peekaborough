import { cache } from 'react'
import { repo } from '@/lib/repo'
import { APP_NAME, SITE_URL } from '@/lib/config'

/** Every published place, read once per page build (the title and the page body both need it). */
export const guidePlaces = cache(() => repo.guidePlaces())

/** Markup that tells search engines what a guide page is and where it sits in the site. */
export function guideMarkup(slug: string | null, title: string, description: string) {
  const url = `${SITE_URL}/guides${slug ? `/${slug}` : ''}`
  const crumbs = [['Home', `${SITE_URL}/`], ['Guides', `${SITE_URL}/guides`], ...(slug ? [[title, url]] : [])]
  return JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, description, url, inLanguage: 'en-GB', isPartOf: { '@type': 'WebSite', name: APP_NAME, url: SITE_URL }, about: { '@type': 'AdministrativeArea', name: 'London Borough of Islington' } },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })) },
  ])
}

export const SOURCE_NOTE = 'Places come from OpenStreetMap, the free map that anyone can correct, so a place that is new or not yet mapped may be missing. The map covers the London Borough of Islington, plus Finsbury Park and Clissold Park next door.'
