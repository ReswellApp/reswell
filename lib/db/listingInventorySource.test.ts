import assert from "node:assert/strict"
import test from "node:test"
import { isMissingInventorySourceColumn } from "@/lib/db/listingInventorySource"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"

test("recognizes the live cart error for a missing inventory_source column", () => {
  assert.equal(
    isMissingInventorySourceColumn({
      code: "42703",
      message: "column listings_1.inventory_source does not exist",
    }),
    true,
  )
  assert.equal(
    isMissingInventorySourceColumn({
      message:
        "Could not find the 'inventory_source' column of 'listings' in the schema cache",
    }),
    true,
  )
  assert.equal(
    isMissingInventorySourceColumn({ message: "permission denied for table listings" }),
    false,
  )
})

test("shared checkout select does not require inventory_source", () => {
  assert.equal(/\binventory_source\b/.test(PEER_SURFBOARD_CHECKOUT_LISTING_SELECT), false)
})
