import type { Metadata } from "next"
import type { ReactNode } from "react"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { SellAuthGate } from "@/components/features/sell/sell-auth-gate"

const title = "Sell your surfboard — Reswell"
const description =
  "Create a listing on Reswell in minutes: add photos, describe your board, set your price, and choose shipping. Reach buyers on the peer-to-peer surf marketplace."

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "sell surfboard",
    "list surfboard",
    "surfboard marketplace",
    "used surfboard",
    "Reswell",
  ],
  alternates: {
    canonical: "/sell",
  },
  openGraph: {
    title,
    description,
    url: "/sell",
    siteName: "Reswell",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
}

export default async function SellLayout({ children }: { children: ReactNode }) {
  const { user } = await getCachedRequestSession()
  if (user) return children
  return <SellAuthGate>{children}</SellAuthGate>
}
