import type { SupabaseClient } from "@supabase/supabase-js"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import {
  escapeIlikePattern,
  shopifyLinkedListingFilterSpec,
  type ShopifyLinkedListingFilterSpec,
} from "@/lib/shopify/linked-listings"
import type {
  ShopifyCatalogSummary,
  ShopifyLinkedListingFilter,
  ShopifyProductMappingRow,
} from "@/lib/shopify/types"

export interface ShopifyLinkedListingRow extends ShopifyProductMappingRow {
  listings: {
    id: string
    title: string
    price: number | string | null
    stock_quantity: number | null
    status: string
    section: PeerListingSection
    slug: string | null
    primary_image_url: string | null
  }
}

const LINKED_LISTING_SELECT = [
  "id",
  "connection_id",
  "listing_id",
  "shopify_product_gid",
  "shopify_variant_gid",
  "shopify_inventory_item_gid",
  "reswell_section",
  "selected",
  "inventory_generation",
  "sync_status",
  "remote_updated_at",
  "last_synced_at",
  "last_error",
  "listings!inner(id,title,price,stock_quantity,status,section,slug,primary_image_url)",
].join(",")

function linkedListingsQuery(
  supabase: SupabaseClient,
  input: {
    connectionId: string
    spec: ShopifyLinkedListingFilterSpec
    section?: PeerListingSection | null
    query?: string
    columns: string
    head?: boolean
  },
) {
  let builder = supabase
    .from("shopify_product_mappings")
    .select(input.columns, { count: "exact", head: input.head === true })
    .eq("connection_id", input.connectionId)
  if (input.spec.listingStatus) {
    builder = builder.eq("listings.status", input.spec.listingStatus)
  }
  if (input.spec.syncStatuses) {
    builder = builder.in("sync_status", input.spec.syncStatuses)
  }
  if (input.spec.selected !== undefined) {
    builder = builder.eq("selected", input.spec.selected)
  }
  if (input.section) builder = builder.eq("reswell_section", input.section)
  const query = input.query?.trim()
  if (query) {
    builder = builder.ilike("listings.title", `%${escapeIlikePattern(query)}%`)
  }
  return builder
}

export async function dbListShopifyLinkedListings(
  supabase: SupabaseClient,
  input: {
    connectionId: string
    filter: ShopifyLinkedListingFilter
    section: PeerListingSection | null
    query: string
    page: number
    pageSize: number
  },
): Promise<{ rows: ShopifyLinkedListingRow[]; total: number }> {
  const from = (input.page - 1) * input.pageSize
  const { data, error, count } = await linkedListingsQuery(supabase, {
    connectionId: input.connectionId,
    spec: shopifyLinkedListingFilterSpec(input.filter),
    section: input.section,
    query: input.query,
    columns: LINKED_LISTING_SELECT,
  })
    .order("created_at", { ascending: false })
    .order("id", { ascending: true })
    .range(from, from + input.pageSize - 1)
  if (error) throw new Error(error.message)
  return {
    rows: (data ?? []) as unknown as ShopifyLinkedListingRow[],
    total: count ?? 0,
  }
}

async function countLinkedListings(
  supabase: SupabaseClient,
  connectionId: string,
  spec: ShopifyLinkedListingFilterSpec,
): Promise<number> {
  const { count, error } = await linkedListingsQuery(supabase, {
    connectionId,
    spec,
    columns: "id,listings!inner(status)",
    head: true,
  })
  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function dbSummarizeShopifyLinkedListings(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<ShopifyCatalogSummary> {
  const spec = shopifyLinkedListingFilterSpec
  const [total, live, outOfStock, deleted, unpublished, errors, needsRemoval] =
    await Promise.all([
      countLinkedListings(supabase, connectionId, spec("all")),
      countLinkedListings(supabase, connectionId, spec("live")),
      countLinkedListings(supabase, connectionId, spec("out_of_stock")),
      countLinkedListings(supabase, connectionId, spec("deleted")),
      countLinkedListings(supabase, connectionId, spec("unpublished")),
      countLinkedListings(supabase, connectionId, spec("error")),
      countLinkedListings(supabase, connectionId, {
        listingStatus: "active",
        syncStatuses: ["deleted", "unselected"],
      }),
    ])
  return { total, live, outOfStock, deleted, unpublished, errors, needsRemoval }
}
