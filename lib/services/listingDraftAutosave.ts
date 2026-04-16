import type { SupabaseClient } from "@supabase/supabase-js"
import { listingTitleWithBoardLength } from "@/lib/listing-title-board-length"
import {
  boardDimensionDisplayFields,
  boardDimensionsToDbFields,
  formatBoardLengthForTitle,
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
import type { ListingDraftAutosaveInput } from "@/lib/validations/listing-draft-autosave"
import { LISTING_TITLE_MAX_LENGTH } from "@/lib/sell-form-validation"
import { sellerPurchasePriceToDb } from "@/lib/utils/seller-purchase-price"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import { boardCategoryMap } from "@/lib/utils/board-type-from-category-id"

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
  const boardLengthFmt = formatBoardLengthForTitle(resolveDraftBoardLength(fd))
  const base = (fd.title ?? "").trim()
  return boardLengthFmt ? listingTitleWithBoardLength(base, boardLengthFmt) : base
}

export function buildSurfboardDraftListingRow(
  fd: ListingDraftAutosaveInput,
  defaultCategoryId: string,
): Record<string, unknown> {
  const flags = resolveListingFulfillmentFlagsForSellSubmit(fd)
  const fulfillment = boardFulfillmentChoiceFromListingFlags(flags)
  const packed = reswellPackageFieldsToDb(fd)
  const priceRaw = (fd.price ?? "").trim()
  const price = priceRaw ? parseFloat(priceRaw.replace(/,/g, "")) : 0
  const boardLengthCombined = resolveDraftBoardLength(fd)
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
  const condition =
    conditionRaw === "new" ||
    conditionRaw === "like_new" ||
    conditionRaw === "good" ||
    conditionRaw === "fair"
      ? conditionRaw
      : "good"

  return {
    title: safeTitle.slice(0, LISTING_TITLE_MAX_LENGTH),
    description: desc,
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    condition,
    category_id: categoryId,
    section: "surfboards",
    board_type: fd.boardType?.trim() || null,
    length_feet: dimDb.length_feet,
    length_inches: dimDb.length_inches,
    width: dimDb.width,
    thickness: dimDb.thickness,
    volume: dimDb.volume,
    ...dimDisplay,
    fins_setup: fd.boardFins?.trim() ? fd.boardFins.trim() : null,
    tail_shape: fd.boardTail?.trim() ? fd.boardTail.trim() : null,
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

  let priorQ = await supabase
    .from("listings")
    .select("id")
    .eq("user_id", userId)
    .eq("section", "surfboards")
    .eq("status", "draft")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (
    priorQ.error &&
    (priorQ.error.code === "42703" ||
      (typeof priorQ.error.message === "string" && priorQ.error.message.includes("archived_at")))
  ) {
    priorQ = await supabase
      .from("listings")
      .select("id")
      .eq("user_id", userId)
      .eq("section", "surfboards")
      .eq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  }

  if (priorQ.error && !priorQ.data) {
    throw priorQ.error
  }

  const priorId =
    priorQ.data && typeof (priorQ.data as { id?: string }).id === "string"
      ? (priorQ.data as { id: string }).id
      : undefined
  if (priorId) {
    let { error: upErr } = await supabase.from("listings").update(row).eq("id", priorId)
    if (upErr && isListingDimensionDisplaySchemaCacheError(upErr)) {
      const retry = await supabase
        .from("listings")
        .update(withoutListingDimensionDisplayDbFields(row))
        .eq("id", priorId)
      upErr = retry.error
    }
    if (upErr) throw upErr
    return { id: priorId }
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
