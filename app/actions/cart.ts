"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { trackKlaviyoAddedToCart } from "@/lib/klaviyo/track-added-to-cart"
import type { PeerListingCartFields } from "@/lib/peer-listing-cart"

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
  condition?: string | null
  board_type?: string | null
  length_feet?: number | null
  length_inches?: number | null
  length_inches_display?: string | null
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
  listing: CartListingRow
}

async function assertListingEligibleForCart(
  supabase: Awaited<ReturnType<typeof createClient>>,
  listingId: string,
  buyerId: string,
): Promise<{ ok: true; listing: PeerListingCartFields } | { ok: false; message: string }> {
  const { data: row, error } = await supabase
    .from("listings")
    .select("id, user_id, section, status, local_pickup, shipping_available, hidden_from_site")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !row) {
    return { ok: false, message: "Listing not found" }
  }

  const listing = row as PeerListingCartFields & { hidden_from_site?: boolean | null }
  if (listing.hidden_from_site) {
    return { ok: false, message: "This listing is not available" }
  }
  if (listing.section !== "surfboards") {
    return { ok: false, message: "This listing cannot be added to cart" }
  }
  if (listing.status !== "active" && listing.status !== "pending_sale") {
    return { ok: false, message: "This listing is no longer available" }
  }
  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  if (!lp && !sa) {
    return { ok: false, message: "This listing has no checkout option" }
  }
  if (listing.user_id === buyerId) {
    return { ok: false, message: "You cannot add your own listing" }
  }

  return { ok: true, listing }
}

export async function addCartItem(listingId: string): Promise<{ ok: boolean; error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, error: "Sign in to save items" }
  }

  const check = await assertListingEligibleForCart(supabase, listingId, user.id)
  if (!check.ok) {
    return { ok: false, error: check.message }
  }

  const { error } = await supabase.from("cart_items").insert({
    profile_id: user.id,
    listing_id: listingId,
  })

  if (error) {
    if (error.code === "23505") {
      revalidatePath("/cart")
      return { ok: true, error: null }
    }
    return { ok: false, error: error.message }
  }

  const [{ data: listingRow }, { data: firstImage }, { data: profileRow }] =
    await Promise.all([
      supabase
        .from("listings")
        .select("id, title, price, slug, section")
        .eq("id", listingId)
        .maybeSingle(),
      supabase
        .from("listing_images")
        .select("url, thumbnail_url")
        .eq("listing_id", listingId)
        .order("sort_order", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle(),
    ])

  if (listingRow) {
    const photoUrl =
      (firstImage?.thumbnail_url &&
        String(firstImage.thumbnail_url).trim()) ||
      (firstImage?.url && String(firstImage.url).trim()) ||
      null
    const buyerEmail =
      (typeof profileRow?.email === "string" && profileRow.email.trim()
        ? profileRow.email.trim()
        : null) || user.email?.trim() || null
    void trackKlaviyoAddedToCart({
      buyerUserId: user.id,
      buyerEmail,
      listingId: listingRow.id,
      title: String(listingRow.title ?? ""),
      price:
        typeof listingRow.price === "number"
          ? listingRow.price
          : Number(listingRow.price),
      slug: listingRow.slug ?? null,
      section: String(listingRow.section ?? "surfboards"),
      photoUrl,
    })
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

  const { error } = await supabase
    .from("cart_items")
    .delete()
    .eq("profile_id", user.id)
    .eq("listing_id", listingId)

  if (error) {
    return { ok: false, error: error.message }
  }

  revalidatePath("/cart")
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
        condition,
        board_type,
        length_feet,
        length_inches,
        length_inches_display,
        listing_images ( url, thumbnail_url, is_primary ),
        profiles ( display_name, avatar_url, seller_slug, shop_verified, shop_name, is_shop )
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
      listings:
        | (CartListingRow & { profiles?: CartListingRow["profiles"] | CartListingRow["profiles"][] })
        | (CartListingRow & { profiles?: CartListingRow["profiles"] | CartListingRow["profiles"][] })[]
        | null
    }
    const Lraw = raw.listings
    const L = Array.isArray(Lraw) ? Lraw[0] : Lraw
    if (!L) continue
    const p = L.profiles
    const profiles = Array.isArray(p) ? p[0] ?? null : p ?? null
    const listing: CartListingRow = { ...L, profiles }
    items.push({
      cartCreatedAt: raw.created_at,
      listing,
    })
  }

  return { items, error: null }
}

export async function getCartItemCount(): Promise<number> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return 0

  const { count, error } = await supabase
    .from("cart_items")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", user.id)

  if (error) return 0
  return count ?? 0
}
