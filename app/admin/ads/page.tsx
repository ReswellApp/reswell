import { privatePageMetadata } from "@/lib/site-metadata"
import { getAdsManagerDashboard } from "@/lib/services/adsManager"
import { AdsManagerClient } from "@/components/features/admin/ads-manager/ads-manager-client"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export const metadata = privatePageMetadata({
  title: "Ads manager — Admin — Reswell",
  description: "Create, pause, edit, and judge live Google Ads and Meta ads.",
  path: "/admin/ads",
})

export default async function AdminAdsManagerPage() {
  const initialData = await getAdsManagerDashboard(30)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Ads manager</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Live Google Ads and Meta campaigns, with spend, conversions, and a read on what is working.
          Create paused Search or Performance Max campaigns, edit asset groups, apply audiences, and
          upload images or video from this computer. Listing sales from ad clicks stay on Ad sales.
        </p>
      </div>
      <AdsManagerClient initialData={initialData} />
    </div>
  )
}
