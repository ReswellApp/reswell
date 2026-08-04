import type { Metadata } from "next"
import type { ReactNode } from "react"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { SellUnsignedAccess } from "@/components/features/sell/sell-unsigned-access"
import { SellerBanSellBlocked } from "@/components/features/sell/seller-ban-sell-blocked"
import { fetchSellerBanState, isSellerBanActive } from "@/lib/db/sellerBan"
import { createClient } from "@/lib/supabase/server"

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
  if (!user) {
    return <SellUnsignedAccess>{children}</SellUnsignedAccess>
  }

  const supabase = await createClient()
  const banState = await fetchSellerBanState(supabase, user.id)
  if (isSellerBanActive(banState)) {
    return <SellerBanSellBlocked />
  }

  return children
}
