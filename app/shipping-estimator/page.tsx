import { ShippingEstimatorPage } from "@/components/features/shipping/shipping-estimator-page"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Shipping label cost estimator — Reswell",
  description:
    "Estimate US surfboard shipping label costs by ship-from ZIP, receiver ZIP, weight, and package dimensions with live carrier quotes.",
  path: "/shipping-estimator",
})

export default function ShippingEstimatorRoutePage() {
  return <ShippingEstimatorPage />
}
