import type { Metadata } from "next"
import type { ReactNode } from "react"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { SellerBanSellBlocked } from "@/components/features/sell/seller-ban-sell-blocked"
import { SellPageFooter } from "@/components/features/sell/sell-page-footer"
import { fetchSellerBanState, isSellerBanActive } from "@/lib/db/sellerBan"
import { createClient } from "@/lib/supabase/server"

function SellLayoutFrame({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <SellPageFooter />
    </>
  )
}

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
  // Guests can browse and fill sell forms; auth is required at publish (and
  // photo upload). Signed-in sellers who are banned are blocked here.
  const { user } = await getCachedRequestSession()
  if (!user) {
    return <SellLayoutFrame>{children}</SellLayoutFrame>
  }

  const supabase = await createClient()
  const banState = await fetchSellerBanState(supabase, user.id)
  if (isSellerBanActive(banState)) {
    return <SellerBanSellBlocked />
  }

  return <SellLayoutFrame>{children}</SellLayoutFrame>
}
