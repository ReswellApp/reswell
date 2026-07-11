import type { Metadata } from "next"
import { getCachedMarketplaceSalesMap } from "@/lib/cache/marketplace-sales-map"
import { SalesMapPageClient } from "@/components/features/map/sales-map-page-client"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

/** ISR for `/map` — public sales geography refreshes hourly and on new orders. */
export const revalidate = 3600

export async function generateMetadata(): Promise<Metadata> {
  return resolvePageMetadata("map")
}

export default async function MapPage() {
  const data = await getCachedMarketplaceSalesMap()
  return <SalesMapPageClient data={data} />
}
