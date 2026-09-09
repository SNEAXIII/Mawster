import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mawster — Alliance War planner for Marvel Contest of Champions',
    short_name: 'Mawster',
    description:
      'Plan Alliance War in Marvel Contest of Champions: combat history, roster management, ia import roster, defense placements, attack assignments, synergies, prefights and war stats for your whole alliance.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/logos/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logos/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
