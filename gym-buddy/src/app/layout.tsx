import type { Metadata, Viewport } from 'next'
import { Anybody, Doto, Geist, Geist_Mono, Inter, JetBrains_Mono, Saira } from 'next/font/google'
import { AmbientBackground } from '@/components/AmbientBackground'
import './globals.css'

// Anybody for display (its width axis lets headings stretch and condense),
// Inter for reading, JetBrains Mono for readouts.
const anybody = Anybody({ subsets: ['latin'], axes: ['wdth'], variable: '--font-anybody' })
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrains = JetBrains_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-jetbrains' })

// Design options under comparison (styles/themes.css). Not preloaded: they
// download only when their theme is switched on.
const doto = Doto({ subsets: ['latin'], axes: ['ROND'], variable: '--font-doto', preload: false })
const geist = Geist({ subsets: ['latin'], variable: '--font-geist', preload: false })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono', preload: false })
const saira = Saira({ subsets: ['latin'], axes: ['wdth'], style: ['normal', 'italic'], variable: '--font-saira', preload: false })
const optionFonts = [doto, geist, geistMono, saira].map((f) => f.variable).join(' ')

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
    <html lang="en" className={`${anybody.variable} ${inter.variable} ${jetbrains.variable} ${optionFonts}`}>
      <body className="min-h-dvh antialiased">
        <AmbientBackground />
        {children}
      </body>
    </html>
  )
}
