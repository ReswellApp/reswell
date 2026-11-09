import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { OwnedListingForEditRow } from "@/lib/db/listingEdit"
import { ownedListingRowToMobileSellEdit } from "@/lib/services/mobileSellEditMap"

const LISTING_ID = "22222222-2222-4222-8222-222222222222"
const VIDEO_ID = "33333333-3333-4333-8333-333333333333"

function row(overrides: Partial<OwnedListingForEditRow> = {}): OwnedListingForEditRow {
  return {
    id: LISTING_ID,
    user_id: "11111111-1111-4111-8111-111111111111",
    section: "fins",
    status: "active",
    slug: "used-fins",
    title: "FCS II Performer",
    description: "Clean set.",
    price: 40,
    condition: "excellent",
    city: "Santa Barbara",
    state: "CA",
    latitude: 34.42,
    longitude: -119.7,
    shipping_available: true,
    local_pickup: false,
    brand: "FCS",
    model: "Performer",
    listing_images: [
      {
        id: "44444444-4444-4444-8444-444444444444",
        url: "https://cdn.example.com/fin.jpg",
        thumbnail_url: "https://cdn.example.com/fin-thumb.jpg",
        sort_order: 0,
      },
    ],
    ...overrides,
  }
}

describe("ownedListingRowToMobileSellEdit", () => {
  it("keeps city/state when latitude and longitude are missing", () => {
    const mapped = ownedListingRowToMobileSellEdit(
      row({
        latitude: null,
        longitude: null,
        city: "Santa Barbara",
        state: "CA",
      }),
    )
    assert.equal(mapped.ok, true)
    if (!mapped.ok) return
    assert.equal(mapped.draft.city, "Santa Barbara")
    assert.equal(mapped.draft.state, "CA")
    assert.equal(mapped.draft.location_lat, null)
    assert.equal(mapped.draft.location_lng, null)
    assert.equal(mapped.locationLabel, "Santa Barbara, CA")
  })

  it("caps listing images at the website sell max of twelve", () => {
    const mapped = ownedListingRowToMobileSellEdit(
      row({
        listing_images: Array.from({ length: 14 }, (_, index) => ({
          id: `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`,
          url: `https://cdn.example.com/${index}.jpg`,
          thumbnail_url: `https://cdn.example.com/${index}-t.jpg`,
          sort_order: index,
        })),
      }),
    )
    assert.equal(mapped.ok, true)
    if (!mapped.ok) return
    assert.equal(mapped.draft.images.length, 12)
    assert.equal(mapped.draft.images[0]?.url, "https://cdn.example.com/0.jpg")
    assert.equal(mapped.draft.images[11]?.url, "https://cdn.example.com/11.jpg")
  })
})

describe("ownedListingRowToMobileSellEdit videos", () => {
  it("maps the first listing video onto the sell payload", () => {
    const mapped = ownedListingRowToMobileSellEdit(
      row({
        listing_videos: [
          {
            id: VIDEO_ID,
            url: "https://cdn.example.com/clip.mp4",
            thumbnail_url: "https://cdn.example.com/clip.jpg",
            content_type: "video/mp4",
            duration_seconds: 18,
            byte_size: 4_000_000,
            sort_order: 0,
          },
        ],
      }),
    )
    assert.equal(mapped.ok, true)
    if (!mapped.ok) return
    assert.equal(mapped.draft.videos?.length, 1)
    assert.equal(mapped.draft.videos?.[0]?.video_id, VIDEO_ID)
    assert.equal(mapped.draft.videos?.[0]?.url, "https://cdn.example.com/clip.mp4")
    assert.equal(mapped.draft.videos?.[0]?.duration_seconds, 18)
  })

  it("returns an empty videos list when the listing has no clip", () => {
    const mapped = ownedListingRowToMobileSellEdit(row({ listing_videos: [] }))
    assert.equal(mapped.ok, true)
    if (!mapped.ok) return
    assert.deepEqual(mapped.draft.videos, [])
  })
})
