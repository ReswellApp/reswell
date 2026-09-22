import React, { Suspense } from "react"
import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Toaster } from '@/components/ui/sonner'
import { LocaleProvider } from '@/components/locale-provider'
import { SiteChromeShell } from '@/components/site-chrome-shell'
import { AbortErrorSuppressor } from '@/components/abort-error-suppressor'
import { OpsErrorReporter } from '@/components/ops-error-reporter'
import { LiveChatWidgetGate } from '@/components/features/live-chat/live-chat-widget-gate'
import { DEFAULT_LOCALE } from '@/lib/translations'
import { publicSiteOrigin } from '@/lib/public-site-origin'
import { GoogleAdsGtag } from '@/components/google-ads-gtag'
import { GoogleAnalyticsGtag } from '@/components/google-analytics-gtag'
import { GoogleSignUpWelcomeRedirect } from '@/components/auth/google-sign-up-welcome-redirect'
import { DeferredMarketingRuntime } from '@/components/deferred-marketing-runtime'
import { MetaPixel } from '@/components/meta-pixel'
import { OpenAiAdsPixel } from '@/components/openai-ads-pixel'
import { MetaCapiParamBootstrap } from '@/components/meta/meta-capi-param-bootstrap'
import { AdClickAttributionBootstrap } from '@/components/ads/ad-click-attribution-bootstrap'
import { DeviceCookieBootstrap } from '@/components/device-cookie-bootstrap'
import { JsonLd } from '@/components/seo/json-ld'
import { organizationSchema, webSiteSchema } from '@/lib/seo/structured-data'

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
 * Site-wide defaults only. Every route should set its own title + description (via
 * `resolvePageMetadata` or `generateMetadata`) so search snippets and link previews are not duplicated.
 *
 * Favicon and apple touch icon are file-based: `app/icon.png` and `app/apple-icon.png`.
 */
export async function generateMetadata(): Promise<Metadata> {
  return {
    metadataBase: new URL(publicSiteOrigin()),
    title: "Reswell",
    description:
      "Buy and sell surfboards and surf gear on Reswell — listings from local surfers and shops.",
    keywords: ["surfing", "surfboard", "marketplace", "sell surfboard", "buy surfboard"],
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
      data-scroll-behavior="auto"
      suppressHydrationWarning
    >
      <body
        className={`${stackSansText.variable} ${stackSansHeadline.variable} font-sans antialiased bg-background text-muted-foreground min-h-dvh overflow-x-clip selection:bg-slate-900/10 selection:text-foreground`}
        suppressHydrationWarning
      >
        <noscript>
          <style>{`.fade-in-section,.fade-in-section.fade-in-pending{opacity:1!important;transform:none!important}`}</style>
        </noscript>
        <JsonLd data={[organizationSchema(publicSiteOrigin()), webSiteSchema(publicSiteOrigin())]} />
        <AbortErrorSuppressor />
        <OpsErrorReporter />
        {/* Ads tags stay in the document with next/script lazyOnload so gclid / first
            load measurement still happen after window load without competing with LCP.
            Klaviyo, PostHog identify, page-view beacons, and Vercel Analytics mount
            from DeferredMarketingRuntime after idle or first interaction. */}
        <GoogleAdsGtag />
        <GoogleAnalyticsGtag />
        <MetaPixel />
        <OpenAiAdsPixel />
        <LocaleProvider>
          <DeviceCookieBootstrap />
          <Suspense fallback={null}>
            <AdClickAttributionBootstrap />
            <MetaCapiParamBootstrap />
            <GoogleSignUpWelcomeRedirect />
          </Suspense>
          <SiteChromeShell>{children}</SiteChromeShell>
          <Suspense fallback={null}>
            <LiveChatWidgetGate />
          </Suspense>
          <Toaster />
        </LocaleProvider>
        <DeferredMarketingRuntime />
      </body>
    </html>
  )
}
