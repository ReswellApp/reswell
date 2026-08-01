/**
 * Full Elasticsearch reindex from Supabase (listings, brands, fin catalog,
 * sellers, forum threads). Shared by admin Tools and the hourly cron.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
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
  ensureListingsIndex,
  indexListingDocument,
  listingRowToSearchDocFromRow,
  LISTING_SEARCH_DOC_SELECT,
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
 * Reindex all searchable Elasticsearch surfaces from Supabase.
 * Callers must pass a service-role (or otherwise privileged) client.
 */
export async function reindexElasticsearchFromSupabase(
  supabase: SupabaseClient,
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
    await ensureSellersIndex()
    await ensureForumThreadsIndex()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 503, error: `Elasticsearch index setup failed: ${msg}` }
  }

  let indexed = 0
  let errors = 0
  let from = 0

  for (;;) {
    const { data: rows, error } = await supabase
      .from("listings")
      .select(LISTING_SEARCH_DOC_SELECT)
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
      .in("section", [...ELASTICSEARCH_INDEXED_LISTING_SECTIONS])
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      return { ok: false, status: 500, error: error.message }
    }

    if (!rows?.length) break

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
        const doc = listingRowToSearchDocFromRow(row)
        await indexListingDocument(doc)
        indexed++
      } catch {
        errors++
      }
    }

    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  let brandsIndexed = 0
  let brandErrors = 0
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

  let finCatalogBrandsIndexed = 0
  let finCatalogModelsIndexed = 0
  let finCatalogVariantsIndexed = 0
  let finCatalogErrors = 0
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

  const activeListingUserIds = new Set<string>()
  {
    const activeListingPageSize = 1000
    let activeListingFrom = 0
    for (;;) {
      const { data: rows, error } = await supabase
        .from("listings")
        .select("user_id")
        .eq("status", "active")
        .eq("hidden_from_site", false)
        .is("archived_at", null)
        .range(activeListingFrom, activeListingFrom + activeListingPageSize - 1)

      if (error) {
        return { ok: false, status: 500, error: error.message }
      }
      if (!rows?.length) break

      for (const row of rows) {
        const uid = (row as { user_id?: string }).user_id
        if (uid) activeListingUserIds.add(uid)
      }
      if (rows.length < activeListingPageSize) break
      activeListingFrom += activeListingPageSize
    }
  }

  let sellersIndexed = 0
  let sellersRemoved = 0
  let sellerErrors = 0
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

  let forumThreadsIndexed = 0
  let forumThreadErrors = 0
  let forumThreadFrom = 0

  for (;;) {
    const { data: threadRows, error: threadListError } = await supabase
      .from("forum_threads")
      .select("id")
      .order("updated_at", { ascending: false })
      .range(forumThreadFrom, forumThreadFrom + PAGE_SIZE - 1)

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
      sellersIndexed,
      sellersRemoved,
      sellerErrors,
      forumThreadsIndexed,
      forumThreadErrors,
    },
  }
}
