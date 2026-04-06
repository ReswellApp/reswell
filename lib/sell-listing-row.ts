import { flagsFromBoardFulfillment, type BoardFulfillmentChoice } from "@/lib/listing-fulfillment"
import { WETSUIT_SIZE_OPTIONS, WETSUIT_THICKNESS_OPTIONS, WETSUIT_ZIP_VALUES, type WetsuitZipValue } from "@/lib/wetsuit-options"
import { LEASH_LENGTH_FT_OPTIONS, LEASH_THICKNESS_OPTIONS } from "@/lib/leash-options"
import {
  COLLECTIBLE_CONDITION_VALUES,
  COLLECTIBLE_ERA_VALUES,
  COLLECTIBLE_TYPE_VALUES,
} from "@/lib/collectible-options"
import { APPAREL_KIND_VALUES, type ApparelKindValue } from "@/lib/apparel-lifestyle-options"
import {
  APPAREL_LIFESTYLE_CATEGORY_ID,
  BACKPACK_CATEGORY_ID,
  BOARD_BAGS_CATEGORY_ID,
  COLLECTIBLES_CATEGORY_ID,
  FINS_CATEGORY_ID,
  LEASHES_CATEGORY_ID,
  WETSUITS_CATEGORY_ID,
} from "@/lib/sell-category-ids"
import { buildResolvedListingTitle, type SellFormValidationInput } from "@/lib/sell-form-validation"

/** Form fields required to build a listings row (extends validation input with map + index picks). */
export type SellListingFormState = SellFormValidationInput & {
  locationLat: number
  locationLng: number
  boardIndexBrandSlug: string
  boardIndexModelSlug: string
  boardIndexLabel: string
}

export function resolveSellListingTitle(listingType: "used" | "board", fd: SellListingFormState): string {
  return buildResolvedListingTitle({ listingType, ...fd })
}

/**
 * Maps sell form state → `public.listings` columns (no user_id, slug, status).
 * Matches `app/sell/page.tsx` create/update payloads.
 */
export function buildSellListingUpsertFields(
  listingType: "used" | "board",
  fd: SellListingFormState,
): Record<string, unknown> {
  const fulfillmentFlags =
    listingType === "used"
      ? { shipping_available: true, local_pickup: false }
      : flagsFromBoardFulfillment(fd.boardFulfillment as BoardFulfillmentChoice)

  const fulfillmentRow = {
    shipping_available: fulfillmentFlags.shipping_available,
    local_pickup: fulfillmentFlags.local_pickup,
    shipping_price: fulfillmentFlags.shipping_available
      ? parseFloat(fd.boardShippingPrice.trim())
      : null,
  }

  const boardLocationLat = listingType === "board" && fd.locationLat ? fd.locationLat : null
  const boardLocationLng = listingType === "board" && fd.locationLng ? fd.locationLng : null
  const boardLocationCity = listingType === "board" ? fd.locationCity.trim() || null : null
  const boardLocationState = listingType === "board" ? fd.locationState.trim() || null : null

  const resolvedListingTitle = resolveSellListingTitle(listingType, fd)

  return {
    title: resolvedListingTitle,
    description: fd.description,
    price: parseFloat(fd.price),
    condition: fd.condition,
    section: listingType === "board" ? "surfboards" : "used",
    category_id: fd.category,
    board_type: listingType === "board" ? fd.boardType : null,
    length_feet:
      listingType === "board" && fd.boardLengthFt ? parseInt(fd.boardLengthFt, 10) : null,
    length_inches:
      listingType === "board" && fd.boardLengthFt ? parseFloat(fd.boardLengthIn) || 0 : null,
    width: listingType === "board" && fd.boardWidthInches ? parseFloat(fd.boardWidthInches) : null,
    thickness: listingType === "board" && fd.boardThicknessInches ? parseFloat(fd.boardThicknessInches) : null,
    volume: listingType === "board" && fd.boardVolumeL ? parseFloat(fd.boardVolumeL) : null,
    fins_setup: listingType === "board" && fd.boardFins ? fd.boardFins : null,
    tail_shape: listingType === "board" && fd.boardTail ? fd.boardTail : null,
    latitude:
      listingType === "board"
        ? boardLocationLat
        : fulfillmentRow.local_pickup && fd.locationLat
          ? fd.locationLat
          : null,
    longitude:
      listingType === "board"
        ? boardLocationLng
        : fulfillmentRow.local_pickup && fd.locationLng
          ? fd.locationLng
          : null,
    city:
      listingType === "board"
        ? boardLocationCity
        : fulfillmentRow.local_pickup
          ? fd.locationCity
          : null,
    state:
      listingType === "board"
        ? boardLocationState
        : fulfillmentRow.local_pickup
          ? fd.locationState
          : null,
    shipping_available: fulfillmentRow.shipping_available,
    local_pickup: fulfillmentRow.local_pickup,
    shipping_price: fulfillmentRow.shipping_price,
    brand:
      listingType === "board" && fd.brand.trim()
        ? fd.brand.trim()
        : listingType === "used" &&
            (fd.category === FINS_CATEGORY_ID || fd.category === BACKPACK_CATEGORY_ID) &&
            fd.brand.trim()
          ? fd.brand.trim()
          : null,
    index_brand_slug: listingType === "board" ? fd.boardIndexBrandSlug.trim() || null : null,
    index_model_slug: listingType === "board" ? fd.boardIndexModelSlug.trim() || null : null,
    index_model_label: listingType === "board" ? fd.boardIndexLabel.trim() || null : null,
    gear_size:
      listingType === "used" &&
      (fd.category === FINS_CATEGORY_ID ||
        fd.category === BACKPACK_CATEGORY_ID ||
        fd.category === BOARD_BAGS_CATEGORY_ID ||
        fd.category === APPAREL_LIFESTYLE_CATEGORY_ID) &&
      fd.gearSize.trim()
        ? fd.gearSize.trim()
        : null,
    gear_color:
      listingType === "used" &&
      (fd.category === FINS_CATEGORY_ID || fd.category === BACKPACK_CATEGORY_ID) &&
      fd.gearColor.trim()
        ? fd.gearColor.trim()
        : null,
    pack_kind:
      listingType === "used" &&
      fd.category === BACKPACK_CATEGORY_ID &&
      (fd.packKind === "surfpack" || fd.packKind === "bag")
        ? fd.packKind
        : null,
    board_bag_kind:
      listingType === "used" &&
      fd.category === BOARD_BAGS_CATEGORY_ID &&
      (fd.boardBagKind === "day" || fd.boardBagKind === "travel")
        ? fd.boardBagKind
        : null,
    apparel_kind:
      listingType === "used" &&
      fd.category === APPAREL_LIFESTYLE_CATEGORY_ID &&
      APPAREL_KIND_VALUES.includes(fd.apparelKind as ApparelKindValue)
        ? fd.apparelKind
        : null,
    wetsuit_size:
      listingType === "used" &&
      fd.category === WETSUITS_CATEGORY_ID &&
      (WETSUIT_SIZE_OPTIONS as readonly string[]).includes(fd.wetsuitSize.trim())
        ? fd.wetsuitSize.trim()
        : null,
    wetsuit_thickness:
      listingType === "used" &&
      fd.category === WETSUITS_CATEGORY_ID &&
      (WETSUIT_THICKNESS_OPTIONS as readonly string[]).includes(fd.wetsuitThickness.trim())
        ? fd.wetsuitThickness.trim()
        : null,
    wetsuit_zip_type:
      listingType === "used" &&
      fd.category === WETSUITS_CATEGORY_ID &&
      WETSUIT_ZIP_VALUES.includes(fd.wetsuitZipType as WetsuitZipValue)
        ? fd.wetsuitZipType
        : null,
    leash_length:
      listingType === "used" &&
      fd.category === LEASHES_CATEGORY_ID &&
      (LEASH_LENGTH_FT_OPTIONS as readonly string[]).includes(fd.leashLength.trim())
        ? fd.leashLength.trim()
        : null,
    leash_thickness:
      listingType === "used" &&
      fd.category === LEASHES_CATEGORY_ID &&
      (LEASH_THICKNESS_OPTIONS as readonly string[]).includes(fd.leashThickness.trim())
        ? fd.leashThickness.trim()
        : null,
    collectible_type:
      listingType === "used" &&
      fd.category === COLLECTIBLES_CATEGORY_ID &&
      (COLLECTIBLE_TYPE_VALUES as readonly string[]).includes(fd.collectibleType)
        ? fd.collectibleType
        : null,
    collectible_era:
      listingType === "used" &&
      fd.category === COLLECTIBLES_CATEGORY_ID &&
      (COLLECTIBLE_ERA_VALUES as readonly string[]).includes(fd.collectibleEra)
        ? fd.collectibleEra
        : null,
    collectible_condition:
      listingType === "used" &&
      fd.category === COLLECTIBLES_CATEGORY_ID &&
      (COLLECTIBLE_CONDITION_VALUES as readonly string[]).includes(fd.collectibleCondition)
        ? fd.collectibleCondition
        : null,
  }
}
