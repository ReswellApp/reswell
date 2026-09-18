import { updateListingSearchTags } from "@/lib/db/listings"
import { serializeListingSearchTags } from "@/lib/listing-search-tags"
import { createServiceRoleClient } from "@/lib/supabase/server"

type ListingSearchTagsResult =
  | { ok: true; searchTags: string[] }
  | { ok: false; message: string; status: 400 | 404 | 500 }

export async function setListingSearchTags(params: {
  listingId: string
  searchTags: string[]
}): Promise<ListingSearchTagsResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const { data: listing, error } = await service
    .from("listings")
    .select("id, section")
    .eq("id", params.listingId)
    .maybeSingle()

  if (error) {
    console.error("setListingSearchTags lookup:", {
      listingId: params.listingId,
      message: error.message,
    })
    return { ok: false, message: "Could not update search tags", status: 500 }
  }
  if (!listing) {
    return { ok: false, message: "Listing not found", status: 404 }
  }
  if (listing.section !== "surfboards") {
    return { ok: false, message: "Search tags are only for surfboard listings", status: 400 }
  }

  const searchTags = serializeListingSearchTags(params.searchTags)
  const result = await updateListingSearchTags(service, params.listingId, searchTags)
  if (!result.ok) {
    console.error("setListingSearchTags update:", {
      listingId: params.listingId,
      message: result.message,
    })
    return { ok: false, message: "Could not update search tags", status: 500 }
  }
  return { ok: true, searchTags }
}
