import type { SupabaseClient } from "@supabase/supabase-js"
import { getDb } from "@/lib/supabase/db"
import { isBlockedOwnListingPurchase, isCartEligibleSection } from "@/lib/cart-eligibility"
import { attachListingInventorySources } from "@/lib/db/listingInventorySource"
import { isListingPurchasable } from "@/lib/listing-public-visibility"
import {
  clampListingBuyerQuantity,
  listingBuyerQuantityCap,
  listingSupportsBuyerQuantity,
  peerBrandNewStockQuantity,
} from "@/lib/listing-stock-quantity"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { isShopifyManagedListing } from "@/lib/shopify/listing"
import { shopifyManagedCheckoutBilling } from "@/lib/services/shopifyBilling"
import { assertBuyerMayPurchaseListingExclusiveWindow } from "@/lib/services/listingBuyerExclusiveWindow"
import { cartFromCartCheckoutHref } from "@/lib/utils/added-to-cart"
import { absoluteUrl } from "@/lib/site-metadata"

type CartEligibleListing = {
  id: string
  user_id: string
  section: string
  status: string
  condition?: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  hidden_from_site?: boolean | null
  archived_at?: string | null
  stock_quantity?: number | null
  inventory_source?: string | null
}

function cartDb(): SupabaseClient {
  return getDb({ consistency: "strong", purpose: "analytics" })
}

async function assertListingEligibleForMcpCart(
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
    const exclusiveCheck = await assertBuyerMayPurchaseListingExclusiveWindow(
      supabase,
      listingId,
      buyerId,
    )
    if (!exclusiveCheck.ok) {
      return { ok: false, message: exclusiveCheck.message }
    }
  }

  return { ok: true, listing: ready }
}

export type McpCartLine = {
  listing_id: string
  slug: string | null
  title: string
  price_usd: number
  quantity: number
  seller_id: string
  seller_name: string | null
  checkout_path: string
}

export async function getMcpCartService(buyerId: string): Promise<
  | { ok: true; items: McpCartLine[]; item_count: number }
  | { ok: false; error: string }
> {
  const supabase = cartDb()
  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
      quantity,
      listings (
        id,
        slug,
        title,
        price,
        status,
        section,
        user_id,
        local_pickup,
        shipping_available,
        stock_quantity,
        hidden_from_site,
        archived_at,
        profiles!listings_user_id_fkey ( display_name, shop_name, is_shop )
      )
    `,
    )
    .eq("profile_id", buyerId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[mcp-cart] get cart failed", {
      timestamp: new Date().toISOString(),
      buyerId,
      message: error.message,
    })
    return { ok: false, error: "Unable to load cart" }
  }

  const items: McpCartLine[] = []
  for (const row of data ?? []) {
    const raw = row as {
      quantity?: number | null
      listings:
        | (CartEligibleListing & {
            slug?: string | null
            title?: string | null
            price?: number | string | null
            profiles?:
              | { display_name?: string | null; shop_name?: string | null; is_shop?: boolean | null }
              | { display_name?: string | null; shop_name?: string | null; is_shop?: boolean | null }[]
              | null
          })
        | null
        | Array<
            CartEligibleListing & {
              slug?: string | null
              title?: string | null
              price?: number | string | null
              profiles?:
                | {
                    display_name?: string | null
                    shop_name?: string | null
                    is_shop?: boolean | null
                  }
                | {
                    display_name?: string | null
                    shop_name?: string | null
                    is_shop?: boolean | null
                  }[]
                | null
            }
          >
    }
    const listingRaw = Array.isArray(raw.listings) ? raw.listings[0] : raw.listings
    if (!listingRaw) continue
    if (!isListingPurchasable(listingRaw)) continue
    if (!isCartEligibleSection(listingRaw.section)) continue

    const profileRaw = listingRaw.profiles
    const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw
    const qty = listingSupportsBuyerQuantity(listingRaw)
      ? clampListingBuyerQuantity(listingRaw, Math.max(1, Math.floor(Number(raw.quantity) || 1)))
      : 1
    const price = Number(listingRaw.price)
    items.push({
      listing_id: listingRaw.id,
      slug: listingRaw.slug?.trim() || null,
      title: listingRaw.title?.trim() || "Untitled listing",
      price_usd: Number.isFinite(price) ? Math.round(price * 100) / 100 : 0,
      quantity: qty,
      seller_id: listingRaw.user_id,
      seller_name:
        (profile?.is_shop && profile.shop_name?.trim()) ||
        profile?.display_name?.trim() ||
        null,
      checkout_path: cartFromCartCheckoutHref(listingRaw.user_id),
    })
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)
  return { ok: true, items, item_count: itemCount }
}

export async function addMcpCartItemsService(
  buyerId: string,
  listingIds: string[],
): Promise<{ ok: true; added: string[]; errors: { listing_id: string; error: string }[] } | { ok: false; error: string }> {
  const supabase = cartDb()
  const added: string[] = []
  const errors: { listing_id: string; error: string }[] = []

  for (const listingId of [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]) {
    const check = await assertListingEligibleForMcpCart(supabase, listingId, buyerId)
    if (!check.ok) {
      errors.push({ listing_id: listingId, error: check.message })
      continue
    }

    const cap = listingBuyerQuantityCap(check.listing)
    if (cap < 1) {
      errors.push({ listing_id: listingId, error: "This item is out of stock" })
      continue
    }

    const { data: existing } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("profile_id", buyerId)
      .eq("listing_id", listingId)
      .maybeSingle()

    if (existing) {
      if (!listingSupportsBuyerQuantity(check.listing)) {
        added.push(listingId)
        continue
      }
      const prevQty = Math.max(1, Math.floor(Number((existing as { quantity?: number }).quantity) || 1))
      const nextQty = prevQty + 1
      if (nextQty > cap) {
        errors.push({ listing_id: listingId, error: "Not enough stock available" })
        continue
      }
      const { error: updateErr } = await supabase
        .from("cart_items")
        .update({ quantity: nextQty })
        .eq("id", (existing as { id: string }).id)
        .eq("profile_id", buyerId)
      if (updateErr) {
        errors.push({ listing_id: listingId, error: updateErr.message })
        continue
      }
      added.push(listingId)
      continue
    }

    const { error } = await supabase.from("cart_items").insert({
      profile_id: buyerId,
      listing_id: listingId,
      quantity: 1,
    })
    if (error) {
      if (error.code === "23505") {
        added.push(listingId)
        continue
      }
      errors.push({ listing_id: listingId, error: error.message })
      continue
    }
    added.push(listingId)
  }

  return { ok: true, added, errors }
}

export async function removeMcpCartItemsService(
  buyerId: string,
  listingIds: string[],
): Promise<{ ok: true; removed: string[] } | { ok: false; error: string }> {
  const supabase = cartDb()
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (!ids.length) return { ok: true, removed: [] }

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("profile_id", buyerId)
    .in("listing_id", ids)

  if (error) {
    console.error("[mcp-cart] remove failed", {
      timestamp: new Date().toISOString(),
      buyerId,
      message: error.message,
    })
    return { ok: false, error: "Unable to update cart" }
  }
  return { ok: true, removed: ids }
}

export async function prepareMcpPurchaseService(
  buyerId: string,
  sellerId?: string,
): Promise<
  | {
      ok: true
      checkout_urls: string[]
      note: string
    }
  | { ok: false; error: string }
> {
  const cart = await getMcpCartService(buyerId)
  if (!cart.ok) return cart
  if (cart.items.length === 0) {
    return { ok: false, error: "Your cart is empty" }
  }

  const bySeller = new Map<string, McpCartLine[]>()
  for (const item of cart.items) {
    if (sellerId && item.seller_id !== sellerId) continue
    const list = bySeller.get(item.seller_id) ?? []
    list.push(item)
    bySeller.set(item.seller_id, list)
  }

  if (bySeller.size === 0) {
    return {
      ok: false,
      error: sellerId
        ? "No cart items for that seller_id"
        : "Your cart is empty",
    }
  }

  const checkout_urls = [...bySeller.keys()].map((id) =>
    absoluteUrl(cartFromCartCheckoutHref(id)),
  )

  return {
    ok: true,
    checkout_urls,
    note:
      "Hand the buyer each checkout_url exactly as returned. Do not paraphrase or invent query params. Shipping and tax are calculated on the Reswell checkout page. The assistant cannot charge a card.",
  }
}
