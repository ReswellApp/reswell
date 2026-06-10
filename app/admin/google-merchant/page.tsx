import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { buildGoogleMerchantInsights } from "@/lib/services/googleMerchantInsights"
import { GoogleMerchantDashboardClient } from "@/components/features/admin/google-merchant-dashboard-client"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Google Merchant Center — Admin — Reswell",
  description:
    "Live Google Merchant Center feed health, approval status, item issues, Shopping performance, and Google Analytics traffic for every product.",
  path: "/admin/google-merchant",
})

const DEFAULT_RANGE_DAYS = 28

export default async function AdminGoogleMerchantPage() {
  const supabase = await createClient()
  const insights = await buildGoogleMerchantInsights(supabase, { days: DEFAULT_RANGE_DAYS })

  return <GoogleMerchantDashboardClient initialInsights={insights} />
}
