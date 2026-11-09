import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { conversationViewerIdentity } from "./conversation-viewer.ts"
import { listingOwnerIsOperableAccount } from "./operates-listing.ts"
import {
  accountRoleHasPermission,
  canGrantAccountRole,
  normalizeAccountEmail,
  permissionsForAccountRole,
} from "./permissions.ts"
import { platformAccessForSignedInUser } from "./platform-access.ts"

describe("account role permissions", () => {
  it("gives the owner every shop permission, including payouts", () => {
    assert.equal(accountRoleHasPermission("owner", "payouts.read"), true)
    assert.equal(accountRoleHasPermission("owner", "team.manage"), true)
  })

  it("lets a manager run the shop without payouts or team changes", () => {
    const permissions = permissionsForAccountRole("manager")
    assert.equal(permissions.has("listings.write"), true)
    assert.equal(permissions.has("orders.write"), true)
    assert.equal(permissions.has("team.read"), true)
    assert.equal(permissions.has("team.manage"), false)
    assert.equal(permissions.has("payouts.read"), false)
  })

  it("lets staff run the shop without earnings, payouts, or team changes", () => {
    const permissions = permissionsForAccountRole("staff")
    assert.equal(permissions.has("listings.write"), true)
    assert.equal(permissions.has("messages.write"), true)
    assert.equal(permissions.has("orders.write"), true)
    assert.equal(permissions.has("team.manage"), false)
    assert.equal(permissions.has("team.read"), true)
    assert.equal(permissions.has("profile.manage"), true)
    assert.equal(permissions.has("payouts.read"), false)
    assert.deepEqual(
      [...permissions].sort(),
      [...permissionsForAccountRole("manager")].sort(),
    )
  })

  it("reserves adding and removing team members for the account owner", () => {
    assert.equal(canGrantAccountRole("owner", "manager"), true)
    assert.equal(canGrantAccountRole("owner", "staff"), true)
    assert.equal(canGrantAccountRole("manager", "staff"), false)
    assert.equal(canGrantAccountRole("manager", "manager"), false)
    assert.equal(canGrantAccountRole("staff", "staff"), false)
    assert.equal(canGrantAccountRole("staff", "manager"), false)
  })

  it("normalizes invite emails", () => {
    assert.equal(normalizeAccountEmail("  Ada@Shop.com "), "ada@shop.com")
  })
})

describe("platform access stays on the signed-in user", () => {
  it("does not inherit admin or employee from the shop account", () => {
    const access = platformAccessForSignedInUser({
      profile: { is_admin: false, is_employee: false },
      shopAccountIsAdmin: true,
      shopAccountIsEmployee: true,
    })
    assert.equal(access.isAdmin, false)
    assert.equal(access.isEmployee, false)
  })

  it("still honors an explicit employee grant on that person's own profile", () => {
    const access = platformAccessForSignedInUser({
      profile: { is_admin: false, is_employee: true },
      shopAccountIsAdmin: true,
    })
    assert.equal(access.isAdmin, false)
    assert.equal(access.isEmployee, true)
  })
})

describe("listing and conversation identity", () => {
  it("treats the acting shop as the listing owner", () => {
    assert.equal(listingOwnerIsOperableAccount("employee", "shop", "shop"), true)
    assert.equal(listingOwnerIsOperableAccount("employee", "shop", null), false)
    assert.equal(listingOwnerIsOperableAccount("shop", "shop", null), true)
  })

  it("lets a shop member speak as the seller without becoming that login", () => {
    const viewer = conversationViewerIdentity({
      actorUserId: "employee",
      buyerId: "buyer",
      sellerId: "shop",
      shopAccountId: "shop",
      canReadMessages: true,
      canWriteMessages: true,
    })
    assert.equal(viewer.allowed, true)
    assert.equal(viewer.viewerId, "shop")
    assert.equal(viewer.senderId, "shop")
    assert.equal(viewer.useServiceRole, true)
  })

  it("refuses shop-seller identity when the member is not in that shop", () => {
    const viewer = conversationViewerIdentity({
      actorUserId: "employee",
      buyerId: "buyer",
      sellerId: "other-shop",
      shopAccountId: "shop",
      canReadMessages: true,
      canWriteMessages: true,
    })
    assert.equal(viewer.allowed, false)
  })
})
