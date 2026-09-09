import assert from "node:assert/strict"
import test from "node:test"
// @ts-expect-error Node's strip-types test runner requires the source extension.
import { buildSellerSupportOutreachDraft, sellerOutreachIssueSummary } from "./seller-support-outreach.ts"

test("seller outreach uses the public username without copying buyer details", () => {
  const draft = buildSellerSupportOutreachDraft({
    sellerUsername: "wave-rider",
    orderRef: "QT39VA",
    kind: "safety",
    customerText:
      "I am in Palm Coast until Friday and tried to contact the seller but got no response. Thanks, SFisher.",
  })

  assert.match(draft, /^Hi wave-rider,/)
  assert.match(draft, /has not received a response/)
  assert.doesNotMatch(draft, /Palm Coast|Friday|SFisher/)
})

test("seller outreach uses a natural fallback instead of calling them Seller", () => {
  const draft = buildSellerSupportOutreachDraft({
    sellerUsername: null,
    orderRef: "ABC123",
    kind: "order_question",
    customerText: "I need help with pickup.",
  })

  assert.match(draft, /^Hi there,/)
  assert.doesNotMatch(draft, /^Hi Seller,/)
})

test("issue classifier shares only the operational mismatch", () => {
  assert.equal(
    sellerOutreachIssueSummary(
      "protection_claim",
      "My personal phone is 555-111-2222. The item does not match the listing.",
    ),
    "The buyer reported that the item may not match the listing.",
  )
})
