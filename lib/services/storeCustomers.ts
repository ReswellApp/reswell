import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStoreStaffRole } from "@/lib/db/consignmentStores"
import type { StoreCustomerCaptureInput } from "@/lib/validations/consignment"

export type CaptureStoreCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string; status: number }

/**
 * Upserts a walk-in customer into a store's customer list, deduped by (store_id, email).
 * Re-capturing the same email updates the name/phone instead of erroring. Staff-gated.
 */
export async function captureStoreCustomer(
  staffProfileId: string,
  input: StoreCustomerCaptureInput,
): Promise<CaptureStoreCustomerResult> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const role = await getStoreStaffRole(service, input.storeId, staffProfileId)
  if (!role) {
    return { ok: false, error: "Only store staff can add customers.", status: 403 }
  }

  const email = input.email.trim().toLowerCase()

  // Link to a Reswell profile if one already exists for this email (best-effort, non-blocking).
  let profileId: string | null = null
  const { data: matchedProfile } = await service
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle()
  profileId = (matchedProfile as { id?: string } | null)?.id ?? null

  const { data, error } = await service
    .from("store_customers")
    .upsert(
      {
        store_id: input.storeId,
        first_name: input.firstName.trim(),
        last_name: input.lastName?.trim() || null,
        email,
        phone_e164: input.phoneE164?.trim() || null,
        profile_id: profileId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id,email" },
    )
    .select("id")
    .single()

  if (error || !data) {
    console.error("[storeCustomers] capture failed", error)
    return { ok: false, error: "Could not save the customer", status: 500 }
  }

  return { ok: true, customerId: data.id }
}
