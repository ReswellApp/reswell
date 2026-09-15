import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateTag } from "next/cache"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import {
  LISTING_RELATED_CONTENT_CACHE_TAG,
  listingRelatedContentCacheTag,
} from "@/lib/listing-related-content"
import {
  deleteRelatedContentRow,
  getListingSummaryById,
  hydrateRelatedContentAdminItems,
  hydrateRelatedContentPublicCards,
  insertRelatedContentRow,
  listRelatedContentHosts,
  listRelatedContentRows,
  nextRelatedContentSortOrder,
  reorderRelatedContentRows,
  searchBlogsForRelatedContent,
  searchListingsForRelatedContent,
  type RelatedContentAdminItem,
  type RelatedContentBlogSearchHit,
  type RelatedContentHostSummary,
  type RelatedContentListingSearchHit,
  type RelatedContentListingSummary,
} from "@/lib/db/listing-related-content"
import type { ListingRelatedContentCard, RelatedContentKind } from "@/lib/listing-related-content"
import { createServiceRoleClient } from "@/lib/supabase/server"

const MAX_ITEMS_PER_LISTING = 20

function serviceRole():
  | { ok: true; svc: ReturnType<typeof createServiceRoleClient> }
  | { ok: false; error: string; status: number } {
  try {
    return { ok: true, svc: createServiceRoleClient() }
  } catch (e) {
    console.error("listingRelatedContent: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }
}

function revalidateRelatedContent(listing: RelatedContentListingSummary): void {
  revalidateTag(LISTING_RELATED_CONTENT_CACHE_TAG, "max")
  revalidateTag(listingRelatedContentCacheTag(listing.id), { expire: 0 })
  revalidateListingDetailPage(listing.id, listing.slug)
}

export async function listRelatedContentPublicForListing(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingRelatedContentCard[]> {
  const rows = await listRelatedContentRows(supabase, listingId)
  if (rows.length === 0) return []
  return hydrateRelatedContentPublicCards(supabase, rows)
}

export async function listRelatedContentHostsForAdminService(): Promise<
  { ok: true; hosts: RelatedContentHostSummary[] } | { ok: false; error: string }
> {
  const gate = serviceRole()
  if (!gate.ok) return gate
  try {
    const hosts = await listRelatedContentHosts(gate.svc)
    return { ok: true, hosts }
  } catch {
    return { ok: false, error: "Could not load related content" }
  }
}

export async function getRelatedContentDetailForAdminService(
  listingId: string,
): Promise<
  | { ok: true; listing: RelatedContentListingSummary; items: RelatedContentAdminItem[] }
  | { ok: false; error: string; status?: number }
> {
  const gate = serviceRole()
  if (!gate.ok) return gate

  const listing = await getListingSummaryById(gate.svc, listingId)
  if (!listing) return { ok: false, error: "Listing not found", status: 404 }

  const rows = await listRelatedContentRows(gate.svc, listingId)
  const items = await hydrateRelatedContentAdminItems(gate.svc, rows)
  return { ok: true, listing, items }
}

export async function addRelatedContentItemService(params: {
  listingId: string
  kind: RelatedContentKind
  blogPostId?: string
  relatedListingId?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string; status?: number }> {
  const gate = serviceRole()
  if (!gate.ok) return gate

  const listing = await getListingSummaryById(gate.svc, params.listingId)
  if (!listing) return { ok: false, error: "Listing not found", status: 404 }

  if (params.kind === "listing") {
    if (!params.relatedListingId) {
      return { ok: false, error: "related_listing_id is required", status: 400 }
    }
    if (params.relatedListingId === params.listingId) {
      return { ok: false, error: "A listing cannot be related to itself", status: 400 }
    }
    const related = await getListingSummaryById(gate.svc, params.relatedListingId)
    if (!related) return { ok: false, error: "Related listing not found", status: 404 }
  }

  if (params.kind === "blog") {
    if (!params.blogPostId) {
      return { ok: false, error: "blog_post_id is required", status: 400 }
    }
    const { data, error } = await gate.svc.from("blog_posts").select("id").eq("id", params.blogPostId).maybeSingle()
    if (error) {
      console.error("addRelatedContentItemService blog lookup:", error.message)
      return { ok: false, error: "Could not verify blog post", status: 500 }
    }
    if (!data?.id) return { ok: false, error: "Blog post not found", status: 404 }
  }

  const existing = await listRelatedContentRows(gate.svc, params.listingId)
  if (existing.length >= MAX_ITEMS_PER_LISTING) {
    return { ok: false, error: `A listing can have at most ${MAX_ITEMS_PER_LISTING} related items`, status: 400 }
  }

  const sortOrder = await nextRelatedContentSortOrder(gate.svc, params.listingId)
  const inserted = await insertRelatedContentRow(gate.svc, {
    listing_id: params.listingId,
    kind: params.kind,
    blog_post_id: params.blogPostId,
    related_listing_id: params.relatedListingId,
    sort_order: sortOrder,
  })
  if (!inserted.ok) {
    return { ok: false, error: inserted.error, status: inserted.alreadyExists ? 409 : 500 }
  }

  revalidateRelatedContent(listing)
  return { ok: true, id: inserted.id }
}

export async function deleteRelatedContentItemService(
  listingId: string,
  rowId: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const gate = serviceRole()
  if (!gate.ok) return gate

  const listing = await getListingSummaryById(gate.svc, listingId)
  if (!listing) return { ok: false, error: "Listing not found", status: 404 }

  const deleted = await deleteRelatedContentRow(gate.svc, listingId, rowId)
  if (!deleted.ok) {
    const notFound = /not found/i.test(deleted.error)
    return { ok: false, error: deleted.error, status: notFound ? 404 : 500 }
  }

  revalidateRelatedContent(listing)
  return { ok: true }
}

export async function reorderRelatedContentItemsService(
  listingId: string,
  orderedRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const gate = serviceRole()
  if (!gate.ok) return gate

  const listing = await getListingSummaryById(gate.svc, listingId)
  if (!listing) return { ok: false, error: "Listing not found", status: 404 }

  const result = await reorderRelatedContentRows(gate.svc, listingId, orderedRowIds)
  if (!result.ok) return { ok: false, error: result.error, status: 400 }

  revalidateRelatedContent(listing)
  return { ok: true }
}

export async function searchRelatedContentPickerService(params: {
  type: "listing" | "blog" | "host"
  query: string
  hostListingId?: string
  limit: number
}): Promise<
  | { ok: true; listings?: RelatedContentListingSearchHit[]; blogs?: RelatedContentBlogSearchHit[] }
  | { ok: false; error: string }
> {
  const gate = serviceRole()
  if (!gate.ok) return gate

  try {
    if (params.type === "blog") {
      let curatedIds = new Set<string>()
      if (params.hostListingId) {
        const rows = await listRelatedContentRows(gate.svc, params.hostListingId)
        curatedIds = new Set(rows.flatMap((row) => (row.blog_post_id ? [row.blog_post_id] : [])))
      }
      const blogs = await searchBlogsForRelatedContent(gate.svc, params.query, {
        curatedIds,
        limit: params.limit,
      })
      return { ok: true, blogs }
    }

    let curatedIds = new Set<string>()
    if (params.type === "listing" && params.hostListingId) {
      const rows = await listRelatedContentRows(gate.svc, params.hostListingId)
      curatedIds = new Set(rows.flatMap((row) => (row.related_listing_id ? [row.related_listing_id] : [])))
    }

    const listings = await searchListingsForRelatedContent(gate.svc, params.query, {
      excludeListingId: params.type === "listing" ? params.hostListingId : undefined,
      curatedIds,
      limit: params.limit,
    })
    return { ok: true, listings }
  } catch {
    return { ok: false, error: "Search failed" }
  }
}
