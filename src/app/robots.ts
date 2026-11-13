import type { MetadataRoute } from 'next'

const SITE_URL = 'https://viralizahost.com'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/admin',
        '/dashboard',
        '/billing',
        '/settings',
        '/hosting',
        '/domains',
        '/tickets',
        // '$' keeps /email-corporativo and /email/* (public pages) crawlable
        '/email$',
        '/checkout',
        '/auth/',
        '/reset-password',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
