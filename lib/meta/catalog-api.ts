/**
 * Server-only: Meta (Facebook/Instagram) Commerce Catalog Graph API reader.
 *
 * This is the read-side counterpart to the scheduled CSV feed (lib/services/metaCatalogFeed.ts).
 * It pulls live product status, item-level errors, and (optionally) Advantage+ catalog ad
 * performance so the admin dashboard can mirror the Google Merchant Center view.
 *
 * Fully optional + graceful: when env is absent, callers fall back to feed-only health.
 *
 * Env:
 * - META_CATALOG_ID                 numeric product catalog id (Commerce Manager → Catalog → Settings)
 * - META_CATALOG_ACCESS_TOKEN       system-user token with `catalog_management` (falls back to
 *                                   META_CONVERSIONS_API_ACCESS_TOKEN if that token also has catalog access)
 * - META_GRAPH_API_VERSION          shared with CAPI (default v21.0)
 * - META_ADS_ACCOUNT_ID             optional — ad account id (with or without `act_`) for per-product clicks
 * - META_ADS_ACCESS_TOKEN           optional — token with `ads_read` (falls back to the catalog token)
 *
 * @see https://developers.facebook.com/docs/marketing-api/reference/product-catalog/products/
 */

const GRAPH_BASE = "https://graph.facebook.com"
const DEFAULT_GRAPH_API_VERSION = "v21.0"
const PRODUCT_PAGE_LIMIT = 200
const MAX_PRODUCT_PAGES = 200

export function getMetaGraphApiVersion(): string {
  const raw = process.env.META_GRAPH_API_VERSION?.trim()
  return raw && /^v\d+\.\d+$/.test(raw) ? raw : DEFAULT_GRAPH_API_VERSION
}

export function getMetaCatalogId(): string | null {
  const raw = process.env.META_CATALOG_ID?.trim()
  return raw || null
}

export function getMetaCatalogAccessToken(): string | null {
  const raw =
    process.env.META_CATALOG_ACCESS_TOKEN?.trim() ||
    process.env.META_CONVERSIONS_API_ACCESS_TOKEN?.trim()
  return raw || null
}

/** Ad account id normalized to bare digits (no `act_` prefix). */
export function getMetaAdsAccountId(): string | null {
  const raw = process.env.META_ADS_ACCOUNT_ID?.trim()
  if (!raw) return null
  return raw.replace(/^act_/i, "")
}

export function getMetaAdsAccessToken(): string | null {
  const raw = process.env.META_ADS_ACCESS_TOKEN?.trim() || getMetaCatalogAccessToken()
  return raw || null
}

export function isMetaCatalogApiConfigured(): boolean {
  return Boolean(getMetaCatalogId() && getMetaCatalogAccessToken())
}

export function isMetaAdsInsightsConfigured(): boolean {
  return Boolean(getMetaAdsAccountId() && getMetaAdsAccessToken())
}

/** Env keys still missing for the Catalog API (empty when fully configured). */
export function getMetaCatalogConfigGap(): string[] {
  const missing: string[] = []
  if (!getMetaCatalogId()) missing.push("META_CATALOG_ID")
  if (!getMetaCatalogAccessToken()) {
    missing.push("META_CATALOG_ACCESS_TOKEN (system-user token with catalog_management)")
  }
  return missing
}

export function getMetaCatalogSetupHint(): string {
  const gap = getMetaCatalogConfigGap()
  if (gap.length === 0) return ""
  return `${gap.join("; ")}. Create the token in Business Settings → System Users, then restart.`
}

type GraphResult = { ok: boolean; status: number; data: unknown }

async function metaGraphRequest(
  path: string,
  params: Record<string, string | number | undefined>,
  token: string,
): Promise<GraphResult> {
  const url = new URL(`${GRAPH_BASE}/${getMetaGraphApiVersion()}/${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value != null) url.searchParams.set(key, String(value))
  }
  url.searchParams.set("access_token", token)

  const res = await fetch(url.toString(), {
    method: "GET",
    // Catalog status changes slowly; cache briefly to avoid hammering Graph on refresh.
    next: { revalidate: 300 },
  })

  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = { raw: text }
    }
  }
  return { ok: res.ok, status: res.status, data }
}

function graphErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const err = (data as { error?: { message?: string } }).error
    if (err?.message) return err.message
  }
  return fallback
}

// ---------------------------------------------------------------------------
// Catalog summary
// ---------------------------------------------------------------------------

export interface MetaCatalogSummary {
  id: string
  name: string | null
  productCount: number | null
  feedCount: number | null
}

export async function getMetaCatalogSummary(): Promise<
  { ok: true; summary: MetaCatalogSummary } | { ok: false; status: number; error: string }
> {
  const catalogId = getMetaCatalogId()
  const token = getMetaCatalogAccessToken()
  if (!catalogId || !token) {
    return { ok: false, status: 503, error: "Meta Catalog API is not configured" }
  }

  const res = await metaGraphRequest(catalogId, { fields: "name,product_count,feed_count" }, token)
  if (!res.ok) {
    return { ok: false, status: res.status, error: graphErrorMessage(res.data, "catalog read failed") }
  }

  const data = res.data as { name?: string; product_count?: number; feed_count?: number }
  return {
    ok: true,
    summary: {
      id: catalogId,
      name: data.name ?? null,
      productCount: typeof data.product_count === "number" ? data.product_count : null,
      feedCount: typeof data.feed_count === "number" ? data.feed_count : null,
    },
  }
}

// ---------------------------------------------------------------------------
// Catalog products (status + item-level errors)
// ---------------------------------------------------------------------------

export type MetaReviewStatus = "approved" | "pending" | "rejected" | "outdated" | "unknown"

export interface MetaProductError {
  type: string
  message: string
  severity: string | null
}

export interface MetaCatalogProductDetail {
  /** Graph product node id. */
  productId: string
  /** retailer_id — equals the Reswell listing UUID. */
  retailerId: string
  name: string | null
  brand: string | null
  url: string | null
  imageUrl: string | null
  price: string | null
  availability: string | null
  condition: string | null
  reviewStatus: MetaReviewStatus
  visibility: string | null
  errors: MetaProductError[]
}

interface RawMetaProduct {
  id?: string
  retailer_id?: string
  name?: string
  brand?: string
  url?: string
  image_url?: string
  price?: string | number
  availability?: string
  condition?: string
  review_status?: string
  visibility?: string
  errors?: Array<{ type?: string; message?: string; severity?: string }>
}

interface RawProductsPage {
  data?: RawMetaProduct[]
  paging?: { cursors?: { after?: string }; next?: string }
  error?: { message?: string }
}

function normalizeReviewStatus(raw: string | undefined): MetaReviewStatus {
  switch ((raw ?? "").toLowerCase()) {
    case "approved":
      return "approved"
    case "pending":
      return "pending"
    case "rejected":
      return "rejected"
    case "outdated":
      return "outdated"
    default:
      return "unknown"
  }
}

function mapRawProduct(raw: RawMetaProduct): MetaCatalogProductDetail {
  return {
    productId: (raw.id ?? "").trim(),
    retailerId: (raw.retailer_id ?? "").trim(),
    name: raw.name?.trim() || null,
    brand: raw.brand?.trim() || null,
    url: raw.url?.trim() || null,
    imageUrl: raw.image_url?.trim() || null,
    price: raw.price != null ? String(raw.price) : null,
    availability: raw.availability ?? null,
    condition: raw.condition ?? null,
    reviewStatus: normalizeReviewStatus(raw.review_status),
    visibility: raw.visibility ?? null,
    errors: (raw.errors ?? []).map((e) => ({
      type: e.type?.trim() || "unknown",
      message: e.message?.trim() || (e.type?.trim() ?? "Unknown issue"),
      severity: e.severity?.trim() || null,
    })),
  }
}

export async function listMetaCatalogProducts(): Promise<
  | { ok: true; products: MetaCatalogProductDetail[] }
  | { ok: false; status: number; error: string }
> {
  const catalogId = getMetaCatalogId()
  const token = getMetaCatalogAccessToken()
  if (!catalogId || !token) {
    return { ok: false, status: 503, error: "Meta Catalog API is not configured" }
  }

  const fields =
    "id,retailer_id,name,brand,url,image_url,price,availability,condition,review_status,visibility,errors"
  const products: MetaCatalogProductDetail[] = []
  let after: string | undefined
  let pages = 0

  for (;;) {
    const res = await metaGraphRequest(
      `${catalogId}/products`,
      { fields, limit: PRODUCT_PAGE_LIMIT, after },
      token,
    )
    if (!res.ok) {
      return { ok: false, status: res.status, error: graphErrorMessage(res.data, "products read failed") }
    }

    const page = res.data as RawProductsPage
    for (const raw of page.data ?? []) {
      const mapped = mapRawProduct(raw)
      if (mapped.retailerId || mapped.productId) products.push(mapped)
    }

    pages += 1
    const next = page.paging?.cursors?.after
    if (!page.paging?.next || !next || pages >= MAX_PRODUCT_PAGES) break
    after = next
  }

  return { ok: true, products }
}

// ---------------------------------------------------------------------------
// Advantage+ catalog ad performance (optional, via Ads Insights product_id breakdown)
// ---------------------------------------------------------------------------

export interface MetaProductPerformanceRow {
  productId: string
  clicks: number
  impressions: number
  spend: number
  ctr: number
}

export interface MetaPerformanceDaily {
  date: string
  clicks: number
  impressions: number
  spend: number
}

export interface MetaCatalogPerformance {
  configured: true
  rangeDays: number
  totals: { clicks: number; impressions: number; spend: number; ctr: number }
  byProduct: MetaProductPerformanceRow[]
  daily: MetaPerformanceDaily[]
}

export interface MetaCatalogPerformanceUnavailable {
  configured: false
  reason: string
}

export type MetaCatalogPerformanceResult =
  | MetaCatalogPerformance
  | MetaCatalogPerformanceUnavailable

interface RawInsightsRow {
  product_id?: string
  clicks?: string
  impressions?: string
  spend?: string
  ctr?: string
  date_start?: string
}

interface RawInsightsResponse {
  data?: RawInsightsRow[]
  paging?: { next?: string; cursors?: { after?: string } }
  error?: { message?: string }
}

function toNumber(value: string | number | undefined | null): number {
  if (value == null) return 0
  const parsed = typeof value === "number" ? value : Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().slice(0, 10)
}

/** The product_id breakdown can return "retailer_id, catalog_id" — keep the retailer-matching token. */
function normalizeBreakdownProductId(raw: string | undefined, knownRetailerIds: Set<string>): string {
  const value = (raw ?? "").trim()
  if (!value) return ""
  if (knownRetailerIds.has(value)) return value
  const tokens = value.split(",").map((t) => t.trim()).filter(Boolean)
  for (const token of tokens) {
    if (knownRetailerIds.has(token)) return token
  }
  return tokens[0] ?? value
}

export async function getMetaCatalogPerformance(
  options: { days: number; knownRetailerIds?: Set<string> },
): Promise<MetaCatalogPerformanceResult> {
  const accountId = getMetaAdsAccountId()
  const token = getMetaAdsAccessToken()
  if (!accountId || !token) {
    return { configured: false, reason: "Meta Ads account is not connected." }
  }

  const days = options.days
  const since = isoDaysAgo(days)
  const until = isoDaysAgo(1)
  const timeRange = JSON.stringify({ since, until })
  const knownRetailerIds = options.knownRetailerIds ?? new Set<string>()

  try {
    const [byProductRes, dailyRes] = await Promise.all([
      metaGraphRequest(
        `act_${accountId}/insights`,
        {
          level: "ad",
          breakdowns: "product_id",
          fields: "clicks,impressions,spend,ctr",
          time_range: timeRange,
          limit: 1000,
        },
        token,
      ),
      metaGraphRequest(
        `act_${accountId}/insights`,
        {
          level: "account",
          fields: "clicks,impressions,spend",
          time_range: timeRange,
          time_increment: 1,
          limit: 500,
        },
        token,
      ),
    ])

    if (!byProductRes.ok) {
      return {
        configured: false,
        reason: graphErrorMessage(byProductRes.data, "Ads insights read failed"),
      }
    }

    const byProductData = byProductRes.data as RawInsightsResponse
    const productMap = new Map<string, MetaProductPerformanceRow>()
    for (const row of byProductData.data ?? []) {
      const id = normalizeBreakdownProductId(row.product_id, knownRetailerIds)
      if (!id) continue
      const clicks = toNumber(row.clicks)
      const impressions = toNumber(row.impressions)
      const spend = toNumber(row.spend)
      const existing = productMap.get(id)
      if (existing) {
        existing.clicks += clicks
        existing.impressions += impressions
        existing.spend += spend
        existing.ctr = existing.impressions > 0 ? existing.clicks / existing.impressions : 0
      } else {
        productMap.set(id, {
          productId: id,
          clicks,
          impressions,
          spend,
          ctr: impressions > 0 ? clicks / impressions : 0,
        })
      }
    }

    const daily: MetaPerformanceDaily[] = []
    if (dailyRes.ok) {
      const dailyData = dailyRes.data as RawInsightsResponse
      for (const row of dailyData.data ?? []) {
        if (!row.date_start) continue
        daily.push({
          date: row.date_start,
          clicks: toNumber(row.clicks),
          impressions: toNumber(row.impressions),
          spend: toNumber(row.spend),
        })
      }
      daily.sort((a, b) => a.date.localeCompare(b.date))
    }

    const totals = daily.reduce(
      (acc, row) => {
        acc.clicks += row.clicks
        acc.impressions += row.impressions
        acc.spend += row.spend
        return acc
      },
      { clicks: 0, impressions: 0, spend: 0 },
    )

    const byProduct = [...productMap.values()].sort((a, b) => b.clicks - a.clicks)

    // If the daily (account-level) call was unavailable, fall back to per-product sums.
    if (daily.length === 0) {
      for (const row of byProduct) {
        totals.clicks += row.clicks
        totals.impressions += row.impressions
        totals.spend += row.spend
      }
    }

    return {
      configured: true,
      rangeDays: days,
      totals: {
        ...totals,
        ctr: totals.impressions > 0 ? totals.clicks / totals.impressions : 0,
      },
      byProduct,
      daily,
    }
  } catch (e) {
    return {
      configured: false,
      reason: e instanceof Error ? e.message : "Could not load Meta Ads performance.",
    }
  }
}
