import assert from "node:assert/strict"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  EMPTY_SHOP_SHIPPING_DEFAULTS,
  SHOP_STORE_DEFAULT_ID,
  SHOP_STORE_DEFAULT_PACKAGE_NAME,
  shopShippingDefaultsToJson,
  type ShopShippingDefaults,
} from "@/lib/shop-shipping-defaults"
import {
  SHOPIFY_DEFAULT_PACKAGE_ROOT_QUERY,
  SHOPIFY_DEFAULT_PACKAGE_SHOP_QUERY,
  fetchShopifyDefaultShippingPackage,
  resetShopifyDefaultPackageSupportForTests,
  saveShopifyDefaultPackageIfMissing,
  shopSavedPackageFromShopifyDefaultPackageResponse,
} from "@/lib/services/shopifyDefaultPackage"

const sampleBox = {
  name: "Sample box",
  default: true,
  dimensions: { length: 21.844, width: 13.716, height: 4.064, unit: "CENTIMETERS" },
  weight: { value: 0.907, unit: "KILOGRAMS" },
}

test("stores Shopify's default package in inches and pounds", () => {
  const saved = shopSavedPackageFromShopifyDefaultPackageResponse({
    shippingPackages: { nodes: [sampleBox] },
  })
  assert.ok(saved)
  assert.equal(saved.id, SHOP_STORE_DEFAULT_ID)
  assert.equal(saved.name, "Sample box")
  assert.equal(saved.presetId, null)
  assert.equal(saved.lengthIn, 8.6)
  assert.equal(saved.widthIn, 5.4)
  assert.equal(saved.heightIn, 1.6)
  assert.ok(Math.abs(saved.weightLb - 2) < 0.02)
  const stored = shopShippingDefaultsToJson({
    ...EMPTY_SHOP_SHIPPING_DEFAULTS,
    storeDefault: saved,
  }).storeDefault
  assert.deepEqual(Object.keys(stored as object).sort(), [
    "heightIn",
    "id",
    "lengthIn",
    "name",
    "presetId",
    "weightLb",
    "widthIn",
  ])
})

test("reads the shop connection shape and ignores buyer contact", () => {
  const saved = shopSavedPackageFromShopifyDefaultPackageResponse({
    shop: {
      email: "owner@shop.example",
      shippingPackages: {
        edges: [
          {
            node: {
              ...sampleBox,
              name: "Mailer",
              email: "buyer@example.com",
              phone: "555-0100",
              address1: "1 Main",
              dimensions: { length: 10, width: 8, height: 4, unit: "INCHES" },
              weight: { value: 32, unit: "OUNCES" },
            },
          },
        ],
      },
    },
  })
  assert.deepEqual(saved, {
    id: SHOP_STORE_DEFAULT_ID,
    name: "Mailer",
    lengthIn: 10,
    widthIn: 8,
    heightIn: 4,
    weightLb: 2,
    presetId: null,
  })
})

test("uses the package Shopify marks as the store default", () => {
  const saved = shopSavedPackageFromShopifyDefaultPackageResponse({
    shippingPackages: {
      nodes: [
        {
          name: "Spare",
          default: false,
          dimensions: { length: 4, width: 4, height: 4, unit: "INCHES" },
          weight: { value: 1, unit: "POUNDS" },
        },
        {
          name: "Store default",
          default: true,
          dimensions: { length: 12, width: 9, height: 3, unit: "INCHES" },
          weight: { value: 1.5, unit: "POUNDS" },
        },
      ],
    },
  })
  assert.equal(saved?.name, "Store default")
  assert.equal(saved?.lengthIn, 12)
  assert.equal(saved?.weightLb, 1.5)
})

test("leaves the shop box empty when Shopify has no usable default", () => {
  assert.equal(
    shopSavedPackageFromShopifyDefaultPackageResponse({
      shippingPackages: { nodes: [] },
    }),
    null,
  )
  assert.equal(
    shopSavedPackageFromShopifyDefaultPackageResponse({
      shippingPackages: {
        nodes: [
          {
            name: "Sample box",
            default: true,
            dimensions: { length: 8, width: 6, height: 2, unit: "INCHES" },
            weight: { value: 0, unit: "POUNDS" },
          },
          {
            name: "Other",
            default: false,
            dimensions: { length: 10, width: 8, height: 4, unit: "INCHES" },
            weight: { value: 2, unit: "POUNDS" },
          },
        ],
      },
    }),
    null,
  )
  assert.equal(
    shopSavedPackageFromShopifyDefaultPackageResponse({
      shippingPackages: {
        nodes: [
          {
            name: "Sample box",
            default: false,
            dimensions: { length: 8, width: 6, height: 2, unit: "INCHES" },
            weight: { value: 1, unit: "POUNDS" },
          },
        ],
      },
    }),
    null,
  )
  assert.equal(
    shopSavedPackageFromShopifyDefaultPackageResponse({
      shippingPackages: {
        nodes: [
          {
            name: "Too big",
            default: true,
            dimensions: { length: 300, width: 10, height: 10, unit: "INCHES" },
            weight: { value: 2, unit: "POUNDS" },
          },
        ],
      },
    }),
    null,
  )
  assert.equal(shopSavedPackageFromShopifyDefaultPackageResponse({ shop: {} }), null)
})

test("converts millimeters, feet, and grams without inventing a unit", () => {
  const saved = shopSavedPackageFromShopifyDefaultPackageResponse({
    shippingPackages: {
      nodes: [
        {
          name: "  ",
          default: true,
          dimensions: { length: 304.8, width: 12, height: 1, unit: "MILLIMETERS" },
          weight: { value: 453.592, unit: "GRAMS" },
        },
      ],
    },
  })
  assert.equal(saved?.name, SHOP_STORE_DEFAULT_PACKAGE_NAME)
  assert.ok(saved)
  assert.ok(Math.abs(saved.lengthIn - 12) < 0.02)
  assert.ok(Math.abs(saved.widthIn - 0.4724) < 0.01)
  assert.ok(Math.abs(saved.weightLb - 1) < 0.02)

  const feet = shopSavedPackageFromShopifyDefaultPackageResponse({
    shippingPackages: {
      nodes: [
        {
          name: "Long tube",
          default: true,
          dimensions: { length: 2, width: 0.5, height: 0.25, unit: "FEET" },
          weight: { value: 1, unit: "POUNDS" },
        },
      ],
    },
  })
  assert.equal(feet?.lengthIn, 24)
  assert.equal(feet?.widthIn, 6)
  assert.equal(feet?.heightIn, 3)

  assert.equal(
    shopSavedPackageFromShopifyDefaultPackageResponse({
      shippingPackages: {
        nodes: [
          {
            name: "Unknown",
            default: true,
            dimensions: { length: 1, width: 1, height: 1, unit: "FURLONGS" },
            weight: { value: 1, unit: "POUNDS" },
          },
        ],
      },
    }),
    null,
  )
})

test("does not ask Shopify for rates, zones, or buyer contact", () => {
  for (const query of [
    SHOPIFY_DEFAULT_PACKAGE_ROOT_QUERY,
    SHOPIFY_DEFAULT_PACKAGE_SHOP_QUERY,
  ]) {
    assert.equal(/\b(email|phone|address|methodDefinitions|zone|rateProvider)\b/i.test(query), false)
  }
})

test("treats a missing package field as no shop box and does not replace a saved box", async () => {
  resetShopifyDefaultPackageSupportForTests()
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return Response.json({
      errors: [{ message: "Field 'shippingPackages' doesn't exist on type 'QueryRoot'" }],
    })
  }) as typeof fetch
  try {
    const first = await fetchShopifyDefaultShippingPackage({
      shopDomain: "pilot.myshopify.com",
      accessToken: "token",
    })
    const second = await fetchShopifyDefaultShippingPackage({
      shopDomain: "pilot.myshopify.com",
      accessToken: "token",
    })
    assert.equal(first, null)
    assert.equal(second, null)
    assert.equal(calls, 2)
  } finally {
    globalThis.fetch = original
  }

  resetShopifyDefaultPackageSupportForTests()
  calls = 0
  globalThis.fetch = (async () => {
    calls += 1
    return Response.json({
      data: {
        shippingPackages: {
          nodes: [
            {
              name: "Shop mailer",
              default: true,
              dimensions: { length: 12, width: 9, height: 2, unit: "INCHES" },
              weight: { value: 1, unit: "POUNDS" },
            },
          ],
        },
      },
    })
  }) as typeof fetch

  const existing: ShopShippingDefaults = {
    ...EMPTY_SHOP_SHIPPING_DEFAULTS,
    physicalProduct: false,
    dimensionUnit: "cm",
    storeDefault: {
      id: SHOP_STORE_DEFAULT_ID,
      name: "Already saved",
      lengthIn: 10,
      widthIn: 8,
      heightIn: 4,
      weightLb: 2,
      presetId: null,
    },
  }
  const kept = profileClient({
    seller_slug: "pilot",
    shop_category_package_sizes: {},
    shop_shipping_defaults: existing,
  })
  try {
    const unchanged = await saveShopifyDefaultPackageIfMissing({
      supabase: kept.supabase,
      userId: "user-1",
      shopDomain: "pilot.myshopify.com",
      accessToken: "token",
    })
    assert.equal(unchanged.storeDefault?.name, "Already saved")
    assert.equal(calls, 0)
    assert.equal(kept.updates.length, 0)

    const empty = profileClient({
      seller_slug: "pilot",
      shop_category_package_sizes: { fins: "small" },
      shop_shipping_defaults: {
        ...EMPTY_SHOP_SHIPPING_DEFAULTS,
        physicalProduct: false,
        dimensionUnit: "cm",
        weightUnit: "kg",
      },
    })
    const imported = await saveShopifyDefaultPackageIfMissing({
      supabase: empty.supabase,
      userId: "user-1",
      shopDomain: "pilot.myshopify.com",
      accessToken: "token",
      current: empty.row.shop_shipping_defaults as ShopShippingDefaults,
    })
    assert.equal(imported.storeDefault?.name, "Shop mailer")
    assert.equal(imported.physicalProduct, false)
    assert.equal(imported.dimensionUnit, "cm")
    assert.equal(imported.weightUnit, "kg")
    assert.equal(calls, 1)
    assert.equal(empty.updates.length, 1)
    const written = empty.updates[0] as { shop_shipping_defaults: Record<string, unknown> }
    assert.equal("email" in written.shop_shipping_defaults, false)
    assert.equal(
      (written.shop_shipping_defaults.storeDefault as { name: string }).name,
      "Shop mailer",
    )
  } finally {
    globalThis.fetch = original
    resetShopifyDefaultPackageSupportForTests()
  }
})

function profileClient(row: {
  seller_slug: string | null
  shop_category_package_sizes: unknown
  shop_shipping_defaults: unknown
}): {
  supabase: SupabaseClient
  updates: unknown[]
  row: typeof row
} {
  const updates: unknown[] = []
  let current = row
  const builder = {
    select() {
      return builder
    },
    eq() {
      return builder
    },
    maybeSingle() {
      return Promise.resolve({ data: current, error: null })
    },
    update(payload: { shop_shipping_defaults?: unknown }) {
      return {
        eq() {
          updates.push(payload)
          current = {
            ...current,
            shop_shipping_defaults: payload.shop_shipping_defaults,
          }
          return Promise.resolve({ error: null })
        },
      }
    },
  }
  return {
    supabase: {
      from(table: string) {
        if (table !== "profiles") throw new Error(table)
        return builder
      },
    } as unknown as SupabaseClient,
    updates,
    get row() {
      return current
    },
  }
}
