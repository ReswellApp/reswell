import { createServiceRoleClient } from "@/lib/supabase/server"
import { getConsignmentStoreById } from "@/lib/db/consignmentStores"
import type { ConsignmentStoreSettingsInput } from "@/lib/validations/consignment"

type SettingsResult = { ok: true } | { ok: false; error: string; status: number }

/**
 * Owner-only: update a store's commission default, active/paused status, and Stripe Terminal
 * location. Commission must clear the Reswell fee (enforced by `commissionBpsSchema`).
 */
export async function updateConsignmentStoreSettings(
  ownerProfileId: string,
  input: ConsignmentStoreSettingsInput,
): Promise<SettingsResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const store = await getConsignmentStoreById(service, input.storeId)
  if (!store) return { ok: false, error: "Store not found", status: 404 }
  if (store.ownerProfileId !== ownerProfileId) {
    return { ok: false, error: "Only the store owner can change settings.", status: 403 }
  }

  if (input.defaultCommissionBps < store.reswellFeeBps) {
    return {
      ok: false,
      error: "Commission must be at least the Reswell fee.",
      status: 400,
    }
  }

  const { error } = await service
    .from("consignment_stores")
    .update({
      default_commission_bps: input.defaultCommissionBps,
      status: input.status,
      stripe_terminal_location_id: input.stripeTerminalLocationId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.storeId)

  if (error) {
    console.error("[consignmentStoreSettings] update failed", { storeId: input.storeId, error })
    return { ok: false, error: "Could not save settings", status: 500 }
  }

  return { ok: true }
}
