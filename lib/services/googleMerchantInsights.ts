import type { SupabaseClient } from "@supabase/supabase-js"
import { googleMerchantRequest } from "@/lib/google-merchant/client"
import {
  getGoogleMerchantAccountId,
  getGoogleMerchantAuthMode,
  getGoogleMerchantContentLanguage,
  getGoogleMerchantDataSourceName,
  getGoogleMerchantFeedLabel,
  getGoogleMerchantParentAccount,
  isGoogleMerchantConfigured,
  matchesGoogleMerchantFeedProduct,
} from "@/lib/google-merchant/config"
import { listGoogleMerchantListingBatch } from "@/lib/db/google-merchant-listings"
import {
  isGoogleMerchantEligibleListing,
  mapListingToProductInput,
} from "@/lib/google-merchant/map-listing-to-product-input"
import {
  getGoogleAnalyticsMerchantTraffic,
  type GoogleAnalyticsResult,
} from "@/lib/services/googleAnalytics"

/**
 * Read-only Google Merchant Center intelligence for the admin dashboard.
 *
 * Combines three sources into one PRO-grade payload:
 *  1. Merchant API `products.list` — processed product state, approval status, item-level issues.
 *  2. Merchant API `reports.search` (product_performance_view) — clicks / impressions / CTR / conversions.
 *  3. Supabase `listings` — eligibility coverage (what *should* be in the feed vs. what is).
 *
 * Plus an optional Google Analytics 4 traffic panel (see lib/services/googleAnalytics.ts).
 *
 * Every function degrades gracefully: when Merchant API env is absent the dashboard renders a
 * setup state instead of throwing, mirroring the Search Console integration.
 */

export type GoogleMerchantProductStatus =
  | "approved"
  | "pending"
  | "disapproved"
  | "no_destination"

/** Per-channel (reporting context) status, scoped to the target country (US). */
export type GoogleMerchantChannelStatus =
  | "approved"
  | "pending"
  | "disapproved"
  | "not_targeted"

export interface GoogleMerchantDestinationStatus {
  reportingContext: string
  approvedCountries: string[]
  pendingCountries: string[]
  disapprovedCountries: string[]
}

export interface GoogleMerchantItemIssue {
  code: string
  /** Merchant API severity enum: NOT_IMPACTED | DEMOTED | DISAPPROVED. */
  severity: string
  resolution: string | null
  attribute: string | null
  reportingContext: string | null
  description: string | null
  detail: string | null
  documentation: string | null
  applicableCountries: string[]
  /** True when this issue impacts Shopping ads in the target country (US). */
  affectsAds: boolean
}

export interface GoogleMerchantProductDetail {
  offerId: string
  title: string | null
  brand: string | null
  link: string | null
  imageLink: string | null
  additionalImageCount: number
  priceMicros: number | null
  currency: string | null
  availability: string | null
  condition: string | null
  /**
   * Headline status, ads-first: Shopping ads status in the target country (US).
   * Falls back to free listings when the product isn't targeted to ads at all.
   */
  status: GoogleMerchantProductStatus
  /** Shopping ads status in the target country (US). */
  adsStatus: GoogleMerchantChannelStatus
  /** Free listings (organic Shopping tab) status in the target country (US). */
  freeListingsStatus: GoogleMerchantChannelStatus
  destinationStatuses: GoogleMerchantDestinationStatus[]
  issues: GoogleMerchantItemIssue[]
  errorCount: number
  warningCount: number
  creationDate: string | null
  lastUpdateDate: string | null
  expirationDate: string | null
}

export interface GoogleMerchantPerformanceRow {
  offerId: string
  title: string | null
  clicks: number
  impressions: number
  ctr: number
  conversions: number
  conversionValueUsd: number
}

export interface GoogleMerchantPerformanceDaily {
  date: string
  clicks: number
  impressions: number
}

export interface GoogleMerchantPerformance {
  configured: true
  rangeDays: number
  totals: {
    clicks: number
    impressions: number
    ctr: number
    conversions: number
    conversionValueUsd: number
  }
  byOffer: GoogleMerchantPerformanceRow[]
  daily: GoogleMerchantPerformanceDaily[]
}

export interface GoogleMerchantPerformanceUnavailable {
  configured: false
  reason: string
}

export type GoogleMerchantPerformanceResult =
  | GoogleMerchantPerformance
  | GoogleMerchantPerformanceUnavailable

export interface GoogleMerchantMissingListing {
  offerId: string
  title: string
  link: string
  priceUsd: number
}

export interface GoogleMerchantCoverage {
  eligibleListings: number
  productsInMerchant: number
  syncedEligible: number
  missingFromMerchant: GoogleMerchantMissingListing[]
  orphanOfferIds: string[]
}

export interface GoogleMerchantTopIssue {
  code: string
  description: string
  severity: string
  documentation: string | null
  count: number
  sampleOfferIds: string[]
  /** True when this issue impacts Shopping ads in the target country (US). */
  affectsAds: boolean
}

export interface GoogleMerchantInsightsSummary {
  total: number
  approved: number
  pending: number
  disapproved: number
  noDestination: number
  /** Approved for Shopping ads in the target country (US). */
  adsApproved: number
  /** Disapproved for Shopping ads in the target country (US). */
  adsDisapproved: number
  /** In the feed but not targeted to Shopping ads at all. */
  adsNotTargeted: number
  /** Approved for free listings in the target country (US). */
  freeListingsApproved: number
  withErrors: number
  withWarnings: number
  totalErrorIssues: number
  totalWarningIssues: number
}

export type GoogleMerchantOptimizationImpact = "high" | "medium" | "low"

export interface GoogleMerchantOptimizationTip {
  code: string
  title: string
  detail: string
  impact: GoogleMerchantOptimizationImpact
}

export interface GoogleMerchantProductOptimization {
  offerId: string
  title: string | null
  link: string | null
  imageLink: string | null
  /** 0–100. 100 = nothing to improve. */
  score: number
  clicks: number
  impressions: number
  ctr: number
  tips: GoogleMerchantOptimizationTip[]
}

export interface GoogleMerchantInsights {
  configured: boolean
  reason?: string
  generatedAt: string
  rangeDays: number
  account: {
    accountId: string | null
    dataSourceName: string | null
    authMode: string
    feedLabel: string
    contentLanguage: string
  }
  summary: GoogleMerchantInsightsSummary
  products: GoogleMerchantProductDetail[]
  performance: GoogleMerchantPerformanceResult
  coverage: GoogleMerchantCoverage
  topIssues: GoogleMerchantTopIssue[]
  /** Per-product ads optimization opportunities, biggest upside first. */
  optimizations: GoogleMerchantProductOptimization[]
  analytics: GoogleAnalyticsResult
}

const FREE_COVERAGE: GoogleMerchantCoverage = {
  eligibleListings: 0,
  productsInMerchant: 0,
  syncedEligible: 0,
  missingFromMerchant: [],
  orphanOfferIds: [],
}

const EMPTY_SUMMARY: GoogleMerchantInsightsSummary = {
  total: 0,
  approved: 0,
  pending: 0,
  disapproved: 0,
  noDestination: 0,
  adsApproved: 0,
  adsDisapproved: 0,
  adsNotTargeted: 0,
  freeListingsApproved: 0,
  withErrors: 0,
  withWarnings: 0,
  totalErrorIssues: 0,
  totalWarningIssues: 0,
}

// ---------------------------------------------------------------------------
// Raw Merchant API response shapes (only the fields we read)
// ---------------------------------------------------------------------------

interface RawProductPrice {
  amountMicros?: string
  currencyCode?: string
}

interface RawProductAttributes {
  title?: string
  brand?: string
  link?: string
  imageLink?: string
  additionalImageLinks?: string[]
  availability?: string
  condition?: string
  price?: RawProductPrice
}

interface RawDestinationStatus {
  reportingContext?: string
  approvedCountries?: string[]
  pendingCountries?: string[]
  disapprovedCountries?: string[]
}

interface RawItemLevelIssue {
  code?: string
  severity?: string
  resolution?: string
  attribute?: string
  reportingContext?: string
  description?: string
  detail?: string
  documentation?: string
  applicableCountries?: string[]
}

interface RawProductStatus {
  destinationStatuses?: RawDestinationStatus[]
  itemLevelIssues?: RawItemLevelIssue[]
  creationDate?: string
  lastUpdateDate?: string
  googleExpirationDate?: string
}

interface RawProduct {
  offerId?: string
  contentLanguage?: string
  feedLabel?: string
  dataSource?: string
  productAttributes?: RawProductAttributes
  productStatus?: RawProductStatus
}

interface RawProductsListResponse {
  products?: RawProduct[]
  nextPageToken?: string
}

interface RawReportDate {
  year?: number
  month?: number
  day?: number
}

interface RawProductPerformanceView {
  offerId?: string
  title?: string
  date?: RawReportDate
  clicks?: string
  impressions?: string
  clickThroughRate?: number
  conversions?: number
  conversionValue?: RawProductPrice
}

interface RawReportRow {
  productPerformanceView?: RawProductPerformanceView
}

interface RawReportsSearchResponse {
  results?: RawReportRow[]
  nextPageToken?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: string | number | null | undefined): number {
  if (value == null) return 0
  const parsed = typeof value === "number" ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function microsToUsd(price: RawProductPrice | undefined): number {
  const micros = toNumber(price?.amountMicros)
  return micros / 1_000_000
}

function isoFromReportDate(d: RawReportDate | undefined): string {
  if (!d?.year || !d?.month || !d?.day) return ""
  const mm = String(d.month).padStart(2, "0")
  const dd = String(d.day).padStart(2, "0")
  return `${d.year}-${mm}-${dd}`
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** Reporting contexts that drive paid Shopping placements. */
const ADS_REPORTING_CONTEXTS = new Set(["SHOPPING_ADS", "DEMAND_GEN_ADS", "VIDEO_ADS", "DISPLAY_ADS"])
const FREE_REPORTING_CONTEXTS = new Set(["FREE_LISTINGS", "FREE_LOCAL_LISTINGS"])

/** The country Reswell sells in — drives all status scoping. */
function targetCountry(): string {
  return getGoogleMerchantFeedLabel()
}

/** Status for a set of reporting contexts in the target country only. */
function channelStatusForCountry(
  destinations: GoogleMerchantDestinationStatus[],
  contexts: Set<string>,
  country: string,
): GoogleMerchantChannelStatus {
  const matching = destinations.filter((d) => contexts.has(d.reportingContext))
  if (matching.length === 0) return "not_targeted"

  let approved = false
  let pending = false
  let disapproved = false
  for (const d of matching) {
    if (d.disapprovedCountries.includes(country)) disapproved = true
    if (d.approvedCountries.includes(country)) approved = true
    if (d.pendingCountries.includes(country)) pending = true
  }
  if (disapproved) return "disapproved"
  if (approved) return "approved"
  if (pending) return "pending"
  return "not_targeted"
}

/**
 * Headline status is ads-first: what matters is whether the product can serve
 * Shopping ads in the US. Free listings only decide the status when the product
 * isn't targeted to ads at all.
 */
function deriveProductStatus(
  adsStatus: GoogleMerchantChannelStatus,
  freeListingsStatus: GoogleMerchantChannelStatus,
): GoogleMerchantProductStatus {
  const primary = adsStatus !== "not_targeted" ? adsStatus : freeListingsStatus
  if (primary === "not_targeted") return "no_destination"
  return primary
}

/** True when an item issue impacts ads serving in the target country. */
function issueAffectsAds(issue: {
  reportingContext: string | null
  applicableCountries: string[]
}): boolean {
  const country = targetCountry()
  if (issue.applicableCountries.length > 0 && !issue.applicableCountries.includes(country)) {
    return false
  }
  if (issue.reportingContext && !ADS_REPORTING_CONTEXTS.has(issue.reportingContext)) {
    return false
  }
  return true
}

/** Ads-blocking disapprovals count as errors; everything else is a warning. */
function issueIsError(issue: { severity: string; affectsAds: boolean }): boolean {
  return issue.severity.toUpperCase() === "DISAPPROVED" && issue.affectsAds
}

function mapRawProduct(raw: RawProduct): GoogleMerchantProductDetail {
  const attrs = raw.productAttributes ?? {}
  const status = raw.productStatus ?? {}

  const destinationStatuses: GoogleMerchantDestinationStatus[] = (
    status.destinationStatuses ?? []
  ).map((d) => ({
    reportingContext: d.reportingContext ?? "UNKNOWN",
    approvedCountries: d.approvedCountries ?? [],
    pendingCountries: d.pendingCountries ?? [],
    disapprovedCountries: d.disapprovedCountries ?? [],
  }))

  const issues: GoogleMerchantItemIssue[] = (status.itemLevelIssues ?? []).map((i) => {
    const base = {
      code: i.code ?? "unknown",
      severity: i.severity ?? "NOT_IMPACTED",
      resolution: i.resolution ?? null,
      attribute: i.attribute ?? null,
      reportingContext: i.reportingContext ?? null,
      description: i.description ?? null,
      detail: i.detail ?? null,
      documentation: i.documentation ?? null,
      applicableCountries: i.applicableCountries ?? [],
    }
    return { ...base, affectsAds: issueAffectsAds(base) }
  })

  let errorCount = 0
  let warningCount = 0
  for (const issue of issues) {
    if (issueIsError(issue)) errorCount += 1
    else warningCount += 1
  }

  const priceMicros = attrs.price?.amountMicros ? toNumber(attrs.price.amountMicros) : null

  const country = targetCountry()
  const adsStatus = channelStatusForCountry(destinationStatuses, ADS_REPORTING_CONTEXTS, country)
  const freeListingsStatus = channelStatusForCountry(
    destinationStatuses,
    FREE_REPORTING_CONTEXTS,
    country,
  )

  return {
    offerId: (raw.offerId ?? "").trim(),
    title: attrs.title?.trim() || null,
    brand: attrs.brand?.trim() || null,
    link: attrs.link?.trim() || null,
    imageLink: attrs.imageLink?.trim() || null,
    additionalImageCount: attrs.additionalImageLinks?.length ?? 0,
    priceMicros,
    currency: attrs.price?.currencyCode ?? null,
    availability: attrs.availability ?? null,
    condition: attrs.condition ?? null,
    status: deriveProductStatus(adsStatus, freeListingsStatus),
    adsStatus,
    freeListingsStatus,
    destinationStatuses,
    issues,
    errorCount,
    warningCount,
    creationDate: status.creationDate ?? null,
    lastUpdateDate: status.lastUpdateDate ?? null,
    expirationDate: status.googleExpirationDate ?? null,
  }
}

// ---------------------------------------------------------------------------
// Merchant API fetchers
// ---------------------------------------------------------------------------

/** Page through processed products keeping full status + attribute detail. */
export async function listGoogleMerchantProductsDetailed(): Promise<
  | { ok: true; products: GoogleMerchantProductDetail[] }
  | { ok: false; status: number; error: string }
> {
  if (!isGoogleMerchantConfigured()) {
    return { ok: false, status: 503, error: "Google Merchant API is not configured" }
  }

  const parent = getGoogleMerchantParentAccount()
  const products: GoogleMerchantProductDetail[] = []
  let pageToken: string | undefined

  for (;;) {
    const params = new URLSearchParams({ pageSize: "250" })
    if (pageToken) params.set("pageToken", pageToken)

    const res = await googleMerchantRequest(
      `/products/v1/${parent}/products?${params.toString()}`,
      { method: "GET" },
    )
    if (!res.ok) {
      const data = res.data as { error?: { message?: string } } | null
      return {
        ok: false,
        status: res.status,
        error: data?.error?.message || `products.list failed (${res.status})`,
      }
    }

    const data = res.data as RawProductsListResponse
    for (const raw of data.products ?? []) {
      if (!matchesGoogleMerchantFeedProduct(raw)) continue
      const mapped = mapRawProduct(raw)
      if (mapped.offerId) products.push(mapped)
    }

    if (!data.nextPageToken?.trim()) break
    pageToken = data.nextPageToken.trim()
  }

  return { ok: true, products }
}

async function runProductPerformanceQuery(
  query: string,
): Promise<RawProductPerformanceView[]> {
  const parent = getGoogleMerchantParentAccount()
  const rows: RawProductPerformanceView[] = []
  let pageToken: string | undefined

  for (;;) {
    const body: Record<string, unknown> = { query, pageSize: 1000 }
    if (pageToken) body.pageToken = pageToken

    const res = await googleMerchantRequest(`/reports/v1/${parent}/reports:search`, {
      method: "POST",
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const data = res.data as { error?: { message?: string } } | null
      throw new Error(data?.error?.message || `reports.search failed (${res.status})`)
    }

    const data = res.data as RawReportsSearchResponse
    for (const row of data.results ?? []) {
      if (row.productPerformanceView) rows.push(row.productPerformanceView)
    }

    if (!data.nextPageToken?.trim()) break
    pageToken = data.nextPageToken.trim()
  }

  return rows
}

/**
 * Clicks / impressions / CTR / conversions per product (and a daily timeseries) from
 * the Merchant Center product_performance_view over the trailing window.
 */
export async function getGoogleMerchantProductPerformance(options?: {
  days?: number
  offerIdFilter?: Set<string>
}): Promise<GoogleMerchantPerformanceResult> {
  if (!isGoogleMerchantConfigured()) {
    return { configured: false, reason: "Google Merchant API is not configured." }
  }

  const days = options?.days ?? 28
  const offerIdFilter = options?.offerIdFilter
  const startDate = isoDaysAgo(days)
  const endDate = isoDaysAgo(1)

  try {
    const offerQuery = `SELECT offer_id, title, clicks, impressions, click_through_rate, conversions, conversion_value FROM product_performance_view WHERE date BETWEEN '${startDate}' AND '${endDate}' ORDER BY clicks DESC`
    const dailyQuery = `SELECT offer_id, date, clicks, impressions FROM product_performance_view WHERE date BETWEEN '${startDate}' AND '${endDate}' ORDER BY date ASC`

    const [offerRows, dailyRows] = await Promise.all([
      runProductPerformanceQuery(offerQuery),
      runProductPerformanceQuery(dailyQuery),
    ])

    // Some currencies split conversion_value into multiple rows per offer; aggregate.
    const offerMap = new Map<string, GoogleMerchantPerformanceRow>()
    for (const row of offerRows) {
      const offerId = (row.offerId ?? "").trim()
      if (!offerId) continue
      if (offerIdFilter && !offerIdFilter.has(offerId)) continue
      const existing = offerMap.get(offerId)
      const clicks = toNumber(row.clicks)
      const impressions = toNumber(row.impressions)
      const conversions = toNumber(row.conversions)
      const conversionValueUsd = microsToUsd(row.conversionValue)
      if (existing) {
        existing.clicks += clicks
        existing.impressions += impressions
        existing.conversions += conversions
        existing.conversionValueUsd += conversionValueUsd
        existing.ctr = existing.impressions > 0 ? existing.clicks / existing.impressions : 0
      } else {
        offerMap.set(offerId, {
          offerId,
          title: row.title?.trim() || null,
          clicks,
          impressions,
          ctr: impressions > 0 ? clicks / impressions : 0,
          conversions,
          conversionValueUsd,
        })
      }
    }

    const dailyMap = new Map<string, GoogleMerchantPerformanceDaily>()
    for (const row of dailyRows) {
      const offerId = (row.offerId ?? "").trim()
      if (offerIdFilter && offerId && !offerIdFilter.has(offerId)) continue
      const date = isoFromReportDate(row.date)
      if (!date) continue
      const existing = dailyMap.get(date)
      const clicks = toNumber(row.clicks)
      const impressions = toNumber(row.impressions)
      if (existing) {
        existing.clicks += clicks
        existing.impressions += impressions
      } else {
        dailyMap.set(date, { date, clicks, impressions })
      }
    }

    const byOffer = [...offerMap.values()].sort((a, b) => b.clicks - a.clicks)
    const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date))

    const totals = byOffer.reduce(
      (acc, row) => {
        acc.clicks += row.clicks
        acc.impressions += row.impressions
        acc.conversions += row.conversions
        acc.conversionValueUsd += row.conversionValueUsd
        return acc
      },
      { clicks: 0, impressions: 0, conversions: 0, conversionValueUsd: 0 },
    )

    return {
      configured: true,
      rangeDays: days,
      totals: {
        ...totals,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      },
      byOffer,
      daily,
    }
  } catch (e) {
    return {
      configured: false,
      reason: e instanceof Error ? e.message : "Could not load Merchant Center performance.",
    }
  }
}

// ---------------------------------------------------------------------------
// DB coverage (eligible listings vs. what's in Merchant Center)
// ---------------------------------------------------------------------------

async function computeCoverage(
  supabase: SupabaseClient,
  merchantOfferIds: Set<string>,
): Promise<GoogleMerchantCoverage> {
  const eligibleOfferIds = new Set<string>()
  const missingFromMerchant: GoogleMerchantMissingListing[] = []
  const pageSize = 100
  let from = 0

  for (;;) {
    const batch = await listGoogleMerchantListingBatch(supabase, { from, limit: pageSize })
    if (batch.length === 0) break

    for (const listing of batch) {
      if (!isGoogleMerchantEligibleListing(listing)) continue
      eligibleOfferIds.add(listing.id)

      if (!merchantOfferIds.has(listing.id)) {
        const productInput = mapListingToProductInput(listing)
        if (productInput && missingFromMerchant.length < 100) {
          missingFromMerchant.push({
            offerId: listing.id,
            title: productInput.productAttributes.title,
            link: productInput.productAttributes.link,
            priceUsd: listing.price,
          })
        }
      }
    }

    if (batch.length < pageSize) break
    from += pageSize
  }

  let syncedEligible = 0
  for (const offerId of eligibleOfferIds) {
    if (merchantOfferIds.has(offerId)) syncedEligible += 1
  }

  const orphanOfferIds: string[] = []
  for (const offerId of merchantOfferIds) {
    if (!eligibleOfferIds.has(offerId)) orphanOfferIds.push(offerId)
  }

  return {
    eligibleListings: eligibleOfferIds.size,
    productsInMerchant: merchantOfferIds.size,
    syncedEligible,
    missingFromMerchant,
    orphanOfferIds,
  }
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function summarize(products: GoogleMerchantProductDetail[]): GoogleMerchantInsightsSummary {
  const summary: GoogleMerchantInsightsSummary = { ...EMPTY_SUMMARY }
  for (const product of products) {
    summary.total += 1
    switch (product.status) {
      case "approved":
        summary.approved += 1
        break
      case "pending":
        summary.pending += 1
        break
      case "disapproved":
        summary.disapproved += 1
        break
      default:
        summary.noDestination += 1
    }
    if (product.adsStatus === "approved") summary.adsApproved += 1
    if (product.adsStatus === "disapproved") summary.adsDisapproved += 1
    if (product.adsStatus === "not_targeted") summary.adsNotTargeted += 1
    if (product.freeListingsStatus === "approved") summary.freeListingsApproved += 1
    if (product.errorCount > 0) summary.withErrors += 1
    if (product.warningCount > 0) summary.withWarnings += 1
    summary.totalErrorIssues += product.errorCount
    summary.totalWarningIssues += product.warningCount
  }
  return summary
}

function buildTopIssues(products: GoogleMerchantProductDetail[]): GoogleMerchantTopIssue[] {
  const byCode = new Map<string, GoogleMerchantTopIssue>()
  for (const product of products) {
    for (const issue of product.issues) {
      const existing = byCode.get(issue.code)
      if (existing) {
        existing.count += 1
        if (existing.sampleOfferIds.length < 5) existing.sampleOfferIds.push(product.offerId)
        if (issueIsError(issue)) existing.severity = "DISAPPROVED"
        if (issue.affectsAds) existing.affectsAds = true
      } else {
        byCode.set(issue.code, {
          code: issue.code,
          description: issue.description || issue.code,
          severity: issue.severity,
          documentation: issue.documentation,
          count: 1,
          sampleOfferIds: [product.offerId],
          affectsAds: issue.affectsAds,
        })
      }
    }
  }
  // Ads-blocking issues first, then by frequency.
  return [...byCode.values()].sort(
    (a, b) => Number(b.affectsAds) - Number(a.affectsAds) || b.count - a.count,
  )
}

// ---------------------------------------------------------------------------
// Ads optimization engine
// ---------------------------------------------------------------------------

const IMPACT_PENALTY: Record<GoogleMerchantOptimizationImpact, number> = {
  high: 25,
  medium: 12,
  low: 5,
}

/** Feed-wide CTR floor: products with traffic but well below this need creative work. */
const OPTIMIZATION_MIN_TITLE_LENGTH = 30
const OPTIMIZATION_GOOD_TITLE_LENGTH = 50
const OPTIMIZATION_MIN_IMPRESSIONS_FOR_CTR = 30

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function buildProductOptimization(
  product: GoogleMerchantProductDetail,
  perf: GoogleMerchantPerformanceRow | undefined,
  context: { feedMedianCtr: number | null; feedMedianPriceMicros: number | null },
): GoogleMerchantProductOptimization {
  const tips: GoogleMerchantOptimizationTip[] = []
  const title = product.title?.trim() ?? ""
  const clicks = perf?.clicks ?? 0
  const impressions = perf?.impressions ?? 0
  const ctr = impressions > 0 ? clicks / impressions : 0

  // 1. Serving blockers / demotions straight from Google.
  if (product.adsStatus === "disapproved") {
    tips.push({
      code: "ads_disapproved",
      title: "Disapproved for US Shopping ads",
      detail:
        product.issues.find((i) => i.affectsAds && i.severity.toUpperCase() === "DISAPPROVED")
          ?.description ?? "Resolve the disapproval issue, then resync the feed.",
      impact: "high",
    })
  }
  for (const issue of product.issues) {
    if (issue.affectsAds && issue.severity.toUpperCase() === "DEMOTED") {
      tips.push({
        code: `demoted_${issue.code}`,
        title: "Google is demoting this ad",
        detail: issue.description ?? issue.code,
        impact: "high",
      })
    }
  }

  // 2. Identifier completeness — drives query matching and ranking.
  if (!product.brand) {
    tips.push({
      code: "missing_brand",
      title: "Add a brand",
      detail:
        "No brand is set. Brand is one of the strongest matching signals for surfboard queries (e.g. \"Channel Islands surfboard\"). Set it on the Reswell listing.",
      impact: "high",
    })
  }

  // 3. Title quality — the single biggest CTR lever in Shopping.
  if (title.length > 0 && title.length < OPTIMIZATION_MIN_TITLE_LENGTH) {
    tips.push({
      code: "title_too_short",
      title: "Title is too short",
      detail: `"${title}" (${title.length} chars). Aim for ${OPTIMIZATION_GOOD_TITLE_LENGTH}+ chars: brand + model + length + condition, e.g. "Channel Islands Dumpster Diver 5'10\\" Used Shortboard".`,
      impact: "high",
    })
  } else if (title.length < OPTIMIZATION_GOOD_TITLE_LENGTH) {
    tips.push({
      code: "title_could_be_richer",
      title: "Enrich the title",
      detail: `Titles around ${OPTIMIZATION_GOOD_TITLE_LENGTH}–70 chars with brand, model, and dimensions match more queries. Current: ${title.length} chars.`,
      impact: "low",
    })
  }
  if (product.brand && title && !title.toLowerCase().includes(product.brand.toLowerCase())) {
    tips.push({
      code: "brand_not_in_title",
      title: "Put the brand in the title",
      detail: `The brand "${product.brand}" isn't in the title. Google heavily weights title text for ad matching.`,
      impact: "medium",
    })
  }

  // 4. Imagery — second biggest CTR lever.
  if (product.additionalImageCount === 0) {
    tips.push({
      code: "single_image",
      title: "Add more photos",
      detail:
        "Only one image is in the feed. Extra angles (deck, bottom, rails, dings) improve both CTR and buyer trust.",
      impact: "medium",
    })
  }

  // 5. Performance-based signals.
  if (
    impressions >= OPTIMIZATION_MIN_IMPRESSIONS_FOR_CTR &&
    context.feedMedianCtr != null &&
    context.feedMedianCtr > 0 &&
    ctr < context.feedMedianCtr / 2
  ) {
    tips.push({
      code: "ctr_below_feed",
      title: "CTR well below your feed median",
      detail: `${(ctr * 100).toFixed(1)}% vs feed median ${(context.feedMedianCtr * 100).toFixed(1)}%. Shoppers see it but skip it — lead with a cleaner hero image and a price check.`,
      impact: "high",
    })
  }
  if (product.adsStatus === "approved" && impressions === 0) {
    tips.push({
      code: "approved_no_impressions",
      title: "Approved but not serving",
      detail:
        "Zero impressions in this window. Usually price competitiveness, a too-generic title, or low campaign priority/budget for this product group.",
      impact: "medium",
    })
  }

  // 6. Price positioning (soft signal in a marketplace of unique boards).
  if (
    context.feedMedianPriceMicros != null &&
    product.priceMicros != null &&
    product.priceMicros > context.feedMedianPriceMicros * 2.5 &&
    impressions > 0 &&
    clicks === 0
  ) {
    tips.push({
      code: "price_outlier_no_clicks",
      title: "Priced far above the feed, with no clicks",
      detail:
        "Google shows price directly in the ad. If this board is premium, make the title justify it (brand, model, condition); otherwise revisit the price.",
      impact: "low",
    })
  }

  const score = Math.max(
    0,
    100 - tips.reduce((acc, tip) => acc + IMPACT_PENALTY[tip.impact], 0),
  )

  return {
    offerId: product.offerId,
    title: product.title,
    link: product.link,
    imageLink: product.imageLink,
    score,
    clicks,
    impressions,
    ctr,
    tips,
  }
}

/**
 * Per-product ads optimization opportunities, ranked by upside: products with
 * traffic (or blocked from serving) and the lowest scores come first.
 */
export function buildGoogleMerchantOptimizations(
  products: GoogleMerchantProductDetail[],
  performance: GoogleMerchantPerformanceResult,
): GoogleMerchantProductOptimization[] {
  const perfByOffer = new Map<string, GoogleMerchantPerformanceRow>()
  if (performance.configured) {
    for (const row of performance.byOffer) perfByOffer.set(row.offerId, row)
  }

  const ctrs = performance.configured
    ? performance.byOffer.filter((r) => r.impressions >= 10).map((r) => r.ctr)
    : []
  const context = {
    feedMedianCtr: median(ctrs),
    feedMedianPriceMicros: median(
      products.map((p) => p.priceMicros).filter((v): v is number => v != null && v > 0),
    ),
  }

  return products
    .map((product) => buildProductOptimization(product, perfByOffer.get(product.offerId), context))
    .filter((o) => o.tips.length > 0)
    .sort(
      (a, b) =>
        a.score - b.score || b.impressions - a.impressions || b.clicks - a.clicks,
    )
}

/**
 * Full dashboard payload. Never throws for the unconfigured/transient case — returns a
 * `configured: false` shape with a setup reason so the admin UI can render guidance.
 */
export async function buildGoogleMerchantInsights(
  supabase: SupabaseClient,
  options?: { days?: number },
): Promise<GoogleMerchantInsights> {
  const days = options?.days ?? 28
  const account = {
    accountId: getGoogleMerchantAccountId(),
    dataSourceName: getGoogleMerchantDataSourceName(),
    authMode: getGoogleMerchantAuthMode(),
    feedLabel: getGoogleMerchantFeedLabel(),
    contentLanguage: getGoogleMerchantContentLanguage(),
  }
  const generatedAt = new Date().toISOString()

  if (!isGoogleMerchantConfigured()) {
    return {
      configured: false,
      reason:
        "Google Merchant API is not connected. Set GOOGLE_MERCHANT_ACCOUNT_ID, GOOGLE_MERCHANT_DATA_SOURCE_NAME, and an auth mode (Workload Identity Federation or GOOGLE_MERCHANT_SERVICE_ACCOUNT_JSON).",
      generatedAt,
      rangeDays: days,
      account,
      summary: { ...EMPTY_SUMMARY },
      products: [],
      performance: { configured: false, reason: "Google Merchant API is not configured." },
      coverage: { ...FREE_COVERAGE },
      topIssues: [],
      optimizations: [],
      analytics: { configured: false, reason: "Google Analytics is not configured." },
    }
  }

  const productsResult = await listGoogleMerchantProductsDetailed()
  if (!productsResult.ok) {
    return {
      configured: false,
      reason: productsResult.error,
      generatedAt,
      rangeDays: days,
      account,
      summary: { ...EMPTY_SUMMARY },
      products: [],
      performance: { configured: false, reason: productsResult.error },
      coverage: { ...FREE_COVERAGE },
      topIssues: [],
      optimizations: [],
      analytics: { configured: false, reason: "Google Analytics is not configured." },
    }
  }

  const products = productsResult.products
  const merchantOfferIds = new Set(products.map((p) => p.offerId))

  const [performance, coverage, analytics] = await Promise.all([
    getGoogleMerchantProductPerformance({ days, offerIdFilter: merchantOfferIds }),
    computeCoverage(supabase, merchantOfferIds),
    getGoogleAnalyticsMerchantTraffic({ days }),
  ])

  return {
    configured: true,
    generatedAt,
    rangeDays: days,
    account,
    summary: summarize(products),
    products,
    performance,
    coverage,
    topIssues: buildTopIssues(products),
    optimizations: buildGoogleMerchantOptimizations(products, performance),
    analytics,
  }
}
