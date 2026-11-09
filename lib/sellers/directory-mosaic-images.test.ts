import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildSellerDirectoryMosaicSlots,
  SELLER_DIRECTORY_MOSAIC_COVER_POOL,
  SELLER_DIRECTORY_MOSAIC_DISPLAY_COUNT,
} from "./directory-mosaic-images.ts"

const STORAGE = "https://proj.supabase.co/storage/v1/object/public/listings"

function listing(id: string) {
  return {
    title: `Listing ${id}`,
    listing_images: [
      {
        url: `${STORAGE}/u/${id}-full.webp`,
        thumbnail_url: `${STORAGE}/u/${id}-thumb.webp`,
        is_primary: true,
      },
    ],
  }
}

const shop = {
  shop_name: "Test Shop",
  display_name: "Test",
  shop_logo_url: null,
  avatar_url: null,
}

describe("buildSellerDirectoryMosaicSlots", () => {
  it("keeps a cover pool larger than the display grid for 404 promotion", () => {
    const listings = Array.from({ length: 8 }, (_, i) => listing(String(i + 1)))
    const slots = buildSellerDirectoryMosaicSlots(listings, shop)
    assert.equal(slots.length, SELLER_DIRECTORY_MOSAIC_COVER_POOL)
    assert.ok(SELLER_DIRECTORY_MOSAIC_COVER_POOL > SELLER_DIRECTORY_MOSAIC_DISPLAY_COUNT)
    assert.equal(slots[0]?.candidates[0], "/media/listings/u/1-film2.webp")
    assert.ok(slots[0]?.candidates.includes("/media/listings/u/1-card2.webp"))
  })

  it("uses a seller tile banner alone when present", () => {
    const slots = buildSellerDirectoryMosaicSlots([listing("1"), listing("2")], {
      ...shop,
      shop_tile_banner_url: `${STORAGE}/profile/tile.webp`,
      shop_tile_banner_focal_x_pct: 40,
      shop_tile_banner_focal_y_pct: 60,
    })
    assert.equal(slots.length, 1)
    assert.ok(slots[0]?.candidates[0])
    assert.ok(slots[0]?.objectPosition)
  })
})
