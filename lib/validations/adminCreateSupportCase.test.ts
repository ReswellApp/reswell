import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  adminCreateSupportCaseSchema,
  adminUserOrdersForSupportSchema,
} from "./adminCreateSupportCase.ts"

const userId = "11111111-1111-4111-8111-111111111111"
const orderId = "22222222-2222-4222-8222-222222222222"

describe("adminCreateSupportCaseSchema", () => {
  it("accepts a staff-opened case with an optional order", () => {
    const parsed = adminCreateSupportCaseSchema.parse({
      user_id: userId,
      order_id: orderId,
      kind: "order_question",
      subject: "Order help · YY3WN3",
      message: "Hi — opening this so we can sort out the shipment.",
    })
    assert.equal(parsed.user_id, userId)
    assert.equal(parsed.order_id, orderId)
    assert.equal(parsed.kind, "order_question")
  })

  it("allows creating a case without an order", () => {
    const parsed = adminCreateSupportCaseSchema.parse({
      user_id: userId,
      kind: "account",
      subject: "Account",
      message: "Opening this from the inbox to continue over email.",
    })
    assert.equal(parsed.order_id, undefined)
  })

  it("rejects a short customer-facing message", () => {
    const parsed = adminCreateSupportCaseSchema.safeParse({
      user_id: userId,
      kind: "general",
      subject: "Hello",
      message: "Hi there",
    })
    assert.equal(parsed.success, false)
  })
})

describe("adminUserOrdersForSupportSchema", () => {
  it("pages a member’s orders with a search and role filter", () => {
    const parsed = adminUserOrdersForSupportSchema.parse({
      user_id: userId,
      offset: 8,
      role: "buyer",
      search: "YY3",
    })
    assert.equal(parsed.limit, 8)
    assert.equal(parsed.role, "buyer")
    assert.equal(parsed.search, "YY3")
  })

  it("rejects an unbounded page size", () => {
    const parsed = adminUserOrdersForSupportSchema.safeParse({
      user_id: userId,
      limit: 500,
    })
    assert.equal(parsed.success, false)
  })
})
