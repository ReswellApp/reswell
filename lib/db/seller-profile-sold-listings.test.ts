import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isListingLastSoldAtColumnMissing,
  isSellerProfileSoldListingRpcMissing,
} from "@/lib/db/seller-profile-sold-listings"

describe("seller profile sold listing denorm", () => {
  it("detects a missing listings.last_sold_at column", () => {
    assert.equal(
      isListingLastSoldAtColumnMissing({
        code: "PGRST204",
        message: "Could not find the 'last_sold_at' column of 'listings' in the schema cache",
      }),
      true,
    )
    assert.equal(
      isListingLastSoldAtColumnMissing({
        code: "42703",
        message: 'column listings.last_sold_at does not exist',
      }),
      true,
    )
    assert.equal(
      isListingLastSoldAtColumnMissing({
        message: "permission denied for table listings",
      }),
      false,
    )
  })

  it("detects a missing seller_profile_sold_listing_ids RPC", () => {
    assert.equal(
      isSellerProfileSoldListingRpcMissing({
        code: "PGRST202",
        message: "Could not find the function public.seller_profile_sold_listing_ids",
      }),
      true,
    )
    assert.equal(
      isSellerProfileSoldListingRpcMissing({
        message: "permission denied for function seller_profile_sold_listing_ids",
      }),
      false,
    )
  })
})
