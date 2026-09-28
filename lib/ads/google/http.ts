import "server-only"

import { AdsPlatformError } from "@/lib/ads/manager/errors"
import { assertGoogleAdsConfigured, getGoogleAdsApiVersion } from "@/lib/ads/google/config"
import { getGoogleAdsAccessToken } from "@/lib/ads/google/auth"

export interface GoogleAdsRow {
  customer?: {
    id?: string
    descriptiveName?: string
    currencyCode?: string
  }
  campaign?: {
    id?: string
    name?: string
    status?: string
    advertisingChannelType?: string
    resourceName?: string
    primaryStatus?: string
  }
  campaignBudget?: {
    id?: string
    resourceName?: string
    amountMicros?: string
    explicitlyShared?: boolean
  }
  adGroup?: {
    id?: string
    name?: string
    status?: string
    resourceName?: string
  }
  adGroupAd?: {
    status?: string
    resourceName?: string
    ad?: {
      id?: string
      name?: string
      type?: string
      finalUrls?: string[]
      resourceName?: string
      responsiveSearchAd?: {
        headlines?: { text?: string }[]
        descriptions?: { text?: string }[]
      }
    }
  }
  adGroupCriterion?: {
    resourceName?: string
    status?: string
    criterionId?: string
    keyword?: { text?: string; matchType?: string }
  }
  assetGroup?: {
    id?: string
    name?: string
    status?: string
    resourceName?: string
    finalUrls?: string[]
  }
  assetGroupAsset?: {
    resourceName?: string
    fieldType?: string
    status?: string
  }
  asset?: {
    id?: string
    name?: string
    type?: string
    textAsset?: { text?: string }
    imageAsset?: { fullSize?: { url?: string } }
    youtubeVideoAsset?: { youtubeVideoId?: string }
  }
  userList?: {
    id?: string
    name?: string
    sizeForDisplay?: string
    membershipStatus?: string
  }
  audience?: {
    id?: string
    name?: string
    description?: string
    status?: string
  }
  metrics?: {
    impressions?: string
    clicks?: string
    costMicros?: string
    conversions?: number
    conversionsValue?: number
  }
}

interface GoogleSearchResponse {
  results?: GoogleAdsRow[]
  nextPageToken?: string
}

interface GoogleMutateResponse {
  results?: { resourceName?: string }[]
}

export async function searchGoogleAds(customerId: string, query: string): Promise<GoogleAdsRow[]> {
  const rows: GoogleAdsRow[] = []
  let pageToken: string | undefined
  for (let page = 0; page < 6; page += 1) {
    const payload = await googleAdsRequest<GoogleSearchResponse>(
      `customers/${customerId}/googleAds:search`,
      {
        method: "POST",
        body: JSON.stringify({
          query,
          ...(pageToken ? { pageToken } : {}),
        }),
      },
    )
    rows.push(...(payload.results ?? []))
    pageToken = payload.nextPageToken
    if (!pageToken || rows.length >= 2000) break
  }
  return rows
}

export async function mutateGoogleAds(
  customerId: string,
  collection: string,
  operations: Record<string, unknown>[],
  timeoutMs = 20_000,
): Promise<string> {
  const payload = await googleAdsRequest<GoogleMutateResponse>(
    `customers/${customerId}/${collection}:mutate`,
    {
      method: "POST",
      body: JSON.stringify({ operations }),
    },
    timeoutMs,
  )
  const resourceName = payload.results?.[0]?.resourceName
  if (!resourceName) {
    throw new AdsPlatformError("Google Ads did not confirm the change", "google")
  }
  return resourceName
}

async function googleAdsRequest<T>(path: string, init: RequestInit, timeoutMs = 20_000): Promise<T> {
  const config = assertGoogleAdsConfigured()
  const token = await getGoogleAdsAccessToken()
  const headers = new Headers(init.headers)
  headers.set("Authorization", `Bearer ${token}`)
  headers.set("developer-token", config.developerToken)
  headers.set("Content-Type", "application/json")
  if (config.loginCustomerId) headers.set("login-customer-id", config.loginCustomerId)

  const response = await fetch(
    `https://googleads.googleapis.com/${getGoogleAdsApiVersion()}/${path}`,
    { ...init, headers, signal: AbortSignal.timeout(timeoutMs) },
  )
  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    throw new AdsPlatformError(googleErrorMessage(payload, response.status), "google")
  }
  return (payload ?? {}) as T
}

function googleErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== "object") return `Google Ads request failed (${status})`
  const error = (payload as { error?: { message?: string; details?: unknown[] } }).error
  const detail = firstDetail(error?.details)
  const message = error?.message?.trim()
  return [message, detail].filter(Boolean).join(": ") || `Google Ads request failed (${status})`
}

function firstDetail(details: unknown): string | null {
  if (!Array.isArray(details)) return null
  for (const detail of details) {
    if (!detail || typeof detail !== "object") continue
    const errors = (detail as { errors?: { message?: string }[] }).errors
    const text = errors?.find((item) => item.message?.trim())?.message?.trim()
    if (text) return text
  }
  return null
}
