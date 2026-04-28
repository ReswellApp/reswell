import type { SupabaseClient } from "@supabase/supabase-js"
import { insertBrandModelRequest } from "@/lib/db/brand-model-requests"

export async function submitSellBrandModelRequestService(
  supabase: SupabaseClient,
  input:
    | {
        userId: string
        requestedModelName: string
        notes: string | null
        brandId: string
      }
    | {
        userId: string
        requestedModelName: string
        notes: string | null
        sellerBrandName: string
      },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if ("brandId" in input) {
    return insertBrandModelRequest(supabase, {
      userId: input.userId,
      brandId: input.brandId,
      requestedModelName: input.requestedModelName,
      notes: input.notes,
    })
  }
  return insertBrandModelRequest(supabase, {
    userId: input.userId,
    sellerBrandName: input.sellerBrandName,
    requestedModelName: input.requestedModelName,
    notes: input.notes,
  })
}
