import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildHaydenShopPnlSaleUpdate, haydenShopListingToPnlInsert } from "./pnl-hayden-shop-sale.ts"

describe("buildHaydenShopPnlSaleUpdate", () => {
  it("marks the entry sold with the checkout sale fields", () => {
    assert.deepEqual(
      buildHaydenShopPnlSaleUpdate({
        listingId: "listing-1",
        salePrice: 425,
        saleDate: "2026-09-21T18:00:00.000Z",
        orderId: "order-1",
        orderNum: "5VCZPU",
        platformFee: 21.25,
      }),
      {
        status: "sold",
        sale_price: 425,
        sale_date: "2026-09-21",
        order_id: "order-1",
        order_num: "5VCZPU",
        order_role: "seller",
        platform_fee: 21.25,
      },
    )
  })

  it("maps a sold listing to a sold P&L row", () => {
    const row = haydenShopListingToPnlInsert(
      {
        listing_id: "listing-5",
        listing_slug: "album-twinsman",
        board_name: "5’6 Album Surf Twinsman",
        category: "twin",
        thumbnail_url: null,
        price: 700,
        created_at: "2026-08-01T00:00:00.000Z",
        status: "sold",
        sale_price: 675,
        sale_date: "2026-09-10T12:00:00.000Z",
        order_id: "order-9",
        order_num: "ABC123",
        platform_fee: 33.75,
      },
      "staff-1",
    )
    assert.equal(row?.status, "sold")
    assert.equal(row?.sale_price, 675)
    assert.equal(row?.sale_date, "2026-09-10")
    assert.equal(row?.order_id, "order-9")
    assert.equal(row?.order_role, "seller")
  })

  it("maps an active listing to a listed P&L row", () => {
    const row = haydenShopListingToPnlInsert(
      {
        listing_id: "listing-3",
        listing_slug: "ci-happy",
        board_name: "5’10 Channel Islands Happy",
        category: "shortboard",
        thumbnail_url: null,
        price: 850,
        created_at: "2026-09-01T00:00:00.000Z",
        status: "active",
        sale_price: null,
        sale_date: null,
        order_id: null,
        order_num: null,
        platform_fee: 0,
      },
      "staff-1",
    )
    assert.equal(row?.status, "listed")
    assert.equal(row?.asking_price, 850)
    assert.equal(row?.sale_price, null)
    assert.equal(row?.created_by, "staff-1")
  })

  it("skips ended listings", () => {
    assert.equal(
      haydenShopListingToPnlInsert(
        {
          listing_id: "listing-4",
          listing_slug: null,
          board_name: "Ended board",
          category: null,
          thumbnail_url: null,
          price: 100,
          created_at: "2026-01-01T00:00:00.000Z",
          status: "removed",
          sale_price: null,
          sale_date: null,
          order_id: null,
          order_num: null,
          platform_fee: 0,
        },
        "staff-1",
      ),
      null,
    )
  })

  it("records an off-platform sale without an order", () => {
    assert.deepEqual(
      buildHaydenShopPnlSaleUpdate({
        listingId: "listing-2",
        salePrice: 380,
        saleDate: "2026-09-01",
      }),
      {
        status: "sold",
        sale_price: 380,
        sale_date: "2026-09-01",
      },
    )
  })
})
