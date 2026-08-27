"use server"

import { randomUUID } from "node:crypto"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isBlockedOwnListingPurchase, isCartEligibleSection } from "@/lib/cart-eligibility"
import { fetchAcceptedOffersForBuyerListings } from "@/lib/db/offers"
import { trackKlaviyoAddedToCart } from "@/lib/klaviyo/track-added-to-cart"
import { listingTileImageSrcFromRow } from "@/lib/listing-image-display"
import { isListingPurchasable } from "@/lib/listing-public-visibility"
import { trackMetaAddToCartServerEvent } from "@/lib/meta/track-add-to-cart-server-event"
import type { PeerListingCartFields } from "@/lib/peer-listing-cart"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { captureServerEvent } from "@/lib/posthog-server"
import { isReswellShopListing } from "@/lib/reswell-shop"
import { acceptedUnitPriceForSingleItemOffer } from "@/lib/services/acceptedOfferCheckout"
import { assertBuyerMayPurchaseListingExclusiveWindow } from "@/lib/services/listingBuyerExclusiveWindow"
import {
  cartFromCartCheckoutHref,
  cartItemCountFromQuantities,
  type AddedToCartPreview,
} from "@/lib/utils/added-to-cart"
import type { MetaBrowserSignalsInput } from "@/lib/validations/metaBrowserSignals"

export type CartListingRow = {
  id: string
  slug: string | null
  title: string
  price: number
  status: string
  section: string
  user_id: string
  local_pickup: boolean | null
  shipping_available: boolean | null
  /** Seller flat shipping rate when shipping is offered; used for cart summary display. */
  shipping_price: string | number | null
  board_shipping_cost_mode?: string | null
  condition?: string | null
  board_type?: string | null
  dimensions?: string | null
  stock_quantity?: number | null
  listing_images: { url: string; thumbnail_url?: string | null; is_primary?: boolean | null }[] | null
  profiles: {
    display_name: string | null
    avatar_url: string | null
    seller_slug: string | null
    shop_verified: boolean | null
    shop_name: string | null
    is_shop: boolean | null
  } | null
}

export type CartPageItem = {
  cartCreatedAt: string
  quantity: number
  listing: CartListingRow
  /** Accepted single-item offer unit price. Cart/checkout charge this instead of list price. */
  agreedPriceUsd: number | null
}

type CartEligibleListing = PeerListingCartFields & {
  hidden_from_site?: boolean | null
  archived_at?: string | null
  stock_quantity?: number | null
}

async function assertListingEligibleForCart(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  buyerId: string,
): Promise<{ ok: true; listing: CartEligibleListing } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("listings")
    .select(
      "id, user_id, section, status, local_pickup, shipping_available, hidden_from_site, archived_at, stock_quantity",
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
  if (isReswellShopListing(listing.section)) {
    const stock = Math.max(0, Math.floor(Number(listing.stock_quantity) || 0))
    if (stock < 1) {
      return { ok: false, message: "This item is out of stock" }
    }
  }

  if (isPeerListingSection(listing.section)) {
    const exclusiveCheck = await assertBuyerMayPurchaseListingExclusiveWindow(
      supabase,
      listingId,
      buyerId,
    )
    if (!exclusiveCheck.ok) {
      return { ok: false, message: exclusiveCheck.message }
    }
  }

  return { ok: true, listing }
}

export type AddCartItemResult = {
  ok: boolean
  error: string | null
  /** Listing price in USD, returned so the client can fire Meta Pixel AddToCart with a value. */
  value?: number
  contentName?: string
  /** Shared event id so the browser AddToCart dedupes against the Conversions API event. */
  metaEventId?: string
  preview?: AddedToCartPreview
}

type AddedToCartListingRow = {
  id: string
  title: string | null
  price: number | string | null
  slug: string | null
  section: string | null
  user_id: string
}

async function fetchAddedToCartBundle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  buyerId: string,
) {
  const [listingRes, imageRes, profileRes, cartRes] = await Promise.all([
    supabase
      .from("listings")
      .select("id, title, price, slug, section, user_id")
      .eq("id", listingId)
      .maybeSingle(),
    supabase
      .from("listing_images")
      .select("url, thumbnail_url")
      .eq("listing_id", listingId)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase.from("profiles").select("email").eq("id", buyerId).maybeSingle(),
    supabase.from("cart_items").select("quantity").eq("profile_id", buyerId),
  ])

  return {
    listingRow: listingRes.data as AddedToCartListingRow | null,
    firstImage: imageRes.data as { url?: string | null; thumbnail_url?: string | null } | null,
    profileRow: profileRes.data as { email?: string | null } | null,
    cartCount: cartItemCountFromQuantities(cartRes.data),
  }
}

function buildAddedToCartPreview(input: {
  listingId: string
  sellerId: string
  listingRow: AddedToCartListingRow | null
  firstImage: { url?: string | null; thumbnail_url?: string | null } | null
  lineQuantity: number
  addedQuantity: number
  cartCount: number
}): { preview: AddedToCartPreview; value?: number; contentName?: string; photoUrl: string | null } {
  const priceRaw = input.listingRow
    ? typeof input.listingRow.price === "number"
      ? input.listingRow.price
      : Number(input.listingRow.price)
    : NaN
  const value = Number.isFinite(priceRaw) && priceRaw > 0 ? priceRaw : undefined
  const title = String(input.listingRow?.title ?? "").trim()
  const contentName = title || undefined
  const imageUrl =
    listingTileImageSrcFromRow({
      url: input.firstImage?.url ?? null,
      thumbnail_url: input.firstImage?.thumbnail_url ?? null,
    }) || null
  const photoUrl =
    (input.firstImage?.thumbnail_url && String(input.firstImage.thumbnail_url).trim()) ||
    (input.firstImage?.url && String(input.firstImage.url).trim()) ||
    null
  const lineQuantity = Math.max(1, input.lineQuantity)
  const addedQuantity = Math.max(1, input.addedQuantity)

  return {
    preview: {
      listingId: input.listingId,
      title: title || "Listing",
      imageUrl,
      priceUsd: value ?? null,
      lineQuantity,
      addedQuantity,
      cartCount: Math.max(lineQuantity, input.cartCount),
      checkoutHref: cartFromCartCheckoutHref(input.sellerId),
    },
    value,
    contentName,
    photoUrl,
  }
}

export async function addCartItem(
  listingId: string,
  metaBrowserSignals?: MetaBrowserSignalsInput,
  quantity = 1,
): Promise<AddCartItemResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Sign in to save items" }
  }

  const addQty = Math.max(1, Math.floor(quantity))
  const check = await assertListingEligibleForCart(supabase, listingId, user.id)
  if (!check.ok) {
    return { ok: false, error: check.message }
  }

  const isShop = isReswellShopListing(check.listing.section)
  const stock = Math.max(0, Math.floor(Number(check.listing.stock_quantity) || 0))
  const maxQty = isShop ? stock : 1
  if (addQty > maxQty) {
    return { ok: false, error: isShop ? "Not enough stock available" : "This listing is already limited to one" }
  }

  const metaEventId = randomUUID()

  const { data: existing } = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("profile_id", user.id)
    .eq("listing_id", listingId)
    .maybeSingle()

  let lineQuantity = isShop ? addQty : 1

  if (existing) {
    const prevQty = Math.max(1, Math.floor(Number((existing as { quantity?: number }).quantity) || 1))
    if (!isShop) {
      revalidatePath("/cart")
      void trackMetaAddToCartServerEvent({
        eventId: metaEventId,
        listingId,
        listingSection: check.listing.section,
        buyerUserId: user.id,
        buyerEmail: user.email ?? null,
        browserSignals: {
          fbc: metaBrowserSignals?.fbc ?? null,
          fbp: metaBrowserSignals?.fbp ?? null,
        },
      })
      const bundle = await fetchAddedToCartBundle(supabase, listingId, user.id)
      const built = buildAddedToCartPreview({
        listingId,
        sellerId: check.listing.user_id,
        listingRow: bundle.listingRow,
        firstImage: bundle.firstImage,
        lineQuantity: 1,
        addedQuantity: 1,
        cartCount: bundle.cartCount,
      })
      return {
        ok: true,
        error: null,
        value: built.value,
        contentName: built.contentName,
        metaEventId,
        preview: built.preview,
      }
    }
    const nextQty = prevQty + addQty
    if (nextQty > maxQty) {
      return { ok: false, error: "Not enough stock available" }
    }
    const { error: updateErr } = await supabase
      .from("cart_items")
      .update({ quantity: nextQty })
      .eq("id", (existing as { id: string }).id)
      .eq("profile_id", user.id)
    if (updateErr) {
      return { ok: false, error: updateErr.message }
    }
    lineQuantity = nextQty
  } else {
    const { error } = await supabase.from("cart_items").insert({
      profile_id: user.id,
      listing_id: listingId,
      quantity: isShop ? addQty : 1,
    })

    if (error) {
      if (error.code === "23505") {
        revalidatePath("/cart")
        const bundle = await fetchAddedToCartBundle(supabase, listingId, user.id)
        const built = buildAddedToCartPreview({
          listingId,
          sellerId: check.listing.user_id,
          listingRow: bundle.listingRow,
          firstImage: bundle.firstImage,
          lineQuantity: 1,
          addedQuantity: 1,
          cartCount: bundle.cartCount,
        })
        return {
          ok: true,
          error: null,
          value: built.value,
          contentName: built.contentName,
          metaEventId,
          preview: built.preview,
        }
      }
      return { ok: false, error: error.message }
    }
  }

  const bundle = await fetchAddedToCartBundle(supabase, listingId, user.id)
  const listingRow = bundle.listingRow
  const built = buildAddedToCartPreview({
    listingId,
    sellerId: listingRow?.user_id ?? check.listing.user_id,
    listingRow,
    firstImage: bundle.firstImage,
    lineQuantity,
    addedQuantity: addQty,
    cartCount: bundle.cartCount,
  })

  if (listingRow) {
    const buyerEmail =
      (typeof bundle.profileRow?.email === "string" && bundle.profileRow.email.trim()
        ? bundle.profileRow.email.trim()
        : null) ||
      user.email?.trim() ||
      null
    void trackMetaAddToCartServerEvent({
      eventId: metaEventId,
      listingId: listingRow.id,
      listingSlug: listingRow.slug ?? null,
      listingSection: String(listingRow.section ?? "surfboards"),
      value: built.value,
      buyerUserId: user.id,
      buyerEmail: user.email ?? null,
      browserSignals: {
        fbc: metaBrowserSignals?.fbc ?? null,
        fbp: metaBrowserSignals?.fbp ?? null,
      },
    })
    void trackKlaviyoAddedToCart({
      buyerUserId: user.id,
      buyerEmail,
      listingId: listingRow.id,
      title: String(listingRow.title ?? ""),
      price: built.value ?? Number(listingRow.price),
      slug: listingRow.slug ?? null,
      section: String(listingRow.section ?? "surfboards"),
      photoUrl: built.photoUrl,
    })
  }

  revalidatePath("/cart")
  const pathSlug = listingRow?.slug?.trim()
  revalidatePath(pathSlug ? `/l/${pathSlug}` : `/l/${listingId}`)
  await captureServerEvent(user.id, "cart_item_added", {
    listing_id: listingId,
    section: listingRow ? String(listingRow.section ?? "surfboards") : undefined,
    quantity: addQty,
  })
  return {
    ok: true,
    error: null,
    value: built.value,
    contentName: built.contentName,
    metaEventId,
    preview: built.preview,
  }
}

export async function updateCartItemQuantity(
  listingId: string,
  quantity: number,
): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const nextQty = Math.floor(quantity)
  if (nextQty < 1) {
    return removeCartItem(listingId)
  }

  const check = await assertListingEligibleForCart(supabase, listingId, user.id)
  if (!check.ok) {
    return { ok: false, error: check.message }
  }
  if (!isReswellShopListing(check.listing.section)) {
    return { ok: false, error: "Quantity cannot be changed for this listing" }
  }
  const stock = Math.max(0, Math.floor(Number(check.listing.stock_quantity) || 0))
  if (nextQty > stock) {
    return { ok: false, error: "Not enough stock available" }
  }

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: nextQty })
    .eq("profile_id", user.id)
    .eq("listing_id", listingId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/cart")
  return { ok: true, error: null }
}

export async function removeCartItem(listingId: string): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const { data: listingMeta } = await supabase
    .from("listings")
    .select("slug")
    .eq("id", listingId)
    .maybeSingle()

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("profile_id", user.id)
    .eq("listing_id", listingId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/cart")
  const pathSlug = typeof listingMeta?.slug === "string" ? listingMeta.slug.trim() : ""
  revalidatePath(pathSlug ? `/l/${pathSlug}` : `/l/${listingId}`)
  return { ok: true, error: null }
}

export async function clearCart(): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Unauthorized" }
  }

  const { error } = await supabase.from("cart_items").delete().eq("profile_id", user.id)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/cart")
  return { ok: true, error: null }
}

export async function getCartPageItems(): Promise<{
  items: CartPageItem[]
  error: string | null
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { items: [], error: null }
  }

  const { data, error } = await supabase
    .from("cart_items")
    .select(
      `
      created_at,
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
        shipping_price,
        board_shipping_cost_mode,
        condition,
        board_type,
        dimensions,
        stock_quantity,
        hidden_from_site,
        archived_at,
        listing_images ( url, thumbnail_url, is_primary ),
        profiles!listings_user_id_fkey ( display_name, avatar_url, seller_slug, shop_verified, shop_name, is_shop )
      )
    `,
    )
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false })

  if (error) {
    return { items: [], error: error.message }
  }

  const items: CartPageItem[] = []
  for (const row of data ?? []) {
    const raw = row as unknown as {
      created_at: string
      quantity?: number | null
      listings:
        | (CartListingRow & { profiles?: CartListingRow["profiles"] | CartListingRow["profiles"][] })
        | (CartListingRow & { profiles?: CartListingRow["profiles"] | CartListingRow["profiles"][] })[]
        | null
    }
    const Lraw = raw.listings
    const L = Array.isArray(Lraw) ? Lraw[0] : Lraw
    if (!L) continue
    if (
      !isListingPurchasable(
        L as CartListingRow & {
          hidden_from_site?: boolean | null
          archived_at?: string | null
        },
      )
    ) {
      continue
    }
    if (!isCartEligibleSection(L.section)) continue
    const p = L.profiles
    const profiles = Array.isArray(p) ? (p[0] ?? null) : (p ?? null)
    const listing: CartListingRow = { ...L, profiles }
    const qty = Math.max(1, Math.floor(Number(raw.quantity) || 1))
    items.push({
      cartCreatedAt: raw.created_at,
      quantity: isReswellShopListing(listing.section) ? qty : 1,
      listing,
      agreedPriceUsd: null,
    })
  }

  const peerIds = items
    .filter((row) => isPeerListingSection(row.listing.section))
    .map((row) => row.listing.id)
  const acceptedOffers = await fetchAcceptedOffersForBuyerListings(supabase, user.id, peerIds)
  if (acceptedOffers.length > 0) {
    const agreedByListingId = new Map<string, number>()
    for (const offer of acceptedOffers) {
      if (agreedByListingId.has(offer.listing_id)) continue
      const listing = items.find((row) => row.listing.id === offer.listing_id)?.listing
      if (!listing || offer.seller_id !== listing.user_id) continue
      const unit = acceptedUnitPriceForSingleItemOffer(offer, offer.listing_id)
      if (unit != null) agreedByListingId.set(offer.listing_id, unit)
    }
    for (const row of items) {
      row.agreedPriceUsd = agreedByListingId.get(row.listing.id) ?? null
    }
  }

  return { items, error: null }
}

export async function getCartItemCount(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { data, error } = await supabase
    .from("cart_items")
    .select("quantity")
    .eq("profile_id", user.id)

  if (error || !data) return 0
  return data.reduce((sum, row) => sum + Math.max(1, Math.floor(Number(row.quantity) || 1)), 0)
}
