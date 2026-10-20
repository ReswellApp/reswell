import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildHeaderShopAccess,
  headerShopAccessFromRows,
  headerShopAccessWithActiveAccount,
} from "./header-shop-access.ts"

const USER = "user-1"
const SHOP = "shop-1"

describe("header shop access", () => {
  it("lists personal beside each accepted shop and opens the saved shop", () => {
    const access = headerShopAccessFromRows({
      userId: USER,
      email: " Hayden@Reswell.app ",
      actor: {
        active_shop_account_id: SHOP,
        display_name: "Christian",
        shopify_connect_enabled: false,
      },
      memberships: [{ account_id: SHOP, role: "staff" }],
      profiles: [
        {
          id: SHOP,
          shop_name: "Hayden Garfields Shop",
          display_name: "Ignored",
          shopify_connect_enabled: true,
        },
      ],
    })

    assert.equal(access.actingAsShop, true)
    assert.equal(access.activeAccountId, SHOP)
    assert.equal(access.role, "staff")
    assert.equal(access.shopLabel, "Hayden Garfields Shop")
    assert.equal(access.actorEmail, "hayden@reswell.app")
    assert.equal(access.showEarnings, false)
    assert.equal(access.hasShopifyAccess, true)
    assert.deepEqual(
      access.options.map((option) => [option.accountId, option.label, option.role]),
      [
        [USER, "My account", "owner"],
        [SHOP, "Hayden Garfields Shop", "staff"],
      ],
    )
  })

  it("keeps the signed-in name even when that profile has a shop brand", () => {
    const access = headerShopAccessFromRows({
      userId: USER,
      email: "haydensbsb@gmail.com",
      actor: {
        display_name: "Christian",
        shop_name: "Hayden Garfields Shop",
        active_shop_account_id: null,
      },
      memberships: [{ account_id: SHOP, role: "staff" }],
      profiles: [{ id: SHOP, shop_name: "Hayden Garfields Shop", display_name: "Christian" }],
    })

    assert.equal(access.actingAsShop, false)
    assert.equal(access.shopLabel, "Christian")
    assert.equal(access.options[1]?.label, "Hayden Garfields Shop")
  })

  it("falls back to personal when the saved shop is not a membership", () => {
    const access = buildHeaderShopAccess({
      userId: USER,
      email: null,
      actorLabel: "Christian",
      activeShopAccountId: "missing",
      actorShopifyConnectEnabled: true,
      memberships: [
        {
          accountId: SHOP,
          role: "manager",
          label: "Shop",
          shopifyConnectEnabled: false,
        },
      ],
    })

    assert.equal(access.actingAsShop, false)
    assert.equal(access.activeAccountId, USER)
    assert.equal(access.role, "owner")
    assert.equal(access.showEarnings, true)
    assert.equal(access.hasShopifyAccess, true)
    assert.equal(access.shopLabel, "Christian")
  })

  it("switches the open account without waiting for a refetch", () => {
    const personal = buildHeaderShopAccess({
      userId: USER,
      email: "hayden@reswell.app",
      actorLabel: "Christian",
      activeShopAccountId: null,
      actorShopifyConnectEnabled: false,
      memberships: [
        {
          accountId: SHOP,
          role: "staff",
          label: "Hayden Garfields Shop",
          shopifyConnectEnabled: true,
        },
      ],
    })

    const shop = headerShopAccessWithActiveAccount(personal, SHOP)
    assert.equal(shop.actingAsShop, true)
    assert.equal(shop.shopLabel, "Hayden Garfields Shop")
    assert.equal(shop.showEarnings, false)
    assert.equal(shop.hasShopifyAccess, true)

    const back = headerShopAccessWithActiveAccount(shop, null)
    assert.equal(back.actingAsShop, false)
    assert.equal(back.activeAccountId, USER)
    assert.equal(back.showEarnings, true)
    assert.equal(back.hasShopifyAccess, false)
    assert.equal(headerShopAccessWithActiveAccount(personal, "other"), personal)
  })
})
