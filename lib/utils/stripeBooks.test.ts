import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { StripeBooksBalanceTransaction } from "@/lib/types/stripeBooks"
import {
  aggregateStripeBooksTransactions,
  categorizeStripeBalanceTransaction,
  categoryForBalanceTransaction,
  coverageFromSnapshots,
  isStripeCardPaymentMethod,
  parseStripeBooksSearch,
  resolveStripeBooksPeriod,
  splitStripeFeeDetails,
  stripeBooksReportToCsv,
  usdToCents,
} from "./stripeBooks.ts"

function txn(
  overrides: Partial<StripeBooksBalanceTransaction> & Pick<StripeBooksBalanceTransaction, "id" | "type">,
): StripeBooksBalanceTransaction {
  return {
    created: 1_700_000_000,
    reportingCategory: null,
    description: null,
    amount: 0,
    fee: 0,
    net: 0,
    currency: "usd",
    status: "available",
    feeDetails: [],
    sourceId: null,
    ...overrides,
  }
}

describe("usdToCents", () => {
  it("rounds wallet dollars to cents", () => {
    assert.equal(usdToCents("69.75"), 6975)
    assert.equal(usdToCents(7), 700)
  })
})

describe("parseStripeBooksSearch", () => {
  it("defaults to empty query (all time)", () => {
    const parsed = parseStripeBooksSearch({})
    assert.equal(parsed.month, undefined)
    assert.equal(parsed.range, undefined)
    assert.equal(parsed.format, undefined)
  })

  it("accepts month over range", () => {
    const parsed = parseStripeBooksSearch({ month: "2026-11", range: "ytd" })
    assert.equal(parsed.month, "2026-11")
  })

  it("rejects invalid month", () => {
    const parsed = parseStripeBooksSearch({ month: "11-2026" })
    assert.equal(parsed.month, undefined)
  })
})

describe("resolveStripeBooksPeriod", () => {
  it("uses all time when no filters are set", () => {
    const period = resolveStripeBooksPeriod({})
    assert.equal(period.mode, "all")
    assert.equal(period.createdGte, null)
    assert.equal(period.createdLt, null)
  })

  it("bounds a Pacific calendar month", () => {
    const period = resolveStripeBooksPeriod({ month: "2026-11" })
    assert.equal(period.mode, "month")
    assert.equal(period.label, "Nov 2026")
    assert.ok(period.createdGte)
    assert.ok(period.createdLt)
    assert.ok((period.createdLt ?? 0) > (period.createdGte ?? 0))
  })
})

describe("splitStripeFeeDetails", () => {
  it("separates Connect and card processing fees", () => {
    const split = splitStripeFeeDetails([
      { amount: 465, type: "stripe_fee", description: "Stripe processing fees" },
      { amount: 25, type: "application_fee", description: "Connect" },
    ])
    assert.equal(split.processingFeeCents, 465)
    assert.equal(split.connectFeeCents, 25)
    assert.equal(split.instantFeeCents, 0)
  })

  it("flags Instant Payout fees", () => {
    const split = splitStripeFeeDetails([
      { amount: 150, type: "stripe_fee", description: "Instant payout fee" },
    ])
    assert.equal(split.instantFeeCents, 150)
    assert.equal(split.processingFeeCents, 0)
  })
})

describe("categoryForBalanceTransaction", () => {
  it("maps marketplace money movement", () => {
    assert.equal(categoryForBalanceTransaction({ type: "charge", reportingCategory: "charge", description: null }), "card_volume")
    assert.equal(categoryForBalanceTransaction({ type: "payment", reportingCategory: null, description: null }), "card_volume")
    assert.equal(categoryForBalanceTransaction({ type: "refund", reportingCategory: "refund", description: null }), "refund")
    assert.equal(categoryForBalanceTransaction({ type: "transfer", reportingCategory: "transfer", description: null }), "seller_transfer")
    assert.equal(categoryForBalanceTransaction({ type: "payout", reportingCategory: "payout", description: null }), "platform_payout")
    assert.equal(categoryForBalanceTransaction({ type: "topup", reportingCategory: "topup", description: null }), "topup")
    assert.equal(
      categoryForBalanceTransaction({
        type: "stripe_fee",
        reportingCategory: "fee",
        description: "Connect volume fee",
      }),
      "connect_fee",
    )
  })
})

describe("categorizeStripeBalanceTransaction", () => {
  it("keeps charge gross, processing fee, and net in balance", () => {
    const row = categorizeStripeBalanceTransaction(
      txn({
        id: "txn_charge",
        type: "charge",
        amount: 15000,
        fee: 465,
        net: 14535,
        feeDetails: [{ amount: 465, type: "stripe_fee", description: "Stripe processing fees" }],
        description: "Reswell checkout",
      }),
    )
    assert.equal(row.category, "card_volume")
    assert.equal(row.amountCents, 15000)
    assert.equal(row.processingFeeCents, 465)
    assert.equal(row.netCents, 14535)
    assert.equal(row.amountCents - row.feeCents, row.netCents)
  })

  it("uses the fee field when Stripe omits fee_details", () => {
    const row = categorizeStripeBalanceTransaction(
      txn({
        id: "txn_bare",
        type: "charge",
        amount: 10000,
        fee: 320,
        net: 9680,
      }),
    )
    assert.equal(row.processingFeeCents, 320)
  })
})

describe("aggregateStripeBooksTransactions", () => {
  it("sums the platform Stripe identity", () => {
    const charge = categorizeStripeBalanceTransaction(
      txn({
        id: "txn_1",
        type: "charge",
        amount: 15000,
        fee: 465,
        net: 14535,
        created: 1_762_300_000,
      }),
    )
    const transfer = categorizeStripeBalanceTransaction(
      txn({
        id: "txn_2",
        type: "transfer",
        amount: -9300,
        fee: 0,
        net: -9300,
        created: 1_762_300_100,
      }),
    )
    const payout = categorizeStripeBalanceTransaction(
      txn({
        id: "txn_3",
        type: "payout",
        amount: -2000,
        fee: 0,
        net: -2000,
        created: 1_762_300_200,
      }),
    )
    const topup = categorizeStripeBalanceTransaction(
      txn({
        id: "txn_4",
        type: "topup",
        amount: 200000,
        fee: 0,
        net: 200000,
        created: 1_762_300_300,
      }),
    )
    const agg = aggregateStripeBooksTransactions([charge, transfer, payout, topup])
    assert.equal(agg.stripeNetChangeCents, 14535 - 9300 - 2000 + 200000)
    const card = agg.categories.find((row) => row.category === "card_volume")
    const sellers = agg.categories.find((row) => row.category === "seller_transfer")
    assert.equal(card?.amountCents, 15000)
    assert.equal(sellers?.netCents, -9300)
  })
})

describe("coverageFromSnapshots", () => {
  it("shows a deficit when sellers can cash out more than Stripe available", () => {
    const coverage = coverageFromSnapshots(50_000, 120_000, {
      walletAvailableCents: 80_000,
      walletPendingCents: 40_000,
    })
    assert.equal(coverage.surplusCents, -30_000)
  })
})

describe("isStripeCardPaymentMethod", () => {
  it("treats stripe and card as Stripe volume", () => {
    assert.equal(isStripeCardPaymentMethod("stripe"), true)
    assert.equal(isStripeCardPaymentMethod("card"), true)
    assert.equal(isStripeCardPaymentMethod("reswell_bucks"), false)
    assert.equal(isStripeCardPaymentMethod("cash"), false)
  })
})

describe("stripeBooksReportToCsv", () => {
  it("includes category and transaction sections", () => {
    const period = resolveStripeBooksPeriod({})
    const csv = stripeBooksReportToCsv({
      generatedAtIso: "2026-11-13T15:00:00.000Z",
      timezone: "America/Los_Angeles",
      period,
      livemode: true,
      stripeAccountId: "acct_test",
      truncated: false,
      transactionCount: 1,
      listedThroughIso: null,
      balance: {
        availableCents: 100,
        pendingCents: 50,
        connectReservedCents: 0,
        instantAvailableCents: 100,
        totalCents: 150,
        currency: "usd",
      },
      categories: [
        {
          category: "card_volume",
          label: "Card charges (gross)",
          glAccount: "Stripe clearing — customer receipts",
          bookType: "balance_sheet",
          count: 1,
          amountCents: 15000,
          feeCents: 465,
          netCents: 14535,
        },
      ],
      months: [],
      transactions: [
        {
          id: "txn_1",
          createdIso: "2026-11-01T00:00:00.000Z",
          type: "charge",
          category: "card_volume",
          categoryLabel: "Card charges (gross)",
          description: 'Board "CI"',
          amountCents: 15000,
          feeCents: 465,
          processingFeeCents: 465,
          connectFeeCents: 0,
          instantFeeCents: 0,
          netCents: 14535,
          sourceId: "ch_1",
          status: "available",
        },
      ],
      payouts: [],
      topups: [],
      ledger: {
        walletAvailableCents: 0,
        walletPendingCents: 0,
        walletOwedCents: 0,
        walletLifetimeEarnedCents: 0,
        walletLifetimeCashedOutCents: 0,
        connectTransferGrossCents: 0,
        connectTransferFeeCents: 0,
        connectTransferNetCents: 0,
        connectTransferCount: 0,
        instantCashoutCount: 0,
        confirmedOrderCount: 0,
        stripeOrderCount: 0,
        cardOrderVolumeCents: 0,
        marketplaceFeeCents: 0,
        sellerEarningsCents: 0,
        shippingCollectedCents: 0,
        promoMarketingCents: 0,
        tipRevenueCents: 0,
        refundedOrderCount: 0,
      },
      coverage: {
        stripeAvailableCents: 100,
        sellerAvailableCents: 0,
        surplusCents: 100,
        stripePendingCents: 50,
        sellerPendingCents: 0,
      },
      stripeNetChangeCents: 14535,
      unexplainedOtherCents: 0,
      feeTotals: {
        processingFeeCents: 465,
        connectFeeCents: 0,
        instantFeeCents: 0,
      },
    })
    assert.match(csv, /Card charges \(gross\)/)
    assert.match(csv, /txn_1/)
    assert.match(csv, /Board ""CI""/)
  })
})
