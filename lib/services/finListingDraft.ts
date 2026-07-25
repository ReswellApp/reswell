/**
 * Business logic for fin listing drafts (`status = draft`, `hidden_from_site = true`).
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { finsSetupFieldForDb } from "@/lib/listing-facet-write"
import {
  FINS_SECTION,
  USED_FINS_CATEGORY_ID,
  finSystemSlugForDb,
  finSizeSlugForDb,
} from "@/lib/fin-listing-config"
import { isListingSellableCondition } from "@/lib/listing-labels"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import type { FinListingDraftAutosaveInput } from "@/lib/validations/fin-listing-draft-autosave"
import { FIN_LISTING_TITLE_MAX_LENGTH } from "@/lib/validations/fin-listing"
import { sellerPurchasePriceToDb } from "@/lib/utils/seller-purchase-price"
import {
  isListingDimensionDisplaySchemaCacheError,
  withoutListingDimensionDisplayDbFields,
} from "@/lib/listing-dimensions-display"
import type { SellDraftSummary } from "@/lib/services/listingDraftAutosave"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import {
  normalizeSellShippingCostMode,
  type ListingPersistShippingOptions,
} from "@/lib/sell-shipping-cost-mode"

function resolvedFinDraftTitle(input: FinListingDraftAutosaveInput): string {
  return (input.title ?? "").trim() || "Untitled draft"
}

function resolvedFinDraftCondition(input: FinListingDraftAutosaveInput): string {
  const raw = (input.condition ?? "").trim()
  if (isListingSellableCondition(raw)) return raw
  if (raw === "new") return "brand_new"
  if (raw === "like_new") return "excellent"
  return "good"
}

export function buildFinListingDraftRow(
  input: FinListingDraftAutosaveInput,
  options?: ListingPersistShippingOptions,
): Record<string, unknown> {
  const shippingMode = normalizeSellShippingCostMode(
    input.shippingCostMode ?? "reswell",
    options?.allowPrivilegedShippingModes === true,
  )
  let shipping_available = true
  let local_pickup = false
  let shipping_price: number | null = 0
  let board_shipping_cost_mode: string | null = shippingMode
  if (shippingMode === "flat") {
    const raw = (input.shippingPrice ?? "").trim()
    shipping_price = raw ? Number.parseFloat(raw.replace(/,/g, "")) : 0
    if (!Number.isFinite(shipping_price)) shipping_price = 0
  } else if (shippingMode === "free") {
    shipping_price = 0
  } else {
    shipping_price = 0
  }
  const packedRow = reswellPackageFieldsToDb({
    boardShippingCostMode: shippingMode,
    reswellPackageLengthIn: input.reswellPackageLengthIn ?? "",
    reswellPackageWidthIn: input.reswellPackageWidthIn ?? "",
    reswellPackageHeightIn: input.reswellPackageHeightIn ?? "",
    reswellPackageWeightLb: input.reswellPackageWeightLb ?? "",
    reswellPackageWeightOz: input.reswellPackageWeightOz ?? "",
  })

  const priceRaw = (input.price ?? "").trim()
  const price = priceRaw ? Number.parseFloat(priceRaw.replace(/,/g, "")) : 0

  return {
    title: resolvedFinDraftTitle(input).slice(0, FIN_LISTING_TITLE_MAX_LENGTH),
    description: (input.description ?? "").trim() || " ",
    price: Number.isFinite(price) && price >= 0 ? price : 0,
    condition: resolvedFinDraftCondition(input),
    section: FINS_SECTION,
    category_id: USED_FINS_CATEGORY_ID,
    latitude: input.locationLat ?? null,
    longitude: input.locationLng ?? null,
    city: input.locationCity?.trim() || null,
    state: input.locationState?.trim() || null,
    shipping_available,
    local_pickup,
    shipping_price,
    board_shipping_cost_mode,
    ...packedRow,
    buyer_offers_enabled: input.buyerOffers !== false,
    seller_purchase_price_usd: sellerPurchasePriceToDb(input.sellerPurchasePrice ?? ""),
    brand: input.brand?.trim() || null,
    brand_id: input.brandId?.trim() || null,
    model: input.model?.trim() || null,
    brand_model_id: input.brandModelId?.trim() || null,
    fins_setup: finsSetupFieldForDb(input.finSetup ?? undefined),
    fin_system: finSystemSlugForDb(input.finSystem ?? null),
    fin_size: finSizeSlugForDb(input.size ?? null),
    board_type: null,
    status: "draft",
    hidden_from_site: true,
    updated_at: new Date().toISOString(),
  }
}

export async function listFinListingDrafts(
  supabase: SupabaseClient,
  userId: string,
  limit = 20,
): Promise<SellDraftSummary[]> {
  const selectCols = "id, title, price, updated_at, listing_images(url, is_primary, sort_order)"

  let query = supabase
    .from("listings")
    .select(selectCols)
    .eq("user_id", userId)
    .eq("section", FINS_SECTION)
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
      .eq("section", FINS_SECTION)
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

export async function upsertFinListingDraft(
  supabase: SupabaseClient,
  userId: string,
  input: FinListingDraftAutosaveInput,
): Promise<{ id: string }> {
  const allowPrivilegedShippingModes = await fetchProfileIsAdmin(supabase, userId)
  const row = buildFinListingDraftRow(input, { allowPrivilegedShippingModes })
  const listingId = input.listingId?.trim() || null

  if (listingId) {
    const { data: existing, error: exErr } = await supabase
      .from("listings")
      .select("id, user_id, status")
      .eq("id", listingId)
      .maybeSingle()

    if (exErr || !existing) throw new Error("Draft not found")
    if ((existing as { user_id: string }).user_id !== userId) throw new Error("Forbidden")
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

  const insertRow = { user_id: userId, ...row }
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
