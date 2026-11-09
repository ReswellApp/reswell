import { Brain } from "lucide-react"

import { IntelligenceCharts } from "@/components/features/admin/intelligence-charts"
import { IntelligenceKpiGrid } from "@/components/features/admin/intelligence-kpi-grid"
import { IntelligenceTrafficPanel } from "@/components/features/admin/intelligence-traffic-panel"
import { loadIntelligenceDashboard } from "@/lib/services/businessIntelligence"
import { privatePageMetadata } from "@/lib/site-metadata"

export const dynamic = "force-dynamic"
export const maxDuration = 60

export const metadata = privatePageMetadata({
  title: "Intelligence — Admin — Reswell",
  description: "Live GMV, users, listings, orders, and top URLs for the marketplace.",
  path: "/admin/intelligence",
})

export default async function AdminIntelligencePage() {
  const dashboard = await loadIntelligenceDashboard()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Brain className="h-6 w-6" aria-hidden />
          Intelligence
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Live GMV, users, listings, orders, and top URLs.
        </p>
      </div>

      {dashboard.insightsError ? (
        <p className="text-sm text-muted-foreground">{dashboard.insightsError}</p>
      ) : null}

      {dashboard.insights ? <IntelligenceKpiGrid insights={dashboard.insights} /> : null}

      {dashboard.insights ? (
        <IntelligenceCharts
          daily={dashboard.insights.daily}
          periodLabel={dashboard.insights.periodLabel}
          monthly={dashboard.monthlyRevenue}
        />
      ) : null}

      <IntelligenceTrafficPanel pages={dashboard.topPages} source={dashboard.topPagesSource} />
    </div>
  )
}
