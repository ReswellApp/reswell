export const STRIPE_BOOKS_CATEGORIES = [
  "card_volume",
  "stripe_processing_fee",
  "connect_fee",
  "instant_payout_fee",
  "refund",
  "dispute",
  "seller_transfer",
  "transfer_reversal",
  "platform_payout",
  "payout_reversal",
  "topup",
  "topup_reversal",
  "adjustment",
  "reserve",
  "other",
] as const

export type StripeBooksCategory = (typeof STRIPE_BOOKS_CATEGORIES)[number]

export type StripeBooksFeeDetail = {
  amount: number
  type: string
  description: string | null
}

export type StripeBooksBalanceTransaction = {
  id: string
  created: number
  type: string
  reportingCategory: string | null
  description: string | null
  amount: number
  fee: number
  net: number
  currency: string
  status: string
  feeDetails: StripeBooksFeeDetail[]
  sourceId: string | null
}

export type StripeBooksPeriodMode = "all" | "month" | "ytd" | "30d" | "90d"

export type StripeBooksPeriod = {
  mode: StripeBooksPeriodMode
  label: string
  yearMonth: string | null
  createdGte: number | null
  createdLt: number | null
  startIso: string | null
  endIsoExclusive: string | null
}

export type StripeBooksCategoryTotal = {
  category: StripeBooksCategory
  label: string
  glAccount: string
  bookType: "pnl" | "balance_sheet"
  count: number
  amountCents: number
  feeCents: number
  netCents: number
}

export type StripeBooksMonthBucket = {
  yearMonth: string
  cardVolumeCents: number
  processingFeeCents: number
  connectFeeCents: number
  refundCents: number
  sellerTransferCents: number
  platformPayoutCents: number
  topupCents: number
  netChangeCents: number
}

export type StripeBooksTxnRow = {
  id: string
  createdIso: string
  type: string
  category: StripeBooksCategory
  categoryLabel: string
  description: string
  amountCents: number
  feeCents: number
  processingFeeCents: number
  connectFeeCents: number
  instantFeeCents: number
  netCents: number
  sourceId: string | null
  status: string
}

export type StripeBooksBalanceSnapshot = {
  availableCents: number
  pendingCents: number
  connectReservedCents: number
  instantAvailableCents: number
  totalCents: number
  currency: string
}

export type StripeBooksPayoutRow = {
  id: string
  createdIso: string
  arrivalIso: string | null
  amountCents: number
  status: string
  method: string | null
  destination: string | null
}

export type StripeBooksTopupRow = {
  id: string
  createdIso: string
  amountCents: number
  status: string
}

export type StripeBooksLedgerSnapshot = {
  walletAvailableCents: number
  walletPendingCents: number
  walletOwedCents: number
  walletLifetimeEarnedCents: number
  walletLifetimeCashedOutCents: number
  connectTransferGrossCents: number
  connectTransferFeeCents: number
  connectTransferNetCents: number
  connectTransferCount: number
  instantCashoutCount: number
  confirmedOrderCount: number
  stripeOrderCount: number
  cardOrderVolumeCents: number
  marketplaceFeeCents: number
  sellerEarningsCents: number
  shippingCollectedCents: number
  promoMarketingCents: number
  tipRevenueCents: number
  refundedOrderCount: number
}

export type StripeBooksCoverage = {
  stripeAvailableCents: number
  sellerAvailableCents: number
  surplusCents: number
  stripePendingCents: number
  sellerPendingCents: number
}

export type StripeBooksReport = {
  generatedAtIso: string
  timezone: string
  period: StripeBooksPeriod
  livemode: boolean | null
  stripeAccountId: string | null
  truncated: boolean
  transactionCount: number
  listedThroughIso: string | null
  balance: StripeBooksBalanceSnapshot | null
  categories: StripeBooksCategoryTotal[]
  months: StripeBooksMonthBucket[]
  transactions: StripeBooksTxnRow[]
  payouts: StripeBooksPayoutRow[]
  topups: StripeBooksTopupRow[]
  ledger: StripeBooksLedgerSnapshot
  coverage: StripeBooksCoverage
  stripeNetChangeCents: number
  unexplainedOtherCents: number
  feeTotals: {
    processingFeeCents: number
    connectFeeCents: number
    instantFeeCents: number
  }
}
