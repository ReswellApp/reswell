import { createClient } from "@/lib/supabase/server"
import { getSoldFeedStats } from "@/lib/feed-sold-stats"
import { formatCompactCount } from "@/lib/format-compact-count"
import { formatGmv } from "@/lib/format-gmv"
import { loadHomeHeroSlideUrls } from "@/lib/services/homeHeroSlides"
import type { AboutPageStats } from "@/components/features/about/about-page-content"

export type AboutPageData = {
  stats: AboutPageStats
  heroListingImages: string[]
}

export async function loadAboutPageData(): Promise<AboutPageData> {
  const supabase = await createClient()

  const [{ soldCount, gmvTotal }, activeListingsRes, heroSlideUrls] = await Promise.all([
    getSoldFeedStats(),
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .in("section", ["surfboards"]),
    loadHomeHeroSlideUrls(supabase),
  ])

  if (activeListingsRes.error) {
    console.error("[about page] active listings count:", activeListingsRes.error.message)
  }

  return {
    stats: {
      soldCountLabel: formatCompactCount(soldCount),
      gmvLabel: formatGmv(gmvTotal),
      activeListingsLabel: formatCompactCount(activeListingsRes.count ?? 0),
    },
    heroListingImages: heroSlideUrls.slice(0, 4),
  }
}
