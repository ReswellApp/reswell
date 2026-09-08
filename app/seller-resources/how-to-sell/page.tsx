import { HowToSellContent } from "@/components/features/seller-resources/how-to-sell-content"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("seller-resources-how-to-sell")
}

export default function HowToSellPage() {
  return <HowToSellContent />
}
