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
}

export interface GoogleMerchantProductDetail {
  offerId: string
  title: string | null
  brand: string | null
  link: string | null
  imageLink: string | null
  priceMicros: number | null
  currency: string | null
  availability: string | null
  condition: string | null
  status: GoogleMerchantProductStatus
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
}

export interface GoogleMerchantInsightsSummary {
  total: number
  approved: number
  pending: number
  disapproved: number
  noDestination: number
  withErrors: number
  withWarnings: number
  totalErrorIssues: number
  totalWarningIssues: number
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

function deriveProductStatus(
  destinations: GoogleMerchantDestinationStatus[],
): GoogleMerchantProductStatus {
  if (destinations.length === 0) return "no_destination"
  const hasDisapproved = destinations.some((d) => d.disapprovedCountries.length > 0)
  if (hasDisapproved) return "disapproved"
  const hasApproved = destinations.some((d) => d.approvedCountries.length > 0)
  if (hasApproved) return "approved"
  const hasPending = destinations.some((d) => d.pendingCountries.length > 0)
  if (hasPending) return "pending"
  return "no_destination"
}

/** Disapproving issues count as errors; demoted/other as warnings. */
function issueIsError(severity: string): boolean {
  return severity.toUpperCase() === "DISAPPROVED"
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

  const issues: GoogleMerchantItemIssue[] = (status.itemLevelIssues ?? []).map((i) => ({
    code: i.code ?? "unknown",
    severity: i.severity ?? "NOT_IMPACTED",
    resolution: i.resolution ?? null,
    attribute: i.attribute ?? null,
    reportingContext: i.reportingContext ?? null,
    description: i.description ?? null,
    detail: i.detail ?? null,
    documentation: i.documentation ?? null,
    applicableCountries: i.applicableCountries ?? [],
  }))

  let errorCount = 0
  let warningCount = 0
  for (const issue of issues) {
    if (issueIsError(issue.severity)) errorCount += 1
    else warningCount += 1
  }

  const priceMicros = attrs.price?.amountMicros ? toNumber(attrs.price.amountMicros) : null

  return {
    offerId: (raw.offerId ?? "").trim(),
    title: attrs.title?.trim() || null,
    brand: attrs.brand?.trim() || null,
    link: attrs.link?.trim() || null,
    imageLink: attrs.imageLink?.trim() || null,
    priceMicros,
    currency: attrs.price?.currencyCode ?? null,
    availability: attrs.availability ?? null,
    condition: attrs.condition ?? null,
    status: deriveProductStatus(destinationStatuses),
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
        if (issueIsError(issue.severity)) existing.severity = "DISAPPROVED"
      } else {
        byCode.set(issue.code, {
          code: issue.code,
          description: issue.description || issue.code,
          severity: issue.severity,
          documentation: issue.documentation,
          count: 1,
          sampleOfferIds: [product.offerId],
        })
      }
    }
  }
  return [...byCode.values()].sort((a, b) => b.count - a.count)
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
    analytics,
  }
}
