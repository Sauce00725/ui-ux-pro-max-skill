import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Gym Buddy',
    short_name: 'Gym Buddy',
    description: 'Dating, gym buddies and local fitness events, from day one to race day.',
    start_url: '/discover',
    display: 'standalone',
    background_color: '#050510',
    theme_color: '#050510',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
