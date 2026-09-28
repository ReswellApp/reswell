export type AdsPlatform = "google" | "meta"

export type DeliveryStatus = "enabled" | "paused" | "removed" | "other"

export type AdVerdict = "winner" | "loser" | "ok" | "learning" | "paused"

export type AdGroupKind = "ad_group" | "ad_set" | "asset_group"

export type AdKind = "responsive_search" | "meta_link" | "other"

export const ADS_RANGE_DAYS = [7, 14, 30, 90] as const

export type AdsRangeDays = (typeof ADS_RANGE_DAYS)[number]

export interface AdsMetrics {
  impressions: number
  clicks: number
  spend: number
  conversions: number
  conversionValue: number
  ctr: number
  cpc: number | null
  cpa: number | null
  roas: number | null
}

export interface ManagedCampaign {
  platform: AdsPlatform
  id: string
  name: string
  status: DeliveryStatus
  channelLabel: string
  dailyBudget: number | null
  budgetShared: boolean
  currency: string
  deliveryNote: string | null
  metrics: AdsMetrics
  verdict: AdVerdict
}

export interface ManagedAdGroup {
  platform: AdsPlatform
  id: string
  campaignId: string
  name: string
  status: DeliveryStatus
  kind: AdGroupKind
  dailyBudget: number | null
  currency: string
  metrics: AdsMetrics
  verdict: AdVerdict
}

export interface ManagedAd {
  platform: AdsPlatform
  id: string
  campaignId: string
  adGroupId: string
  name: string
  status: DeliveryStatus
  kind: AdKind
  headlines: string[]
  descriptions: string[]
  primaryText: string | null
  finalUrl: string | null
  currency: string
  metrics: AdsMetrics
  verdict: AdVerdict
}

export interface ManagedKeyword {
  platform: "google"
  id: string
  campaignId: string
  adGroupId: string
  text: string
  matchType: "EXACT" | "PHRASE" | "BROAD" | "OTHER"
  status: DeliveryStatus
  currency: string
  metrics: AdsMetrics
  verdict: AdVerdict
}

export interface AdsAccountSnapshot {
  platform: AdsPlatform
  configured: boolean
  accountId: string | null
  accountName: string | null
  currency: string | null
  missing: string[]
  error: string | null
  truncated: boolean
}

export interface AdsTotals {
  metrics: AdsMetrics | null
  currency: string | null
  mixedCurrency: boolean
}

export interface AdsManagerDashboard {
  rangeDays: AdsRangeDays
  generatedAt: string
  accounts: AdsAccountSnapshot[]
  totals: AdsTotals
  campaigns: ManagedCampaign[]
  adGroups: ManagedAdGroup[]
  ads: ManagedAd[]
  keywords: ManagedKeyword[]
}

export type Unscored<T extends { verdict: AdVerdict }> = Omit<T, "verdict">
