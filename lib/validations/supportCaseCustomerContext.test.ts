import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  supportCaseCustomerContextSchema,
  supportCaseCustomerOrdersPageSchema,
  supportCaseCustomerTicketsPageSchema,
} from "./supportCaseCustomerContext.ts"

describe("supportCaseCustomerContext schemas", () => {
  it("accepts a legacy inbox case key, not only a raw uuid", () => {
    const parsed = supportCaseCustomerContextSchema.parse({
      case_id: "sc:11111111-1111-4111-8111-111111111111",
    })
    assert.equal(parsed.case_id, "sc:11111111-1111-4111-8111-111111111111")
  })

  it("pages orders with a role filter and bounded limit", () => {
    const parsed = supportCaseCustomerOrdersPageSchema.parse({
      case_id: "11111111-1111-4111-8111-111111111111",
      offset: 8,
      role: "seller",
      search: "RS-12",
    })
    assert.equal(parsed.limit, 8)
    assert.equal(parsed.role, "seller")
    assert.equal(parsed.search, "RS-12")
  })

  it("rejects an unbounded ticket page", () => {
    const parsed = supportCaseCustomerTicketsPageSchema.safeParse({
      case_id: "11111111-1111-4111-8111-111111111111",
      limit: 500,
    })
    assert.equal(parsed.success, false)
  })
})
