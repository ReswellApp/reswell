"use server"

import { createClient } from "@/lib/supabase/server"

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
    return { success: true as const, favorited: false as const }
  }

  const { error } = await supabase.from("favorites").insert({ user_id: user.id, listing_id: listingId })

  if (error) {
    return { error: "Failed to add favorite" as const }
  }

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
