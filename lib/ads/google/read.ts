import "server-only"

import { buildMetrics, emptyMetrics } from "@/lib/ads/manager/metrics"
import { microsToMajor, parseMajor } from "@/lib/ads/manager/money"
import {
  googleChannelLabel,
  googleDeliveryNote,
  mapDeliveryStatus,
} from "@/lib/ads/manager/labels"
import type {
  AdsMetrics,
  ManagedAd,
  ManagedAdGroup,
  ManagedCampaign,
  ManagedKeyword,
  Unscored,
} from "@/lib/types/adsManager"
import { searchGoogleAds, type GoogleAdsRow } from "@/lib/ads/google/http"
import { assertGoogleAdsConfigured } from "@/lib/ads/google/config"
import { AdsPlatformError } from "@/lib/ads/manager/errors"

const ROW_CAP = 400

export interface GoogleAdsReadModel {
  accountId: string
  accountName: string | null
  currency: string
  campaigns: Unscored<ManagedCampaign>[]
  adGroups: Unscored<ManagedAdGroup>[]
  ads: Unscored<ManagedAd>[]
  keywords: Unscored<ManagedKeyword>[]
  truncated: boolean
}

export async function readGoogleAds(range: { since: string; until: string }): Promise<GoogleAdsReadModel> {
  const { customerId } = assertGoogleAdsConfigured()
  const since = assertIsoDate(range.since)
  const until = assertIsoDate(range.until)
  const dateClause = `segments.date BETWEEN '${since}' AND '${until}'`

  const [customerRows, campaigns, campaignMetrics, adGroups, adGroupMetrics, ads, adMetrics, assetGroups, assetMetrics, keywords, keywordMetrics] =
    await Promise.all([
      searchGoogleAds(
        customerId,
        "SELECT customer.id, customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
      ),
      searchGoogleAds(
        customerId,
        `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, campaign.primary_status,
          campaign_budget.resource_name, campaign_budget.amount_micros, campaign_budget.explicitly_shared
         FROM campaign
         WHERE campaign.status != 'REMOVED'`,
      ),
      searchGoogleAds(
        customerId,
        `SELECT campaign.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value
         FROM campaign WHERE ${dateClause}`,
      ),
      searchGoogleAds(
        customerId,
        `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id
         FROM ad_group WHERE ad_group.status != 'REMOVED'`,
      ),
      searchGoogleAds(
        customerId,
        `SELECT ad_group.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value
         FROM ad_group WHERE ${dateClause}`,
      ),
      searchGoogleAds(
        customerId,
        `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type, ad_group_ad.status,
          ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines,
          ad_group_ad.ad.responsive_search_ad.descriptions, ad_group.id, campaign.id
         FROM ad_group_ad WHERE ad_group_ad.status != 'REMOVED'`,
      ),
      searchGoogleAds(
        customerId,
        `SELECT ad_group_ad.ad.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value
         FROM ad_group_ad WHERE ${dateClause}`,
      ),
      searchGoogleAds(
        customerId,
        `SELECT asset_group.id, asset_group.name, asset_group.status, asset_group.final_urls, campaign.id
         FROM asset_group WHERE asset_group.status != 'REMOVED'`,
      ).catch(() => [] as GoogleAdsRow[]),
      searchGoogleAds(
        customerId,
        `SELECT asset_group.id, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value
         FROM asset_group WHERE ${dateClause}`,
      ).catch(() => [] as GoogleAdsRow[]),
      searchGoogleAds(
        customerId,
        `SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
          ad_group_criterion.status, ad_group.id, campaign.id
         FROM ad_group_criterion
         WHERE ad_group_criterion.type = 'KEYWORD' AND ad_group_criterion.status != 'REMOVED'`,
      ),
      searchGoogleAds(
        customerId,
        `SELECT ad_group_criterion.criterion_id, ad_group.id, metrics.impressions, metrics.clicks, metrics.cost_micros,
          metrics.conversions, metrics.conversions_value
         FROM keyword_view WHERE ${dateClause}`,
      ).catch(() => [] as GoogleAdsRow[]),
    ])

  const customer = customerRows[0]?.customer
  const currency = customer?.currencyCode?.trim() || "USD"
  const campaignMetricMap = metricMap(campaignMetrics, (row) => row.campaign?.id)
  const adGroupMetricMap = metricMap(adGroupMetrics, (row) => row.adGroup?.id)
  const adMetricMap = metricMap(adMetrics, (row) => row.adGroupAd?.ad?.id)
  const assetMetricMap = metricMap(assetMetrics, (row) => row.assetGroup?.id)
  const keywordMetricMap = metricMap(
    keywordMetrics,
    (row) => keywordKey(row.adGroup?.id, row.adGroupCriterion?.criterionId),
  )

  let truncated = false
  const campaignRows = cap(campaigns.filter((row) => row.campaign?.id))
  truncated = truncated || campaignRows.truncated
  const adGroupRows = cap(adGroups.filter((row) => row.adGroup?.id && row.campaign?.id))
  truncated = truncated || adGroupRows.truncated
  const adRows = cap(ads.filter((row) => row.adGroupAd?.ad?.id && row.adGroup?.id && row.campaign?.id))
  truncated = truncated || adRows.truncated
  const assetRows = cap(assetGroups.filter((row) => row.assetGroup?.id && row.campaign?.id))
  truncated = truncated || assetRows.truncated
  const keywordRows = cap(
    keywords.filter((row) => row.adGroupCriterion?.criterionId && row.adGroup?.id && row.campaign?.id),
  )
  truncated = truncated || keywordRows.truncated

  return {
    accountId: customerId,
    accountName: customer?.descriptiveName?.trim() || null,
    currency,
    campaigns: campaignRows.rows.map((row) => mapCampaign(row, currency, campaignMetricMap)),
    adGroups: [
      ...adGroupRows.rows.map((row) => mapAdGroup(row, currency, adGroupMetricMap)),
      ...assetRows.rows.map((row) => mapAssetGroup(row, currency, assetMetricMap)),
    ],
    ads: adRows.rows.map((row) => mapAd(row, currency, adMetricMap)),
    keywords: keywordRows.rows.map((row) => mapKeyword(row, currency, keywordMetricMap)),
    truncated,
  }
}

function mapCampaign(
  row: GoogleAdsRow,
  currency: string,
  metrics: Map<string, AdsMetrics>,
): Unscored<ManagedCampaign> {
  const campaign = row.campaign
  const id = campaign?.id ?? ""
  const status = mapDeliveryStatus(campaign?.status)
  return {
    platform: "google",
    id,
    name: campaign?.name?.trim() || "Untitled campaign",
    status,
    channelLabel: googleChannelLabel(campaign?.advertisingChannelType),
    dailyBudget: microsToMajor(row.campaignBudget?.amountMicros),
    budgetShared: row.campaignBudget?.explicitlyShared === true,
    currency,
    deliveryNote: googleDeliveryNote(campaign?.primaryStatus, status),
    metrics: metrics.get(id) ?? emptyMetrics(),
  }
}

function mapAdGroup(
  row: GoogleAdsRow,
  currency: string,
  metrics: Map<string, AdsMetrics>,
): Unscored<ManagedAdGroup> {
  const id = row.adGroup?.id ?? ""
  return {
    platform: "google",
    id,
    campaignId: row.campaign?.id ?? "",
    name: row.adGroup?.name?.trim() || "Ad group",
    status: mapDeliveryStatus(row.adGroup?.status),
    kind: "ad_group",
    dailyBudget: null,
    currency,
    metrics: metrics.get(id) ?? emptyMetrics(),
  }
}

function mapAssetGroup(
  row: GoogleAdsRow,
  currency: string,
  metrics: Map<string, AdsMetrics>,
): Unscored<ManagedAdGroup> {
  const id = row.assetGroup?.id ?? ""
  return {
    platform: "google",
    id,
    campaignId: row.campaign?.id ?? "",
    name: row.assetGroup?.name?.trim() || "Asset group",
    status: mapDeliveryStatus(row.assetGroup?.status),
    kind: "asset_group",
    dailyBudget: null,
    currency,
    metrics: metrics.get(id) ?? emptyMetrics(),
  }
}

function mapAd(row: GoogleAdsRow, currency: string, metrics: Map<string, AdsMetrics>): Unscored<ManagedAd> {
  const ad = row.adGroupAd?.ad
  const id = ad?.id ?? ""
  const headlines = (ad?.responsiveSearchAd?.headlines ?? [])
    .map((item) => item.text?.trim() || "")
    .filter(Boolean)
  const descriptions = (ad?.responsiveSearchAd?.descriptions ?? [])
    .map((item) => item.text?.trim() || "")
    .filter(Boolean)
  const kind = ad?.type === "RESPONSIVE_SEARCH_AD" ? "responsive_search" : "other"
  return {
    platform: "google",
    id,
    campaignId: row.campaign?.id ?? "",
    adGroupId: row.adGroup?.id ?? "",
    name: ad?.name?.trim() || headlines[0] || "Ad",
    status: mapDeliveryStatus(row.adGroupAd?.status),
    kind,
    headlines,
    descriptions,
    primaryText: null,
    finalUrl: ad?.finalUrls?.[0] ?? null,
    currency,
    metrics: metrics.get(id) ?? emptyMetrics(),
  }
}

function mapKeyword(
  row: GoogleAdsRow,
  currency: string,
  metrics: Map<string, AdsMetrics>,
): Unscored<ManagedKeyword> {
  const criterion = row.adGroupCriterion
  const id = criterion?.criterionId ?? ""
  const adGroupId = row.adGroup?.id ?? ""
  const match = criterion?.keyword?.matchType
  return {
    platform: "google",
    id,
    campaignId: row.campaign?.id ?? "",
    adGroupId,
    text: criterion?.keyword?.text?.trim() || "Keyword",
    matchType: match === "EXACT" || match === "PHRASE" || match === "BROAD" ? match : "OTHER",
    status: mapDeliveryStatus(criterion?.status),
    currency,
    metrics: metrics.get(`${adGroupId}:${id}`) ?? emptyMetrics(),
  }
}

function metricMap(rows: GoogleAdsRow[], idOf: (row: GoogleAdsRow) => string | undefined): Map<string, AdsMetrics> {
  const map = new Map<string, AdsMetrics>()
  for (const row of rows) {
    const id = idOf(row)
    if (!id) continue
    map.set(id, metricsFromRow(row))
  }
  return map
}

function metricsFromRow(row: GoogleAdsRow): AdsMetrics {
  return buildMetrics({
    impressions: parseMajor(row.metrics?.impressions),
    clicks: parseMajor(row.metrics?.clicks),
    spend: microsToMajor(row.metrics?.costMicros) ?? 0,
    conversions: parseMajor(row.metrics?.conversions),
    conversionValue: parseMajor(row.metrics?.conversionsValue),
  })
}

function keywordKey(adGroupId: string | undefined, criterionId: string | undefined): string | undefined {
  if (!adGroupId || !criterionId) return undefined
  return `${adGroupId}:${criterionId}`
}

function cap<T>(rows: T[]): { rows: T[]; truncated: boolean } {
  if (rows.length <= ROW_CAP) return { rows, truncated: false }
  return { rows: rows.slice(0, ROW_CAP), truncated: true }
}

function assertIsoDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AdsPlatformError("Invalid reporting range", "google")
  }
  return value
}
