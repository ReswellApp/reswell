import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  displaySupportCaseSystemBody,
  splitSupportCaseSubject,
  suggestedStaffSupportSubject,
} from "./support-case-display.ts"

describe("displaySupportCaseSystemBody", () => {
  it("drops the retired email line from stored welcome copy", () => {
    assert.equal(
      displaySupportCaseSystemBody(
        "Thanks — we received this. Reply here anytime. We’ll also email you. Case RS-0A774B91.",
      ),
      "Thanks — we received this. Reply here anytime. Case RS-0A774B91.",
    )
    assert.equal(
      displaySupportCaseSystemBody(
        "Thanks — we received this. Reply here anytime. We'll also email you. Case RS-0A774B91.",
      ),
      "Thanks — we received this. Reply here anytime. Case RS-0A774B91.",
    )
  })

  it("leaves newer welcome copy unchanged", () => {
    assert.equal(
      displaySupportCaseSystemBody("Thanks — we received this. Reply here anytime. Case RS-0A774B91."),
      "Thanks — we received this. Reply here anytime. Case RS-0A774B91.",
    )
  })

  it("treats a missing body as empty copy", () => {
    assert.equal(displaySupportCaseSystemBody(null), "")
    assert.equal(displaySupportCaseSystemBody(undefined), "")
  })
})

describe("splitSupportCaseSubject", () => {
  it("lifts a seller or buyer prefix out of the title", () => {
    assert.deepEqual(splitSupportCaseSubject("[Seller] Order help · YY3WN3"), {
      roleLabel: "Seller",
      title: "Order help · YY3WN3",
    })
    assert.deepEqual(splitSupportCaseSubject("[Buyer] Cancel request · ABC123"), {
      roleLabel: "Buyer",
      title: "Cancel request · ABC123",
    })
  })

  it("leaves a plain subject unchanged", () => {
    assert.deepEqual(splitSupportCaseSubject("Payments & payouts"), {
      roleLabel: null,
      title: "Payments & payouts",
    })
  })
})

describe("suggestedStaffSupportSubject", () => {
  it("uses the kind label when no order is connected", () => {
    assert.equal(suggestedStaffSupportSubject("payments", null), "Payments & payouts")
    assert.equal(suggestedStaffSupportSubject("general", "  "), "General help")
  })

  it("mirrors order-help subjects when an order is connected", () => {
    assert.equal(suggestedStaffSupportSubject("order_question", "YY3WN3"), "Order help · YY3WN3")
    assert.equal(suggestedStaffSupportSubject("cancel_request", "ABC123"), "Cancel request · ABC123")
    assert.equal(
      suggestedStaffSupportSubject("protection_claim", "PP-9"),
      "Protection claim · PP-9",
    )
    assert.equal(suggestedStaffSupportSubject("account", "YY3WN3"), "Account · YY3WN3")
  })
})
