import type { SupabaseClient } from "@supabase/supabase-js"

export async function updateListingHiddenFromSite(
  client: SupabaseClient,
  listingId: string,
  hiddenFromSite: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client
    .from("listings")
    .update({ hidden_from_site: hiddenFromSite })
    .eq("id", listingId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return { ok: false, message: "Listing not found" }
  }
  return { ok: true }
}

export async function updateListingHiddenFromHomepage(
  client: SupabaseClient,
  listingId: string,
  hiddenFromHomepage: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client
    .from("listings")
    .update({ hidden_from_homepage: hiddenFromHomepage })
    .eq("id", listingId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return { ok: false, message: "Listing not found" }
  }
  return { ok: true }
}

export async function updateListingSuppressedOnBoardsBrowse(
  client: SupabaseClient,
  listingId: string,
  suppressed: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client
    .from("listings")
    .update({ suppressed_on_boards_browse: suppressed })
    .eq("id", listingId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return { ok: false, message: "Listing not found" }
  }
  return { ok: true }
}

export async function updateListingCategoryRow(
  client: SupabaseClient,
  listingId: string,
  patch: { category_id: string; board_type?: string | null },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const row: {
    category_id: string
    updated_at: string
    board_type?: string | null
  } = {
    category_id: patch.category_id,
    updated_at: new Date().toISOString(),
  }
  if (patch.board_type !== undefined) {
    row.board_type = patch.board_type
  }

  const { data, error } = await client
    .from("listings")
    .update(row)
    .eq("id", listingId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return { ok: false, message: "Listing not found" }
  }
  return { ok: true }
}

/** Minimal listing row for Klaviyo when a buyer favorites a listing (seller notification). */
export type ListingFavoriteNotificationRow = {
  user_id: string
  title: string
  slug: string | null
  section: string | null
}

export async function patchListingPriceByOwner(
  client: SupabaseClient,
  params: {
    listingId: string
    ownerUserId: string
    priceUsd: number
    allowedStatuses: readonly string[]
  },
): Promise<
  | { ok: true }
  | { ok: false; kind: "not_found"; message: string }
  | { ok: false; kind: "update_failed"; message: string }
> {
  const { listingId, ownerUserId, priceUsd, allowedStatuses } = params

  const { data, error } = await client
    .from("listings")
    .update({
      price: priceUsd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .eq("user_id", ownerUserId)
    .in("status", [...allowedStatuses])
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, kind: "update_failed", message: error.message }
  }
  if (!data) {
    return {
      ok: false,
      kind: "not_found",
      message: "Listing not found or price can’t be updated in this state.",
    }
  }
  return { ok: true }
}

export async function getListingRowForFavoriteNotification(
  client: SupabaseClient,
  listingId: string,
): Promise<ListingFavoriteNotificationRow | null> {
  const { data, error } = await client
    .from("listings")
    .select("user_id, title, slug, section")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) {
    return null
  }

  return {
    user_id: data.user_id,
    title: data.title,
    slug: data.slug,
    section: data.section,
  }
}
