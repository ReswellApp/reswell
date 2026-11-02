import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isSellerProfileSoldListingRpcMissing } from "@/lib/db/seller-profile-sold-listings"

describe("seller profile sold listing RPC", () => {
  it("detects a missing seller_profile_sold_listing_ids overload", () => {
    assert.equal(
      isSellerProfileSoldListingRpcMissing({
        code: "PGRST202",
        message: "Could not find the function",
      }),
      true,
    )
    assert.equal(
      isSellerProfileSoldListingRpcMissing({
        message:
          "Could not find the function public.seller_profile_sold_listing_ids(uuid, text[], integer) in the schema cache",
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
