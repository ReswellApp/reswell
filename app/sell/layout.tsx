import type { Metadata } from "next"
import type { ReactNode } from "react"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { SellAuthGate } from "@/components/features/sell/sell-auth-gate"

const title = "Sell surf gear — Reswell"
const description =
  "Create a listing on Reswell in minutes: add photos, describe your gear, set your price, and choose shipping. Boards, fins, wetsuits, and more on the peer-to-peer surf marketplace."

export const metadata: Metadata = {
  title,
  description,
  keywords: [
    "sell surfboard",
    "sell fins",
    "sell wetsuit",
    "surf marketplace",
    "used surf gear",
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
