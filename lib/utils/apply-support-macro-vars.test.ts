import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { applySupportMacroVars } from "./apply-support-macro-vars.ts"

describe("applySupportMacroVars", () => {
  it("substitutes name and order_ref", () => {
    assert.equal(
      applySupportMacroVars("Hi {{name}}, about {{order_ref}}.", {
        name: "Alex",
        order_ref: "RS-1042",
      }),
      "Hi Alex, about RS-1042.",
    )
  })

  it("substitutes tracking and order status when present", () => {
    assert.equal(
      applySupportMacroVars("{{order_ref}} is {{order_status}} ({{tracking}}).", {
        order_ref: "RS-1042",
        order_status: "In transit",
        tracking: "1Z999",
      }),
      "RS-1042 is In transit (1Z999).",
    )
  })

  it("uses safe fallbacks when a value is missing", () => {
    assert.equal(
      applySupportMacroVars("Hi {{name}} — {{order_ref}} / {{tracking}} / {{order_status}}."),
      "Hi there — your order / your tracking number / in progress.",
    )
  })

  it("trims values and treats blank as missing", () => {
    assert.equal(
      applySupportMacroVars("Hi {{name}}", { name: "  " }),
      "Hi there",
    )
  })
})

