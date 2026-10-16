import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isMostSpecificDashboardNavMatch } from "./dashboard-nav-match.ts"

const HREFS = ["/dashboard", "/dashboard/profile", "/dashboard/profile/team", "/messages"]

describe("isMostSpecificDashboardNavMatch", () => {
  it("highlights Team on the profile team route and leaves Profile inactive", () => {
    assert.equal(
      isMostSpecificDashboardNavMatch("/dashboard/profile/team", "/dashboard/profile/team", HREFS),
      true,
    )
    assert.equal(
      isMostSpecificDashboardNavMatch("/dashboard/profile/team", "/dashboard/profile", HREFS),
      false,
    )
    assert.equal(
      isMostSpecificDashboardNavMatch("/dashboard/profile/team", "/dashboard", HREFS),
      false,
    )
  })

  it("highlights Profile only on the profile page", () => {
    assert.equal(isMostSpecificDashboardNavMatch("/dashboard/profile", "/dashboard/profile", HREFS), true)
    assert.equal(
      isMostSpecificDashboardNavMatch("/dashboard/profile", "/dashboard/profile/team", HREFS),
      false,
    )
  })

  it("keeps Overview exact and Messages prefix-aware", () => {
    assert.equal(isMostSpecificDashboardNavMatch("/dashboard", "/dashboard", HREFS), true)
    assert.equal(isMostSpecificDashboardNavMatch("/dashboard/profile", "/dashboard", HREFS), false)
    assert.equal(isMostSpecificDashboardNavMatch("/messages/abc", "/messages", HREFS), true)
  })
})
