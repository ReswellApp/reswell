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

export type CreativeFieldType =
  | "headline"
  | "long_headline"
  | "description"
  | "marketing_image"
  | "square_image"
  | "logo"
  | "youtube_video"
  | "business_name"
  | "other"

export interface ManagedCreativeAsset {
  platform: "google"
  id: string
  assetGroupId: string
  campaignId: string
  fieldType: CreativeFieldType
  fieldLabel: string
  text: string | null
  previewUrl: string | null
  youtubeId: string | null
  linkResource: string
  status: DeliveryStatus
}

export type AdsMediaRole = "marketing_image" | "square_image" | "logo" | "meta_image" | "meta_video"

export type AudienceKind = "user_list" | "google_audience" | "saved" | "custom"

export interface ManagedAudience {
  platform: AdsPlatform
  id: string
  name: string
  kind: AudienceKind
  kindLabel: string
  size: number | null
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
  assets: ManagedCreativeAsset[]
  audiences: ManagedAudience[]
}

export type Unscored<T extends { verdict: AdVerdict }> = Omit<T, "verdict">
