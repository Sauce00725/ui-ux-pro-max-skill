import type { Metadata, Viewport } from 'next'
import { Anybody, Inter, JetBrains_Mono } from 'next/font/google'
import { AmbientBackground } from '@/components/AmbientBackground'
import './globals.css'

// Anybody for display (its width axis lets headings stretch and condense),
// Inter for reading, JetBrains Mono for readouts.
const anybody = Anybody({ subsets: ['latin'], axes: ['wdth'], variable: '--font-anybody' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains' })

export const metadata: Metadata = {
  title: { default: 'Gym Buddy', template: '%s · Gym Buddy' },
  applicationName: 'Gym Buddy',
  description: 'Dating, training partners and local fitness events for active people and anyone getting in shape.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#03030a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${anybody.variable} ${inter.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh antialiased">
        <AmbientBackground />
        {children}
      </body>
    </html>
  )
}
