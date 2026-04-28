import type { SupabaseClient } from "@supabase/supabase-js"
import { insertBrandModelRequest } from "@/lib/db/brand-model-requests"

export async function submitSellBrandModelRequestService(
  supabase: SupabaseClient,
  input: {
    userId: string
    brandId: string
    requestedModelName: string
    notes: string | null
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  return insertBrandModelRequest(supabase, {
    userId: input.userId,
    brandId: input.brandId,
    requestedModelName: input.requestedModelName,
    notes: input.notes,
  })
}
