"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getListingRowForFavoriteNotification } from "@/lib/db/listings"
import { trackKlaviyoFavoritesButton } from "@/lib/klaviyo/track-favorites-button"

export async function toggleFavoriteListing(listingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const }
  }

  if (!listingId) {
    return { error: "Listing ID required" as const }
  }

  const { data: existing } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .single()

  if (existing) {
    await supabase.from("favorites").delete().eq("id", existing.id)
    const { data: meta } = await supabase
      .from("listings")
      .select("slug")
      .eq("id", listingId)
      .maybeSingle()
    const pathSlug = typeof meta?.slug === "string" ? meta.slug.trim() : ""
    revalidatePath(pathSlug ? `/l/${pathSlug}` : `/l/${listingId}`)
    return { success: true as const, favorited: false as const }
  }

  const { data: inserted, error } = await supabase
    .from("favorites")
    .insert({ user_id: user.id, listing_id: listingId })
    .select("id, created_at")
    .single()

  if (error || !inserted) {
    return { error: "Failed to add favorite" as const }
  }

  const listing = await getListingRowForFavoriteNotification(supabase, listingId)

  if (listing && listing.user_id !== user.id) {
    const { data: favoriterProfile } = await supabase
      .from("profiles")
      .select("display_name, shop_name, is_shop")
      .eq("id", user.id)
      .maybeSingle()

    void trackKlaviyoFavoritesButton({
      listingOwnerId: listing.user_id,
      listingId,
      listingTitle: listing.title,
      listingSlug: listing.slug,
      listingSection: listing.section,
      favoriterUserId: user.id,
      favoriterEmail: user.email?.trim() ?? null,
      favoriterProfile,
      favoriteId: inserted.id,
      favoritedAt: inserted.created_at,
    })
  }

  const { data: meta } = await supabase
    .from("listings")
    .select("slug")
    .eq("id", listingId)
    .maybeSingle()
  const pathSlug = typeof meta?.slug === "string" ? meta.slug.trim() : ""
  revalidatePath(pathSlug ? `/l/${pathSlug}` : `/l/${listingId}`)

  return { success: true as const, favorited: true as const }
}

export async function getFavoriteListingIds() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" as const, favorites: [] as string[] }
  }

  const { data: favorites } = await supabase
    .from("favorites")
    .select("listing_id")
    .eq("user_id", user.id)

  return { favorites: favorites?.map((f) => f.listing_id) || [] }
}

export async function isListingFavorited(listingId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { favorited: false }
  }

  const { data } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("listing_id", listingId)
    .single()

  return { favorited: !!data }
}
