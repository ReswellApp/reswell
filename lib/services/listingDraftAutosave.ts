import type { SupabaseClient } from "@supabase/supabase-js"
import {
  boardDimensionDisplayFields,
  boardDimensionsToDbFields,
  formatBoardLengthInputFromParts,
} from "@/lib/board-measurements"
import type { BoardFulfillmentChoice } from "@/lib/listing-fulfillment"
import { flagsFromBoardFulfillment } from "@/lib/listing-fulfillment"
import type { BoardShippingCostMode } from "@/lib/sell-form-validation"
import {
  boardFulfillmentChoiceFromListingFlags,
  reswellPackageFieldsToDb,
  resolveListingFulfillmentFlagsForSellSubmit,
} from "@/lib/sell-listing-fulfillment-flags"
import { isListingSellableCondition } from "@/lib/listing-labels"
import type { ListingDraftAutosaveInput } from "@/lib/validations/listing-draft-autosave"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"
import { sellerPurchasePriceToDb } from "@/lib/utils/seller-purchase-price"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { boardCategoryMap, resolveListingBoardTypeFromCategory } from "@/lib/utils/board-type-from-category-id"
import { boardBrowseFacetFieldsForDb } from "@/lib/listing-facet-write"

function shippingPriceToDb(
  fulfillment: BoardFulfillmentChoice,
  raw: string,
  mode: BoardShippingCostMode | undefined,
): number | null {
  const flags = flagsFromBoardFulfillment(fulfillment)
  if (!flags.shipping_available) return null
  const m = mode ?? "reswell"
  if (m === "flat") {
    const t = raw.trim()
    if (!t) return 0
    const n = parseFloat(t.replace(/,/g, ""))
    return Number.isFinite(n) ? n : null
  }
  return 0
}

function resolveDraftBoardLength(fd: ListingDraftAutosaveInput): string {
  const c = fd.boardLength?.trim()
  if (c) return c
  return formatBoardLengthInputFromParts(fd.boardLengthFt ?? "", fd.boardLengthIn ?? "")
}

function resolvedDraftTitle(fd: ListingDraftAutosaveInput): string {
  return (fd.title ?? "").trim()
}

export function buildSurfboardDraftListingRow(
  fd: ListingDraftAutosaveInput,
  defaultCategoryId: string,
): Record<string, unknown> {
  const flags = resolveListingFulfillmentFlagsForSellSubmit(fd)
  const fulfillment = boardFulfillmentChoiceFromListingFlags(flags)
  const boardLengthCombined = resolveDraftBoardLength(fd)
  const packed = reswellPackageFieldsToDb({
    ...fd,
    boardLength: boardLengthCombined,
  })
  const priceRaw = (fd.price ?? "").trim()
  const price = priceRaw ? parseFloat(priceRaw.replace(/,/g, "")) : 0
  const dimDb = boardDimensionsToDbFields({
    boardLength: boardLengthCombined,
    boardWidthInches: fd.boardWidthInches ?? "",
    boardThicknessInches: fd.boardThicknessInches ?? "",
    boardVolumeL: fd.boardVolumeL ?? "",
  })
  const dimDisplay = boardDimensionDisplayFields({
    boardLength: boardLengthCombined,
    boardWidthInches: fd.boardWidthInches ?? "",
    boardThicknessInches: fd.boardThicknessInches ?? "",
    boardVolumeL: fd.boardVolumeL ?? "",
  })
  const title = resolvedDraftTitle(fd)
  const safeTitle = title.trim() || "Untitled draft"
  const desc = (fd.description ?? "").trim() || " "
  const categoryId = fd.category && fd.category.length > 0 ? fd.category : defaultCategoryId
  const conditionRaw = (fd.condition ?? "").trim()
  const condition = isListingSellableCondition(conditionRaw)
    ? conditionRaw
    : conditionRaw === "new"
      ? "brand_new"
      : conditionRaw === "like_new"
        ? "excellent"
        : "good"

  return {
    title: safeTitle.slice(0, LISTING_TITLE_MAX_LENGTH),
    description: desc,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    condition,
    category_id: categoryId,
    section: "surfboards",
    board_type: resolveListingBoardTypeFromCategory(categoryId, fd.boardType),
    length_feet: dimDb.length_feet,
    length_inches: dimDb.length_inches,
    width: dimDb.width,
    thickness: dimDb.thickness,
    volume: dimDb.volume,
    ...dimDisplay,
    fins_setup: fd.boardFins?.trim() ? fd.boardFins.trim() : null,
    tail_shape: fd.boardTail?.trim() ? fd.boardTail.trim() : null,
    ...boardBrowseFacetFieldsForDb({
      boardLength: boardLengthCombined,
      boardVolumeL: fd.boardVolumeL ?? "",
      boardFins: fd.boardFins,
      boardFinSystem: fd.boardFinSystem,
      boardConstruction: fd.boardConstruction,
    }),
    model: fd.boardModelName?.trim() ? fd.boardModelName.trim() : null,
    brand_model_id: fd.boardBrandModelId?.trim() ? fd.boardBrandModelId.trim() : null,
    latitude: fd.locationLat ? fd.locationLat : null,
    longitude: fd.locationLng ? fd.locationLng : null,
    city: fd.locationCity?.trim() || null,
    state: fd.locationState?.trim() || null,
    shipping_available: flags.shipping_available,
    local_pickup: flags.local_pickup,
    shipping_price: shippingPriceToDb(
      fulfillment,
      fd.boardShippingPrice ?? "",
      fd.boardShippingCostMode as BoardShippingCostMode | undefined,
    ),
    board_shipping_cost_mode: flags.shipping_available
      ? ((fd.boardShippingCostMode ?? "reswell") as BoardShippingCostMode)
      : null,
    ...packed,
    auto_price_drop_floor: (() => {
      if (fd.autoPriceDrop !== true) return null
      const t = (fd.autoPriceDropFloor ?? "").trim().replace(/,/g, "")
      if (!t) return null
      const n = parseFloat(t)
      return Number.isFinite(n) ? n : null
    })(),
    buyer_offers_enabled: fd.buyerOffers !== false,
    brand: fd.brand?.trim() ? fd.brand.trim() : null,
    brand_id: fd.boardBrandId?.trim() || null,
    seller_purchase_price_usd: sellerPurchasePriceToDb(fd.sellerPurchasePrice ?? ""),
    status: "draft",
    hidden_from_site: true,
    updated_at: new Date().toISOString(),
  }
}

export interface SellDraftSummary {
  id: string
  title: string | null
  price: number | null
  updatedAt: string
  primaryImageUrl: string | null
}

/**
 * Returns the seller's recent surfboard drafts (most recent first) with the metadata
 * the /sell "Drafts" picker needs to render thumbnails, titles, prices, and timestamps.
 */
export async function listSurfboardListingDrafts(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<SellDraftSummary[]> {
  const selectCols = "id, title, price, updated_at, listing_images(url, is_primary, sort_order)"

  let query = supabase
    .from("listings")
    .select(selectCols)
    .eq("user_id", userId)
    .eq("section", "surfboards")
    .eq("status", "draft")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit)

  let { data, error } = await query
  if (
    error &&
    (error.code === "42703" ||
      (typeof error.message === "string" && error.message.includes("archived_at")))
  ) {
    const fallback = await supabase
      .from("listings")
      .select(selectCols)
      .eq("user_id", userId)
      .eq("section", "surfboards")
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(limit)
    data = fallback.data
    error = fallback.error
  }
  if (error) throw error

  type Row = {
    id: string
    title: string | null
    price: number | null
    updated_at: string
    listing_images:
      | { url: string | null; is_primary: boolean | null; sort_order: number | null }[]
      | null
  }
  const rows = (data ?? []) as Row[]
  return rows.map((r) => {
    const imgs = Array.isArray(r.listing_images) ? r.listing_images : []
    const primary =
      imgs.find((i) => i.is_primary) ??
      imgs.slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0]
    const rawTitle = typeof r.title === "string" ? r.title.trim() : ""
    return {
      id: r.id,
      title: rawTitle && rawTitle !== "Untitled draft" ? rawTitle : null,
      price: typeof r.price === "number" ? r.price : null,
      updatedAt: r.updated_at,
      primaryImageUrl: primary?.url ?? null,
    }
  })
}

async function fetchDefaultBoardCategoryId(supabase: SupabaseClient): Promise<string | null> {
  const preferred = boardCategoryMap.shortboard
  const { data, error } = await supabase
    .from("categories")
    .select("id")
    .eq("id", preferred)
    .maybeSingle()
  if (!error && data?.id) return data.id as string

  const { data: fallback, error: fbErr } = await supabase
    .from("categories")
    .select("id")
    .eq("board", true)
    .order("name")
    .limit(1)
    .maybeSingle()
  if (fbErr || !fallback?.id) return null
  return fallback.id as string
}

export async function upsertSurfboardListingDraft(
  supabase: SupabaseClient,
  userId: string,
  input: ListingDraftAutosaveInput,
): Promise<{ id: string }> {
  const defaultCategoryId = await fetchDefaultBoardCategoryId(supabase)
  if (!defaultCategoryId) {
    throw new Error("No board category configured")
  }

  const row = buildSurfboardDraftListingRow(input, defaultCategoryId)
  const listingId = input.listingId?.trim() || null

  if (listingId) {
    const { data: existing, error: exErr } = await supabase
      .from("listings")
      .select("id, user_id, status")
      .eq("id", listingId)
      .maybeSingle()

    if (exErr || !existing) {
      throw new Error("Draft not found")
    }
    if ((existing as { user_id: string }).user_id !== userId) {
      throw new Error("Forbidden")
    }
    if ((existing as { status: string }).status !== "draft") {
      throw new Error("Listing is not a draft")
    }

    let { error: upErr } = await supabase.from("listings").update(row).eq("id", listingId)
    if (upErr && isListingDimensionDisplaySchemaCacheError(upErr)) {
      const retry = await supabase
        .from("listings")
        .update(withoutListingDimensionDisplayDbFields(row))
        .eq("id", listingId)
      upErr = retry.error
    }
    if (upErr) throw upErr
    return { id: listingId }
  }

  const insertRow = {
    user_id: userId,
    ...row,
  }
  let { data: created, error: insErr } = await supabase
    .from("listings")
    .insert(insertRow)
    .select("id")
    .single()

  if (insErr && isListingDimensionDisplaySchemaCacheError(insErr)) {
    const retry = await supabase
      .from("listings")
      .insert({
        user_id: userId,
        ...withoutListingDimensionDisplayDbFields(row),
      })
      .select("id")
      .single()
    created = retry.data
    insErr = retry.error
  }

  if (insErr || !created?.id) {
    throw insErr ?? new Error("Failed to create draft")
  }
  return { id: created.id as string }
}
