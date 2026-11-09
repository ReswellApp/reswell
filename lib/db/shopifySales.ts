import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  ShopifySaleCollectVia,
  ShopifySourceOfTruth,
} from "@/lib/shopify/types"

export type ShopifySaleRecordStatus =
  | "pending"
  | "ordered"
  | "adjusted"
  | "charged"
  | "skipped"

export interface ShopifySaleRecord {
  order_id: string
  connection_id: string
  source_of_truth: ShopifySourceOfTruth
  collect_via: ShopifySaleCollectVia
  item_price: number
  usage_amount: number
  shopify_order_gid: string | null
  usage_record_gid: string | null
  status: ShopifySaleRecordStatus
  last_error: string | null
}

const SALE_SELECT = [
  "order_id",
  "connection_id",
  "source_of_truth",
  "collect_via",
  "item_price",
  "usage_amount",
  "shopify_order_gid",
  "usage_record_gid",
  "status",
  "last_error",
].join(",")

export async function dbGetShopifySaleRecord(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ShopifySaleRecord | null> {
  const { data, error } = await supabase
    .from("shopify_sale_records")
    .select(SALE_SELECT)
    .eq("order_id", orderId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ShopifySaleRecord | null) ?? null
}

export async function dbInsertShopifySaleRecord(
  supabase: SupabaseClient,
  input: {
    orderId: string
    connectionId: string
    sourceOfTruth: ShopifySourceOfTruth
    collectVia: ShopifySaleCollectVia
    itemPrice: number
    usageAmount: number
  },
): Promise<boolean> {
  const { error } = await supabase.from("shopify_sale_records").insert({
    order_id: input.orderId,
    connection_id: input.connectionId,
    source_of_truth: input.sourceOfTruth,
    collect_via: input.collectVia,
    item_price: input.itemPrice,
    usage_amount: input.usageAmount,
    status: "pending",
  })
  if (!error) return true
  if (error.code === "23505") return false
  throw new Error(error.message)
}

export async function dbUpdateShopifySaleRecord(
  supabase: SupabaseClient,
  orderId: string,
  patch: {
    status?: ShopifySaleRecordStatus
    shopifyOrderGid?: string | null
    usageRecordGid?: string | null
    itemPrice?: number
    usageAmount?: number
    error?: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from("shopify_sale_records")
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.shopifyOrderGid !== undefined
        ? { shopify_order_gid: patch.shopifyOrderGid }
        : {}),
      ...(patch.usageRecordGid !== undefined
        ? { usage_record_gid: patch.usageRecordGid }
        : {}),
      ...(patch.itemPrice !== undefined ? { item_price: patch.itemPrice } : {}),
      ...(patch.usageAmount !== undefined
        ? { usage_amount: patch.usageAmount }
        : {}),
      last_error: patch.error?.slice(0, 1000) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)
  if (error) throw new Error(error.message)
}

export async function dbListShopifyBilledListingIds(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<string[]> {
  if (listingIds.length === 0) return []
  const { data: mappings, error } = await supabase
    .from("shopify_product_mappings")
    .select("listing_id, connection_id")
    .in("listing_id", listingIds)
    .eq("selected", true)
  if (error) throw new Error(error.message)
  const rows = mappings ?? []
  const connectionIds = [...new Set(rows.map((row) => String(row.connection_id)))]
  if (connectionIds.length === 0) return []
  const { data: connections, error: connectionError } = await supabase
    .from("shopify_connections")
    .select("id")
    .in("id", connectionIds)
    .eq("status", "active")
    .eq("billing_status", "active")
  if (connectionError) throw new Error(connectionError.message)
  const billed = new Set((connections ?? []).map((row) => String(row.id)))
  return rows
    .filter((row) => billed.has(String(row.connection_id)))
    .map((row) => String(row.listing_id))
}
