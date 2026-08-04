import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getOrderItemReturnById,
  returnHasPaperlessQr,
  type OrderItemReturnRow,
} from "@/lib/db/orderItemReturns"

export type OrderReturnPaperlessLabel = Pick<
  OrderItemReturnRow,
  | "paperless_qr_url"
  | "paperless_qr_storage_path"
  | "paperless_instructions"
  | "paperless_handoff_code"
  | "tracking_number"
  | "tracking_carrier"
>

export async function resolveOrderReturnLabelPaperless(
  supabase: SupabaseClient,
  returnId: string,
): Promise<OrderReturnPaperlessLabel | null> {
  const row = await getOrderItemReturnById(supabase, returnId)
  if (!row || !returnHasPaperlessQr(row)) return null
  return {
    paperless_qr_url: row.paperless_qr_url,
    paperless_qr_storage_path: row.paperless_qr_storage_path,
    paperless_instructions: row.paperless_instructions,
    paperless_handoff_code: row.paperless_handoff_code,
    tracking_number: row.tracking_number,
    tracking_carrier: row.tracking_carrier,
  }
}
