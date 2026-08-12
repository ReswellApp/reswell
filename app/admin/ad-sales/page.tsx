import { privatePageMetadata } from "@/lib/site-metadata"
import { getAdAttributedSalesDashboard } from "@/lib/services/adAttributedSales"
import { AdSalesAdminClient } from "@/components/features/admin/ad-sales-admin-client"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Ad sales — Admin — Reswell",
  description:
    "Listings sold from Google Ads and Meta ad clicks, pulled from GA4 purchase items and matched to Reswell orders.",
  path: "/admin/ad-sales",
})

const DEFAULT_RANGE_DAYS = 28

export default async function AdminAdSalesPage() {
  const initialData = await getAdAttributedSalesDashboard({ days: DEFAULT_RANGE_DAYS })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ad sales</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every listing sold from a Google or Meta ad click — click IDs stored on the order, with GA4 as a
          historical cross-check.
        </p>
      </div>
      <AdSalesAdminClient initialData={initialData} />
    </div>
  )
}
