import type { SupabaseClient } from "@supabase/supabase-js"
import type { ArticleBlock } from "@/lib/field-notes-articles"
import { parseBlogListingRef } from "@/lib/blog/parse-listing-ref"
import {
  getBlogEmbedListingByParam,
  listBlogRecentlySoldEmbeds,
} from "@/lib/db/blog-listing-embeds"
import type { BlogEmbedListing } from "@/lib/types/blog-listing-embed"

export type BlogListingEmbeds = {
  listingsByRef: Record<string, BlogEmbedListing>
  soldListings: BlogEmbedListing[]
}

const DEFAULT_SOLD_LIMIT = 6

export async function resolveBlogListingEmbeds(
  supabase: SupabaseClient,
  blocks: ArticleBlock[],
): Promise<BlogListingEmbeds> {
  const listingRefs = new Set<string>()
  let soldLimit = 0

  for (const block of blocks) {
    if (block.kind === "listing" || block.kind === "listing-image") {
      const param = parseBlogListingRef(block.ref)
      if (param) listingRefs.add(param)
    }
    if (block.kind === "sold-listings") {
      soldLimit = Math.max(soldLimit, block.limit ?? DEFAULT_SOLD_LIMIT)
    }
  }

  const listingsByRef: Record<string, BlogEmbedListing> = {}
  await Promise.all(
    [...listingRefs].map(async (param) => {
      const listing = await getBlogEmbedListingByParam(supabase, param)
      if (listing) listingsByRef[param] = listing
    }),
  )

  const soldListings = soldLimit > 0 ? await listBlogRecentlySoldEmbeds(supabase, soldLimit) : []

  return { listingsByRef, soldListings }
}

export function listingForBlogBlockRef(
  embeds: BlogListingEmbeds,
  ref: string,
): BlogEmbedListing | null {
  const param = parseBlogListingRef(ref)
  if (!param) return null
  return embeds.listingsByRef[param] ?? null
}
