import { privatePageMetadata } from "@/lib/site-metadata"
import { PriceGuideAdminClient } from "@/components/features/admin/price-guide/price-guide-admin-client"

export const metadata = privatePageMetadata({
  title: "Price Guide — Admin — Reswell",
  description: "Attach editorial pricing to brands and models in the Reswell Price Guide.",
  path: "/admin/price-guide",
})

export default function AdminPriceGuidePage() {
  return <PriceGuideAdminClient />
}
