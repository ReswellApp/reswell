import type { SupabaseClient } from "@supabase/supabase-js"
import { setListingVacationModeForSeller } from "@/lib/services/listingVacationMode"
import { shopVacationTargetIds, type ShopVacationListing } from "@/lib/shop-vacation"

const SHOP_VACATION_SELECT = "id, status, hidden_from_site, site_visibility_reason, archived_at"
const CONCURRENCY = 4

async function mapPool(
  ids: string[],
  worker: (id: string) => Promise<boolean>,
): Promise<{ updated: number; failed: number }> {
  let index = 0
  let updated = 0
  let failed = 0

  async function run(): Promise<void> {
    const current = index
    index += 1
    if (current >= ids.length) return
    const id = ids[current]
    if (!id) return
    const ok = await worker(id)
    if (ok) updated += 1
    else failed += 1
    await run()
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, ids.length) }, () => run())
  await Promise.all(workers)
  return { updated, failed }
}

export async function setShopVacationModeForSeller(params: {
  supabase: SupabaseClient
  userId: string
  vacationMode: boolean
}): Promise<
  | { ok: true; updated: number; failed: number; vacationMode: boolean }
  | { ok: false; error: string; status: number }
> {
  const { data, error } = await params.supabase
    .from("listings")
    .select(SHOP_VACATION_SELECT)
    .eq("user_id", params.userId)
    .is("archived_at", null)

  if (error) {
    console.error("[shopVacationMode] load listings", error.message)
    return { ok: false, error: "Could not load your listings.", status: 500 }
  }

  const rows = (data ?? []) as ShopVacationListing[]
  const targets = shopVacationTargetIds(rows, params.vacationMode ? "on" : "off")
  if (targets.length === 0) {
    return { ok: true, updated: 0, failed: 0, vacationMode: params.vacationMode }
  }

  const { updated, failed } = await mapPool(targets, async (listingId) => {
    const result = await setListingVacationModeForSeller({
      supabase: params.supabase,
      userId: params.userId,
      listingId,
      vacationMode: params.vacationMode,
    })
    if (!result.ok) {
      console.error("[shopVacationMode] listing", listingId, result.error)
      return false
    }
    return true
  })

  if (updated === 0 && failed > 0) {
    return { ok: false, error: "Could not update vacation mode for your shop.", status: 500 }
  }

  return { ok: true, updated, failed, vacationMode: params.vacationMode }
}
