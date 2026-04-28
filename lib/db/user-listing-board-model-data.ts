import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  BoardCatalogDimensionLabels,
  SellFormBoardCatalogSlice,
} from "@/lib/utils/listing-board-catalog-snapshot"
import { buildBoardCatalogDimensionLabels } from "@/lib/utils/listing-board-catalog-snapshot"
import {
  isListingSellableCondition,
  sellFormConditionValue,
} from "@/lib/listing-labels"
import type { BrandModelVariantCondition } from "@/lib/validations/brand-model-variants"

export type UserListingBoardModelDataRow = {
  id: string
  listing_id: string
  listing_url: string
  user_id: string
  brand_id: string | null
  catalog_brand_slug: string | null
  catalog_model_slug: string | null
  model_name: string | null
  category_id: string | null
  dimensions: string
  length_label: string | null
  width_label: string | null
  thickness_label: string | null
  volume_label: string | null
  condition: BrandModelVariantCondition
  listing_price: number
  fins_setup: string | null
  sold_price: number | null
  sold_at: string | null
  converted_brand_model_variant_id: string | null
  converted_at: string | null
  dismissed_at: string | null
  admin_notes: string | null
  created_at: string
  updated_at: string
}

const SELECT_ADMIN =
  "id, listing_id, listing_url, user_id, brand_id, catalog_brand_slug, catalog_model_slug, model_name, category_id, dimensions, length_label, width_label, thickness_label, volume_label, condition, listing_price, fins_setup, sold_price, sold_at, converted_brand_model_variant_id, converted_at, dismissed_at, admin_notes, created_at, updated_at"

function normalizeMoney(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeRow(raw: Record<string, unknown>): UserListingBoardModelDataRow {
  return {
    ...(raw as Omit<UserListingBoardModelDataRow, "listing_price" | "sold_price">),
    listing_price: Number(normalizeMoney(raw.listing_price) ?? 0),
    sold_price: normalizeMoney(raw.sold_price),
  }
}

export async function upsertUserListingBoardModelDataFromSellForm(
  supabase: SupabaseClient,
  input: {
    listingId: string
    listingUrl: string
    sellerUserId: string
    form: SellFormBoardCatalogSlice
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const listingUrl = input.listingUrl.trim().slice(0, 2048)
  if (!listingUrl.startsWith("/l/") || listingUrl.length < 4) {
    return { ok: false, error: "invalid_listing_url" }
  }

  const dims: BoardCatalogDimensionLabels = buildBoardCatalogDimensionLabels(input.form)
  const brandId = input.form.boardBrandId.trim() || null
  const categoryId = input.form.category.trim() || null

  const priceRaw = input.form.price.trim().replace(/,/g, "")
  const listingPrice = Number.parseFloat(priceRaw)
  if (!Number.isFinite(listingPrice) || listingPrice < 0) {
    return { ok: false, error: "invalid_listing_price" }
  }

  const normalizedCond = sellFormConditionValue(input.form.condition.trim())
  const cond: BrandModelVariantCondition = isListingSellableCondition(normalizedCond)
    ? normalizedCond
    : "good"
  const modelName =
    input.form.boardIndexLabel.trim() ||
    (input.form.brand.trim() && !input.form.boardIndexModelSlug
      ? input.form.brand.trim()
      : "") ||
    null

  const fins = input.form.boardFins.trim() ? input.form.boardFins.trim() : null

  const now = new Date().toISOString()

  const payload = {
    listing_id: input.listingId,
    listing_url: listingUrl,
    user_id: input.sellerUserId,
    brand_id: brandId,
    catalog_brand_slug: input.form.boardIndexBrandSlug.trim() || null,
    catalog_model_slug: input.form.boardIndexModelSlug.trim() || null,
    model_name: modelName,
    category_id: categoryId,
    dimensions: dims.dimensions_summary,
    length_label: dims.length_label || null,
    width_label: dims.width_label || null,
    thickness_label: dims.thickness_label || null,
    volume_label: dims.volume_label || null,
    condition: cond,
    listing_price: listingPrice,
    fins_setup: fins,
    updated_at: now,
  }

  const { error } = await supabase.from("user_listing_board_model_data").upsert(payload, {
    onConflict: "listing_id",
    ignoreDuplicates: false,
  })

  if (error) {
    console.error("upsertUserListingBoardModelDataFromSellForm:", error.message)
    return { ok: false, error: error.message }
  }

  return { ok: true }
}

export async function listUserListingBoardModelDataForAdminPage(
  supabase: SupabaseClient,
  opts: {
    limit: number
    offset: number
    pendingOnly: boolean
  },
): Promise<{
  rows: (UserListingBoardModelDataRow & {
    listings?: { title: string | null; slug: string | null; status: string | null } | null
    brands?: { name: string | null; slug: string | null } | null
  })[]
  total: number
}> {
  const limit = Math.min(100, Math.max(1, opts.limit))
  const offset = Math.max(0, opts.offset)

  let q = supabase
    .from("user_listing_board_model_data")
    .select(
      `${SELECT_ADMIN}, listings ( title, slug, status ), brands ( name, slug )`,
      { count: "exact" },
    )

  if (opts.pendingOnly) {
    q = q.is("converted_at", null).is("dismissed_at", null)
  }

  const { data, error, count } = await q
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error("listUserListingBoardModelDataForAdminPage:", error.message)
    return { rows: [], total: 0 }
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map((raw) => {
    const base = normalizeRow(raw)
    const listings = raw.listings as
      | { title: string | null; slug: string | null; status: string | null }
      | { title: string | null; slug: string | null; status: string | null }[]
      | null
      | undefined
    const listingsObj = Array.isArray(listings) ? listings[0] ?? null : listings ?? null
    const brands = raw.brands as
      | { name: string | null; slug: string | null }
      | { name: string | null; slug: string | null }[]
      | null
      | undefined
    const brandsObj = Array.isArray(brands) ? brands[0] ?? null : brands ?? null
    return {
      ...base,
      listings: listingsObj,
      brands: brandsObj,
    }
  }) as (UserListingBoardModelDataRow & {
    listings?: { title: string | null; slug: string | null; status: string | null } | null
    brands?: { name: string | null; slug: string | null } | null
  })[]

  return {
    rows,
    total: count ?? rows.length,
  }
}

export async function getUserListingBoardModelDataByIdForAdmin(
  supabase: SupabaseClient,
  id: string,
): Promise<UserListingBoardModelDataRow | null> {
  const { data, error } = await supabase
    .from("user_listing_board_model_data")
    .select(SELECT_ADMIN)
    .eq("id", id)
    .maybeSingle()

  if (error) {
    console.error("getUserListingBoardModelDataByIdForAdmin:", error.message)
    return null
  }
  if (!data) return null
  return normalizeRow(data as Record<string, unknown>)
}

export async function patchUserListingBoardModelDataAdminFields(
  supabase: SupabaseClient,
  id: string,
  patch: { admin_notes?: string | null; dismissed_at?: string | null },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (patch.admin_notes !== undefined) updates.admin_notes = patch.admin_notes
  if (patch.dismissed_at !== undefined) updates.dismissed_at = patch.dismissed_at

  const { error } = await supabase.from("user_listing_board_model_data").update(updates).eq("id", id)

  if (error) {
    console.error("patchUserListingBoardModelDataAdminFields:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/** Service role — listing just sold via checkout. */
export async function markUserListingBoardModelDataSold(
  service: SupabaseClient,
  listingId: string,
  soldPriceUsd: number,
  soldAtIso: string,
): Promise<{ ok: true } | { ok: false }> {
  const { error } = await service
    .from("user_listing_board_model_data")
    .update({
      sold_price: soldPriceUsd,
      sold_at: soldAtIso,
      updated_at: new Date().toISOString(),
    })
    .eq("listing_id", listingId)

  if (error) {
    if (error.code === "PGRST116" || /row not found/i.test(error.message)) {
      return { ok: false }
    }
    console.error("markUserListingBoardModelDataSold:", error.message)
    return { ok: false }
  }
  return { ok: true }
}

export async function linkSnapshotToConvertedVariant(
  supabase: SupabaseClient,
  snapshotId: string,
  variantId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("user_listing_board_model_data")
    .update({
      converted_brand_model_variant_id: variantId,
      converted_at: now,
      updated_at: now,
    })
    .eq("id", snapshotId)
    .is("converted_at", null)
    .select("id")
    .maybeSingle()

  if (error) {
    console.error("linkSnapshotToConvertedVariant:", error.message)
    return { ok: false, error: error.message }
  }
  if (!data?.id) {
    return { ok: false, error: "Snapshot not found or already converted" }
  }
  return { ok: true }
}

