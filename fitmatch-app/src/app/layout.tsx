import type { Metadata, Viewport } from 'next'
import { Exo_2, JetBrains_Mono, Orbitron } from 'next/font/google'
import './globals.css'

// Orbitron for display, Exo 2 for reading, JetBrains Mono for HUD readouts.
const orbitron = Orbitron({ subsets: ['latin'], weight: ['500', '700', '900'], variable: '--font-orbitron' })
const exo = Exo_2({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--font-exo' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  title: 'FitMatch',
  description: 'Dating, gym buddies and local fitness events for people who move.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050510',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${exo.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  )
}
