import "server-only"

import { requireAdmin } from "@/lib/brands/admin-server"
import { rangeDates } from "@/lib/ads/manager/dates"
import { AdsManagerInputError, AdsPlatformError, publicAdsError } from "@/lib/ads/manager/errors"
import { emptyMetrics, sumMetrics } from "@/lib/ads/manager/metrics"
import { benchmarksFromMetrics, scoreDelivery } from "@/lib/ads/manager/score"
import { readGoogleCreativeAssets } from "@/lib/ads/google/assets"
import { applyGoogleAudience, readGoogleAudiences } from "@/lib/ads/google/audiences"
import { googleAdsMissingConfig } from "@/lib/ads/google/config"
import { uploadGoogleImageAsset } from "@/lib/ads/google/media"
import { addPmaxAsset, createGooglePmaxCampaign, removePmaxAsset } from "@/lib/ads/google/pmax"
import { readGoogleAds } from "@/lib/ads/google/read"
import {
  addGoogleKeyword,
  createGoogleSearchCampaign,
  removeGoogleEntity,
  updateGoogleEntity,
} from "@/lib/ads/google/write"
import { applyMetaAudience, createMetaSavedAudience, readMetaAudiences } from "@/lib/ads/meta/audiences"
import { metaAdsMissingConfig } from "@/lib/ads/meta/config"
import { uploadMetaImageBytes, uploadMetaVideo } from "@/lib/ads/meta/media"
import { readMetaAds } from "@/lib/ads/meta/read"
import { createMetaLinkCampaign, removeMetaEntity, updateMetaEntity } from "@/lib/ads/meta/write"
import {
  googleImageMime,
  isMetaImageMime,
  isMetaVideoMime,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  safeMediaName,
} from "@/lib/ads/manager/media"
import type {
  AdVerdict,
  AdsAccountSnapshot,
  AdsManagerDashboard,
  AdsMetrics,
  AdsRangeDays,
  AdsTotals,
  DeliveryStatus,
  ManagedAd,
  ManagedAdGroup,
  ManagedAudience,
  ManagedCampaign,
  ManagedCreativeAsset,
  ManagedKeyword,
} from "@/lib/types/adsManager"
import {
  addGoogleKeywordSchema,
  addPmaxAssetSchema,
  adsMediaRoleSchema,
  applyAdsAudienceSchema,
  createAdsCampaignSchema,
  createMetaSavedAudienceSchema,
  removeAdsEntitySchema,
  removePmaxAssetSchema,
  updateAdsEntitySchema,
} from "@/lib/validations/adsManager"

export async function getAdsManagerDashboard(days: AdsRangeDays): Promise<AdsManagerDashboard> {
  const gate = await requireAdmin()
  if (!gate.ok) return emptyDashboard(days)

  const range = rangeDates(days)
  const [google, meta] = await Promise.all([
    loadGoogle(range, gate.ctx.user.id),
    loadMeta(range, gate.ctx.user.id),
  ])

  const campaigns = [...google.campaigns, ...meta.campaigns]
  return {
    rangeDays: days,
    generatedAt: new Date().toISOString(),
    accounts: [google.account, meta.account],
    totals: combineTotals(campaigns),
    campaigns,
    adGroups: [...google.adGroups, ...meta.adGroups],
    ads: [...google.ads, ...meta.ads],
    keywords: google.keywords,
    assets: google.assets,
    audiences: [...google.audiences, ...meta.audiences],
  }
}

export async function createAdsCampaignService(raw: unknown): Promise<string> {
  await assertAdmin()
  const parsed = createAdsCampaignSchema.safeParse(raw)
  if (!parsed.success) throw new AdsManagerInputError(firstIssue(parsed.error.issues))
  if (parsed.data.kind === "google_search") return createGoogleSearchCampaign(parsed.data)
  if (parsed.data.kind === "google_pmax") return createGooglePmaxCampaign(parsed.data)
  return createMetaLinkCampaign(parsed.data)
}

export async function updateAdsEntityService(raw: unknown): Promise<string> {
  await assertAdmin()
  const parsed = updateAdsEntitySchema.safeParse(raw)
  if (!parsed.success) throw new AdsManagerInputError(firstIssue(parsed.error.issues))
  if (parsed.data.platform === "google") return updateGoogleEntity(parsed.data)
  return updateMetaEntity(parsed.data)
}

export async function removeAdsEntityService(raw: unknown): Promise<string> {
  await assertAdmin()
  const parsed = removeAdsEntitySchema.safeParse(raw)
  if (!parsed.success) throw new AdsManagerInputError(firstIssue(parsed.error.issues))
  if (parsed.data.platform === "google") return removeGoogleEntity(parsed.data)
  return removeMetaEntity(parsed.data)
}

export async function addGoogleKeywordService(raw: unknown): Promise<string> {
  await assertAdmin()
  const parsed = addGoogleKeywordSchema.safeParse(raw)
  if (!parsed.success) throw new AdsManagerInputError(firstIssue(parsed.error.issues))
  return addGoogleKeyword(parsed.data)
}

export async function addPmaxAssetService(raw: unknown): Promise<string> {
  await assertAdmin()
  const parsed = addPmaxAssetSchema.safeParse(raw)
  if (!parsed.success) throw new AdsManagerInputError(firstIssue(parsed.error.issues))
  return addPmaxAsset(parsed.data)
}

export async function removePmaxAssetService(raw: unknown): Promise<string> {
  await assertAdmin()
  const parsed = removePmaxAssetSchema.safeParse(raw)
  if (!parsed.success) throw new AdsManagerInputError(firstIssue(parsed.error.issues))
  return removePmaxAsset(parsed.data.linkResource)
}

export async function applyAdsAudienceService(raw: unknown): Promise<string> {
  await assertAdmin()
  const parsed = applyAdsAudienceSchema.safeParse(raw)
  if (!parsed.success) throw new AdsManagerInputError(firstIssue(parsed.error.issues))
  if (parsed.data.platform === "google") return applyGoogleAudience(parsed.data)
  return applyMetaAudience(parsed.data)
}

export async function createMetaSavedAudienceService(raw: unknown): Promise<string> {
  await assertAdmin()
  const parsed = createMetaSavedAudienceSchema.safeParse(raw)
  if (!parsed.success) throw new AdsManagerInputError(firstIssue(parsed.error.issues))
  return createMetaSavedAudience(parsed.data)
}

export async function uploadAdsMediaService(input: {
  role: unknown
  filename: string
  mime: string
  bytes: Uint8Array
}): Promise<{ resource: string; kind: "google_asset" | "meta_image" | "meta_video" }> {
  await assertAdmin()
  const role = adsMediaRoleSchema.safeParse(input.role)
  if (!role.success) throw new AdsManagerInputError("Choose an image or video role")
  if (input.bytes.byteLength === 0) throw new AdsManagerInputError("That file is empty")
  const filename = safeMediaName(input.filename)

  if (role.data === "meta_video") {
    if (input.bytes.byteLength > MAX_VIDEO_BYTES) throw new AdsManagerInputError("Videos must be 100 MB or smaller")
    if (!isMetaVideoMime(input.mime)) throw new AdsManagerInputError("Use an MP4 or QuickTime video")
    const resource = await uploadMetaVideo({ filename, bytes: input.bytes, mime: input.mime })
    return { resource, kind: "meta_video" }
  }

  if (input.bytes.byteLength > MAX_IMAGE_BYTES) throw new AdsManagerInputError("Images must be 4 MB or smaller")
  if (role.data === "meta_image") {
    if (!isMetaImageMime(input.mime)) throw new AdsManagerInputError("Use a JPEG, PNG, GIF, or WebP image")
    const resource = await uploadMetaImageBytes({ filename, bytes: input.bytes, mime: input.mime })
    return { resource, kind: "meta_image" }
  }

  const mimeType = googleImageMime(input.mime)
  if (!mimeType) throw new AdsManagerInputError("Google image assets need a JPEG, PNG, or GIF")
  const resource = await uploadGoogleImageAsset({ filename, bytes: input.bytes, mimeType })
  return { resource, kind: "google_asset" }
}

async function assertAdmin(): Promise<void> {
  const gate = await requireAdmin()
  if (!gate.ok) throw new AdsManagerInputError("Admin only")
}

interface PlatformSlice {
  account: AdsAccountSnapshot
  campaigns: ManagedCampaign[]
  adGroups: ManagedAdGroup[]
  ads: ManagedAd[]
  keywords: ManagedKeyword[]
  assets: ManagedCreativeAsset[]
  audiences: ManagedAudience[]
}

async function loadGoogle(range: { since: string; until: string }, userId: string): Promise<PlatformSlice> {
  const missing = googleAdsMissingConfig()
  if (missing.length > 0) return blankSlice("google", missing)
  try {
    const model = await readGoogleAds(range)
    const [assets, audiences] = await Promise.all([
      readGoogleCreativeAssets().catch((error: unknown) => {
        logAds(userId, "read-google-assets", error)
        return [] as ManagedCreativeAsset[]
      }),
      readGoogleAudiences().catch((error: unknown) => {
        logAds(userId, "read-google-audiences", error)
        return [] as ManagedAudience[]
      }),
    ])
    const benchmarks = benchmarksFromMetrics(sumMetrics(model.campaigns.map((row) => row.metrics)))
    return {
      account: {
        platform: "google",
        configured: true,
        accountId: model.accountId,
        accountName: model.accountName,
        currency: model.currency,
        missing: [],
        error: null,
        truncated: model.truncated,
      },
      campaigns: withVerdicts(model.campaigns, benchmarks),
      adGroups: withVerdicts(model.adGroups, benchmarks),
      ads: withVerdicts(model.ads, benchmarks),
      keywords: withVerdicts(model.keywords, benchmarks),
      assets,
      audiences,
    }
  } catch (error) {
    logAds(userId, "read-google", error)
    return failedSlice("google", error)
  }
}

async function loadMeta(range: { since: string; until: string }, userId: string): Promise<PlatformSlice> {
  const missing = metaAdsMissingConfig()
  if (missing.length > 0) return blankSlice("meta", missing)
  try {
    const model = await readMetaAds(range)
    const audiences = await readMetaAudiences().catch((error: unknown) => {
      logAds(userId, "read-meta-audiences", error)
      return [] as ManagedAudience[]
    })
    const benchmarks = benchmarksFromMetrics(sumMetrics(model.campaigns.map((row) => row.metrics)))
    return {
      account: {
        platform: "meta",
        configured: true,
        accountId: model.accountId,
        accountName: model.accountName,
        currency: model.currency,
        missing: [],
        error: null,
        truncated: model.truncated,
      },
      campaigns: withVerdicts(model.campaigns, benchmarks),
      adGroups: withVerdicts(model.adGroups, benchmarks),
      ads: withVerdicts(model.ads, benchmarks),
      keywords: [],
      assets: [],
      audiences,
    }
  } catch (error) {
    logAds(userId, "read-meta", error)
    return failedSlice("meta", error)
  }
}

function withVerdicts<T extends { status: DeliveryStatus; metrics: AdsMetrics }>(
  rows: T[],
  benchmarks: ReturnType<typeof benchmarksFromMetrics>,
): (T & { verdict: AdVerdict })[] {
  return rows.map((row) => ({
    ...row,
    verdict: scoreDelivery({ status: row.status, metrics: row.metrics, benchmarks }),
  }))
}

function blankSlice(platform: AdsAccountSnapshot["platform"], missing: string[]): PlatformSlice {
  return {
    account: {
      platform,
      configured: false,
      accountId: null,
      accountName: null,
      currency: null,
      missing,
      error: null,
      truncated: false,
    },
    campaigns: [],
    adGroups: [],
    ads: [],
    keywords: [],
    assets: [],
    audiences: [],
  }
}

function failedSlice(platform: AdsAccountSnapshot["platform"], error: unknown): PlatformSlice {
  return {
    account: {
      platform,
      configured: true,
      accountId: null,
      accountName: null,
      currency: null,
      missing: [],
      error: publicAdsError(error),
      truncated: false,
    },
    campaigns: [],
    adGroups: [],
    ads: [],
    keywords: [],
    assets: [],
    audiences: [],
  }
}

function combineTotals(campaigns: ManagedCampaign[]): AdsTotals {
  const currencies = [...new Set(campaigns.map((row) => row.currency).filter(Boolean))]
  if (currencies.length > 1) {
    return { metrics: null, currency: null, mixedCurrency: true }
  }
  return {
    metrics: campaigns.length > 0 ? sumMetrics(campaigns.map((row) => row.metrics)) : emptyMetrics(),
    currency: currencies[0] ?? "USD",
    mixedCurrency: false,
  }
}

function emptyDashboard(days: AdsRangeDays): AdsManagerDashboard {
  return {
    rangeDays: days,
    generatedAt: new Date().toISOString(),
    accounts: [blankSlice("google", []).account, blankSlice("meta", []).account].map((account) => ({
      ...account,
      error: "Admin only",
    })),
    totals: { metrics: emptyMetrics(), currency: "USD", mixedCurrency: false },
    campaigns: [],
    adGroups: [],
    ads: [],
    keywords: [],
    assets: [],
    audiences: [],
  }
}

function firstIssue(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Invalid input"
}

function logAds(userId: string, op: string, error: unknown): void {
  const message = error instanceof AdsPlatformError || error instanceof Error ? error.message : "unknown"
  console.error(
    "[ads-manager]",
    JSON.stringify({ userId, op, at: new Date().toISOString(), message: message.slice(0, 500) }),
  )
}
