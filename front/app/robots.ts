import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/app/lib/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin',
        '/api/',
        '/game/',
        '/profile',
        '/login',
        '/register',
        '/dev/', // dev-only sandbox, 404 in production
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
