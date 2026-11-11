import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { shopVacationButtonMode, shopVacationTargetIds } from "./shop-vacation.ts"

function listing(
  partial: Partial<{
    id: string
    status: string | null
    hidden_from_site: boolean | null
    site_visibility_reason: string | null
    archived_at: string | null
  }>,
) {
  return {
    id: "listing-1",
    status: "active",
    hidden_from_site: false,
    site_visibility_reason: null,
    archived_at: null,
    ...partial,
  }
}

describe("shopVacationTargetIds", () => {
  it("restores listings hidden by seller vacation or the old auto-vacation job", () => {
    assert.deepEqual(
      shopVacationTargetIds(
        [
          listing({ id: "seller", site_visibility_reason: "seller_vacation", hidden_from_site: true }),
          listing({
            id: "auto",
            site_visibility_reason: "seller_inactivity",
            hidden_from_site: true,
          }),
          listing({
            id: "admin",
            site_visibility_reason: "admin_site_visibility",
            hidden_from_site: true,
          }),
        ],
        "off",
      ),
      ["seller", "auto"],
    )
  })
})

describe("shopVacationButtonMode", () => {
  it("offers end vacation when every live listing was auto-hidden", () => {
    assert.equal(
      shopVacationButtonMode([
        listing({
          hidden_from_site: true,
          site_visibility_reason: "seller_inactivity",
        }),
      ]),
      "off",
    )
  })
})
