import "server-only"

import { buildMetrics, emptyMetrics } from "@/lib/ads/manager/metrics"
import { metaMinorToMajor, parseMajor } from "@/lib/ads/manager/money"
import { mapDeliveryStatus, metaDeliveryNote, metaObjectiveLabel } from "@/lib/ads/manager/labels"
import { getMetaAdAccountId, metaPurchaseCount, metaPurchaseValue } from "@/lib/ads/meta/config"
import { metaGet, metaGetAll } from "@/lib/ads/meta/http"
import { AdsPlatformError } from "@/lib/ads/manager/errors"
import type { AdsMetrics, Unscored } from "@/lib/types/adsManager"
import type { ManagedAd, ManagedAdGroup, ManagedCampaign } from "@/lib/types/adsManager"

interface MetaAccount {
  name?: string
  currency?: string
  account_status?: number
}

interface MetaCampaignRow {
  id?: string
  name?: string
  status?: string
  effective_status?: string
  objective?: string
  daily_budget?: string
}

interface MetaAdSetRow {
  id?: string
  name?: string
  status?: string
  effective_status?: string
  campaign_id?: string
  daily_budget?: string
}

interface MetaAdRow {
  id?: string
  name?: string
  status?: string
  effective_status?: string
  campaign_id?: string
  adset_id?: string
  creative?: {
    title?: string
    body?: string
    object_story_spec?: {
      link_data?: {
        message?: string
        name?: string
        description?: string
        link?: string
      }
    }
  }
}

interface MetaInsight {
  campaign_id?: string
  adset_id?: string
  ad_id?: string
  impressions?: string
  clicks?: string
  spend?: string
  actions?: { action_type?: string; value?: string }[]
  action_values?: { action_type?: string; value?: string }[]
}

export interface MetaAdsReadModel {
  accountId: string
  accountName: string | null
  currency: string
  campaigns: Unscored<ManagedCampaign>[]
  adGroups: Unscored<ManagedAdGroup>[]
  ads: Unscored<ManagedAd>[]
  truncated: boolean
}

export async function readMetaAds(range: { since: string; until: string }): Promise<MetaAdsReadModel> {
  const accountId = getMetaAdAccountId()
  if (!accountId) throw new AdsPlatformError("Meta Ads is not connected", "meta")
  const timeRange = JSON.stringify({ since: range.since, until: range.until })
  const insightFields = "impressions,clicks,spend,actions,action_values"

  const [account, campaigns, adSets, ads, campaignInsights, adSetInsights, adInsights] = await Promise.all([
    metaGet<MetaAccount>(`act_${accountId}`, { fields: "name,currency,account_status" }),
    metaGetAll<MetaCampaignRow>(`act_${accountId}/campaigns`, {
      fields: "id,name,status,effective_status,objective,daily_budget",
      limit: "100",
    }),
    metaGetAll<MetaAdSetRow>(`act_${accountId}/adsets`, {
      fields: "id,name,status,effective_status,campaign_id,daily_budget",
      limit: "100",
    }),
    metaGetAll<MetaAdRow>(`act_${accountId}/ads`, {
      fields: "id,name,status,effective_status,campaign_id,adset_id,creative{title,body,object_story_spec}",
      limit: "100",
    }),
    metaGetAll<MetaInsight>(`act_${accountId}/insights`, {
      level: "campaign",
      fields: `campaign_id,${insightFields}`,
      time_range: timeRange,
      limit: "100",
    }),
    metaGetAll<MetaInsight>(`act_${accountId}/insights`, {
      level: "adset",
      fields: `adset_id,${insightFields}`,
      time_range: timeRange,
      limit: "100",
    }),
    metaGetAll<MetaInsight>(`act_${accountId}/insights`, {
      level: "ad",
      fields: `ad_id,${insightFields}`,
      time_range: timeRange,
      limit: "100",
    }),
  ])

  const currency = account.currency?.trim() || "USD"
  const campaignMetrics = insightMap(campaignInsights.rows, (row) => row.campaign_id)
  const adSetMetrics = insightMap(adSetInsights.rows, (row) => row.adset_id)
  const adMetrics = insightMap(adInsights.rows, (row) => row.ad_id)

  return {
    accountId,
    accountName: account.name?.trim() || null,
    currency,
    campaigns: campaigns.rows
      .filter((row) => row.id && row.status !== "DELETED" && row.status !== "ARCHIVED")
      .map((row) => mapCampaign(row, currency, campaignMetrics)),
    adGroups: adSets.rows
      .filter((row) => row.id && row.campaign_id && row.status !== "DELETED" && row.status !== "ARCHIVED")
      .map((row) => mapAdSet(row, currency, adSetMetrics)),
    ads: ads.rows
      .filter((row) => row.id && row.adset_id && row.status !== "DELETED" && row.status !== "ARCHIVED")
      .map((row) => mapAd(row, currency, adMetrics)),
    truncated: campaigns.truncated || adSets.truncated || ads.truncated,
  }
}

function mapCampaign(
  row: MetaCampaignRow,
  currency: string,
  metrics: Map<string, AdsMetrics>,
): Unscored<ManagedCampaign> {
  const id = row.id ?? ""
  const status = mapDeliveryStatus(row.status)
  return {
    platform: "meta",
    id,
    name: row.name?.trim() || "Untitled campaign",
    status,
    channelLabel: metaObjectiveLabel(row.objective),
    dailyBudget: metaMinorToMajor(row.daily_budget, currency),
    budgetShared: false,
    currency,
    deliveryNote: metaDeliveryNote(row.effective_status, status),
    metrics: metrics.get(id) ?? emptyMetrics(),
  }
}

function mapAdSet(
  row: MetaAdSetRow,
  currency: string,
  metrics: Map<string, AdsMetrics>,
): Unscored<ManagedAdGroup> {
  const id = row.id ?? ""
  return {
    platform: "meta",
    id,
    campaignId: row.campaign_id ?? "",
    name: row.name?.trim() || "Ad set",
    status: mapDeliveryStatus(row.status),
    kind: "ad_set",
    dailyBudget: metaMinorToMajor(row.daily_budget, currency),
    currency,
    metrics: metrics.get(id) ?? emptyMetrics(),
  }
}

function mapAd(row: MetaAdRow, currency: string, metrics: Map<string, AdsMetrics>): Unscored<ManagedAd> {
  const link = row.creative?.object_story_spec?.link_data
  const headline = link?.name?.trim() || row.creative?.title?.trim() || ""
  const primary = link?.message?.trim() || row.creative?.body?.trim() || null
  const id = row.id ?? ""
  return {
    platform: "meta",
    id,
    campaignId: row.campaign_id ?? "",
    adGroupId: row.adset_id ?? "",
    name: row.name?.trim() || headline || "Ad",
    status: mapDeliveryStatus(row.status),
    kind: link ? "meta_link" : "other",
    headlines: headline ? [headline] : [],
    descriptions: link?.description?.trim() ? [link.description.trim()] : [],
    primaryText: primary,
    finalUrl: link?.link ?? null,
    currency,
    metrics: metrics.get(id) ?? emptyMetrics(),
  }
}

function insightMap(rows: MetaInsight[], idOf: (row: MetaInsight) => string | undefined): Map<string, AdsMetrics> {
  const map = new Map<string, AdsMetrics>()
  for (const row of rows) {
    const id = idOf(row)
    if (!id) continue
    map.set(
      id,
      buildMetrics({
        impressions: parseMajor(row.impressions),
        clicks: parseMajor(row.clicks),
        spend: parseMajor(row.spend),
        conversions: metaPurchaseCount(row.actions),
        conversionValue: metaPurchaseValue(row.action_values),
      }),
    )
  }
  return map
}
