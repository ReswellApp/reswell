import { HowToSellContent } from "@/components/features/seller-resources/how-to-sell-content"
import { getCachedHowToSellGuidePayload } from "@/lib/cache/seller-resources-how-to-sell"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("seller-resources-how-to-sell")
}

export default async function HowToSellPage() {
  const guide = await getCachedHowToSellGuidePayload()
  return <HowToSellContent guide={guide} />
}
