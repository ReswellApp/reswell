import type { SupabaseClient } from "@supabase/supabase-js"
import { deleteListingDocument } from "@/lib/elasticsearch/listings-index"
import { removeListingFromGoogleMerchantFeed } from "@/lib/services/googleMerchantSync"
import {
  fetchListingImageUrlsForListingIds,
  removeListingImageFilesFromStorage,
} from "@/lib/services/listingStorageCleanup"

export type AdminSeedListingPurgePreview = {
  listingCount: number
  listings: Array<{ id: string; title: string | null; status: string; slug: string | null }>
  orderCount: number
  orderItemCount: number
  payoutCount: number
  walletTransactionCount: number
  nonAdminTestOrderCount: number
}

export type AdminSeedListingPurgeResult =
  | {
      ok: true
      deletedListingCount: number
      deletedOrderCount: number
      deletedPayoutCount: number
      deletedWalletTransactionCount: number
      deletedOrderItemCount: number
    }
  | { ok: false; error: string; status: number }

const ADMIN_SEED_TITLE_FILTER = "Admin seed%"

async function fetchAdminSeedListingIds(supabase: SupabaseClient): Promise<
  Array<{ id: string; title: string | null; status: string; slug: string | null }>
> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, status, slug")
    .ilike("title", ADMIN_SEED_TITLE_FILTER)

  if (error) {
    throw new Error(`Failed to load admin seed listings: ${error.message}`)
  }

  return (data ?? []) as Array<{ id: string; title: string | null; status: string; slug: string | null }>
}

async function collectRelatedOrderIds(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<{ orderIds: string[]; orderItemCount: number; nonAdminTestOrderCount: number }> {
  if (listingIds.length === 0) {
    return { orderIds: [], orderItemCount: 0, nonAdminTestOrderCount: 0 }
  }

  const orderIdSet = new Set<string>()

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, is_admin_test")
    .in("listing_id", listingIds)

  if (ordersError) {
    throw new Error(`Failed to load orders: ${ordersError.message}`)
  }

  let nonAdminTestOrderCount = 0
  for (const row of orders ?? []) {
    orderIdSet.add(row.id as string)
    if (row.is_admin_test !== true) {
      nonAdminTestOrderCount += 1
    }
  }

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("id, order_id, listing_id")
    .in("listing_id", listingIds)

  if (itemsError) {
    throw new Error(`Failed to load order items: ${itemsError.message}`)
  }

  const orderItemCount = orderItems?.length ?? 0

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
      if (row.is_admin_test !== true) {
        nonAdminTestOrderCount += 1
      }
    }
  }

  return {
    orderIds: [...orderIdSet],
    orderItemCount,
    nonAdminTestOrderCount,
  }
}

export async function previewAdminSeedListingPurge(
  supabase: SupabaseClient,
): Promise<AdminSeedListingPurgePreview> {
  const listings = await fetchAdminSeedListingIds(supabase)
  const listingIds = listings.map((row) => row.id)
  const { orderIds, orderItemCount, nonAdminTestOrderCount } = await collectRelatedOrderIds(
    supabase,
    listingIds,
  )

  let payoutCount = 0
  let walletTransactionCount = 0

  if (orderIds.length > 0) {
    const { count: payoutTotal, error: payoutError } = await supabase
      .from("payouts")
      .select("id", { count: "exact", head: true })
      .in("order_id", orderIds)

    if (payoutError) {
      throw new Error(`Failed to count payouts: ${payoutError.message}`)
    }
    payoutCount = payoutTotal ?? 0

    const { count: walletTotal, error: walletError } = await supabase
      .from("wallet_transactions")
      .select("id", { count: "exact", head: true })
      .in("reference_id", orderIds)

    if (walletError) {
      throw new Error(`Failed to count wallet transactions: ${walletError.message}`)
    }
    walletTransactionCount = walletTotal ?? 0
  }

  return {
    listingCount: listings.length,
    listings,
    orderCount: orderIds.length,
    orderItemCount,
    payoutCount,
    walletTransactionCount,
    nonAdminTestOrderCount,
  }
}

export async function purgeAdminSeedListingsService(
  supabase: SupabaseClient,
  audit: { adminId?: string },
): Promise<AdminSeedListingPurgeResult> {
  const preview = await previewAdminSeedListingPurge(supabase)

  if (preview.listingCount === 0) {
    return {
      ok: true,
      deletedListingCount: 0,
      deletedOrderCount: 0,
      deletedPayoutCount: 0,
      deletedWalletTransactionCount: 0,
      deletedOrderItemCount: 0,
    }
  }

  if (preview.nonAdminTestOrderCount > 0) {
    return {
      ok: false,
      error: `${preview.nonAdminTestOrderCount} real marketplace order(s) reference admin seed listings. Refusing to purge.`,
      status: 409,
    }
  }

  const listingIds = preview.listings.map((row) => row.id)
  const { orderIds, orderItemCount } = await collectRelatedOrderIds(supabase, listingIds)

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
      console.error("[adminSeedListingPurge] wallet_transactions:", walletDeleteError.message)
      return { ok: false, error: "Failed to delete wallet transactions", status: 500 }
    }
    deletedWalletTransactionCount = deletedWalletRows?.length ?? 0

    const { data: deletedPayoutRows, error: payoutDeleteError } = await supabase
      .from("payouts")
      .delete()
      .in("order_id", orderIds)
      .select("id")

    if (payoutDeleteError) {
      console.error("[adminSeedListingPurge] payouts:", payoutDeleteError.message)
      return { ok: false, error: "Failed to delete payouts", status: 500 }
    }
    deletedPayoutCount = deletedPayoutRows?.length ?? 0

    const { data: deletedItemRows, error: itemDeleteError } = await supabase
      .from("order_items")
      .delete()
      .in("listing_id", listingIds)
      .select("id")

    if (itemDeleteError) {
      console.error("[adminSeedListingPurge] order_items:", itemDeleteError.message)
      return { ok: false, error: "Failed to delete order items", status: 500 }
    }
    deletedOrderItemCount = deletedItemRows?.length ?? orderItemCount

    const { data: deletedOrderRows, error: orderDeleteError } = await supabase
      .from("orders")
      .delete()
      .in("id", orderIds)
      .select("id")

    if (orderDeleteError) {
      console.error("[adminSeedListingPurge] orders:", orderDeleteError.message)
      return { ok: false, error: "Failed to delete orders", status: 500 }
    }
    deletedOrderCount = deletedOrderRows?.length ?? 0
  }

  const imageUrls = await fetchListingImageUrlsForListingIds(supabase, listingIds)

  const { data: deletedListingRows, error: listingDeleteError } = await supabase
    .from("listings")
    .delete()
    .in("id", listingIds)
    .select("id")

  if (listingDeleteError) {
    console.error("[adminSeedListingPurge] listings:", listingDeleteError.message)
    return { ok: false, error: "Failed to delete listings", status: 500 }
  }

  for (const listingId of listingIds) {
    try {
      await deleteListingDocument(listingId)
    } catch {
      /* ES optional */
    }
    await removeListingFromGoogleMerchantFeed(listingId)
  }

  try {
    await removeListingImageFilesFromStorage(supabase, imageUrls)
  } catch {
    /* best-effort */
  }

  console.info("[adminSeedListingPurge] complete", {
    adminId: audit.adminId ?? "script",
    deletedListingCount: deletedListingRows?.length ?? 0,
    deletedOrderCount,
    deletedPayoutCount,
    deletedWalletTransactionCount,
    deletedOrderItemCount,
  })

  return {
    ok: true,
    deletedListingCount: deletedListingRows?.length ?? 0,
    deletedOrderCount,
    deletedPayoutCount,
    deletedWalletTransactionCount,
    deletedOrderItemCount,
  }
}
