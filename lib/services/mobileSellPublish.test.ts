import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { MobileSellDraft, MobileSellPublish } from "@reswell/api-contract"
import { USED_FINS_CATEGORY_ID } from "@/lib/fin-listing-config"
import { mobileSellDraftFields, mobileSellListingFields } from "@/lib/services/mobileSellListingFields"
import { boardCategoryMap } from "@/lib/utils/board-type-from-category-id"

const image = {
  url: "https://example.supabase.co/storage/v1/object/public/listings/user/a-full.jpg",
  thumbnail_url: "https://example.supabase.co/storage/v1/object/public/listings/user/a-thumb.jpg",
}

function publishInput(overrides: Partial<MobileSellPublish> = {}): MobileSellPublish {
  return {
    title: "6'0 Pyzel Ghost",
    description: "Clean board.",
    brand: "Pyzel",
    model: "Ghost",
    category: "surfboards",
    subcategory: "shortboard",
    condition: "excellent",
    price: 650,
    city: "Santa Barbara",
    state: "CA",
    location_lat: 34.42,
    location_lng: -119.7,
    local_pickup: false,
    shipping: true,
    shipping_mode: "reswell",
    shipping_price: null,
    package_length: "75",
    package_width: "20",
    package_height: "4",
    package_weight_lb: "8",
    package_weight_oz: "0",
    dropoff_location_id: null,
    specs: { length: "6'0", width: "19", thickness: "2 1/2", volume: "30" },
    images: [image],
    draft_id: null,
    ...overrides,
  }
}

describe("mobile sell publish fields", () => {
  it("stores a surfboard with the website category, dimensions, and packed box", () => {
    const built = mobileSellListingFields(publishInput())
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.fields.section, "surfboards")
    assert.equal(built.fields.category_id, boardCategoryMap.shortboard)
    assert.equal(built.fields.board_type, "shortboard")
    assert.equal(built.fields.city, "Santa Barbara")
    assert.equal(built.fields.state, "CA")
    assert.equal(built.fields.shipping_available, true)
    assert.equal(built.fields.board_shipping_cost_mode, "reswell")
    assert.equal(built.fields.shipping_packed_length_in, 75)
    assert.equal(typeof built.fields.dimensions, "string")
  })

  it("stores a flat shipping rate", () => {
    const built = mobileSellListingFields(
      publishInput({
        shipping_mode: "flat",
        shipping_price: 5,
        package_length: "",
        package_width: "",
        package_height: "",
        package_weight_lb: "",
        package_weight_oz: "",
      }),
    )
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.fields.shipping_available, true)
    assert.equal(built.fields.board_shipping_cost_mode, "flat")
    assert.equal(built.fields.shipping_price, 5)
    assert.equal(built.fields.shipping_packed_length_in, null)
  })

  it("stores a fin on the fins category", () => {
    const built = mobileSellListingFields(
      publishInput({ category: "fins", subcategory: "", specs: {}, package_length: "" }),
    )
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.fields.section, "fins")
    assert.equal(built.fields.category_id, USED_FINS_CATEGORY_ID)
    assert.equal(built.fields.board_type, null)
    assert.equal(built.fields.dimensions, null)
  })

  it("rejects a surfboard with no board style", () => {
    const built = mobileSellListingFields(publishInput({ subcategory: "" }))
    assert.equal(built.ok, false)
  })

  it("saves an unfinished board as a hidden draft", () => {
    const input: MobileSellDraft = {
      ...publishInput({ subcategory: "", images: [] }),
      id: null,
      title: "",
      description: "",
      brand: "",
      model: "",
      condition: "",
      price: null,
      city: "",
      state: "",
      location_lat: null,
      location_lng: null,
      images: [],
    }
    const built = mobileSellDraftFields(input)
    assert.equal(built.ok, true)
    if (!built.ok) return
    assert.equal(built.fields.status, "draft")
    assert.equal(built.fields.hidden_from_site, true)
    assert.equal(built.fields.title, "Untitled draft")
    assert.equal(built.fields.board_type, null)
    assert.equal(built.fields.category_id, boardCategoryMap.shortboard)
    assert.equal(built.fields.city, null)
    assert.equal(built.fields.price, 0)
  })
})
