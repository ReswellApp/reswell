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
  user_id: string
  brand_id: string | null
  catalog_brand_slug: string | null
  catalog_model_slug: string | null
  model_name: string | null
  length_label: string | null
  width_label: string | null
  thickness_label: string | null
  volume_label: string | null
  condition: BrandModelVariantCondition
  listing_price: number
  sold_price: number | null
  converted_brand_model_variant_id: string | null
}

const SELECT_ADMIN =
  "id, listing_id, user_id, brand_id, catalog_brand_slug, catalog_model_slug, model_name, length_label, width_label, thickness_label, volume_label, condition, listing_price, sold_price, converted_brand_model_variant_id"

/** Joined `listing_images` rows for picker when converting snapshots to catalog imagery. */
export type UserListingBoardModelDataListingImageEmbed = {
  id: string
  url: string
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

/** Joined `listings` row fields for admin board-catalog tools (prefill from live listing). */
export type UserListingBoardModelDataListingEmbed = {
  title: string | null
  slug: string | null
  status: string | null
  board_type: string | null
  price: number | string | null
  condition: string | null
  fins_setup: string | null
  description: string | null
  brand: string | null
  dimensions: string | null
  updated_at: string | null
  listing_images?: UserListingBoardModelDataListingImageEmbed[] | null
}

const LISTING_EMBED_FOR_ADMIN = `title, slug, status, board_type, price, condition, fins_setup, description, brand, dimensions, updated_at,
  listing_images ( id, url, thumbnail_url, is_primary, sort_order )`

function normalizeMoney(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function normalizeListingImages(raw: unknown): UserListingBoardModelDataListingImageEmbed[] | null {
  if (raw == null) return null
  if (!Array.isArray(raw)) return null
  const out: UserListingBoardModelDataListingImageEmbed[] = []
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue
    const r = item as Record<string, unknown>
    const id = r.id
    const url = r.url
    if (typeof id !== "string" || typeof url !== "string" || !url.trim()) continue
    const thumb = r.thumbnail_url
    const isPrimary = r.is_primary
    const sortOrder = r.sort_order
    out.push({
      id,
      url: url.trim(),
      thumbnail_url:
        thumb === null ? null : typeof thumb === "string" && thumb.trim() ? thumb.trim() : null,
      is_primary: typeof isPrimary === "boolean" ? isPrimary : null,
      sort_order:
        typeof sortOrder === "number" && Number.isFinite(sortOrder) ? sortOrder : null,
    })
  }
  return out.length ? out : null
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
    sellerUserId: string
    form: SellFormBoardCatalogSlice
    /** Optional; omit on live publishes so concurrent sold_* updates are not cleared. */
    sold_snapshot?: { sold_price: number }
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const dims: BoardCatalogDimensionLabels = buildBoardCatalogDimensionLabels(input.form)
  const brandId = input.form.boardBrandId.trim() || null

  const priceRaw = input.form.price.trim().replace(/,/g, "")
  const listingPrice = Number.parseFloat(priceRaw)
  if (!Number.isFinite(listingPrice) || listingPrice < 0) {
    return { ok: false, error: "invalid_listing_price" }
  }

  const normalizedCond = sellFormConditionValue(input.form.condition.trim())
  const cond: BrandModelVariantCondition = isListingSellableCondition(normalizedCond)
    ? normalizedCond
    : "good"
  const explicitModel = input.form.boardModelName.trim()
  const modelName =
    explicitModel ||
    input.form.boardIndexLabel.trim() ||
    (input.form.brand.trim() && !input.form.boardIndexModelSlug
      ? input.form.brand.trim()
      : "") ||
    null

  const payload = {
    listing_id: input.listingId,
    user_id: input.sellerUserId,
    brand_id: brandId,
    catalog_brand_slug: input.form.boardIndexBrandSlug.trim() || null,
    catalog_model_slug: input.form.boardIndexModelSlug.trim() || null,
    model_name: modelName,
    length_label: dims.length_label || null,
    width_label: dims.width_label || null,
    thickness_label: dims.thickness_label || null,
    volume_label: dims.volume_label || null,
    condition: cond,
    listing_price: listingPrice,
    ...(input.sold_snapshot
      ? {
          sold_price: input.sold_snapshot.sold_price,
        }
      : {}),
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
    listings?: UserListingBoardModelDataListingEmbed | null
    brands?: { name: string | null; slug: string | null } | null
  })[]
  total: number
}> {
  const limit = Math.min(100, Math.max(1, opts.limit))
  const offset = Math.max(0, opts.offset)

  let q = supabase
    .from("user_listing_board_model_data")
    .select(
      `${SELECT_ADMIN}, listings ( ${LISTING_EMBED_FOR_ADMIN} ), brands ( name, slug )`,
      { count: "exact" },
    )

  if (opts.pendingOnly) {
    q = q.is("converted_brand_model_variant_id", null)
  }

  const { data, error, count } = await q
    .order("id", { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    console.error("listUserListingBoardModelDataForAdminPage:", error.message)
    return { rows: [], total: 0 }
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map((raw) => {
    const base = normalizeRow(raw)
    const listings = raw.listings as
      | UserListingBoardModelDataListingEmbed
      | UserListingBoardModelDataListingEmbed[]
      | null
      | undefined
    const listingsObj = Array.isArray(listings) ? listings[0] ?? null : listings ?? null
    const brands = raw.brands as
      | { name: string | null; slug: string | null }
      | { name: string | null; slug: string | null }[]
      | null
      | undefined
    const brandsObj = Array.isArray(brands) ? brands[0] ?? null : brands ?? null
    const listingsNormalized =
      listingsObj && typeof listingsObj === "object"
        ? ({
            ...(listingsObj as UserListingBoardModelDataListingEmbed),
            listing_images: normalizeListingImages(
              (listingsObj as Record<string, unknown>).listing_images,
            ),
          } satisfies UserListingBoardModelDataListingEmbed)
        : null

    return {
      ...base,
      listings: listingsNormalized,
      brands: brandsObj,
    }
  }) as (UserListingBoardModelDataRow & {
    listings?: UserListingBoardModelDataListingEmbed | null
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

/** Service role — listing just sold via checkout. */
export async function markUserListingBoardModelDataSold(
  service: SupabaseClient,
  listingId: string,
  soldPriceUsd: number,
): Promise<{ ok: true } | { ok: false }> {
  const { error } = await service
    .from("user_listing_board_model_data")
    .update({
      sold_price: soldPriceUsd,
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
  const { data, error } = await supabase
    .from("user_listing_board_model_data")
    .update({
      converted_brand_model_variant_id: variantId,
    })
    .eq("id", snapshotId)
    .is("converted_brand_model_variant_id", null)
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

