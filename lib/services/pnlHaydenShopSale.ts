import { revalidatePath } from "next/cache"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { listPnlEntriesByListingIds, updatePnlEntryRow } from "@/lib/db/pnl"
import {
  buildHaydenShopPnlSaleUpdate,
  type HaydenShopPnlSale,
} from "@/lib/pnl-hayden-shop-sale"
import { resolveMetaCatalogHaydenShopUserId } from "@/lib/services/metaCatalogFeed"

export type { HaydenShopPnlSale }
export { buildHaydenShopPnlSaleUpdate }

export function pnlCatalogClient(fallback: Awaited<ReturnType<typeof createClient>>) {
  try {
    return createServiceRoleClient()
  } catch {
    return fallback
  }
}

export async function resolveHaydenShopUserId(
  supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>,
): Promise<string | null> {
  return resolveMetaCatalogHaydenShopUserId(supabase)
}

function isNextCacheContextMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("static generation store missing") || message.includes("revalidateTag")
}

/**
 * When a Hayden shop listing sells, mark the linked balance-sheet row sold.
 * No-ops for other sellers or listings that were never attached.
 */
export async function syncHaydenShopPnlOnSale(params: {
  sellerId: string
  sales: HaydenShopPnlSale[]
}): Promise<void> {
  const sales = params.sales.filter((sale) => sale.listingId && Number.isFinite(sale.salePrice))
  if (sales.length === 0) return

  try {
    let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createServiceRoleClient>
    try {
      supabase = createServiceRoleClient()
    } catch {
      supabase = await createClient()
    }
    const haydenId = await resolveHaydenShopUserId(supabase)
    if (!haydenId || haydenId !== params.sellerId) return

    const listingIds = sales.map((sale) => sale.listingId)
    const entries = await listPnlEntriesByListingIds(supabase, listingIds)
    if (entries.length === 0) return

    const saleByListing = new Map(sales.map((sale) => [sale.listingId, sale]))
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.listing_id) return
        const sale = saleByListing.get(entry.listing_id)
        if (!sale) return
        if (entry.status === "sold" && entry.order_id && sale.orderId === entry.order_id) {
          return
        }
        await updatePnlEntryRow(supabase, entry.id, buildHaydenShopPnlSaleUpdate(sale))
      }),
    )

    try {
      revalidatePath("/admin/pnl")
    } catch (error) {
      if (!isNextCacheContextMissing(error)) {
        console.error("[pnl] revalidate after Hayden shop sale:", error)
      }
    }
  } catch (error) {
    console.error("[pnl] Hayden shop sale sync failed:", error)
  }
}
