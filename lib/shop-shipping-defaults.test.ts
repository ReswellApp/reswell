import assert from "node:assert/strict"
import test from "node:test"
import {
  EMPTY_SHOP_SHIPPING_DEFAULTS,
  SHOP_STORE_DEFAULT_ID,
  createShopSavedPackageId,
  formatStoreDefaultPackageLabel,
  packageFitsSurfboardListing,
  planShopShippingListingUpdates,
  readShopShippingDefaults,
  shopBoardPackSizeForLength,
  shopShippingDefaultsFromDraft,
  shopShippingDefaultsToJson,
  type ShopSavedPackedSize,
  type ShopShippingDefaults,
  type ShopShippingListingTarget,
} from "@/lib/shop-shipping-defaults"

function listing(
  id: string,
  section: string,
  length: number | null,
): ShopShippingListingTarget {
  return {
    id,
    section,
    lengthTotalInches: length,
    columns: {
      shipping_packed_length_in: null,
      shipping_packed_width_in: null,
      shipping_packed_height_in: null,
      shipping_packed_weight_oz: null,
      shipping_package_tier: null,
      shipping_package_band: null,
    },
  }
}

test("maps board length onto the packed-size bands", () => {
  assert.equal(shopBoardPackSizeForLength(null), null)
  assert.equal(shopBoardPackSizeForLength(0), null)
  assert.equal(shopBoardPackSizeForLength(71), "shortboard_compact")
  assert.equal(shopBoardPackSizeForLength(72), "shortboard_medium")
  assert.equal(shopBoardPackSizeForLength(78), "shortboard_medium")
  assert.equal(shopBoardPackSizeForLength(79), "midlength")
  assert.equal(shopBoardPackSizeForLength(100), "midlength")
  assert.equal(shopBoardPackSizeForLength(101), "longboard")
})

test("labels the store default the way the shipping card reads", () => {
  assert.equal(
    formatStoreDefaultPackageLabel("Shop box", "72 × 22 × 5 in, 14 lb"),
    "Store default • Shop box - 72 × 22 × 5 in, 14 lb",
  )
})

test("reads a saved shop default and drops unknown board assignments", () => {
  const savedId = "box_abc12345"
  const defaults = readShopShippingDefaults({
    physicalProduct: false,
    dimensionUnit: "cm",
    weightUnit: "kg",
    storeDefault: {
      name: "Shop box",
      lengthIn: 72,
      widthIn: 22,
      heightIn: 5,
      weightLb: 14,
      presetId: "nope",
    },
    savedPackages: [
      { id: savedId, name: "Travel", lengthIn: 78, widthIn: 25.5, heightIn: 7.25, weightLb: 22 },
      { id: "not-an-id", name: "Skip", lengthIn: 12, widthIn: 10, heightIn: 4, weightLb: 2 },
    ],
    boardSizes: {
      shortboard_compact: "shortboard_compact",
      shortboard_medium: savedId,
      midlength: "missing",
      fins: "small",
    },
  })
  assert.equal(defaults.physicalProduct, false)
  assert.equal(defaults.dimensionUnit, "cm")
  assert.equal(defaults.storeDefault?.presetId, null)
  assert.equal(defaults.savedPackages.length, 1)
  assert.equal(defaults.boardSizes.shortboard_compact, undefined)
  assert.equal(defaults.boardSizes.shortboard_medium, savedId)
  assert.equal(defaults.boardSizes.midlength, undefined)
  assert.deepEqual(readShopShippingDefaults(null), {
    ...EMPTY_SHOP_SHIPPING_DEFAULTS,
    savedPackages: [],
    boardSizes: {},
  })
})

test("converts a draft in centimeters into the stored shop box", () => {
  const saved = shopShippingDefaultsFromDraft({
    physicalProduct: true,
    dimensionUnit: "cm",
    weightUnit: "kg",
    name: "Sample box",
    presetId: null,
    length: "21.844",
    width: "13.716",
    height: "4.064",
    weight: "0.907",
    savedPackages: [],
    boardSizes: {},
  })
  assert.equal(saved.ok, true)
  if (!saved.ok) return
  assert.equal(saved.defaults.storeDefault?.lengthIn, 8.6)
  assert.equal(saved.defaults.storeDefault?.widthIn, 5.4)
  assert.equal(saved.defaults.storeDefault?.heightIn, 1.6)
  assert.equal(saved.defaults.storeDefault?.presetId, null)
  assert.ok(Math.abs((saved.defaults.storeDefault?.weightLb ?? 0) - 2) < 0.02)
})

test("rejects a catalog packed size as a board assignment", () => {
  const saved = shopShippingDefaultsFromDraft({
    physicalProduct: true,
    dimensionUnit: "in",
    weightUnit: "lb",
    name: "Shop box",
    presetId: "shortboard_compact",
    length: "74",
    width: "22",
    height: "5",
    weight: "14",
    savedPackages: [],
    boardSizes: { shortboard_compact: "shortboard_compact" },
  })
  assert.equal(saved.ok, false)
})

test("rejects a half-filled shop box", () => {
  const saved = shopShippingDefaultsFromDraft({
    physicalProduct: true,
    dimensionUnit: "in",
    weightUnit: "lb",
    name: "Shop box",
    presetId: null,
    length: "72",
    width: "",
    height: "",
    weight: "",
    savedPackages: [],
    boardSizes: {},
  })
  assert.equal(saved.ok, false)
})

test("applies each board length to its saved box and leaves a too-small box alone", () => {
  const mediumBox: ShopSavedPackedSize = {
    id: "box_medium01",
    name: "Medium boards",
    lengthIn: 80,
    widthIn: 24,
    heightIn: 6,
    weightLb: 16,
    presetId: null,
  }
  const defaults: ShopShippingDefaults = {
    ...EMPTY_SHOP_SHIPPING_DEFAULTS,
    storeDefault: {
      id: SHOP_STORE_DEFAULT_ID,
      name: "Shop box",
      lengthIn: 74,
      widthIn: 22,
      heightIn: 5,
      weightLb: 14,
      presetId: null,
    },
    savedPackages: [mediumBox],
    boardSizes: { shortboard_medium: mediumBox.id },
  }
  const plan = planShopShippingListingUpdates({
    defaults,
    categoryPresets: {},
    listings: [
      listing("compact-board", "surfboards", 70),
      listing("medium-board", "surfboards", 74),
      listing("log", "surfboards", 110),
      listing("fins", "fins", null),
    ],
  })
  assert.equal(plan.updates.length, 2)
  assert.equal(plan.skippedBecausePackageDoesNotFit, 1)
  const compactUpdate = plan.updates.find((row) => row.id === "compact-board")
  const mediumUpdate = plan.updates.find((row) => row.id === "medium-board")
  assert.equal(compactUpdate?.columns.shipping_packed_length_in, 74)
  assert.equal(compactUpdate?.columns.shipping_package_tier, "shortboard")
  assert.equal(compactUpdate?.columns.shipping_package_band, null)
  assert.equal(mediumUpdate?.columns.shipping_packed_length_in, 80)
  assert.equal(mediumUpdate?.columns.shipping_package_tier, "shortboard")
  assert.equal(mediumUpdate?.columns.shipping_package_band, null)
  assert.equal(packageFitsSurfboardListing(compactUpdate!.columns), true)
})

test("writes a custom shop box onto boards that fit inside it", () => {
  const plan = planShopShippingListingUpdates({
    defaults: {
      ...EMPTY_SHOP_SHIPPING_DEFAULTS,
      storeDefault: {
        id: SHOP_STORE_DEFAULT_ID,
        name: "Shop box",
        lengthIn: 74,
        widthIn: 22,
        heightIn: 5,
        weightLb: 14,
        presetId: null,
      },
    },
    categoryPresets: {},
    listings: [listing("board", "surfboards", 70)],
  })
  assert.equal(plan.updates.length, 1)
  assert.equal(plan.updates[0]?.columns.shipping_packed_length_in, 74)
  assert.equal(plan.updates[0]?.columns.shipping_package_tier, "shortboard")
  assert.equal(plan.updates[0]?.columns.shipping_package_band, null)
})

test("uses the shop box for other categories that do not already have a preset", () => {
  const saved = shopShippingDefaultsFromDraft({
    physicalProduct: true,
    dimensionUnit: "in",
    weightUnit: "lb",
    name: "Mailer",
    presetId: "small",
    length: "12",
    width: "10",
    height: "4",
    weight: "2",
    savedPackages: [],
    boardSizes: {},
  })
  assert.equal(saved.ok, true)
  if (!saved.ok) return
  const open = planShopShippingListingUpdates({
    defaults: saved.defaults,
    categoryPresets: {},
    listings: [listing("fin", "fins", null)],
  })
  assert.equal(open.updates.length, 1)
  assert.equal(open.updates[0]?.columns.shipping_packed_length_in, 12)
  assert.equal(open.updates[0]?.columns.shipping_package_band, null)
  assert.equal(saved.defaults.storeDefault?.presetId, null)
  const held = planShopShippingListingUpdates({
    defaults: saved.defaults,
    categoryPresets: { fins: "large" },
    listings: [listing("fin", "fins", null)],
  })
  assert.equal(held.updates.length, 0)
})

test("does not rewrite listings while physical product is off", () => {
  const plan = planShopShippingListingUpdates({
    defaults: {
      ...EMPTY_SHOP_SHIPPING_DEFAULTS,
      physicalProduct: false,
      storeDefault: {
        id: SHOP_STORE_DEFAULT_ID,
        name: "Shop box",
        lengthIn: 74,
        widthIn: 22,
        heightIn: 5,
        weightLb: 14,
        presetId: null,
      },
    },
    categoryPresets: {},
    listings: [listing("board", "surfboards", 66)],
  })
  assert.deepEqual(plan.updates, [])
})

test("round-trips the stored json", () => {
  const id = createShopSavedPackageId()
  assert.match(id, /^box_[a-z0-9]{10}$/)
  const defaults = readShopShippingDefaults(
    shopShippingDefaultsToJson({
      ...EMPTY_SHOP_SHIPPING_DEFAULTS,
      savedPackages: [
        {
          id,
          name: "Travel",
          lengthIn: 78,
          widthIn: 25.5,
          heightIn: 7.25,
          weightLb: 22,
          presetId: null,
        },
      ],
      boardSizes: { longboard: id },
    }),
  )
  assert.equal(defaults.savedPackages[0]?.id, id)
  assert.equal(defaults.boardSizes.longboard, id)
})
