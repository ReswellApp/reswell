import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getAdminNavGroupsForUser } from "../admin-nav.ts"
import {
  EMPLOYEE_ADMIN_HOME,
  EMPLOYEE_NAV_HREFS,
  employeeAdminPathDecision,
} from "./employee-access.ts"

function navHrefs(isAdmin: boolean): string[] {
  return getAdminNavGroupsForUser(isAdmin).flatMap((group) =>
    group.items.flatMap((item) => [item.href, ...(item.children ?? []).map((child) => child.href)]),
  )
}

describe("employeeAdminPathDecision", () => {
  it("allows the six employee tools", () => {
    for (const pathname of [
      "/admin/search-analytics",
      "/admin/saved-searches",
      "/admin/crm",
      "/admin/shipping",
      "/admin/orders/terminal",
    ]) {
      assert.deepEqual(employeeAdminPathDecision(pathname, new URLSearchParams()), { allow: true })
    }
  })

  it("allows the brand catalog tab and sends every other market tab there", () => {
    assert.deepEqual(
      employeeAdminPathDecision(
        "/admin/used-board-market-dashboard",
        new URLSearchParams("tab=catalog"),
      ),
      { allow: true },
    )
    const redirected = employeeAdminPathDecision(
      "/admin/used-board-market-dashboard",
      new URLSearchParams("tab=sales&range=90d"),
    )
    assert.equal(redirected.allow, false)
    if (!redirected.allow) {
      assert.equal(redirected.redirectPath, "/admin/used-board-market-dashboard")
      assert.equal(new URLSearchParams(redirected.redirectSearch).get("tab"), "catalog")
      assert.equal(new URLSearchParams(redirected.redirectSearch).get("range"), "90d")
    }
  })

  it("sends every other admin path to search analytics", () => {
    for (const pathname of ["/admin", "/admin/home", "/admin/orders", "/admin/users", "/admin/listings"]) {
      const decision = employeeAdminPathDecision(pathname, new URLSearchParams())
      assert.equal(decision.allow, false)
      if (!decision.allow) {
        assert.equal(decision.redirectPath, EMPLOYEE_ADMIN_HOME)
      }
    }
  })

  it("does not treat the orders list as in-person checkout", () => {
    assert.equal(
      employeeAdminPathDecision("/admin/orders/abc", new URLSearchParams()).allow,
      false,
    )
    assert.equal(
      employeeAdminPathDecision("/admin/orders/terminal/extra", new URLSearchParams()).allow,
      true,
    )
  })
})

describe("getAdminNavGroupsForUser employee nav", () => {
  it("shows admins every item and employees only the allowlist", () => {
    const adminHrefs = navHrefs(true)
    const employeeHrefs = navHrefs(false)
    assert.ok(adminHrefs.length > employeeHrefs.length)
    assert.deepEqual(new Set(employeeHrefs), EMPLOYEE_NAV_HREFS)
    for (const href of employeeHrefs) {
      assert.ok(adminHrefs.includes(href))
    }
  })
})
