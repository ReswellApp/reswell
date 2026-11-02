import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { clientAuthRequiresHardNavigation } from "@/lib/auth/client-auth-requires-hard-navigation"

describe("clientAuthRequiresHardNavigation", () => {
  it("hard-navigates Shopify claim and connect after client sign-in", () => {
    assert.equal(clientAuthRequiresHardNavigation("/shopify/connect"), true)
    assert.equal(clientAuthRequiresHardNavigation("/shopify/claim"), true)
    assert.equal(
      clientAuthRequiresHardNavigation("/shopify/connect/extra"),
      true,
    )
  })

  it("hard-navigates protected dashboard routes", () => {
    assert.equal(clientAuthRequiresHardNavigation("/dashboard/shopify"), true)
    assert.equal(clientAuthRequiresHardNavigation("/messages"), true)
  })

  it("allows soft navigation for ordinary public paths", () => {
    assert.equal(clientAuthRequiresHardNavigation("/"), false)
    assert.equal(clientAuthRequiresHardNavigation("/sell"), false)
    assert.equal(clientAuthRequiresHardNavigation("/auth/login"), false)
  })
})
