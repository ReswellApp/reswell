import { privatePageMetadata } from "@/lib/site-metadata"
import { getCachedDashboardSession } from "@/lib/dashboard-session"
import { EarningsPageClient } from "@/components/features/earnings/earnings-page-client"
import { getEarningsHubSnapshot } from "@/lib/services/earningsDashboard"
import { parseEarningsView } from "@/lib/earnings-view"

export const metadata = privatePageMetadata({
  title: "Earnings — Reswell",
  description: "Your marketplace wallet, payouts, and rewards.",
  path: "/dashboard/earnings",
})

export default async function EarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const [{ supabase, user }, params] = await Promise.all([
    getCachedDashboardSession(),
    searchParams,
  ])
  if (!user) return null

  const initialHub = await getEarningsHubSnapshot(supabase, user.id)

  return (
    <EarningsPageClient
      initialHub={initialHub}
      initialView={parseEarningsView(params.view)}
    />
  )
}
