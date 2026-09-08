import { HowToShipContent } from "@/components/features/seller-resources/how-to-ship-content"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("seller-resources-how-to-ship")
}

export default function HowToShipPage() {
  return <HowToShipContent />
}
