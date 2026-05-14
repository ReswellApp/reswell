import React, { Suspense } from "react"
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import localFont from 'next/font/local'
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from '@/components/ui/sonner'
import { LocaleProvider } from '@/components/locale-provider'
import { SiteChrome } from '@/components/site-chrome'
import { PresenceHeartbeatLoader } from '@/components/presence-heartbeat-loader'
import { LOCALE_COOKIE_NAME } from '@/lib/translations'
import type { Locale } from '@/lib/translations'
import { publicSiteOrigin } from '@/lib/public-site-origin'
import { GoogleAdsGtag } from '@/components/google-ads-gtag'
import { KlaviyoPageViewTracker } from '@/components/klaviyo-page-view-tracker'

import './globals.css'

/** Stack Sans Text — body / UI (variable 200–700). Typography: Light+, 0% tracking, 130% leading. */
const stackSansText = localFont({
  src: '../fonts/stack-sans-text-latin.woff2',
  variable: '--font-sans',
  display: 'swap',
  weight: '200 700',
  adjustFontFallback: 'Arial',
  preload: true,
})

/** Stack Sans Headline — headings (variable 200–700). Typography: Bold, -5% tracking, 105% leading. */
const stackSansHeadline = localFont({
  src: '../fonts/stack-sans-headline-latin.woff2',
  variable: '--font-headline',
  display: 'swap',
  weight: '200 700',
  adjustFontFallback: 'Arial',
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
    <html lang={locale} className="overflow-x-clip">
      <body className={`${stackSansText.variable} ${stackSansHeadline.variable} font-sans antialiased bg-background text-muted-foreground min-h-dvh overflow-x-clip selection:bg-slate-900/10 selection:text-foreground`}>
        <GoogleAdsGtag />
        <LocaleProvider initialLocale={locale}>
          <Suspense fallback={null}>
            <KlaviyoPageViewTracker />
          </Suspense>
          <PresenceHeartbeatLoader />
          <SiteChrome>{children}</SiteChrome>
          <Toaster />
          <Analytics />
        </LocaleProvider>
      </body>
    </html>
  )
}
