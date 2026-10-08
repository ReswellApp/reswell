import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { insertNavLinkAfter } from "@/lib/dashboard-nav-order"
import {
  authorizeDropoffLocationView,
  dropoffLocationMembership,
  orderBelongsToDropoffLocation,
  resolveDropoffLocationGrantUserId,
} from "@/lib/services/dropoffLocationAccess"

describe("dropoffLocationMembership", () => {
  it("is a grant row, and a failed lookup is not a grant", () => {
    assert.equal(dropoffLocationMembership({ rowId: "grant-1", queryFailed: false }), true)
    assert.equal(dropoffLocationMembership({ rowId: "", queryFailed: false }), false)
    assert.equal(dropoffLocationMembership({ rowId: null, queryFailed: false }), false)
    assert.equal(dropoffLocationMembership({ rowId: "grant-1", queryFailed: true }), false)
  })
})

describe("resolveDropoffLocationGrantUserId", () => {
  it("uses the profile id, then the auth login id", () => {
    assert.deepEqual(resolveDropoffLocationGrantUserId({ profileIds: ["profile-1"], authUserId: "auth-1" }), {
      userId: "profile-1",
    })
    assert.deepEqual(resolveDropoffLocationGrantUserId({ profileIds: [], authUserId: "auth-1" }), {
      userId: "auth-1",
    })
    assert.deepEqual(resolveDropoffLocationGrantUserId({ profileIds: [], authUserId: null }), {
      error: "No Reswell account uses that email.",
    })
    assert.deepEqual(
      resolveDropoffLocationGrantUserId({ profileIds: ["a", "b"], authUserId: "auth-1" }),
      { error: "More than one account uses that email." },
    )
  })
})

describe("authorizeDropoffLocationView", () => {
  it("allows only the granted account", () => {
    assert.equal(authorizeDropoffLocationView({ userId: "user-1", grantUserId: "user-1" }), "allow")
    assert.equal(authorizeDropoffLocationView({ userId: "admin-1", grantUserId: null }), "not_found")
    assert.equal(authorizeDropoffLocationView({ userId: null, grantUserId: "user-1" }), "not_found")
    assert.equal(authorizeDropoffLocationView({ userId: "stranger", grantUserId: "user-1" }), "not_found")
  })
})

describe("orderBelongsToDropoffLocation", () => {
  it("matches when any listing on the order uses that location", () => {
    assert.equal(
      orderBelongsToDropoffLocation({
        locationId: "sb",
        listingDropoffIds: [null, "other", "sb"],
      }),
      true,
    )
    assert.equal(
      orderBelongsToDropoffLocation({
        locationId: "sb",
        listingDropoffIds: [null, "other"],
      }),
      false,
    )
  })
})

describe("insertNavLinkAfter", () => {
  it("places Drop-off after Shipper, or after Overview when Shipper is absent", () => {
    const overview = { href: "/dashboard", name: "Overview" }
    const shipper = { href: "/dashboard/shipper", name: "Shipper" }
    const dropoff = { href: "/dashboard/dropoff-location", name: "Drop-off" }
    const profile = { href: "/dashboard/profile", name: "Profile" }

    assert.deepEqual(
      insertNavLinkAfter(insertNavLinkAfter([overview, profile], shipper, "/dashboard"), dropoff, "/dashboard/shipper").map(
        (link) => link.href,
      ),
      ["/dashboard", "/dashboard/shipper", "/dashboard/dropoff-location", "/dashboard/profile"],
    )
    assert.deepEqual(
      insertNavLinkAfter([overview, profile], dropoff, "/dashboard").map((link) => link.href),
      ["/dashboard", "/dashboard/dropoff-location", "/dashboard/profile"],
    )
  })
})
