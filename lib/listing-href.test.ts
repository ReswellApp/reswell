import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { peerListingCheckoutHref } from "@/lib/listing-href"

describe("peerListingCheckoutHref", () => {
  it("adds quantity and buy-again as explicit checkout params", () => {
    assert.equal(peerListingCheckoutHref("new", "fin-1"), "/checkout?listing=fin-1")
    assert.equal(
      peerListingCheckoutHref("new", "fin-1", { quantity: 2 }),
      "/checkout?listing=fin-1&qty=2",
    )
    assert.equal(
      peerListingCheckoutHref("new", "fin-1", { quantity: 2, buyAgain: true }),
      "/checkout?listing=fin-1&qty=2&buy_again=1",
    )
  })
})
