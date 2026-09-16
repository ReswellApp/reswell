import type { SupabaseClient } from "@supabase/supabase-js"

export type DueAutoPriceDropListingRow = {
  id: string
  user_id: string
  status: string
  title: string | null
  slug: string | null
  section: string | null
  price: string | number | null
  compare_at_price: string | number | null
  auto_price_drop_floor: string | number | null
  auto_price_drop_scheduled_for: string | null
}

const DUE_LISTING_SELECT =
  "id, user_id, status, title, slug, section, price, compare_at_price, auto_price_drop_floor, auto_price_drop_scheduled_for"

const DEFAULT_DUE_LIMIT = 100

export async function listDueAutoPriceDropListings(
  client: SupabaseClient,
  referenceTime: Date,
  limit = DEFAULT_DUE_LIMIT,
): Promise<DueAutoPriceDropListingRow[]> {
  const { data, error } = await client
    .from("listings")
    .select(DUE_LISTING_SELECT)
    .eq("status", "active")
    .not("auto_price_drop_floor", "is", null)
    .not("auto_price_drop_scheduled_for", "is", null)
    .lte("auto_price_drop_scheduled_for", referenceTime.toISOString())
    .order("auto_price_drop_scheduled_for", { ascending: true })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as DueAutoPriceDropListingRow[]
}

export async function applyListingAutoPriceDropPatch(
  client: SupabaseClient,
  params: {
    listingId: string
    priceUsd: number
    compareAtPriceUsd: number | null
    clearFloor: boolean
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const patch: {
    price: number
    compare_at_price: number | null
    updated_at: string
    auto_price_drop_floor?: null
  } = {
    price: params.priceUsd,
    compare_at_price: params.compareAtPriceUsd,
    updated_at: new Date().toISOString(),
  }
  if (params.clearFloor) {
    patch.auto_price_drop_floor = null
  }

  const { data, error } = await client
    .from("listings")
    .update(patch)
    .eq("id", params.listingId)
    .eq("status", "active")
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return { ok: false, message: "Listing is no longer active." }
  }
  return { ok: true }
}

export async function clearListingAutoPriceDropFloor(
  client: SupabaseClient,
  listingId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await client
    .from("listings")
    .update({
      auto_price_drop_floor: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listingId)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, message: error.message }
  }
  if (!data) {
    return { ok: false, message: "Listing not found." }
  }
  return { ok: true }
}
