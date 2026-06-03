import React, { Suspense } from "react"
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from '@/components/ui/sonner'
import { LocaleProvider } from '@/components/locale-provider'
import { SiteChrome } from '@/components/site-chrome'
import { AbortErrorSuppressor } from '@/components/abort-error-suppressor'
import { PresenceHeartbeatLoader } from '@/components/presence-heartbeat-loader'
import { DEFAULT_LOCALE } from '@/lib/translations'
import { publicSiteOrigin } from '@/lib/public-site-origin'
import { GoogleAdsGtag } from '@/components/google-ads-gtag'
import { GoogleSignUpWelcomeRedirect } from '@/components/auth/google-sign-up-welcome-redirect'
import { KlaviyoPageViewTracker } from '@/components/klaviyo-page-view-tracker'
import { MetaPixel } from '@/components/meta-pixel'
import { MetaPixelPageViewTracker } from '@/components/meta-pixel-page-view-tracker'
import { JsonLd } from '@/components/seo/json-ld'
import { organizationSchema, webSiteSchema } from '@/lib/seo/structured-data'
import { absoluteProxiedSeoMediaUrl } from '@/lib/public-media-display-src'
import { getCachedSeoSettings } from '@/lib/seo/resolve-seo-settings'

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
 *
 * The favicon / app icon is admin-managed (SEO panel → Crawling tab) and resolved here so it
 * applies across every route. Falls back to no explicit icon (browser default) when unset.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getCachedSeoSettings()

  const favicon = absoluteProxiedSeoMediaUrl(settings.faviconUrl) ?? settings.faviconUrl ?? null
  const appleIcon = absoluteProxiedSeoMediaUrl(settings.appleIconUrl) ?? settings.appleIconUrl ?? null

  const icons: Metadata["icons"] =
    favicon || appleIcon
      ? {
          ...(favicon ? { icon: [{ url: favicon }], shortcut: [favicon] } : {}),
          ...(appleIcon ? { apple: [{ url: appleIcon }] } : {}),
        }
      : undefined

  return {
    metadataBase: new URL(publicSiteOrigin()),
    title: "Reswell",
    description:
      "Buy and sell surfboards and surf gear on Reswell — listings from local surfers and shops.",
    keywords: ["surfing", "surfboard", "marketplace", "sell surfboard", "buy surfboard"],
    ...(icons ? { icons } : {}),
  }
}

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang={DEFAULT_LOCALE}
      className="overflow-x-clip"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body
        className={`${stackSansText.variable} ${stackSansHeadline.variable} font-sans antialiased bg-background text-muted-foreground min-h-dvh overflow-x-clip selection:bg-slate-900/10 selection:text-foreground`}
        suppressHydrationWarning
      >
        <JsonLd data={[organizationSchema(publicSiteOrigin()), webSiteSchema(publicSiteOrigin())]} />
        <AbortErrorSuppressor />
        <GoogleAdsGtag />
        <MetaPixel />
        <LocaleProvider>
          <Suspense fallback={null}>
            <KlaviyoPageViewTracker />
            <MetaPixelPageViewTracker />
            <GoogleSignUpWelcomeRedirect />
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
