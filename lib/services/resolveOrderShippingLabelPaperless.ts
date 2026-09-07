import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getLatestPreparedShippingLabelForOrder,
  preparedLabelHasPaperlessQr,
} from "@/lib/db/orderShippingLabels"

export type ResolvedOrderShippingLabelPaperless = {
  paperless_qr_url: string | null
  paperless_qr_storage_path: string | null
  paperless_instructions: string | null
  paperless_handoff_code: string | null
}

export async function resolveOrderShippingLabelPaperless(
  supabase: SupabaseClient,
  orderId: string,
  labelId?: string | null,
): Promise<ResolvedOrderShippingLabelPaperless | null> {
  if (labelId?.trim()) {
    const { data } = await supabase
      .from("order_shipping_labels")
      .select(
        "paperless_qr_url, paperless_qr_storage_path, paperless_instructions, paperless_handoff_code",
      )
      .eq("order_id", orderId)
      .eq("id", labelId.trim())
      .maybeSingle()
    if (data && preparedLabelHasPaperlessQr(data)) {
      return {
        paperless_qr_url: data.paperless_qr_url?.trim() || null,
        paperless_qr_storage_path: data.paperless_qr_storage_path?.trim() || null,
        paperless_instructions: data.paperless_instructions?.trim() || null,
        paperless_handoff_code: data.paperless_handoff_code?.trim() || null,
      }
    }
    return null
  }

  const stored = await getLatestPreparedShippingLabelForOrder(supabase, orderId)
  if (!stored || !preparedLabelHasPaperlessQr(stored)) return null
  return {
    paperless_qr_url: stored.paperless_qr_url,
    paperless_qr_storage_path: stored.paperless_qr_storage_path,
    paperless_instructions: stored.paperless_instructions,
    paperless_handoff_code: stored.paperless_handoff_code,
  }
}
