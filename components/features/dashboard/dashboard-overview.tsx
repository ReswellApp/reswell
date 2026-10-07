import { DashboardOverviewRealtimeRefresh } from "@/components/features/dashboard/dashboard-overview-realtime-refresh"
import { DashboardOverviewHero } from "@/components/features/dashboard/dashboard-overview-hero"
import { DashboardOverviewListings } from "@/components/features/dashboard/dashboard-overview-listings"
import { DashboardOverviewManage } from "@/components/features/dashboard/dashboard-overview-manage"
import type { DashboardOverviewModel } from "@/components/features/dashboard/dashboard-overview-model"

interface DashboardOverviewProps {
  model: DashboardOverviewModel
}

export function DashboardOverview({ model }: DashboardOverviewProps) {
  return (
    <div className="space-y-8 sm:space-y-10">
      <DashboardOverviewRealtimeRefresh />
      <DashboardOverviewHero model={model} />
      <DashboardOverviewListings
        active={model.activeListingPreviews}
        drafts={model.draftListingPreviews}
      />
      <DashboardOverviewManage model={model} />
    </div>
  )
}

export type { DashboardOverviewModel, DashboardOverviewListingPreview } from "@/components/features/dashboard/dashboard-overview-model"
