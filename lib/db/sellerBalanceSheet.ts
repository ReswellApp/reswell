import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  BalanceSheetSaleSource,
  SellerBalanceSheetEntry,
  SellerBalanceSheetPage,
  SellerBalanceSheetSummary,
} from "@/lib/types/sellerBalanceSheet"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { balanceSheetEntryOrder } from "@/lib/utils/balance-sheet-query"
import type { UpdateListingAcquisitionInput } from "@/lib/validations/listing-acquisition"
import type {
  BalanceSheetSort,
  RemoveBalanceSheetItemInput,
} from "@/lib/validations/seller-balance-sheet"

interface BalanceSheetViewRow {
  entry_key: string
  sale_source: BalanceSheetSaleSource
  listing_id: string
  listing_title: string
  listing_section: string
  listing_slug: string | null
  purchase_price: number | string | null
  purchased_from: string | null
  purchased_on: string | null
  sold_price: number | string
  reswell_fee: number | string
  seller_proceeds: number | string
  sold_at: string
  order_id: string | null
  order_num: string | null
  profit: number | string | null
  profit_margin_percent: number | string | null
}

interface BalanceSheetSummaryRow {
  inventory_listings: number | string
  inventory_asking_value: number | string
  inventory_cost_basis: number | string
  realized_sales: number | string
  gross_sales: number | string
  reswell_fees: number | string
  recorded_cost_basis: number | string
  realized_profit: number | string
  missing_cost_basis: number | string
}

function money(value: number | string | null): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function optionalNumber(value: number | string | null): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function mapEntry(row: BalanceSheetViewRow): SellerBalanceSheetEntry {
  return {
    entryKey: row.entry_key,
    saleSource: row.sale_source,
    listingId: row.listing_id,
    listingTitle: row.listing_title,
    listingSection: row.listing_section,
    listingSlug: row.listing_slug,
    purchasePrice: optionalNumber(row.purchase_price),
    purchasedFrom: row.purchased_from,
    purchasedOn: row.purchased_on,
    soldPrice: money(row.sold_price),
    reswellFee: money(row.reswell_fee),
    sellerProceeds: money(row.seller_proceeds),
    soldAt: row.sold_at,
    orderId: row.order_id,
    orderNum: row.order_num,
    profit: optionalNumber(row.profit),
    profitMarginPercent: optionalNumber(row.profit_margin_percent),
  }
}

function mapSummary(row: BalanceSheetSummaryRow | null): SellerBalanceSheetSummary {
  return {
    inventoryListings: Number(row?.inventory_listings ?? 0),
    inventoryAskingValue: money(row?.inventory_asking_value ?? 0),
    inventoryCostBasis: money(row?.inventory_cost_basis ?? 0),
    realizedSales: Number(row?.realized_sales ?? 0),
    grossSales: money(row?.gross_sales ?? 0),
    reswellFees: money(row?.reswell_fees ?? 0),
    recordedCostBasis: money(row?.recorded_cost_basis ?? 0),
    realizedProfit: money(row?.realized_profit ?? 0),
    missingCostBasis: Number(row?.missing_cost_basis ?? 0),
  }
}

const BALANCE_SHEET_COLUMNS =
  "entry_key, sale_source, listing_id, listing_title, listing_section, listing_slug, purchase_price, purchased_from, purchased_on, sold_price, reswell_fee, seller_proceeds, sold_at, order_id, order_num, profit, profit_margin_percent"

export async function getSellerBalanceSheetPage(
  supabase: SupabaseClient,
  userId: string,
  page: number,
  pageSize: number,
  listingSection: PeerListingSection | null,
  sort: BalanceSheetSort,
): Promise<SellerBalanceSheetPage> {
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let entriesQuery = supabase
    .from("visible_seller_balance_sheet_entries")
    .select(BALANCE_SHEET_COLUMNS, { count: "exact" })
    .eq("owner_id", userId)

  if (listingSection) {
    entriesQuery = entriesQuery.eq("listing_section", listingSection)
  }

  const orderedEntries = balanceSheetEntryOrder(sort).reduce(
    (query, step) =>
      query.order(step.column, {
        ascending: step.ascending,
        nullsFirst: step.nullsFirst,
      }),
    entriesQuery,
  )

  const [entriesResult, summaryResult] = await Promise.all([
    orderedEntries.range(from, to),
    supabase.rpc("get_my_balance_sheet_summary_by_section", {
      p_listing_section: listingSection,
    }),
  ])

  if (entriesResult.error) throw entriesResult.error
  if (summaryResult.error) throw summaryResult.error

  const totalEntries = entriesResult.count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize))

  return {
    entries: ((entriesResult.data ?? []) as BalanceSheetViewRow[]).map(mapEntry),
    summary: mapSummary(
      ((summaryResult.data ?? []) as BalanceSheetSummaryRow[])[0] ?? null,
    ),
    page,
    pageSize,
    totalEntries,
    totalPages,
  }
}

export async function updateOwnedListingAcquisition(
  supabase: SupabaseClient,
  userId: string,
  input: UpdateListingAcquisitionInput,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("listings")
    .update({
      seller_purchase_price_usd: input.purchasePrice,
      seller_purchased_from: input.purchasedFrom,
      seller_purchased_on: input.purchasedOn,
    })
    .eq("id", input.listingId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle()

  if (error) throw error
  return data?.id === input.listingId
}

export async function excludeOwnedBalanceSheetItem(
  supabase: SupabaseClient,
  userId: string,
  input: RemoveBalanceSheetItemInput,
): Promise<void> {
  const { error } = await supabase
    .from("seller_balance_sheet_exclusions")
    .upsert(
      {
        owner_id: userId,
        listing_id: input.listingId,
      },
      {
        onConflict: "owner_id,listing_id",
        ignoreDuplicates: true,
      },
    )

  if (error) throw error
}
