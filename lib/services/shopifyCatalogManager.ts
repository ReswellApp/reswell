import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { dbGetShopifyConnectionForUser } from "@/lib/db/shopifyConnections"
import {
  dbListShopifyLinkedListings,
  dbSummarizeShopifyLinkedListings,
  type ShopifyLinkedListingRow,
} from "@/lib/db/shopifyLinkedListings"
import {
  dbCountShopifySyncJobsByStatus,
  dbCountUnresolvedShopifyInventoryJobs,
  dbEnqueueShopifyJob,
} from "@/lib/db/shopifyQueue"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { fetchShopifyVariantPresence } from "@/lib/shopify/catalog"
import { areShopifyInventoryWritesEnabled } from "@/lib/shopify/config"
import {
  deriveShopifyLinkedListingState,
  shopifyAdminProductUrl,
  shopifyVariantTitle,
} from "@/lib/shopify/linked-listings"
import type {
  ShopifyCatalogManagerData,
  ShopifyConnectionRow,
  ShopifyLinkedListing,
  ShopifyLinkedListingFilter,
  ShopifyVariantPresence,
} from "@/lib/shopify/types"
import type { ServiceResult } from "@/lib/services/shopifyConnection"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"

export const SHOPIFY_LINKED_LISTINGS_PAGE_SIZE = 25

async function loadPresence(
  service: SupabaseClient,
  connection: ShopifyConnectionRow,
  rows: ShopifyLinkedListingRow[],
): Promise<Map<string, ShopifyVariantPresence | null> | null> {
  const variantIds = rows
    .filter((row) => row.selected)
    .map((row) => row.shopify_variant_gid)
  if (variantIds.length === 0) return new Map()
  try {
    const accessToken = await getShopifyAccessToken(service, connection)
    return await fetchShopifyVariantPresence({
      shopDomain: connection.shop_domain,
      accessToken,
      variantIds,
    })
  } catch (error) {
    console.error("[shopify] linked listing presence", {
      connectionId: connection.id,
      error,
    })
    return null
  }
}

function toLinkedListing(
  row: ShopifyLinkedListingRow,
  shopDomain: string,
  presence: ShopifyVariantPresence | null | undefined,
): ShopifyLinkedListing {
  const listing = row.listings
  const price = listing.price == null ? null : Number(listing.price)
  return {
    mappingId: row.id,
    listingId: listing.id,
    productId: row.shopify_product_gid,
    variantId: row.shopify_variant_gid,
    title: presence?.productTitle || listing.title,
    variantTitle: shopifyVariantTitle(listing.title, presence),
    imageUrl: listing.primary_image_url,
    price: price != null && Number.isFinite(price) ? price : null,
    shopifyQuantity: presence ? presence.inventoryQuantity : null,
    reswellStock: Math.max(0, listing.stock_quantity ?? 0),
    reswellStatus: listing.status,
    section: row.reswell_section,
    slug: listing.slug,
    syncStatus: row.sync_status,
    selected: row.selected,
    lastSyncedAt: row.last_synced_at,
    lastError: row.last_error,
    shopifyProductStatus: presence?.productStatus ?? null,
    state: deriveShopifyLinkedListingState({
      syncStatus: row.sync_status,
      reswellStatus: listing.status,
      presence,
    }),
    adminUrl: shopifyAdminProductUrl(shopDomain, row.shopify_product_gid),
  }
}

export async function getMerchantShopifyCatalog(input: {
  userId: string
  filter: ShopifyLinkedListingFilter
  section: PeerListingSection | null
  query: string
  page: number
}): Promise<ServiceResult<ShopifyCatalogManagerData | null>> {
  try {
    const service = createServiceRoleClient()
    const connection = await dbGetShopifyConnectionForUser(service, input.userId)
    if (!connection) return { ok: true, data: null }
    const canReadShopify =
      connection.status === "active" && connection.sync_enabled

    const [summary, jobs, pendingInventoryWrites, page] = await Promise.all([
      dbSummarizeShopifyLinkedListings(service, connection.id),
      dbCountShopifySyncJobsByStatus(service, connection.id),
      dbCountUnresolvedShopifyInventoryJobs(service, connection.id),
      dbListShopifyLinkedListings(service, {
        connectionId: connection.id,
        filter: input.filter,
        section: input.section,
        query: input.query,
        page: input.page,
        pageSize: SHOPIFY_LINKED_LISTINGS_PAGE_SIZE,
      }),
    ])
    const presence = canReadShopify
      ? await loadPresence(service, connection, page.rows)
      : null
    const listings = page.rows.map((row) =>
      toLinkedListing(row, connection.shop_domain, presence?.get(row.shopify_variant_gid)),
    )
    const missingInShopify = listings.filter(
      (listing) => presence?.get(listing.variantId) === null,
    ).length

    if (canReadShopify && (missingInShopify > 0 || summary.needsRemoval > 0)) {
      await dbEnqueueShopifyJob(service, {
        connectionId: connection.id,
        jobType: "reconcile_connection",
        payload: { connectionId: connection.id },
        dedupeKey: `reconcile:${connection.id}`,
      })
    }

    return {
      ok: true,
      data: {
        summary,
        health: {
          queuedJobs: jobs.queued,
          retryJobs: jobs.retry,
          deadJobs: jobs.dead,
          pendingInventoryWrites,
          inventoryWritesEnabled:
            areShopifyInventoryWritesEnabled() &&
            connection.inventory_write_enabled,
        },
        listings: {
          listings,
          total: page.total,
          page: input.page,
          pageSize: SHOPIFY_LINKED_LISTINGS_PAGE_SIZE,
          shopifyCheck: !canReadShopify
            ? "skipped"
            : presence
              ? "ok"
              : "unavailable",
          missingInShopify,
        },
      },
    }
  } catch (error) {
    console.error("[shopify] catalog manager", { userId: input.userId, error })
    return { ok: false, status: 500, error: "Could not load Shopify listings" }
  }
}
