import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { EarningsTransaction } from "../components/features/earnings/earnings-types"
import { applyEarningsListingMap, type EarningsListingMapRow } from "./earnings-listing-map"
import {
  orderDetailPathFromLedgerTx,
  orderIdFromSellerSaleLedger,
  saleHrefForOrderId,
} from "./earnings-sale-ledger"

const ORDER_A = "11111111-1111-4111-8111-111111111111"
const ORDER_B = "22222222-2222-4222-8222-222222222222"

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

describe("orderDetailPathFromLedgerTx", () => {
  it("sends seller earnings rows to the sale page", () => {
    assert.equal(
      orderDetailPathFromLedgerTx({
        reference_type: "order_pending_earnings",
        reference_id: ORDER_A,
      }),
      `/dashboard/sales/${ORDER_A}`,
    )
    assert.equal(
      orderDetailPathFromLedgerTx({
        reference_type: "order_seller_earnings",
        reference_id: ORDER_A,
      }),
      `/dashboard/sales/${ORDER_A}`,
    )
  })

  it("keeps buyer wallet refunds on the purchase page", () => {
    assert.equal(
      orderDetailPathFromLedgerTx({
        reference_type: "wallet_refund",
        reference_id: ORDER_A,
      }),
      `/dashboard/purchases/${ORDER_A}`,
    )
  })

  it("prefers an attached saleHref", () => {
    assert.equal(
      orderDetailPathFromLedgerTx({
        saleHref: "/dashboard/sales/custom",
        reference_type: "order_seller_earnings",
        reference_id: ORDER_A,
      }),
      "/dashboard/sales/custom",
    )
  })
})

describe("applyEarningsListingMap", () => {
  it("attaches listing, sale href, and seller earnings to ledger rows", () => {
    const listingMap = new Map<string, EarningsListingMapRow>([
      [
        ORDER_A,
        {
          sellerEarningsUsd: 142.35,
          listing: {
            id: "list-1",
            title: "Firewire 6'0",
            href: "/l/firewire-6-0",
            imageUrl: "/media/listings/firewire.jpg",
            extraListingCount: 0,
          },
        },
      ],
    ])
    const [enriched] = applyEarningsListingMap(
      [
        tx({
          id: "p1",
          amount: "142.35",
          reference_type: "order_pending_earnings",
          reference_id: ORDER_A,
          description: 'Pending — Sold "Firewire 6\'0"',
        }),
      ],
      listingMap,
    )
    assert.equal(enriched?.saleHref, saleHrefForOrderId(ORDER_A))
    assert.equal(enriched?.sellerEarningsUsd, 142.35)
    assert.equal(enriched?.listing?.title, "Firewire 6'0")
    assert.equal(enriched?.listing?.href, "/l/firewire-6-0")
    assert.equal(orderIdFromSellerSaleLedger(enriched ?? {}), ORDER_A)
  })

  it("still adds a sale href when the order has no listing row", () => {
    const [enriched] = applyEarningsListingMap(
      [
        tx({
          id: "p1",
          reference_type: "order_seller_earnings",
          reference_id: ORDER_B,
          description: 'Available — Sold "Unknown"',
        }),
      ],
      new Map(),
    )
    assert.equal(enriched?.saleHref, saleHrefForOrderId(ORDER_B))
    assert.equal(enriched?.listing, undefined)
  })
})
