import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

/**
 * Checkout, payment intents, and offer pay all call
 * `computePeerCheckoutTotalsUsd` / `computePeerBundleShippingUsd`. Those
 * read `effectiveBoardShippingMode` in this file. A re-export-only line
 * (`export { NAME } from`) does not create a local binding — production
 * then throws `effectiveBoardShippingMode is not defined` and checkout
 * shows "Could not calculate shipping for this address."
 *
 * This is a source contract because importing the module pulls ShipEngine
 * and Redis. Pair with `lib/board-shipping-cost-mode.test.ts` for behavior.
 */
const source = readFileSync(new URL("./peerListingShippingQuote.ts", import.meta.url), "utf8")

describe("peerListingShippingQuote local shipping-mode binding", () => {
  it("imports effectiveBoardShippingMode instead of only re-exporting it", () => {
    assert.match(
      source,
      /import\s*\{[\s\S]*\beffectiveBoardShippingMode\b[\s\S]*\}\s*from\s*["']@\/lib\/board-shipping-cost-mode["']/,
    )
    assert.doesNotMatch(
      source,
      /export\s*\{[\s\S]*\beffectiveBoardShippingMode\b[\s\S]*\}\s*from\s*["']@\/lib\/board-shipping-cost-mode["']/,
    )
    assert.match(source, /\beffectiveBoardShippingMode\s*\(/)
  })
})
