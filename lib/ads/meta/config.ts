import type { AdsPlatform } from "@/lib/types/adsManager"

import { AdsPlatformError } from "@/lib/ads/manager/errors"

const DEFAULT_GRAPH_VERSION = "v21.0"

const PURCHASE_ACTION_TYPES = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase"] as const

export function getMetaGraphVersion(): string {
  const raw = process.env.META_GRAPH_API_VERSION?.trim()
  return raw && /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_GRAPH_VERSION
}

export function normalizeMetaAdAccountId(raw: string | undefined): string | null {
  if (!raw) return null
  const digits = raw.trim().replace(/^act_/i, "").replace(/-/g, "")
  return /^\d{5,20}$/.test(digits) ? digits : null
}

export function getMetaAdAccountId(): string | null {
  return normalizeMetaAdAccountId(process.env.META_ADS_AD_ACCOUNT_ID)
}

export function getMetaAdsAccessToken(): string | null {
  const token = process.env.META_ADS_ACCESS_TOKEN?.trim()
  return token || null
}

export function getMetaAdsPageId(): string | null {
  const pageId = process.env.META_ADS_PAGE_ID?.trim()
  return pageId && /^\d{5,20}$/.test(pageId) ? pageId : null
}

export function metaAdsMissingConfig(): string[] {
  const missing: string[] = []
  if (!getMetaAdsAccessToken()) missing.push("META_ADS_ACCESS_TOKEN")
  if (!getMetaAdAccountId()) missing.push("META_ADS_AD_ACCOUNT_ID")
  return missing
}

export function metaAdsCreateMissingConfig(): string[] {
  const missing = metaAdsMissingConfig()
  if (!getMetaAdsPageId()) missing.push("META_ADS_PAGE_ID")
  return missing
}

export function assertMetaAdsConfigured(): { accountId: string; accessToken: string } {
  const missing = metaAdsMissingConfig()
  if (missing.length > 0) {
    throw new AdsPlatformError(`Meta Ads is not connected. Missing ${missing.join(", ")}`, "meta")
  }
  const accountId = getMetaAdAccountId()
  const accessToken = getMetaAdsAccessToken()
  if (!accountId || !accessToken) {
    throw new AdsPlatformError("Meta Ads is not connected", "meta")
  }
  return { accountId, accessToken }
}

export function metaPurchaseCount(
  actions: { action_type?: string; value?: string }[] | undefined,
): number {
  return readPreferredAction(actions)
}

export function metaPurchaseValue(
  actionValues: { action_type?: string; value?: string }[] | undefined,
): number {
  return readPreferredAction(actionValues)
}

function readPreferredAction(rows: { action_type?: string; value?: string }[] | undefined): number {
  if (!rows?.length) return 0
  const byType = new Map<string, number>()
  for (const row of rows) {
    if (!row.action_type) continue
    const value = Number(row.value)
    if (Number.isFinite(value)) byType.set(row.action_type, value)
  }
  for (const type of PURCHASE_ACTION_TYPES) {
    const value = byType.get(type)
    if (value != null) return value
  }
  return 0
}

export function metaPlatform(): AdsPlatform {
  return "meta"
}
