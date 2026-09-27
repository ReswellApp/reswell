import assert from "node:assert/strict"
import { register } from "node:module"
import { before, describe, it } from "node:test"

register(
  "data:text/javascript," +
    encodeURIComponent(`
import { pathToFileURL } from "node:url"
import { join } from "node:path"
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const abs = join(${JSON.stringify("/workspace")}, specifier.slice(2))
    const file = abs.endsWith(".ts") ? abs : abs + ".ts"
    return { url: pathToFileURL(file).href, shortCircuit: true }
  }
  return nextResolve(specifier, context)
}
`),
)

let catalogApi: typeof import("./catalog-api.ts")
let catalogProduct: typeof import("./catalog-product.ts")

before(async () => {
  catalogApi = await import("./catalog-api.ts")
  catalogProduct = await import("./catalog-product.ts")
})

const LISTING_ID = "6f1c0b2e-3a4d-4e5f-8a7b-9c0d1e2f3a4b"

describe("klaviyo catalog feed item", () => {
  it("marks a live listing in stock and visible to product blocks", () => {
    const item = catalogProduct.listingToKlaviyoCatalogFeedItem({
      id: LISTING_ID,
      title: "6'2 rounded pin",
      price: 750,
      section: "surfboards",
    })

    assert.equal(item.id, LISTING_ID)
    assert.equal(item.inventory_quantity, catalogProduct.KLAVIYO_CATALOG_LIVE_INVENTORY_QUANTITY)
    assert.equal(item.inventory_policy, catalogProduct.KLAVIYO_CATALOG_LIVE_INVENTORY_POLICY)
    assert.equal(item.inventory_policy, 2)
  })
})

describe("klaviyo catalog publish state", () => {
  it("treats an active visible peer listing as live", () => {
    assert.equal(
      catalogApi.isKlaviyoCatalogListingLive({
        status: "active",
        hidden_from_site: false,
        archived_at: null,
        section: "surfboards",
      }),
      true,
    )
  })

  it("keeps sold, hidden, and draft listings out of the live catalog", () => {
    assert.equal(
      catalogApi.isKlaviyoCatalogListingLive({
        status: "sold",
        hidden_from_site: false,
        archived_at: null,
        section: "surfboards",
      }),
      false,
    )
    assert.equal(
      catalogApi.isKlaviyoCatalogListingLive({
        status: "active",
        hidden_from_site: true,
        archived_at: null,
        section: "fins",
      }),
      false,
    )
    assert.equal(
      catalogApi.isKlaviyoCatalogListingLive({
        status: "active",
        hidden_from_site: null,
        archived_at: null,
        section: "fins",
      }),
      false,
    )
    assert.equal(
      catalogApi.isKlaviyoCatalogListingLive({
        status: "active",
        hidden_from_site: false,
        archived_at: "2026-09-25T00:00:00.000Z",
        section: "wetsuits",
      }),
      false,
    )
  })

  it("writes published true and in-stock variant fields for a live listing", () => {
    const item = catalogProduct.listingToKlaviyoCatalogFeedItem({
      id: LISTING_ID,
      title: "Daily driver",
      price: 400,
      section: "surfboards",
    })
    const body = catalogApi.klaviyoCatalogItemWriteBody({
      externalId: LISTING_ID,
      item,
      published: true,
      mode: "update",
    })
    const attributes = body.data.attributes as { published: boolean; url: string }
    assert.equal(attributes.published, true)
    assert.equal(body.data.id, catalogApi.klaviyoCatalogCompoundId(LISTING_ID))
    assert.match(attributes.url, /^https:\/\//)

    const variant = catalogApi.klaviyoCatalogVariantWriteBody({
      listingId: LISTING_ID,
      item,
      published: true,
      mode: "create",
    })
    const variantAttributes = variant.data.attributes as {
      published: boolean
      inventory_quantity: number
      inventory_policy: number
    }
    assert.equal(variantAttributes.published, true)
    assert.equal(variantAttributes.inventory_quantity, 1)
    assert.equal(variantAttributes.inventory_policy, 2)
  })

  it("zeroes stock when the listing is no longer live", () => {
    const item = catalogProduct.listingToKlaviyoCatalogFeedItem({
      id: LISTING_ID,
      title: "Sold board",
      price: 400,
      section: "surfboards",
    })
    const variant = catalogApi.klaviyoCatalogVariantWriteBody({
      listingId: LISTING_ID,
      item,
      published: false,
      variantCompoundId: catalogApi.klaviyoCatalogCompoundId(`${LISTING_ID}-variant`),
      mode: "update",
    })
    const attributes = variant.data.attributes as {
      published: boolean
      inventory_quantity: number
      inventory_policy: number
    }
    assert.equal(attributes.published, false)
    assert.equal(attributes.inventory_quantity, 0)
    assert.equal(attributes.inventory_policy, 1)
  })

  it("recognizes a feed-managed catalog rejection", () => {
    assert.equal(
      catalogApi.isKlaviyoCustomFeedManagedError(
        "Catalog items synced from a custom catalog feed cannot be updated via the API",
      ),
      true,
    )
    assert.equal(catalogApi.isKlaviyoCustomFeedManagedError("rate limit"), false)
  })
})
