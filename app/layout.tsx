import React from "react"
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'ReSwell Surf - Buy & Sell Surfing Gear',
  description: 'The peer-to-peer marketplace for surfing accessories and surfboards. Buy used gear, shop new items, or find surfboards for in-person pickup.',
  keywords: ['surfing', 'surfboard', 'marketplace', 'used surf gear', 'wetsuit', 'fins'],
}

export const viewport: Viewport = {
  themeColor: '#0891b2',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
