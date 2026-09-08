import { MoreSellResourcesContent } from "@/components/features/seller-resources/more-sell-resources-content"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("seller-resources")
}

export default function SellerResourcesPage() {
  return <MoreSellResourcesContent />
}
