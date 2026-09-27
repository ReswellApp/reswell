/**
 * Push listing catalog state to Klaviyo so a live board is published
 * without waiting for the 6-hour custom-catalog feed pull.
 *
 * The feed remains the bulk source Klaviyo reads. These writes set `published`
 * and variant stock on the same `$custom` / `$default` catalog. If Klaviyo
 * rejects API writes because the catalog is feed-managed, callers stop.
 */

import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import {
  fetchKlaviyoCatalogListingById,
  fetchKlaviyoCatalogListingsByIds,
  fetchRecentlyUpdatedLiveKlaviyoCatalogListings,
  type KlaviyoCatalogSyncListing,
} from "@/lib/db/klaviyoCatalogFeed"
import {
  getKlaviyoApiKey,
  klaviyoGet,
  klaviyoWrite,
  mapWithConcurrency,
  type KlaviyoGetResult,
  type KlaviyoWriteResult,
} from "@/lib/klaviyo/api-client"
import {
  isKlaviyoCatalogListingLive,
  isKlaviyoCustomFeedManagedError,
  klaviyoCatalogCategoryCreateBody,
  klaviyoCatalogCompoundId,
  klaviyoCatalogItemPath,
  klaviyoCatalogItemVariantsPath,
  klaviyoCatalogItemWriteBody,
  klaviyoCatalogVariantPath,
  klaviyoCatalogVariantWriteBody,
} from "@/lib/klaviyo/catalog-api"
import { listingToKlaviyoCatalogFeedItem } from "@/lib/klaviyo/catalog-product"
import { createServiceRoleClient } from "@/lib/supabase/server"

const listingIdSchema = z.string().uuid()

const RECONCILE_UNPUBLISHED_LIMIT = 80
const RECONCILE_RECENT_LIMIT = 40
const RECONCILE_CONCURRENCY = 4
const RECENT_WINDOW_MS = 6 * 60 * 60 * 1000

export type KlaviyoCatalogSyncAction =
  | "published"
  | "unpublished"
  | "skipped"
  | "feed_managed"
  | "error"

export interface KlaviyoCatalogSyncResult {
  action: KlaviyoCatalogSyncAction
  listingId: string
  error?: string
}

export interface KlaviyoCatalogReconcileSummary {
  ok: boolean
  skipped: boolean
  reason?: string
  considered: number
  published: number
  unpublished: number
  skipped_items: number
  errors: number
  error_samples: Array<{ listingId: string; error: string }>
}

interface KlaviyoCatalogResource {
  id?: string
  attributes?: {
    external_id?: string
  }
}

interface KlaviyoCatalogListResponse {
  data?: KlaviyoCatalogResource[]
  links?: { next?: string | null }
}

let liveCategoryReady: Promise<KlaviyoWriteResult<unknown> | { ok: true; status: number }> | null =
  null

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function klaviyoWriteWithRetry<T>(
  method: "POST" | "PATCH",
  path: string,
  body: unknown,
): Promise<KlaviyoWriteResult<T>> {
  let last: KlaviyoWriteResult<T> | null = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    last = await klaviyoWrite<T>(method, path, body)
    if (last.ok || last.missingKey) return last
    const retriable = last.status === 429 || last.status >= 500
    if (!retriable || attempt === 4) return last
    await sleep(400 * attempt)
  }
  return last ?? { ok: false, status: 0, detail: "Klaviyo request failed" }
}

function feedManaged(listingId: string, detail: string): KlaviyoCatalogSyncResult | null {
  if (!isKlaviyoCustomFeedManagedError(detail)) return null
  return { action: "feed_managed", listingId, error: detail.slice(0, 300) }
}

async function ensureLiveCategory(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!liveCategoryReady) {
    liveCategoryReady = klaviyoWriteWithRetry(
      "POST",
      "/api/catalog-categories/",
      klaviyoCatalogCategoryCreateBody(),
    ).then((result) => {
      if (!result.ok && result.status !== 409) liveCategoryReady = null
      return result
    })
  }
  const result = await liveCategoryReady
  if ("missingKey" in result && result.missingKey) {
    return { ok: false, error: result.detail }
  }
  if (result.ok || result.status === 409) return { ok: true }
  return { ok: false, error: result.detail }
}

async function listVariantIds(listingId: string): Promise<
  | { ok: true; ids: string[] }
  | { ok: false; missing: true }
  | { ok: false; error: string; feedManaged?: boolean }
> {
  const listed = await klaviyoGet<KlaviyoCatalogListResponse>(
    klaviyoCatalogItemVariantsPath(listingId),
  )
  if (!listed.ok) {
    if (listed.status === 404) return { ok: false, missing: true }
    return {
      ok: false,
      error: listed.detail,
      feedManaged: isKlaviyoCustomFeedManagedError(listed.detail),
    }
  }
  const ids = (listed.data.data ?? [])
    .map((row) => row.id?.trim() ?? "")
    .filter((id) => id.length > 0)
  return { ok: true, ids }
}

async function upsertVariants(
  listing: KlaviyoCatalogSyncListing,
  published: boolean,
): Promise<KlaviyoCatalogSyncResult | null> {
  const item = listingToKlaviyoCatalogFeedItem(listing)
  const existing = await listVariantIds(listing.id)
  if (!existing.ok) {
    if ("missing" in existing && existing.missing) {
      if (!published) return null
    } else if ("feedManaged" in existing && existing.feedManaged) {
      return { action: "feed_managed", listingId: listing.id, error: existing.error }
    } else if (!("missing" in existing)) {
      return { action: "error", listingId: listing.id, error: existing.error }
    }
  }

  let variantIds = existing.ok ? existing.ids : []
  if (variantIds.length === 0) {
    if (!published) return null
    const created = await klaviyoWriteWithRetry(
      "POST",
      "/api/catalog-variants/",
      klaviyoCatalogVariantWriteBody({
        listingId: listing.id,
        item,
        published: true,
        mode: "create",
      }),
    )
    if (created.ok) return null
    if (created.status !== 409) {
      return (
        feedManaged(listing.id, created.detail) ?? {
          action: "error",
          listingId: listing.id,
          error: created.detail,
        }
      )
    }
    const retry = await listVariantIds(listing.id)
    if (!retry.ok) {
      return { action: "error", listingId: listing.id, error: created.detail }
    }
    if (retry.ids.length === 0) {
      return { action: "error", listingId: listing.id, error: created.detail }
    }
    variantIds = retry.ids
  }

  for (const variantId of variantIds) {
    const patched = await klaviyoWriteWithRetry(
      "PATCH",
      klaviyoCatalogVariantPath(variantId),
      klaviyoCatalogVariantWriteBody({
        listingId: listing.id,
        item,
        published,
        variantCompoundId: variantId,
        mode: "update",
      }),
    )
    if (!patched.ok) {
      return (
        feedManaged(listing.id, patched.detail) ?? {
          action: "error",
          listingId: listing.id,
          error: patched.detail,
        }
      )
    }
  }
  return null
}

async function upsertCatalogItem(
  listing: KlaviyoCatalogSyncListing,
  published: boolean,
): Promise<KlaviyoCatalogSyncResult | null> {
  const item = listingToKlaviyoCatalogFeedItem(listing)
  const existing = await klaviyoGet(klaviyoCatalogItemPath(listing.id))
  if (!existing.ok && existing.status !== 404) {
    return (
      feedManaged(listing.id, existing.detail) ?? {
        action: "error",
        listingId: listing.id,
        error: existing.detail,
      }
    )
  }

  if (!existing.ok) {
    if (!published) return { action: "skipped", listingId: listing.id }
    const category = await ensureLiveCategory()
    if (!category.ok) {
      return (
        feedManaged(listing.id, category.error) ?? {
          action: "error",
          listingId: listing.id,
          error: category.error,
        }
      )
    }
    const created = await klaviyoWriteWithRetry(
      "POST",
      "/api/catalog-items/",
      klaviyoCatalogItemWriteBody({
        externalId: listing.id,
        item,
        published: true,
        mode: "create",
      }),
    )
    if (!created.ok && created.status !== 409) {
      return (
        feedManaged(listing.id, created.detail) ?? {
          action: "error",
          listingId: listing.id,
          error: created.detail,
        }
      )
    }
    return null
  }

  const patched = await klaviyoWriteWithRetry(
    "PATCH",
    klaviyoCatalogItemPath(listing.id),
    klaviyoCatalogItemWriteBody({
      externalId: listing.id,
      item,
      published,
      mode: "update",
    }),
  )
  if (!patched.ok) {
    return (
      feedManaged(listing.id, patched.detail) ?? {
        action: "error",
        listingId: listing.id,
        error: patched.detail,
      }
    )
  }
  return null
}

export async function syncKlaviyoCatalogListing(
  listing: KlaviyoCatalogSyncListing,
): Promise<KlaviyoCatalogSyncResult> {
  if (!getKlaviyoApiKey()) {
    return { action: "skipped", listingId: listing.id }
  }

  const published = isKlaviyoCatalogListingLive(listing)
  const itemResult = await upsertCatalogItem(listing, published)
  if (itemResult?.action === "skipped") return itemResult
  if (itemResult?.action === "feed_managed" || itemResult?.action === "error") return itemResult

  const variantResult = await upsertVariants(listing, published)
  if (variantResult) return variantResult

  if (published) {
    const republish = await upsertCatalogItem(listing, true)
    if (republish?.action === "feed_managed" || republish?.action === "error") return republish
  }

  return { action: published ? "published" : "unpublished", listingId: listing.id }
}

export async function syncListingToKlaviyoCatalog(
  supabase: SupabaseClient,
  listingId: string,
): Promise<KlaviyoCatalogSyncResult> {
  const parsed = listingIdSchema.safeParse(listingId)
  if (!parsed.success) {
    return { action: "error", listingId: String(listingId), error: "Invalid listing id" }
  }
  if (!getKlaviyoApiKey()) {
    return { action: "skipped", listingId: parsed.data }
  }

  try {
    const listing = await fetchKlaviyoCatalogListingById(supabase, parsed.data)
    if (!listing) {
      return unpublishKlaviyoCatalogItem(parsed.data)
    }
    return syncKlaviyoCatalogListing(listing)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[klaviyo-catalog] sync failed", { listingId: parsed.data, message })
    return { action: "error", listingId: parsed.data, error: message }
  }
}

async function unpublishKlaviyoCatalogItem(listingId: string): Promise<KlaviyoCatalogSyncResult> {
  const existing = await klaviyoGet(klaviyoCatalogItemPath(listingId))
  if (!existing.ok) {
    if (existing.status === 404 || existing.missingKey) {
      return { action: "skipped", listingId }
    }
    return (
      feedManaged(listingId, existing.detail) ?? {
        action: "error",
        listingId,
        error: existing.detail,
      }
    )
  }

  const patched = await klaviyoWriteWithRetry("PATCH", klaviyoCatalogItemPath(listingId), {
    data: {
      type: "catalog-item",
      id: klaviyoCatalogCompoundId(listingId),
      attributes: { published: false },
    },
  })
  if (!patched.ok) {
    return (
      feedManaged(listingId, patched.detail) ?? {
        action: "error",
        listingId,
        error: patched.detail,
      }
    )
  }

  const variants = await listVariantIds(listingId)
  if (!variants.ok) {
    if (!("missing" in variants) || !variants.missing) {
      const detail = "error" in variants ? variants.error : "Could not list catalog variants"
      return (
        feedManaged(listingId, detail) ?? {
          action: "error",
          listingId,
          error: detail,
        }
      )
    }
  } else {
    for (const variantId of variants.ids) {
      const variantPatch = await klaviyoWriteWithRetry(
        "PATCH",
        klaviyoCatalogVariantPath(variantId),
        {
          data: {
            type: "catalog-variant",
            id: variantId,
            attributes: {
              published: false,
              inventory_quantity: 0,
              inventory_policy: 1,
            },
          },
        },
      )
      if (!variantPatch.ok) {
        return (
          feedManaged(listingId, variantPatch.detail) ?? {
            action: "error",
            listingId,
            error: variantPatch.detail,
          }
        )
      }
    }
  }

  return { action: "unpublished", listingId }
}

/**
 * Fire-and-forget. Listing publish, price, sold, and hide paths already call
 * the Google Merchant helper; that helper also calls this so Klaviyo sees the
 * same visibility change without a second fan-out.
 */
export function syncListingToKlaviyoCatalogBestEffort(listingId: string): void {
  const run = async () => {
    try {
      const supabase = createServiceRoleClient()
      const result = await syncListingToKlaviyoCatalog(supabase, listingId)
      if (result.action === "error" || result.action === "feed_managed") {
        console.error("[klaviyo-catalog] sync failed", {
          listingId,
          action: result.action,
          error: result.error,
        })
      }
    } catch (error) {
      console.error("[klaviyo-catalog] sync threw", {
        listingId,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  try {
    after(run)
  } catch {
    void run()
  }
}

async function listUnpublishedExternalIds(): Promise<
  | { ok: true; ids: string[] }
  | { ok: false; feedManaged: boolean; error: string }
> {
  const ids: string[] = []
  let next: string | null = "/api/catalog-items/"
  let pages = 0
  const search: Record<string, string> = {
    filter: "equals(published,false)",
    "page[size]": "50",
  }

  while (next && ids.length < RECONCILE_UNPUBLISHED_LIMIT && pages < 3) {
    const page: KlaviyoGetResult<KlaviyoCatalogListResponse> =
      await klaviyoGet<KlaviyoCatalogListResponse>(next, pages === 0 ? search : undefined)
    if (!page.ok) {
      return {
        ok: false,
        feedManaged: isKlaviyoCustomFeedManagedError(page.detail),
        error: page.detail,
      }
    }
    for (const row of page.data.data ?? []) {
      const externalId = row.attributes?.external_id?.trim()
      if (externalId && listingIdSchema.safeParse(externalId).success) {
        ids.push(externalId)
      }
      if (ids.length >= RECONCILE_UNPUBLISHED_LIMIT) break
    }
    next = page.data.links?.next ?? null
    pages += 1
  }

  return { ok: true, ids }
}

function emptySummary(partial: Partial<KlaviyoCatalogReconcileSummary>): KlaviyoCatalogReconcileSummary {
  return {
    ok: partial.ok ?? true,
    skipped: partial.skipped ?? false,
    reason: partial.reason,
    considered: partial.considered ?? 0,
    published: partial.published ?? 0,
    unpublished: partial.unpublished ?? 0,
    skipped_items: partial.skipped_items ?? 0,
    errors: partial.errors ?? 0,
    error_samples: partial.error_samples ?? [],
  }
}

export async function reconcileKlaviyoCatalogPublishedState(
  supabase: SupabaseClient,
): Promise<KlaviyoCatalogReconcileSummary> {
  if (!getKlaviyoApiKey()) {
    return emptySummary({ skipped: true, reason: "KLAVIYO_API_KEY not set" })
  }

  const unpublished = await listUnpublishedExternalIds()
  if (!unpublished.ok && unpublished.feedManaged) {
    console.error("[klaviyo-catalog] catalog is feed-managed", { error: unpublished.error })
    return emptySummary({
      skipped: true,
      reason: unpublished.error.slice(0, 300),
    })
  }
  if (!unpublished.ok) {
    console.error("[klaviyo-catalog] unpublished list failed", { error: unpublished.error })
  }

  const since = new Date(Date.now() - RECENT_WINDOW_MS).toISOString()
  const recent = await fetchRecentlyUpdatedLiveKlaviyoCatalogListings(
    supabase,
    since,
    RECONCILE_RECENT_LIMIT,
  )
  const unpublishedIds = unpublished.ok ? unpublished.ids : []
  const ids = [...new Set([...unpublishedIds, ...recent.map((row) => row.id)])]
  if (!unpublished.ok && ids.length === 0) {
    return emptySummary({
      ok: false,
      reason: unpublished.error.slice(0, 300),
    })
  }
  const rows = await fetchKlaviyoCatalogListingsByIds(supabase, ids)
  const byId = new Map(rows.map((row) => [row.id, row]))

  const summary = emptySummary({ considered: ids.length })
  let stop = false

  await mapWithConcurrency(ids, RECONCILE_CONCURRENCY, async (listingId) => {
    if (stop) return
    const row = byId.get(listingId)
    const result = row
      ? await syncKlaviyoCatalogListing(row)
      : await unpublishKlaviyoCatalogItem(listingId)

    if (result.action === "published") summary.published += 1
    else if (result.action === "unpublished") summary.unpublished += 1
    else if (result.action === "skipped") summary.skipped_items += 1
    else if (result.action === "feed_managed") {
      stop = true
      summary.skipped = true
      summary.reason = result.error
      summary.errors += 1
    } else {
      summary.errors += 1
      summary.ok = false
      if (summary.error_samples.length < 5 && result.error) {
        summary.error_samples.push({ listingId, error: result.error.slice(0, 300) })
      }
    }
  })

  return summary
}
