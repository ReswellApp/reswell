import { Suspense } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { EarningsHubSkeleton } from "@/components/features/earnings/earnings-hub"
import { EarningsPageClient } from "@/components/features/earnings/earnings-page-client"

export const metadata = privatePageMetadata({
  title: "Earnings — Reswell",
  description: "Your marketplace wallet, payouts, and rewards.",
  path: "/dashboard/earnings",
})

export default function EarningsPage() {
  return (
    <Suspense fallback={<EarningsHubSkeleton />}>
      <EarningsPageClient />
    </Suspense>
  )
}
