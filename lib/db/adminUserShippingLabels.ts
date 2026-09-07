import type { SupabaseClient } from "@supabase/supabase-js"

export type AdminUserShippingLabelInsert = {
  recipientUserId: string
  createdBy: string
  conversationId?: string | null
  labelPdfUrl?: string | null
  trackingNumber?: string | null
  trackingCarrier?: string | null
  shipengineRateId?: string | null
  labelCostUsd?: number | null
  labelCostCurrency?: string | null
  parcelLengthIn: number
  parcelWidthIn: number
  parcelHeightIn: number
  parcelWeightLb: number
  shipTo: Record<string, unknown>
}

export async function insertAdminUserShippingLabel(
  supabase: SupabaseClient,
  row: AdminUserShippingLabelInsert,
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("admin_user_shipping_labels")
    .insert({
      recipient_user_id: row.recipientUserId,
      created_by: row.createdBy,
      conversation_id: row.conversationId ?? null,
      label_pdf_url: row.labelPdfUrl ?? null,
      tracking_number: row.trackingNumber ?? null,
      tracking_carrier: row.trackingCarrier ?? null,
      shipengine_rate_id: row.shipengineRateId ?? null,
      label_cost_usd: row.labelCostUsd ?? null,
      label_cost_currency: row.labelCostCurrency ?? null,
      parcel_length_in: row.parcelLengthIn,
      parcel_width_in: row.parcelWidthIn,
      parcel_height_in: row.parcelHeightIn,
      parcel_weight_lb: row.parcelWeightLb,
      ship_to: row.shipTo,
    })
    .select("id")
    .maybeSingle()

  if (error) {
    const parts = [error.message, error.hint, error.details, error.code].filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    )
    return {
      id: null,
      error: new Error(parts.length ? parts.join(" — ") : "Insert failed"),
    }
  }

  return { id: typeof data?.id === "string" ? data.id : null, error: null }
}
