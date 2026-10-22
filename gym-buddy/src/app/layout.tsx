import type { Metadata, Viewport } from 'next'
import { JetBrains_Mono, Saira } from 'next/font/google'
import { AmbientBackground } from '@/components/AmbientBackground'
import './globals.css'

// Saira for display and reading (its width axis lets type condense; italics
// for the display voice), JetBrains Mono for readouts.
const saira = Saira({ subsets: ['latin'], axes: ['wdth'], style: ['normal', 'italic'], variable: '--font-saira' })
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
  themeColor: '#0a0a0b',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${saira.variable} ${jetbrains.variable}`}>
      <body className="min-h-dvh antialiased">
        <AmbientBackground />
        {children}
      </body>
    </html>
  )
}
