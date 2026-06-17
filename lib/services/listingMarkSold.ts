import type { SupabaseClient } from "@supabase/supabase-js"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { trackKlaviyoMarkedAsSold } from "@/lib/klaviyo/track-marked-as-sold"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import { removeListingFromGoogleMerchantFeed } from "@/lib/services/googleMerchantSync"
import { revalidateMarketplaceSoldFeedCatalog } from "@/lib/cache/revalidate-marketplace-sold-feed"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { SoldOffPlatformChannel } from "@/lib/validations/mark-listing-sold"

type ListingMarkSoldRow = {
  id: string
  user_id: string
  status: string
  archived_at: string | null
  title: string
  price: number
  section: string
  slug: string | null
  listing_images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null
}

export type MarkSellerListingSoldOffPlatformResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

async function loadListingForMarkSold(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingMarkSoldRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, user_id, status, archived_at, title, price, section, slug, listing_images(url, is_primary, sort_order)",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingMarkSoldRow
}

function primaryPhotoUrl(
  images: ListingMarkSoldRow["listing_images"],
): string | null {
  if (!images?.length) return null
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary && !b.is_primary) return -1
    if (!a.is_primary && b.is_primary) return 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })
  const url = sorted[0]?.url
  return typeof url === "string" && url.trim() ? url.trim() : null
}

/**
 * Seller marks a live listing sold off-platform. Keeps the listing record, sets status to sold,
 * and records the reported sale channel for analytics and Klaviyo.
 */
export async function markSellerListingSoldOffPlatform(
  supabase: SupabaseClient,
  params: {
    listingId: string
    sellerUserId: string
    sellerEmail?: string | null
    channel: SoldOffPlatformChannel
    detail?: string | null
  },
): Promise<MarkSellerListingSoldOffPlatformResult> {
  const { listingId, sellerUserId, channel, detail } = params

  const row = await loadListingForMarkSold(supabase, listingId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }
  if (row.user_id !== sellerUserId) {
    return { ok: false, status: 403, error: "Forbidden" }
  }
  if (row.status === "draft") {
    return {
      ok: false,
      status: 400,
      error: "Discard drafts from the dashboard instead.",
    }
  }
  if (row.status === "sold") {
    return { ok: false, status: 400, error: "Listing is already sold" }
  }
  if (row.archived_at) {
    return { ok: false, status: 400, error: "Archived listings cannot be marked as sold" }
  }

  const soldAt = new Date().toISOString()
  const channelDetail = channel === "elsewhere" ? (detail?.trim() ?? "") : null

  const { error } = await supabase
    .from("listings")
    .update({
      status: "sold",
      sold_off_platform: true,
      sold_off_platform_channel: channel,
      sold_off_platform_detail: channelDetail,
      sold_off_platform_at: soldAt,
      updated_at: soldAt,
    })
    .eq("id", listingId)
    .eq("user_id", sellerUserId)

  if (error) {
    return { ok: false, status: 500, error: "Failed to mark listing as sold" }
  }

  try {
    const service = createServiceRoleClient()
    await deleteAllCartRowsForListing(service, listingId)
  } catch {
    // best-effort
  }

  try {
    await syncListingToIndex(supabase, listingId)
  } catch {
    // ES optional
  }

  await removeListingFromGoogleMerchantFeed(listingId)

  revalidateListingDetailPage(listingId, row.slug)
  revalidateBoardsBrowseCatalog()
  revalidateMarketplaceSoldFeedCatalog()
  await revalidateSellersAfterListingChange(supabase, sellerUserId)

  void trackKlaviyoMarkedAsSold({
    sellerUserId,
    sellerEmail: params.sellerEmail,
    listingId,
    title: row.title,
    price: row.price,
    section: row.section,
    slug: row.slug,
    photoUrl: primaryPhotoUrl(row.listing_images),
    channel,
    channelDetail,
  })

  return { ok: true }
}
