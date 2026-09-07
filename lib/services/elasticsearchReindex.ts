/**
 * Elasticsearch reindex from Supabase (listings, brands, fin catalog,
 * sellers, forum threads). Admin Tools runs a full rebuild; the twice-daily cron
 * passes `catchUpSince` for recent listings/sellers/threads only.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateSellCatalogSearch } from "@/lib/cache/revalidate-sell-catalog-search"
import {
  brandRowToSearchDoc,
  ensureBrandsIndex,
  indexBrandDocument,
} from "@/lib/elasticsearch/brands-index"
import {
  ensureFinCatalogIndex,
  reindexFinCatalogFromSupabase,
} from "@/lib/elasticsearch/fin-catalog-index"
import {
  ensureSellCatalogIndex,
  reindexSellCatalogFromSupabase,
} from "@/lib/elasticsearch/sell-catalog-index"
import {
  bulkIndexListingDocuments,
  ensureListingsIndex,
  listingRowToSearchDocFromRow,
  LISTING_SEARCH_DOC_SELECT,
  type ListingSearchDoc,
  type ListingSearchDocRow,
} from "@/lib/elasticsearch/listings-index"
import {
  deleteSellerDocument,
  ensureSellersIndex,
  indexSellerDocument,
  profileRowToSellerDoc,
  type SellerProfileRow,
} from "@/lib/elasticsearch/sellers-index"
import {
  ensureForumThreadsIndex,
  forumThreadRowToSearchDoc,
  indexForumThreadDocument,
} from "@/lib/elasticsearch/forum-threads-index"
import { getElasticsearchClient } from "@/lib/elasticsearch/client"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import { ELASTICSEARCH_INDEXED_LISTING_SECTIONS } from "@/lib/elasticsearch/listing-sections"
import { isListingExternallyIndexable } from "@/lib/listing-public-visibility"

export type ElasticsearchReindexSummary = {
  indexed: number
  errors: number
  brandsIndexed: number
  brandErrors: number
  finCatalogBrandsIndexed: number
  finCatalogModelsIndexed: number
  finCatalogVariantsIndexed: number
  finCatalogErrors: number
  sellCatalogBrandsIndexed: number
  sellCatalogModelsIndexed: number
  sellCatalogErrors: number
  sellersIndexed: number
  sellersRemoved: number
  sellerErrors: number
  forumThreadsIndexed: number
  forumThreadErrors: number
}

export type ElasticsearchReindexResult =
  | { ok: true; summary: ElasticsearchReindexSummary }
  | { ok: false; error: string; status: number }

const PAGE_SIZE = 200

/**
 * Twice-daily cron lookback. Live sync + the listings webhook keep the index
 * current; this only covers a missed run. A 26h hourly window was rewriting
 * the same docs ~26× (Elastic Serverless ingest VCUs).
 */
export const ELASTICSEARCH_CATCH_UP_LOOKBACK_MS = 14 * 60 * 60 * 1000

export type ElasticsearchReindexOptions = {
  /**
   * When set, only reindex listings/threads/sellers touched since this instant.
   * Skips full brand + catalog rebuilds (those have live sync + admin reindex).
   */
  catchUpSince?: Date
}

/**
 * Reindex searchable Elasticsearch surfaces from Supabase.
 * Callers must pass a service-role (or otherwise privileged) client.
 */
export async function reindexElasticsearchFromSupabase(
  supabase: SupabaseClient,
  options?: ElasticsearchReindexOptions,
): Promise<ElasticsearchReindexResult> {
  if (!isElasticsearchConfigured()) {
    return {
      ok: false,
      status: 503,
      error:
        "Elasticsearch is not configured. Set ELASTICSEARCH_URL plus ELASTICSEARCH_API_KEY (or username/password), or ELASTICSEARCH_ALLOW_ANONYMOUS=true for a local unsecured cluster.",
    }
  }

  const es = getElasticsearchClient()
  if (!es) {
    return { ok: false, status: 503, error: "Elasticsearch client unavailable" }
  }

  try {
    await ensureListingsIndex()
    await ensureBrandsIndex()
    await ensureFinCatalogIndex()
    await ensureSellCatalogIndex()
    await ensureSellersIndex()
    await ensureForumThreadsIndex()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 503, error: `Elasticsearch index setup failed: ${msg}` }
  }

  const catchUpSince = options?.catchUpSince
  const catchUpIso = catchUpSince?.toISOString()
  const isCatchUp = Boolean(catchUpIso)

  let indexed = 0
  let errors = 0
  let from = 0

  for (;;) {
    let listingQuery = supabase
      .from("listings")
      .select(LISTING_SEARCH_DOC_SELECT)
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
      .in("section", [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS])
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (catchUpIso) {
      listingQuery = listingQuery.gte("updated_at", catchUpIso)
    }

    const { data: rows, error } = await listingQuery

    if (error) {
      return { ok: false, status: 500, error: error.message }
    }

    if (!rows?.length) break

    const docs: ListingSearchDoc[] = []
    for (const row of rows as ListingSearchDocRow[]) {
      try {
        if (
          !isListingExternallyIndexable({
            status: String(row.status ?? ""),
            title: row.title,
            hidden_from_site: row.hidden_from_site,
            archived_at: row.archived_at,
          })
        ) {
          continue
        }
        docs.push(listingRowToSearchDocFromRow(row))
      } catch {
        errors++
      }
    }

    const bulk = await bulkIndexListingDocuments(docs)
    indexed += bulk.indexed
    errors += bulk.errors

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  let brandsIndexed = 0
  let brandErrors = 0

  if (!isCatchUp) {
    let brandFrom = 0
    for (;;) {
      const { data: brandRows, error: brandListError } = await supabase
        .from("brands")
        .select("id, name, slug, short_description, lead_shaper_name, location_label, founder_name")
        .order("name", { ascending: true })
        .range(brandFrom, brandFrom + PAGE_SIZE - 1)

      if (brandListError) {
        return { ok: false, status: 500, error: brandListError.message }
      }

      if (!brandRows?.length) break

      for (const row of brandRows) {
        try {
          const doc = brandRowToSearchDoc(row as Parameters<typeof brandRowToSearchDoc>[0])
          await indexBrandDocument(doc)
          brandsIndexed++
        } catch {
          brandErrors++
        }
      }

      if (brandRows.length < PAGE_SIZE) break
      brandFrom += PAGE_SIZE
    }
  }

  let finCatalogBrandsIndexed = 0
  let finCatalogModelsIndexed = 0
  let finCatalogVariantsIndexed = 0
  let finCatalogErrors = 0
  let sellCatalogBrandsIndexed = 0
  let sellCatalogModelsIndexed = 0
  let sellCatalogErrors = 0

  if (!isCatchUp) {
    try {
      const finCatalog = await reindexFinCatalogFromSupabase(supabase)
      finCatalogBrandsIndexed = finCatalog.brandsIndexed
      finCatalogModelsIndexed = finCatalog.modelsIndexed
      finCatalogVariantsIndexed = finCatalog.variantsIndexed
      finCatalogErrors = finCatalog.errors
    } catch (err) {
      console.error("[elasticsearchReindex] fin catalog reindex failed:", err)
      finCatalogErrors++
    }

    try {
      const sellCatalog = await reindexSellCatalogFromSupabase(supabase)
      sellCatalogBrandsIndexed = sellCatalog.brandsIndexed
      sellCatalogModelsIndexed = sellCatalog.modelsIndexed
      sellCatalogErrors = sellCatalog.errors
      revalidateSellCatalogSearch()
    } catch (err) {
      console.error("[elasticsearchReindex] sell catalog reindex failed:", err)
      sellCatalogErrors++
    }
  }

  const activeListingUserIds = new Set<string>()
  const catchUpSellerIds = new Set<string>()
  {
    const activeListingPageSize = 1000
    let activeListingFrom = 0
    for (;;) {
      let activeQuery = supabase
        .from("listings")
        .select("user_id")
        .eq("status", "active")
        .eq("hidden_from_site", false)
        .is("archived_at", null)
        .range(activeListingFrom, activeListingFrom + activeListingPageSize - 1)

      if (catchUpIso) {
        activeQuery = activeQuery.gte("updated_at", catchUpIso)
      }

      const { data: rows, error } = await activeQuery

      if (error) {
        return { ok: false, status: 500, error: error.message }
      }
      if (!rows?.length) break

      for (const row of rows) {
        const uid = (row as { user_id?: string }).user_id
        if (uid) {
          activeListingUserIds.add(uid)
          if (isCatchUp) catchUpSellerIds.add(uid)
        }
      }
      if (rows.length < activeListingPageSize) break
      activeListingFrom += activeListingPageSize
    }
  }

  let sellersIndexed = 0
  let sellersRemoved = 0
  let sellerErrors = 0

  if (isCatchUp) {
    const sellerIdList = [...catchUpSellerIds]
    for (let i = 0; i < sellerIdList.length; i += PAGE_SIZE) {
      const chunk = sellerIdList.slice(i, i + PAGE_SIZE)
      const { data: sellerRows, error: sellerListError } = await supabase
        .from("profiles")
        .select(
          "id, seller_slug, display_name, shop_name, shop_description, bio, city, shop_address, is_shop, shop_verified",
        )
        .in("id", chunk)

      if (sellerListError) {
        return { ok: false, status: 500, error: sellerListError.message }
      }

      for (const row of (sellerRows ?? []) as SellerProfileRow[]) {
        try {
          const hasListings = true
          if (!row.seller_slug) continue
          await indexSellerDocument(profileRowToSellerDoc(row, hasListings))
          sellersIndexed++
        } catch {
          sellerErrors++
        }
      }
    }
  } else {
    let sellerFrom = 0
    for (;;) {
      const { data: sellerRows, error: sellerListError } = await supabase
        .from("profiles")
        .select(
          "id, seller_slug, display_name, shop_name, shop_description, bio, city, shop_address, is_shop, shop_verified",
        )
        .order("id", { ascending: true })
        .range(sellerFrom, sellerFrom + PAGE_SIZE - 1)

      if (sellerListError) {
        return { ok: false, status: 500, error: sellerListError.message }
      }
      if (!sellerRows?.length) break

      for (const row of sellerRows as SellerProfileRow[]) {
        try {
          const hasListings = activeListingUserIds.has(row.id)
          const eligible = Boolean(row.is_shop) || hasListings
          if (!eligible || !row.seller_slug) {
            await deleteSellerDocument(row.id)
            sellersRemoved++
            continue
          }
          await indexSellerDocument(profileRowToSellerDoc(row, hasListings))
          sellersIndexed++
        } catch {
          sellerErrors++
        }
      }

      if (sellerRows.length < PAGE_SIZE) break
      sellerFrom += PAGE_SIZE
    }
  }

  let forumThreadsIndexed = 0
  let forumThreadErrors = 0
  let forumThreadFrom = 0

  for (;;) {
    let threadQuery = supabase
      .from("forum_threads")
      .select("id")
      .order("updated_at", { ascending: false })
      .range(forumThreadFrom, forumThreadFrom + PAGE_SIZE - 1)

    if (catchUpIso) {
      threadQuery = threadQuery.gte("updated_at", catchUpIso)
    }

    const { data: threadRows, error: threadListError } = await threadQuery

    if (threadListError) {
      return { ok: false, status: 500, error: threadListError.message }
    }

    if (!threadRows?.length) break

    for (const row of threadRows) {
      try {
        const doc = await forumThreadRowToSearchDoc(supabase, row.id)
        if (doc) {
          await indexForumThreadDocument(doc)
          forumThreadsIndexed++
        }
      } catch {
        forumThreadErrors++
      }
    }

    if (threadRows.length < PAGE_SIZE) break
    forumThreadFrom += PAGE_SIZE
  }

  return {
    ok: true,
    summary: {
      indexed,
      errors,
      brandsIndexed,
      brandErrors,
      finCatalogBrandsIndexed,
      finCatalogModelsIndexed,
      finCatalogVariantsIndexed,
      finCatalogErrors,
      sellCatalogBrandsIndexed,
      sellCatalogModelsIndexed,
      sellCatalogErrors,
      sellersIndexed,
      sellersRemoved,
      sellerErrors,
      forumThreadsIndexed,
      forumThreadErrors,
    },
  }
}
