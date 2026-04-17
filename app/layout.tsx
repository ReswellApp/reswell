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

/**
 * Site-wide defaults only. Every route should set its own title + description (via `pageSeoMetadata`
 * or `generateMetadata`) so search snippets and link previews are not duplicated.
 */
export const metadata: Metadata = {
  metadataBase: new URL(publicSiteOrigin()),
  title: "Reswell",
  description:
    "Buy and sell surfboards and surf gear on Reswell — listings from local surfers and shops.",
  keywords: ["surfing", "surfboard", "marketplace", "sell surfboard", "buy surfboard"],
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
