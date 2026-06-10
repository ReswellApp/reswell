import type { SupabaseClient } from "@supabase/supabase-js"
import { buildMetaCatalogFeed } from "@/lib/services/metaCatalogFeed"
import { getMetaPixelId } from "@/lib/meta/pixel-config"
import { isMetaCapiEnabled, isMetaTestEventCodeConfigured } from "@/lib/meta/conversions-api"
import {
  getMetaAdsAccountId,
  getMetaCatalogId,
  getMetaCatalogPerformance,
  getMetaCatalogSetupHint,
  getMetaCatalogSummary,
  getMetaGraphApiVersion,
  isMetaAdsInsightsConfigured,
  isMetaCatalogApiConfigured,
  listMetaCatalogProducts,
  type MetaCatalogPerformanceResult,
  type MetaCatalogProductDetail,
  type MetaCatalogSummary,
} from "@/lib/meta/catalog-api"

/**
 * Read-only Meta Commerce catalog intelligence for the admin dashboard — the Meta counterpart to
 * lib/services/googleMerchantInsights.ts.
 *
 * Three layers, each independently optional:
 *  1. Feed health (always available, no Meta creds) — eligible Reswell listings vs. what the CSV
 *     feed would emit, sourced from the same pipeline Meta pulls.
 *  2. Catalog Graph API (META_CATALOG_ID + token) — live product review_status + item-level errors.
 *  3. Ads Insights (META_ADS_ACCOUNT_ID + token) — Advantage+ catalog ad clicks/impressions/spend.
 *
 * Plus a Pixel/CAPI configuration panel (events that feed dynamic ads).
 */

export type MetaProductStatus = "approved" | "pending" | "rejected" | "outdated" | "unknown"

export interface MetaCatalogInsightsSummary {
  total: number
  approved: number
  pending: number
  rejected: number
  outdated: number
  unknown: number
  withErrors: number
  totalErrors: number
}

export interface MetaCatalogMissingListing {
  retailerId: string
  title: string
  link: string
  price: string
}

export interface MetaCatalogCoverage {
  eligibleListings: number
  productsInCatalog: number
  syncedEligible: number
  missingFromCatalog: MetaCatalogMissingListing[]
  orphanRetailerIds: string[]
}

export interface MetaCatalogTopIssue {
  type: string
  message: string
  severity: string | null
  count: number
  sampleRetailerIds: string[]
}

export interface MetaPixelStatus {
  pixelId: string | null
  capiEnabled: boolean
  testEventCodeSet: boolean
}

export interface MetaCatalogInsights {
  configured: boolean
  reason?: string
  generatedAt: string
  rangeDays: number
  catalog: {
    catalogId: string | null
    name: string | null
    productCount: number | null
    feedCount: number | null
    graphApiVersion: string
    adsConnected: boolean
  }
  feed: {
    eligibleListings: number
    feedSecretSet: boolean
  }
  pixel: MetaPixelStatus
  summary: MetaCatalogInsightsSummary
  products: MetaCatalogProductDetail[]
  performance: MetaCatalogPerformanceResult
  coverage: MetaCatalogCoverage
  topIssues: MetaCatalogTopIssue[]
}

const EMPTY_SUMMARY: MetaCatalogInsightsSummary = {
  total: 0,
  approved: 0,
  pending: 0,
  rejected: 0,
  outdated: 0,
  unknown: 0,
  withErrors: 0,
  totalErrors: 0,
}

function summarize(products: MetaCatalogProductDetail[]): MetaCatalogInsightsSummary {
  const summary: MetaCatalogInsightsSummary = { ...EMPTY_SUMMARY }
  for (const product of products) {
    summary.total += 1
    summary[product.reviewStatus] += 1
    if (product.errors.length > 0) {
      summary.withErrors += 1
      summary.totalErrors += product.errors.length
    }
  }
  return summary
}

function buildTopIssues(products: MetaCatalogProductDetail[]): MetaCatalogTopIssue[] {
  const byType = new Map<string, MetaCatalogTopIssue>()
  for (const product of products) {
    for (const issue of product.errors) {
      const existing = byType.get(issue.type)
      if (existing) {
        existing.count += 1
        if (existing.sampleRetailerIds.length < 5 && product.retailerId) {
          existing.sampleRetailerIds.push(product.retailerId)
        }
      } else {
        byType.set(issue.type, {
          type: issue.type,
          message: issue.message,
          severity: issue.severity,
          count: 1,
          sampleRetailerIds: product.retailerId ? [product.retailerId] : [],
        })
      }
    }
  }
  return [...byType.values()].sort((a, b) => b.count - a.count)
}

function pixelStatus(): MetaPixelStatus {
  return {
    pixelId: getMetaPixelId(),
    capiEnabled: isMetaCapiEnabled(),
    testEventCodeSet: isMetaTestEventCodeConfigured(),
  }
}

/**
 * Full dashboard payload. Never throws — returns a `configured: false` shape (with feed + pixel
 * health still populated) when the Catalog Graph API is not connected.
 */
export async function buildMetaCatalogInsights(
  supabase: SupabaseClient,
  options?: { days?: number },
): Promise<MetaCatalogInsights> {
  const days = options?.days ?? 28
  const generatedAt = new Date().toISOString()
  const graphApiVersion = getMetaGraphApiVersion()
  const adsConnected = isMetaAdsInsightsConfigured()

  // Layer 1 — feed health (always available). Mirrors what Meta pulls from the CSV feed.
  const feedItems = await buildMetaCatalogFeed(supabase)
  const eligibleByRetailerId = new Map(feedItems.map((item) => [item.id, item]))
  const feedSecretSet = Boolean(process.env.META_CATALOG_FEED_SECRET?.trim())

  const baseCatalog = {
    catalogId: getMetaCatalogId(),
    name: null as string | null,
    productCount: null as number | null,
    feedCount: null as number | null,
    graphApiVersion,
    adsConnected,
  }

  if (!isMetaCatalogApiConfigured()) {
    return {
      configured: false,
      reason: getMetaCatalogSetupHint() || "Meta Catalog API is not connected.",
      generatedAt,
      rangeDays: days,
      catalog: baseCatalog,
      feed: { eligibleListings: feedItems.length, feedSecretSet },
      pixel: pixelStatus(),
      summary: { ...EMPTY_SUMMARY },
      products: [],
      performance: { configured: false, reason: "Meta Ads account is not connected." },
      coverage: {
        eligibleListings: feedItems.length,
        productsInCatalog: 0,
        syncedEligible: 0,
        missingFromCatalog: [],
        orphanRetailerIds: [],
      },
      topIssues: [],
    }
  }

  const [productsResult, summaryResult] = await Promise.all([
    listMetaCatalogProducts(),
    getMetaCatalogSummary(),
  ])

  const catalog = {
    ...baseCatalog,
    ...(summaryResult.ok
      ? {
          name: summaryResult.summary.name,
          productCount: summaryResult.summary.productCount,
          feedCount: summaryResult.summary.feedCount,
        }
      : {}),
  } satisfies MetaCatalogInsights["catalog"]

  if (!productsResult.ok) {
    return {
      configured: false,
      reason: productsResult.error,
      generatedAt,
      rangeDays: days,
      catalog,
      feed: { eligibleListings: feedItems.length, feedSecretSet },
      pixel: pixelStatus(),
      summary: { ...EMPTY_SUMMARY },
      products: [],
      performance: { configured: false, reason: "Meta Ads account is not connected." },
      coverage: {
        eligibleListings: feedItems.length,
        productsInCatalog: 0,
        syncedEligible: 0,
        missingFromCatalog: [],
        orphanRetailerIds: [],
      },
      topIssues: [],
    }
  }

  const products = productsResult.products
  const catalogRetailerIds = new Set(products.map((p) => p.retailerId).filter(Boolean))

  // Layer 3 — ads performance (optional), matched by retailer id.
  const performance = await getMetaCatalogPerformance({
    days,
    knownRetailerIds: catalogRetailerIds,
  })

  // Coverage: eligible feed listings vs. catalog membership.
  const missingFromCatalog: MetaCatalogMissingListing[] = []
  let syncedEligible = 0
  for (const [retailerId, item] of eligibleByRetailerId) {
    if (catalogRetailerIds.has(retailerId)) {
      syncedEligible += 1
    } else if (missingFromCatalog.length < 100) {
      missingFromCatalog.push({
        retailerId,
        title: item.title,
        link: item.link,
        price: item.price,
      })
    }
  }

  const orphanRetailerIds: string[] = []
  for (const retailerId of catalogRetailerIds) {
    if (!eligibleByRetailerId.has(retailerId)) orphanRetailerIds.push(retailerId)
  }

  return {
    configured: true,
    generatedAt,
    rangeDays: days,
    catalog,
    feed: { eligibleListings: feedItems.length, feedSecretSet },
    pixel: pixelStatus(),
    summary: summarize(products),
    products,
    performance,
    coverage: {
      eligibleListings: eligibleByRetailerId.size,
      productsInCatalog: catalogRetailerIds.size,
      syncedEligible,
      missingFromCatalog,
      orphanRetailerIds,
    },
    topIssues: buildTopIssues(products),
  }
}
