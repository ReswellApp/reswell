import React from "react"
import type { Metadata, Viewport } from 'next'
import { cookies } from 'next/headers'
import { Inter } from 'next/font/google'
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from '@/components/ui/sonner'
import { LocaleProvider } from '@/components/locale-provider'
import { LOCALE_COOKIE_NAME } from '@/lib/translations'
import type { Locale } from '@/lib/translations'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'Reswell - Buy & Sell Surfing Gear',
  description: 'The peer-to-peer marketplace for surfing accessories and surfboards. Buy used gear, shop new items, or find surfboards for in-person pickup.',
  keywords: ['surfing', 'surfboard', 'marketplace', 'used surf gear', 'wetsuit', 'fins'],
}

export const viewport: Viewport = {
  themeColor: '#0F2143',
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
      <body className={`${inter.variable} font-sans antialiased bg-white text-midgray min-h-dvh overflow-x-hidden`}>
        <LocaleProvider initialLocale={locale}>
          {children}
          <Toaster />
          <Analytics />
        </LocaleProvider>
      </body>
    </html>
  )
}
