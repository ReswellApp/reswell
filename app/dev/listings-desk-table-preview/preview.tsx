"use client"

import { useState } from "react"
import { ListingDeskTable } from "@/components/features/dashboard/listings/listing-desk-table"
import type { ListingDeskTableListing } from "@/components/features/dashboard/listings/listing-desk-table-row"

const MOCK_LISTINGS: ListingDeskTableListing[] = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "firewire-seaside",
    title: "Firewire Seaside 5'6",
    price: 650,
    status: "active",
    section: "surfboards",
    condition: "good",
    description: "Ridden lightly. A few pressure dings on the deck.",
    views: 128,
    cartCount: 2,
    favoriteCount: 9,
    created_at: "2026-09-11T16:00:00.000Z",
    canDelete: true,
    listing_images: null,
    shipping_package_tier: "shortboard",
    shipping_package_band: "shortboard_medium",
    shipping_packed_length_in: 72,
    shipping_packed_width_in: 22,
    shipping_packed_height_in: 8,
    shipping_packed_weight_oz: 320,
    brand: "Firewire",
    model: "Seaside",
    city: "San Diego",
    state: "CA",
    latitude: 32.7,
    longitude: -117.2,
    local_pickup: true,
    shipping_available: true,
    board_shipping_cost_mode: "reswell",
    shipping_price: null,
    dropoff_location_id: null,
    dimensions: "5'6 x 21 3/4 x 2 1/2",
    length_total_inches: 66,
    volume_liters: 34,
    fins_setup: "twin",
    fin_system: "futures",
    construction: "helilum",
    fins_included: true,
    tail_shape: "swallow",
    fin_size: null,
    wetsuit_size: null,
    apparel_kind: null,
    traction_size: null,
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    slug: "futures-thruster-set",
    title: "Futures AM2 Honeycomb",
    price: 95,
    status: "active",
    section: "fins",
    condition: "excellent",
    description: "Barely used thruster set.",
    views: 44,
    cartCount: 0,
    favoriteCount: 3,
    created_at: "2026-08-02T12:00:00.000Z",
    canDelete: true,
    listing_images: null,
    shipping_package_tier: null,
    shipping_package_band: null,
    shipping_packed_length_in: 12,
    shipping_packed_width_in: 10,
    shipping_packed_height_in: 4,
    shipping_packed_weight_oz: 32,
    brand: "Futures",
    model: "AM2",
    city: "Ventura",
    state: "CA",
    latitude: null,
    longitude: null,
    local_pickup: false,
    shipping_available: true,
    board_shipping_cost_mode: "reswell",
    shipping_price: null,
    dropoff_location_id: null,
    dimensions: null,
    length_total_inches: null,
    volume_liters: null,
    fins_setup: null,
    fin_system: null,
    construction: null,
    fins_included: null,
    tail_shape: null,
    fin_size: "large",
    wetsuit_size: null,
    apparel_kind: null,
    traction_size: null,
  },
]

export function ListingsDeskTablePreview() {
  const [listedSort, setListedSort] = useState<"recent" | "oldest">("recent")
  const listings =
    listedSort === "oldest" ? [...MOCK_LISTINGS].reverse() : MOCK_LISTINGS

  return (
    <div className="container mx-auto max-w-[90rem] space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Advanced listings table preview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Dev-only mock of the dense desk table. Saves are disabled against fake ids.
        </p>
      </div>
      <ListingDeskTable
        listings={listings}
        listedSort={listedSort}
        onListedSortChange={setListedSort}
        onListingSaved={() => {}}
        onEndListing={() => {}}
        onDiscardDraft={() => {}}
      />
    </div>
  )
}
