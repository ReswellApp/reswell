import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { supportReplyGreetingName } from "./support-reply-greeting.ts"

describe("supportReplyGreetingName", () => {
  it("prefers the contact name used in the inbox", () => {
    assert.equal(
      supportReplyGreetingName({
        contactName: "Hayden G",
        displayName: "Other",
        role: "member",
      }),
      "Hayden G",
    )
  })

  it("skips emails and falls back to the profile name", () => {
    assert.equal(
      supportReplyGreetingName({
        contactName: "hayden@reswell.app",
        displayName: "Hayden",
        role: "member",
      }),
      "Hayden",
    )
  })

  it("uses the inbox role label when no real name exists", () => {
    assert.equal(
      supportReplyGreetingName({ contactName: null, displayName: null, role: "seller" }),
      "Seller",
    )
    assert.equal(
      supportReplyGreetingName({ contactName: "  ", displayName: "buyer@example.com", role: "buyer" }),
      "Buyer",
    )
    assert.equal(
      supportReplyGreetingName({ contactName: null, displayName: null, role: "guest" }),
      "Member",
    )
  })
})
