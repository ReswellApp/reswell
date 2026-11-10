import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FOR_SURFBOARD_FLIPPERS_FAQS,
  FOR_SURFBOARD_FLIPPERS_PATH,
  forSurfboardFlippersAccountHref,
  forSurfboardFlippersAccountLabel,
} from "./for-surfboard-flippers.ts"
import { MARKETPLACE_FEE_PERCENT, SELLER_SHARE_PERCENT } from "./seller-fees.ts"

describe("forSurfboardFlippersAccountHref", () => {
  it("sends signed-out flippers to sign-up, then into a new board listing", () => {
    assert.equal(
      forSurfboardFlippersAccountHref(false),
      "/auth/sign-up?redirect=%2Fsell%2Fboards%3Fnew%3D1",
    )
    assert.equal(forSurfboardFlippersAccountLabel(false), "Create a free account")
  })

  it("sends signed-in flippers straight to a new board listing", () => {
    assert.equal(forSurfboardFlippersAccountHref(true), "/sell/boards?new=1")
    assert.equal(forSurfboardFlippersAccountLabel(true), "List a board")
  })
})

describe("FOR_SURFBOARD_FLIPPERS_FAQS", () => {
  it("states the live marketplace fee and the public path", () => {
    assert.equal(FOR_SURFBOARD_FLIPPERS_PATH, "/for-surfboard-flippers")
    const fee = FOR_SURFBOARD_FLIPPERS_FAQS.find((item) => item.question.includes("cost"))
    assert.ok(fee)
    assert.match(fee.answer, new RegExp(`${MARKETPLACE_FEE_PERCENT}%`))
    assert.match(fee.answer, new RegExp(`${SELLER_SHARE_PERCENT}%`))
  })
})
