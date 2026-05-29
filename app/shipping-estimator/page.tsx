import { ShippingEstimatorPage } from "@/components/features/shipping/shipping-estimator-page"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"

export async function generateMetadata() {
  return resolvePageMetadata("shipping-estimator")
}

export default function ShippingEstimatorRoutePage() {
  return <ShippingEstimatorPage />
}
