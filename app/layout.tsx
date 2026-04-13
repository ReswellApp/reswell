import React from "react"
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Inter, Caveat } from 'next/font/google'
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from '@/components/ui/sonner'
import { LocaleProvider } from '@/components/locale-provider'
import { SiteChrome } from '@/components/site-chrome'
import { PresenceHeartbeatLoader } from '@/components/presence-heartbeat-loader'
import { LOCALE_COOKIE_NAME } from '@/lib/translations'
import type { Locale } from '@/lib/translations'
import { publicSiteOrigin } from '@/lib/public-site-origin'

import './globals.css'

// Inter for UI — neutral, readable, standard for modern professional products.
// CLS-FIX: next/font generates size-adjusted fallbacks for the display font below.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  adjustFontFallback: true,
  preload: true,
  weight: ['400', '500', '600', '700'],
})
const caveat = Caveat({
  subsets: ['latin'],
  variable: '--font-caveat',
  display: 'swap',
  adjustFontFallback: true,
  preload: true,
})

export const metadata: Metadata = {
  metadataBase: new URL(publicSiteOrigin()),
  title: 'Reswell — Buy & sell surfboards',
  description:
    'Peer-to-peer surfboard marketplace: list your board, browse local shapes, and shop new items from verified sellers.',
  keywords: ['surfing', 'surfboard', 'marketplace', 'sell surfboard', 'buy surfboard'],
  openGraph: {
    title: 'Reswell — Buy & sell surfboards',
    description:
      'Peer-to-peer surfboard marketplace: list your board, browse local shapes, and shop new items from verified sellers.',
    images: [{ url: '/images/og-image.jpg', width: 1024, height: 1024, alt: 'Reswell' }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Reswell — Buy & sell surfboards',
    description:
      'Peer-to-peer surfboard marketplace: list your board, browse local shapes, and shop new items from verified sellers.',
    images: ['/images/og-image.jpg'],
  },
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const cookieStore = await cookies()
  const localeCookie = cookieStore.get(LOCALE_COOKIE_NAME)?.value
  const locale: Locale = localeCookie === 'es' ? 'es' : 'en'

  return (
    <html lang={locale} className="overflow-x-hidden">
      <body className={`${inter.variable} ${caveat.variable} font-sans antialiased bg-background text-muted-foreground min-h-dvh overflow-x-hidden selection:bg-slate-900/10 selection:text-foreground`}>
        <LocaleProvider initialLocale={locale}>
          <PresenceHeartbeatLoader />
          <SiteChrome>{children}</SiteChrome>
          <Toaster />
          <Analytics />
        </LocaleProvider>
      </body>
    </html>
  )
}
