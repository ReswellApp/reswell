import {
  mobileListingActionResultSchema,
  mobileMyListingsSchema,
  type MobileMyListings,
} from "@reswell/api-contract"
import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchMyListings, type MyListingRow } from "@/lib/db/my-listings"
import { listingCardImageSrc } from "@/lib/listing-image-display"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { endSellerListing } from "@/lib/services/listingEnd"
import { markSellerListingSoldOffPlatform } from "@/lib/services/listingMarkSold"
import { relistSellerMarkedSoldListing } from "@/lib/services/listingRelist"
import { setListingVacationModeForSeller } from "@/lib/services/listingVacationMode"
import type { MarkListingSoldBody } from "@/lib/validations/mark-listing-sold"
import { setShopVacationModeForSeller } from "@/lib/services/shopVacationMode"
import { absolutePublicMediaUrl } from "@/lib/site-metadata"

function money(amount: number): string {
  return `$${amount.toFixed(2)}`
}

function statusLabel(listing: MyListingRow): string {
  if (listing.status === "sold") return "Sold"
  if (listing.status === "draft") return "Draft"
  if (listing.hidden_from_site && (listing.status === "active" || listing.status === "pending_sale")) return "Vacation"
  if (listing.status === "active") return "Active"
  if (listing.status === "delinquent") return "Delinquent"
  return listing.status.replaceAll("_", " ")
}

function toCard(listing: MyListingRow) {
  const image = listingCardImageSrc(listing.listing_images)
  const created = new Date(listing.created_at)
  return {
    id: listing.id,
    slug: listing.slug,
    title: listing.title,
    price_label: listing.status === "draft" ? "Draft" : money(Number(listing.price) || 0),
    status: listing.status,
    status_label: statusLabel(listing),
    image_url: image ? absolutePublicMediaUrl(image) ?? null : null,
    views: Math.max(0, listing.views || 0),
    cart_count: Math.max(0, listing.cartCount || 0),
    favorite_count: Math.max(0, listing.favoriteCount || 0),
    on_vacation: listing.hidden_from_site === true,
    can_vacation: listing.status === "active" || listing.status === "pending_sale",
    can_relist: listing.canRelist,
    created_label: Number.isNaN(created.getTime())
      ? ""
      : created.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  }
}

export async function listMobileMyListingsService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<MobileMyListings>> {
  const listed = await fetchMyListings(supabase, userId)
  if (listed.error) {
    console.error("[mobile-api] my listings failed", { timestamp: new Date().toISOString(), message: listed.error })
    return { ok: false, status: 500, error: "Unable to load your listings right now" }
  }
  const parsed = mobileMyListingsSchema.safeParse({
    total_listings: listed.stats.totalListings,
    total_views: listed.stats.totalViews,
    in_carts: listed.stats.inCarts,
    saved: listed.stats.saved,
    listings: listed.listings.map(toCard),
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load your listings right now" }
  return { ok: true, data: parsed.data }
}

export async function setMobileListingVacationService(
  supabase: SupabaseClient,
  userId: string,
  input: { enabled: boolean; listingId?: string },
): Promise<MobileApiResult<{ message: string }>> {
  const result = input.listingId
    ? await setListingVacationModeForSeller({
        supabase,
        userId,
        listingId: input.listingId,
        vacationMode: input.enabled,
      })
    : await setShopVacationModeForSeller({ supabase, userId, vacationMode: input.enabled })
  if (!result.ok) return { ok: false, status: result.status, error: result.error }
  const parsed = mobileListingActionResultSchema.safeParse({
    message: input.enabled ? "Vacation is on." : "Vacation is off.",
  })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to update vacation right now" }
  return { ok: true, data: parsed.data }
}

export async function endMobileListingService(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<MobileApiResult<{ message: string }>> {
  const result = await endSellerListing(supabase, { listingId, sellerUserId: userId })
  if (!result.ok) return { ok: false, status: result.status, error: result.error }
  const parsed = mobileListingActionResultSchema.safeParse({ message: "Listing deleted." })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to delete listing right now" }
  return { ok: true, data: parsed.data }
}

export async function markMobileListingSoldService(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
  body: MarkListingSoldBody,
  sellerEmail?: string | null,
): Promise<MobileApiResult<{ message: string }>> {
  const result = await markSellerListingSoldOffPlatform(supabase, {
    listingId,
    sellerUserId: userId,
    sellerEmail,
    channel: body.channel,
    detail: body.detail,
    reswellHelpedFindBuyer: body.reswellHelpedFindBuyer,
  })
  if (!result.ok) return { ok: false, status: result.status, error: result.error }
  const parsed = mobileListingActionResultSchema.safeParse({ message: "Listing marked as sold." })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to mark listing sold right now" }
  return { ok: true, data: parsed.data }
}

export async function relistMobileListingService(
  supabase: SupabaseClient,
  userId: string,
  listingId: string,
): Promise<MobileApiResult<{ message: string }>> {
  const result = await relistSellerMarkedSoldListing(supabase, { listingId, sellerUserId: userId })
  if (!result.ok) return { ok: false, status: result.status, error: result.error }
  const parsed = mobileListingActionResultSchema.safeParse({ message: "Listing is active again." })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to relist right now" }
  return { ok: true, data: parsed.data }
}
