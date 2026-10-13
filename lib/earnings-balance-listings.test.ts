import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { EarningsTransaction } from "../components/features/earnings/earnings-types"
import {
  allocateReadyBalanceRows,
  saleEarningsAmountUsd,
  stillPendingBalanceRows,
} from "./earnings-balance-listings"

const ORDER_A = "11111111-1111-4111-8111-111111111111"
const ORDER_B = "22222222-2222-4222-8222-222222222222"
const ORDER_C = "33333333-3333-4333-8333-333333333333"

function tx(partial: Partial<EarningsTransaction> & Pick<EarningsTransaction, "id">): EarningsTransaction {
  return {
    type: "sale",
    amount: "0.00",
    balance_after: "10.00",
    description: "",
    status: "completed",
    created_at: "2026-10-10T12:00:00.000Z",
    ...partial,
  }
}

describe("saleEarningsAmountUsd", () => {
  it("prefers a positive ledger amount, then order seller earnings", () => {
    assert.equal(saleEarningsAmountUsd(tx({ id: "1", amount: "12.50" })), 12.5)
    assert.equal(
      saleEarningsAmountUsd(tx({ id: "2", amount: "0.00", sellerEarningsUsd: 88 })),
      88,
    )
    assert.equal(saleEarningsAmountUsd(tx({ id: "3", amount: "0.00" })), 0)
  })
})

describe("stillPendingBalanceRows", () => {
  it("keeps unreleased pending sales and drops unlocked or reversed ones", () => {
    const pending = [
      tx({
        id: "p-open",
        amount: "339.45",
        created_at: "2026-10-12T10:00:00.000Z",
        reference_type: "order_pending_earnings",
        reference_id: ORDER_A,
        description: 'Pending — Sold "Channel Islands Flyer"',
        listing: {
          id: "l1",
          title: "Channel Islands Flyer",
          href: "/l/ci-flyer",
          imageUrl: "/media/listings/ci.jpg",
          extraListingCount: 0,
        },
        saleHref: `/dashboard/sales/${ORDER_A}`,
      }),
      tx({
        id: "p-released",
        amount: "260.40",
        created_at: "2026-10-01T10:00:00.000Z",
        reference_type: "order_pending_earnings",
        reference_id: ORDER_B,
        description: 'Pending — Sold "Happy"',
      }),
      tx({
        id: "p-refunded",
        amount: "100.00",
        created_at: "2026-10-11T10:00:00.000Z",
        reference_type: "order_pending_earnings",
        reference_id: ORDER_C,
        description: 'Pending — Sold "Refunded board"',
      }),
    ]
    const rows = stillPendingBalanceRows(pending, new Set([ORDER_B]), new Set([ORDER_C]))
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.title, "Channel Islands Flyer")
    assert.equal(rows[0]?.status, "pending")
    assert.equal(rows[0]?.amountUsd, 339.45)
    assert.equal(rows[0]?.listingHref, "/l/ci-flyer")
    assert.equal(rows[0]?.saleHref, `/dashboard/sales/${ORDER_A}`)
  })
})

describe("allocateReadyBalanceRows", () => {
  it("returns nothing when ready balance is zero", () => {
    const released = [
      tx({
        id: "r1",
        amount: "0.00",
        sellerEarningsUsd: 348.75,
        created_at: "2026-10-10T10:00:00.000Z",
        reference_type: "order_seller_earnings",
        reference_id: ORDER_A,
        description: 'Available — Sold "Firewire Creeper"',
        listing: {
          id: "l1",
          title: "Firewire Creeper",
          href: "/l/creeper",
          imageUrl: null,
          extraListingCount: 0,
        },
      }),
    ]
    assert.deepEqual(allocateReadyBalanceRows(released, new Set(), 0), [])
  })

  it("attributes ready balance to the newest unlocked sales first", () => {
    const older = tx({
      id: "r-old",
      amount: "0.00",
      sellerEarningsUsd: 604.5,
      created_at: "2026-09-01T10:00:00.000Z",
      reference_type: "order_seller_earnings",
      reference_id: ORDER_A,
      description: 'Available — Sold "The Solution"',
      listing: {
        id: "l-old",
        title: "The Solution",
        href: "/l/solution",
        imageUrl: null,
        extraListingCount: 0,
      },
    })
    const newer = tx({
      id: "r-new",
      amount: "0.00",
      sellerEarningsUsd: 200,
      created_at: "2026-10-10T10:00:00.000Z",
      reference_type: "order_seller_earnings",
      reference_id: ORDER_B,
      description: 'Available — Sold "Happy"',
      listing: {
        id: "l-new",
        title: "Happy",
        href: "/l/happy",
        imageUrl: null,
        extraListingCount: 0,
      },
    })

    const rows = allocateReadyBalanceRows([older, newer], new Set(), 250)
    assert.equal(rows.length, 2)
    assert.equal(rows[0]?.title, "Happy")
    assert.equal(rows[0]?.amountUsd, 200)
    assert.equal(rows[1]?.title, "The Solution")
    assert.equal(rows[1]?.amountUsd, 50)
    assert.equal(
      rows.reduce((sum, row) => sum + row.amountUsd, 0),
      250,
    )
  })

  it("skips reversed unlocks", () => {
    const rows = allocateReadyBalanceRows(
      [
        tx({
          id: "r1",
          sellerEarningsUsd: 100,
          reference_type: "order_seller_earnings",
          reference_id: ORDER_A,
          description: 'Available — Sold "Board"',
        }),
      ],
      new Set([ORDER_A]),
      100,
    )
    assert.equal(rows.length, 0)
  })
})
