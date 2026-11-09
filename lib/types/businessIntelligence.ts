import type {
  AdminBusinessInsights,
  AdminMonthlyRevenueRow,
} from "@/lib/types/adminBusinessInsights"

export type IntelligenceTopPath = {
  path: string
  views: number
  title?: string | null
  sessions?: number
}

export type IntelligenceLiveDashboard = {
  generatedAt: string
  insights: AdminBusinessInsights | null
  insightsError: string | null
  monthlyRevenue: AdminMonthlyRevenueRow[]
  monthlyRevenueError: string | null
  topPages: IntelligenceTopPath[]
  topPagesSource: "ga4" | "none"
}
