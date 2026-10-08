import type { SupabaseClient } from "@supabase/supabase-js"
import { isBlockedOwnListingPurchase, isCartEligibleSection } from "@/lib/cart-eligibility"
import { isListingPurchasable } from "@/lib/listing-public-visibility"
import type { PeerListingCartFields } from "@/lib/peer-listing-cart"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { isShopifyManagedListing } from "@/lib/shopify/listing"
import { assertBuyerMayPurchaseListingExclusiveWindow } from "@/lib/services/listingBuyerExclusiveWindow"
import {
  countSurfboardListings,
  isSurfboardListingSection,
  peerCheckoutSurfboardCountError,
} from "@/lib/surfboard-multi-board-parcel"

export type CartEligibleListing = PeerListingCartFields & {
  hidden_from_site?: boolean | null
  archived_at?: string | null
  stock_quantity?: number | null
  inventory_source?: string | null
}

export async function assertListingEligibleForCart(
  supabase: SupabaseClient,
  listingId: string,
  buyerId: string,
): Promise<{ ok: true; listing: CartEligibleListing } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("listings")
    .select(
      "id, user_id, section, status, local_pickup, shipping_available, hidden_from_site, archived_at, stock_quantity, inventory_source",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (error || !row) {
    return { ok: false, message: "Listing not found" }
  }

  const listing = row as CartEligibleListing
  if (!isListingPurchasable(listing)) {
    return { ok: false, message: "This listing is not available" }
  }
  if (!isCartEligibleSection(listing.section)) {
    return { ok: false, message: "This listing cannot be added to cart" }
  }
  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    return { ok: false, message: "This listing has no checkout option" }
  }
  if (isBlockedOwnListingPurchase(listing, buyerId)) {
    return { ok: false, message: "You cannot add your own listing" }
  }
  if (isReswellShopListing(listing.section) || isShopifyManagedListing(listing)) {
    const stock = Math.max(0, Math.floor(Number(listing.stock_quantity) || 0))
    if (stock < 1) {
      return { ok: false, message: "This item is out of stock" }
    }
  }

  if (isPeerListingSection(listing.section)) {
    const exclusiveCheck = await assertBuyerMayPurchaseListingExclusiveWindow(supabase, listingId, buyerId)
    if (!exclusiveCheck.ok) {
      return { ok: false, message: exclusiveCheck.message }
    }
  }

  return { ok: true, listing }
}

/** Error when adding this surfboard would exceed the seller's checkout cap. Null when it is allowed. */
export async function peerSurfboardAddCapError(
  supabase: SupabaseClient,
  listing: CartEligibleListing,
  buyerId: string,
): Promise<string | null> {
  if (!isSurfboardListingSection(listing.section)) return null

  const { data: cartPeerRows } = await supabase
    .from("cart_items")
    .select("listing_id, listings!inner ( user_id, section )")
    .eq("profile_id", buyerId)

  const alreadyIds = new Set<string>()
  const sellerBoards: Array<{ section?: string | null }> = []
  for (const row of cartPeerRows ?? []) {
    const raw = row as {
      listing_id?: string
      listings?: { user_id?: string; section?: string | null } | { user_id?: string; section?: string | null }[] | null
    }
    const joined = Array.isArray(raw.listings) ? raw.listings[0] : raw.listings
    const listingId = String(raw.listing_id ?? "").trim()
    if (listingId) alreadyIds.add(listingId)
    if (joined?.user_id === listing.user_id) {
      sellerBoards.push({ section: joined.section })
    }
  }
  if (alreadyIds.has(listing.id)) return null
  return peerCheckoutSurfboardCountError(countSurfboardListings(sellerBoards) + 1)
}
