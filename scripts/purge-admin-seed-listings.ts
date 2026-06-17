import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  const content = readFileSync(filePath, "utf8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!value) continue
    if (process.env[key]?.trim()) continue
    process.env[key] = value
  }
}

const ADMIN_SEED_TITLE_FILTER = "Admin seed%"

async function purgeAdminSeedListings(supabase: SupabaseClient): Promise<void> {
  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, title, status, slug")
    .ilike("title", ADMIN_SEED_TITLE_FILTER)

  if (listingsError) {
    throw new Error(`Failed to load admin seed listings: ${listingsError.message}`)
  }

  const rows = listings ?? []
  const listingIds = rows.map((row) => row.id as string)

  console.log(JSON.stringify({ preview: { listingCount: rows.length, listings: rows } }, null, 2))

  if (listingIds.length === 0) {
    console.log("No admin seed listings found.")
    return
  }

  const orderIdSet = new Set<string>()
  let nonAdminTestOrderCount = 0

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, is_admin_test")
    .in("listing_id", listingIds)

  if (ordersError) {
    throw new Error(`Failed to load orders: ${ordersError.message}`)
  }

  for (const row of orders ?? []) {
    orderIdSet.add(row.id as string)
    if (row.is_admin_test !== true) nonAdminTestOrderCount += 1
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, order_id")
    .in("listing_id", listingIds)

  if (itemsError) {
    throw new Error(`Failed to load order items: ${itemsError.message}`)
  }

  const extraOrderIds = (orderItems ?? [])
    .map((row) => row.order_id as string)
    .filter((id) => !orderIdSet.has(id))

  if (extraOrderIds.length > 0) {
    const { data: extraOrders, error: extraOrdersError } = await supabase
      .from("orders")
      .select("id, is_admin_test")
      .in("id", extraOrderIds)

    if (extraOrdersError) {
      throw new Error(`Failed to load multi-item orders: ${extraOrdersError.message}`)
    }

    for (const row of extraOrders ?? []) {
      orderIdSet.add(row.id as string)
      if (row.is_admin_test !== true) nonAdminTestOrderCount += 1
    }
  }

  const orderIds = [...orderIdSet]

  if (nonAdminTestOrderCount > 0) {
    throw new Error(
      `${nonAdminTestOrderCount} real marketplace order(s) reference admin seed listings. Refusing to purge.`,
    )
  }

  console.log(
    JSON.stringify(
      {
        related: {
          orderCount: orderIds.length,
          orderItemCount: orderItems?.length ?? 0,
        },
      },
      null,
      2,
    ),
  )

  let deletedWalletTransactionCount = 0
  let deletedPayoutCount = 0
  let deletedOrderItemCount = 0
  let deletedOrderCount = 0

  if (orderIds.length > 0) {
    const { data: deletedWalletRows, error: walletDeleteError } = await supabase
      .from("wallet_transactions")
      .delete()
      .in("reference_id", orderIds)
      .select("id")

    if (walletDeleteError) {
      throw new Error(`Failed to delete wallet transactions: ${walletDeleteError.message}`)
    }
    deletedWalletTransactionCount = deletedWalletRows?.length ?? 0

    const { data: deletedPayoutRows, error: payoutDeleteError } = await supabase
      .from("payouts")
      .delete()
      .in("order_id", orderIds)
      .select("id")

    if (payoutDeleteError) {
      throw new Error(`Failed to delete payouts: ${payoutDeleteError.message}`)
    }
    deletedPayoutCount = deletedPayoutRows?.length ?? 0

    const { data: deletedItemRows, error: itemDeleteError } = await supabase
      .from("order_items")
      .delete()
      .in("listing_id", listingIds)
      .select("id")

    if (itemDeleteError) {
      throw new Error(`Failed to delete order items: ${itemDeleteError.message}`)
    }
    deletedOrderItemCount = deletedItemRows?.length ?? 0

    const { data: deletedOrderRows, error: orderDeleteError } = await supabase
      .from("orders")
      .delete()
      .in("id", orderIds)
      .select("id")

    if (orderDeleteError) {
      throw new Error(`Failed to delete orders: ${orderDeleteError.message}`)
    }
    deletedOrderCount = deletedOrderRows?.length ?? 0
  }

  const { data: deletedListingRows, error: listingDeleteError } = await supabase
    .from("listings")
    .delete()
    .in("id", listingIds)
    .select("id, slug")

  if (listingDeleteError) {
    throw new Error(`Failed to delete listings: ${listingDeleteError.message}`)
  }

  console.log(
    JSON.stringify(
      {
        deleted: {
          listings: deletedListingRows?.length ?? 0,
          orders: deletedOrderCount,
          payouts: deletedPayoutCount,
          walletTransactions: deletedWalletTransactionCount,
          orderItems: deletedOrderItemCount,
        },
      },
      null,
      2,
    ),
  )
}

async function main(): Promise<void> {
  loadEnvFile(".env.local")

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  }

  const execute = process.argv.includes("--execute")
  const supabase = createClient(url, key)

  if (!execute) {
    const { data: listings } = await supabase
      .from("listings")
      .select("id, title, status, slug")
      .ilike("title", ADMIN_SEED_TITLE_FILTER)

    const listingIds = (listings ?? []).map((row) => row.id as string)
    const { data: orders } = listingIds.length
      ? await supabase.from("orders").select("id, order_num, is_admin_test, listing_id").in("listing_id", listingIds)
      : { data: [] }

    console.log(
      JSON.stringify(
        {
          mode: "preview",
          listingCount: listings?.length ?? 0,
          listings,
          orderCount: orders?.length ?? 0,
          orders,
        },
        null,
        2,
      ),
    )
    console.log("\nDry run only. Re-run with --execute to permanently delete these rows.")
    return
  }

  await purgeAdminSeedListings(supabase)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
