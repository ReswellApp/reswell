import type { SupabaseClient } from "@supabase/supabase-js"
import { isBlockedOwnListingPurchase, isCartEligibleSection } from "@/lib/cart-eligibility"
import { attachListingInventorySources } from "@/lib/db/listingInventorySource"
import { peerBrandNewStockQuantity } from "@/lib/listing-stock-quantity"
import { isListingPurchasable } from "@/lib/listing-public-visibility"
import type { PeerListingCartFields } from "@/lib/peer-listing-cart"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { isShopifyManagedListing } from "@/lib/shopify/listing"
import { assertBuyerMayPurchaseListingExclusiveWindow } from "@/lib/services/listingBuyerExclusiveWindow"
import { shopifyManagedCheckoutBilling } from "@/lib/services/shopifyBilling"
import {
  countSurfboardListings,
  isSurfboardListingSection,
  peerCheckoutSurfboardCountError,
} from "@/lib/surfboard-multi-board-parcel"

export type CartEligibleListing = PeerListingCartFields & {
  hidden_from_site?: boolean | null
  archived_at?: string | null
  condition?: string | null
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
      "id, user_id, section, status, condition, local_pickup, shipping_available, hidden_from_site, archived_at, stock_quantity",
    )
    .eq("id", listingId)
    .maybeSingle()

  if (error || !row) {
    return { ok: false, message: "Listing not found" }
  }

  const listing = row as CartEligibleListing
  const sourced = await attachListingInventorySources(supabase, [listing])
  if (!sourced.ok) {
    return { ok: false, message: sourced.error }
  }
  const ready = sourced.listings[0]
  if (!ready) {
    return { ok: false, message: "Listing not found" }
  }
  if (!isListingPurchasable(ready)) {
    return { ok: false, message: "This listing is not available" }
  }
  if (!isCartEligibleSection(ready.section)) {
    return { ok: false, message: "This listing cannot be added to cart" }
  }
  const lp = ready.local_pickup !== false
  const sa = !!ready.shipping_available
  if (!lp && !sa) {
    return { ok: false, message: "This listing has no checkout option" }
  }
  if (isBlockedOwnListingPurchase(ready, buyerId)) {
    return { ok: false, message: "You cannot add your own listing" }
  }
  if (
    isReswellShopListing(ready.section) ||
    isShopifyManagedListing(ready) ||
    peerBrandNewStockQuantity(ready) >= 1
  ) {
    const stock = Math.max(0, Math.floor(Number(ready.stock_quantity) || 0))
    if (stock < 1) {
      return { ok: false, message: "This item is out of stock" }
    }
  }
  const shopifyBilling = await shopifyManagedCheckoutBilling([ready])
  if (!shopifyBilling.ok) {
    return { ok: false, message: shopifyBilling.error }
  }

  if (isPeerListingSection(ready.section)) {
    const exclusiveCheck = await assertBuyerMayPurchaseListingExclusiveWindow(supabase, listingId, buyerId)
    if (!exclusiveCheck.ok) {
      return { ok: false, message: exclusiveCheck.message }
    }
  }

  return { ok: true, listing: ready }
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
