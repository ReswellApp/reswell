import type { PeerListingSection } from "@/lib/peer-listing-sections"

export type SellFunnelAnalyticsSummary = {
  publishAttempts: number
  publishSuccesses: number
  validationFailures: number
  uploadFailures: number
  publishFailures: number
  flowStarts: number
  uniqueUsers: number
  medianDurationMs: number | null
  successRate: number | null
}

export type SellFunnelEventBreakdownRow = {
  event: string
  count: number
  uniqueUsers: number
}

export type SellFunnelListingTypeRow = {
  listingType: string
  publishAttempts: number
  publishSuccesses: number
  validationFailures: number
  flowStarts: number
}

export type SellFunnelValidationFailureRow = {
  field: string
  message: string
  count: number
}

export type SellFunnelStepRow = {
  step: string
  viewed: number
  completed: number
}

export type SellFunnelDailyTrendRow = {
  date: string
  publishAttempts: number
  publishSuccesses: number
}

export type SellFunnelRecentEventRow = {
  id: string
  createdAt: string
  userId: string | null
  listingType: string
  event: string
  field: string | null
  message: string | null
  listingId: string | null
  durationMs: number | null
}

export type SellFunnelAnalyticsDashboard = {
  days: number
  listingTypeFilter: PeerListingSection | null
  summary: SellFunnelAnalyticsSummary
  byEvent: SellFunnelEventBreakdownRow[]
  byListingType: SellFunnelListingTypeRow[]
  topValidationFailures: SellFunnelValidationFailureRow[]
  stepFunnel: SellFunnelStepRow[]
  dailyTrend: SellFunnelDailyTrendRow[]
  recentEvents: SellFunnelRecentEventRow[]
}
