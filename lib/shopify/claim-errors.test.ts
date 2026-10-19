import assert from "node:assert/strict"
import test from "node:test"
import { publicShopifyClaimError } from "@/lib/shopify/claim-errors"

test("the account approval exception keeps its own message", () => {
  assert.equal(
    publicShopifyClaimError(
      new Error("Reswell account is not approved for Shopify"),
    ),
    "Your account is not approved for Shopify yet.",
  )
})

test("a usage charge that is not approved is not an account approval error", () => {
  assert.equal(
    publicShopifyClaimError(new Error("Shopify usage charge is not approved")),
    "Could not link this Shopify store. Try installing again from Shopify.",
  )
})

test("protected customer data approval is not an account approval error", () => {
  assert.equal(
    publicShopifyClaimError(
      new Error(
        "This app is not approved to subscribe to webhook topics containing protected customer data.",
      ),
    ),
    "Could not link this Shopify store. Try installing again from Shopify.",
  )
})

test("claim still explains a store owned by someone else", () => {
  assert.equal(
    publicShopifyClaimError(
      new Error("Shopify store belongs to another Reswell account"),
    ),
    "This Shopify store cannot be linked to this Reswell account.",
  )
  assert.equal(
    publicShopifyClaimError(
      new Error("Reswell account is linked to another Shopify store"),
    ),
    "This Shopify store cannot be linked to this Reswell account.",
  )
})
