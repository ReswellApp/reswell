import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isAdminListingEditEntry,
  shouldShowImpersonationActingAsBanner,
  withAdminListingEditEntry,
} from "./admin-listing-edit-entry.ts"

describe("withAdminListingEditEntry", () => {
  it("adds from=admin to a path with an existing query", () => {
    assert.equal(
      withAdminListingEditEntry("/sell/boards?edit=abc"),
      "/sell/boards?edit=abc&from=admin",
    )
  })

  it("adds from=admin to a bare path", () => {
    assert.equal(withAdminListingEditEntry("/sell"), "/sell?from=admin")
  })
})

describe("isAdminListingEditEntry", () => {
  it("is true only for from=admin", () => {
    assert.equal(isAdminListingEditEntry(new URLSearchParams("edit=1&from=admin")), true)
    assert.equal(isAdminListingEditEntry(new URLSearchParams("edit=1&from=catalog")), false)
    assert.equal(isAdminListingEditEntry(new URLSearchParams("edit=1")), false)
  })
})

describe("shouldShowImpersonationActingAsBanner", () => {
  it("hides on public listing pages", () => {
    assert.equal(shouldShowImpersonationActingAsBanner("/l/my-board", null), false)
    assert.equal(
      shouldShowImpersonationActingAsBanner("/l/my-board", new URLSearchParams("from=admin")),
      false,
    )
  })

  it("hides on sell-edit unless the edit started from admin listings", () => {
    assert.equal(
      shouldShowImpersonationActingAsBanner("/sell/boards", new URLSearchParams("edit=abc")),
      false,
    )
    assert.equal(
      shouldShowImpersonationActingAsBanner(
        "/sell/boards",
        new URLSearchParams("edit=abc&from=admin"),
      ),
      true,
    )
  })

  it("keeps the banner on sell create and other admin surfaces", () => {
    assert.equal(shouldShowImpersonationActingAsBanner("/sell", new URLSearchParams()), true)
    assert.equal(shouldShowImpersonationActingAsBanner("/admin/users", null), true)
  })
})
