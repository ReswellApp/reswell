export type BalanceSheetSaleSource = "inventory" | "reswell" | "off_platform"

export interface SellerBalanceSheetEntry {
  entryKey: string
  saleSource: BalanceSheetSaleSource
  listingId: string
  listingTitle: string
  listingSection: string
  listingSlug: string | null
  purchasePrice: number | null
  purchasedFrom: string | null
  purchasedOn: string | null
  soldPrice: number
  reswellFee: number
  sellerProceeds: number
  soldAt: string
  orderId: string | null
  orderNum: string | null
  profit: number | null
  profitMarginPercent: number | null
}

export interface SellerBalanceSheetSummary {
  inventoryListings: number
  inventoryAskingValue: number
  inventoryCostBasis: number
  realizedSales: number
  grossSales: number
  reswellFees: number
  recordedCostBasis: number
  realizedProfit: number
  missingCostBasis: number
}

export interface SellerBalanceSheetPage {
  entries: SellerBalanceSheetEntry[]
  summary: SellerBalanceSheetSummary
  page: number
  pageSize: number
  totalEntries: number
  totalPages: number
}
