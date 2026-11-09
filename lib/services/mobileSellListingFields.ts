import type { MobileSellDraft, MobileSellPublish } from "@reswell/api-contract"
import { USED_ACCESSORIES_CATEGORY_ID } from "@/lib/accessory-listing-config"
import { USED_APPAREL_CATEGORY_ID } from "@/lib/apparel-listing-config"
import { USED_BOARDBAGS_CATEGORY_ID } from "@/lib/boardbag-listing-config"
import { USED_FINS_CATEGORY_ID } from "@/lib/fin-listing-config"
import { boardBrowseFacetFieldsForDb, finsSetupFieldForDb } from "@/lib/listing-facet-write"
import { listingDimensionsColumnFromSurfboardSellForm } from "@/lib/listing-dimensions-storage"
import { USED_LEASHES_CATEGORY_ID } from "@/lib/leash-listing-config"
import { USED_MAGAZINES_CATEGORY_ID } from "@/lib/magazine-listing-config"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import { USED_SURFPACKS_CATEGORY_ID } from "@/lib/surfpack-listing-config"
import { USED_TRACTION_CATEGORY_ID } from "@/lib/traction-listing-config"
import { boardCategoryMap, categoryIdForBrowseBoardType } from "@/lib/utils/board-type-from-category-id"
import { USED_WETSUITS_CATEGORY_ID } from "@/lib/wetsuit-listing-config"

const CATEGORY_IDS = {
  fins: USED_FINS_CATEGORY_ID,
  traction: USED_TRACTION_CATEGORY_ID,
  wetsuits: USED_WETSUITS_CATEGORY_ID,
  apparel: USED_APPAREL_CATEGORY_ID,
  magazines: USED_MAGAZINES_CATEGORY_ID,
  boardbags: USED_BOARDBAGS_CATEGORY_ID,
  surfpacks: USED_SURFPACKS_CATEGORY_ID,
  leashes: USED_LEASHES_CATEGORY_ID,
  accessories: USED_ACCESSORIES_CATEGORY_ID,
} as const

function draftCondition(value: MobileSellDraft["condition"]): MobileSellPublish["condition"] {
  if (
    value === "brand_new" ||
    value === "excellent" ||
    value === "very_good" ||
    value === "good" ||
    value === "fair" ||
    value === "poor"
  ) {
    return value
  }
  return "good"
}

/** Listing columns shared with the website sell insert. Photos are stored separately. */
export function mobileSellListingFields(
  input: MobileSellPublish,
): { ok: true; fields: Record<string, unknown> } | { ok: false; error: string } {
  const categoryId =
    input.category === "surfboards" ? categoryIdForBrowseBoardType(input.subcategory) : CATEGORY_IDS[input.category]
  if (!categoryId) return { ok: false, error: "Choose a board style" }
  const surfboard = input.category === "surfboards"
  const pickupAllowed = surfboard
  const localPickup = pickupAllowed ? input.local_pickup : false

  const shippingOn = input.shipping
  const mode = input.shipping_mode
  if (!shippingOn && !pickupAllowed) {
    return { ok: false, error: "Shipping is required for this category" }
  }
  if (!shippingOn && !localPickup) {
    return { ok: false, error: "Choose local pickup or shipping" }
  }
  const shipping = !shippingOn
    ? { shipping_available: false, local_pickup: true, shipping_price: null, board_shipping_cost_mode: null }
    : mode === "free"
      ? { shipping_available: true, local_pickup: localPickup, shipping_price: 0, board_shipping_cost_mode: "free" }
      : mode === "flat"
        ? {
            shipping_available: true,
            local_pickup: localPickup,
            shipping_price: input.shipping_price ?? 0,
            board_shipping_cost_mode: "flat",
          }
        : { shipping_available: true, local_pickup: localPickup, shipping_price: 0, board_shipping_cost_mode: "reswell" }

  const packed =
    shippingOn && mode === "reswell" && input.package_length.trim()
      ? reswellPackageFieldsToDb({
          boardShippingCostMode: "reswell",
          adminCustomShippingCarton: true,
          reswellPackageLengthIn: input.package_length,
          reswellPackageWidthIn: input.package_width,
          reswellPackageHeightIn: input.package_height,
          reswellPackageWeightLb: input.package_weight_lb,
          reswellPackageWeightOz: input.package_weight_oz,
        })
      : {
          shipping_packed_length_in: null,
          shipping_packed_width_in: null,
          shipping_packed_height_in: null,
          shipping_packed_weight_oz: null,
          shipping_package_tier: null,
          shipping_package_band: null,
        }

  const specs = input.specs
  const dimensions = surfboard
    ? listingDimensionsColumnFromSurfboardSellForm({
        boardLength: specs.length ?? "",
        boardWidthInches: specs.width ?? "",
        boardThicknessInches: specs.thickness ?? "",
        boardVolumeL: specs.volume ?? "",
      })
    : null
  const facets = surfboard
    ? boardBrowseFacetFieldsForDb({
        boardLength: specs.length,
        boardVolumeL: specs.volume,
        boardFins: specs.fin_setup,
        boardFinSystem: specs.fin_system,
        boardConstruction: specs.construction,
        boardFinsIncluded: specs.fins_included,
      })
    : {
        length_total_inches: null,
        volume_liters: null,
        fin_system: null,
        construction: null,
        fins_included: null,
      }

  return {
    ok: true,
    fields: {
      title: input.title,
      description: input.description,
      price: input.price,
      condition: input.condition,
      section: input.category,
      category_id: categoryId,
      board_type: surfboard ? input.subcategory : null,
      dimensions,
      fins_setup: surfboard ? finsSetupFieldForDb(specs.fin_setup) : null,
      ...facets,
      latitude: input.location_lat,
      longitude: input.location_lng,
      city: input.city,
      state: input.state,
      ...shipping,
      dropoff_location_id: shippingOn && input.dropoff_location_id ? input.dropoff_location_id : null,
      ...packed,
      brand: input.brand,
      model: input.model,
      buyer_offers_enabled: true,
    },
  }
}

/** Same columns as a published listing, hidden until Post listing. */
export function mobileSellDraftFields(
  input: MobileSellDraft,
): { ok: true; fields: Record<string, unknown> } | { ok: false; error: string } {
  const surfboard = input.category === "surfboards"
  const categoryId =
    input.category === "surfboards"
      ? (categoryIdForBrowseBoardType(input.subcategory) ?? boardCategoryMap.shortboard)
      : CATEGORY_IDS[input.category]
  if (!categoryId) return { ok: false, error: "Choose a category before saving a draft" }

  const built = mobileSellListingFields({
    ...input,
    title: input.title.trim() || "Untitled draft",
    description: input.description.trim() || " ",
    brand: input.brand.trim() || "Draft",
    model: input.model.trim() || "Draft",
    subcategory: surfboard ? input.subcategory || "shortboard" : input.subcategory,
    condition: draftCondition(input.condition),
    price: input.price && input.price > 0 ? input.price : 0.01,
    city: input.city.trim() || "Draft",
    state: input.state.trim() || "CA",
    location_lat: input.location_lat ?? 0,
    location_lng: input.location_lng ?? 0,
    images: input.images.length > 0 ? input.images : [{ url: "https://example.com/a.jpg", thumbnail_url: "https://example.com/b.jpg" }],
    draft_id: input.id,
  })
  if (!built.ok) return built

  const fields = { ...built.fields }
  if (!input.title.trim()) fields.title = "Untitled draft"
  if (!input.description.trim()) fields.description = " "
  if (!input.brand.trim()) fields.brand = null
  if (!input.model.trim()) fields.model = null
  if (surfboard && !input.subcategory) {
    fields.board_type = null
    fields.category_id = boardCategoryMap.shortboard
  }
  if (!input.city.trim()) fields.city = null
  if (!input.state.trim()) fields.state = null
  if (input.location_lat == null) fields.latitude = null
  if (input.location_lng == null) fields.longitude = null
  if (input.price == null || input.price <= 0) fields.price = 0
  fields.status = "draft"
  fields.hidden_from_site = true
  return { ok: true, fields }
}
