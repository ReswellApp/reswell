import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Suspense } from "react"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { SellGiveawayBanner } from "@/components/features/giveaways/sell-giveaway-banner"
import { SellerBanSellBlocked } from "@/components/features/sell/seller-ban-sell-blocked"
import { SellFlowViewedTracker } from "@/components/features/sell/sell-flow-viewed-tracker"
import { SellPageFooter } from "@/components/features/sell/sell-page-footer"
import { getGiveawayEntryForUser } from "@/lib/db/giveawayEntries"
import { fetchSellerBanState, isSellerBanActive } from "@/lib/db/sellerBan"
import {
  getGiveawayBySlug,
  isGiveawayOpen,
  WIN_A_SURFBOARD_GIVEAWAY_SLUG,
} from "@/lib/giveaways/catalog"
import { createClient } from "@/lib/supabase/server"
import type { Giveaway } from "@/lib/types/giveaways"

function SellLayoutFrame({
  children,
  giveawayBanner,
}: {
  children: ReactNode
  giveawayBanner?: ReactNode
}) {
  return (
    <>
      <Suspense fallback={null}>
        <SellFlowViewedTracker />
      </Suspense>
      {giveawayBanner}
      {children}
      <SellPageFooter />
    </>
  )
}

function sellGiveawayBanner(opts: {
  giveaway: Giveaway | undefined
  isLoggedIn: boolean
  hasEntry: boolean
}): ReactNode {
  const { giveaway, isLoggedIn, hasEntry } = opts
  if (!giveaway || !isGiveawayOpen(giveaway) || hasEntry) return null
  return <SellGiveawayBanner giveaway={giveaway} isLoggedIn={isLoggedIn} />
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
  const giveaway = getGiveawayBySlug(WIN_A_SURFBOARD_GIVEAWAY_SLUG)
  const giveawayOpen = Boolean(giveaway && isGiveawayOpen(giveaway))

  if (!user) {
    return (
      <SellLayoutFrame
        giveawayBanner={sellGiveawayBanner({
          giveaway,
          isLoggedIn: false,
          hasEntry: false,
        })}
      >
        {children}
      </SellLayoutFrame>
    )
  }

  const supabase = await createClient()
  const [banState, entry] = await Promise.all([
    fetchSellerBanState(supabase, user.id),
    giveawayOpen
      ? getGiveawayEntryForUser(supabase, user.id, WIN_A_SURFBOARD_GIVEAWAY_SLUG)
      : Promise.resolve(null),
  ])
  if (isSellerBanActive(banState)) {
    return (
      <>
        <Suspense fallback={null}>
          <SellFlowViewedTracker />
        </Suspense>
        <SellerBanSellBlocked />
      </>
    )
  }

  return (
    <SellLayoutFrame
      giveawayBanner={sellGiveawayBanner({
        giveaway,
        isLoggedIn: true,
        hasEntry: Boolean(entry),
      })}
    >
      {children}
    </SellLayoutFrame>
  )
}
