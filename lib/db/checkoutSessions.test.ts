import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  CHECKOUT_ITEM_RESERVED_ERROR,
  CHECKOUT_ITEM_UNAVAILABLE_ERROR,
  checkoutStockReserveUserError,
  isMissingCheckoutSessionsRelation,
} from "@/lib/db/checkoutSessions"

describe("isMissingCheckoutSessionsRelation", () => {
  it("detects PostgREST and Postgres missing-table errors", () => {
    assert.equal(isMissingCheckoutSessionsRelation({ code: "PGRST205" }), true)
    assert.equal(isMissingCheckoutSessionsRelation({ code: "42P01" }), true)
    assert.equal(
      isMissingCheckoutSessionsRelation({
        message: "Could not find the table 'public.checkout_sessions' in the schema cache",
      }),
      true,
    )
    assert.equal(isMissingCheckoutSessionsRelation({ code: "42501", message: "permission denied" }), false)
  })
})

describe("checkoutStockReserveUserError", () => {
  it("maps a unique hold to a retryable reserved message", () => {
    assert.equal(
      checkoutStockReserveUserError("reserve_checkout_session_stock: listing abc already reserved"),
      CHECKOUT_ITEM_RESERVED_ERROR,
    )
  })

  it("maps unique-index races to a retryable reserved message", () => {
    assert.equal(
      checkoutStockReserveUserError(
        'duplicate key value violates unique constraint "checkout_stock_holds_unique_item_uidx"',
      ),
      CHECKOUT_ITEM_RESERVED_ERROR,
    )
    assert.equal(
      checkoutStockReserveUserError("Could not reserve inventory", "23505"),
      CHECKOUT_ITEM_RESERVED_ERROR,
    )
  })

  it("maps sold-out and missing listings to no longer available", () => {
    assert.equal(
      checkoutStockReserveUserError("reserve_checkout_session_stock: insufficient stock for listing abc"),
      CHECKOUT_ITEM_UNAVAILABLE_ERROR,
    )
    assert.equal(
      checkoutStockReserveUserError("reserve_checkout_session_stock: listing abc is not available"),
      CHECKOUT_ITEM_UNAVAILABLE_ERROR,
    )
    assert.equal(
      checkoutStockReserveUserError("reserve_checkout_session_stock: listing abc is not available", "23505"),
      CHECKOUT_ITEM_UNAVAILABLE_ERROR,
    )
    assert.equal(
      checkoutStockReserveUserError("reserve_checkout_session_stock: listing abc not found"),
      CHECKOUT_ITEM_UNAVAILABLE_ERROR,
    )
  })
})
