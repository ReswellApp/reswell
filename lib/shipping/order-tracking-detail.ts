import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

const trackingEventSchema = z.object({
  occurred_at: z.string().optional(),
  description: z.string().nullable().optional(),
  city_locality: z.string().nullable().optional(),
  state_province: z.string().nullable().optional(),
})

export const orderTrackingDetailSchema = z.object({
  source: z.literal("shipengine"),
  status_code: z.string().nullable().optional(),
  status_description: z.string().nullable().optional(),
  carrier_status_description: z.string().nullable().optional(),
  estimated_delivery_date: z.string().nullable().optional(),
  actual_delivery_date: z.string().nullable().optional(),
  exception_description: z.string().nullable().optional(),
  events: z.array(trackingEventSchema).optional(),
  updated_at: z.string(),
})

export type OrderTrackingDetail = z.infer<typeof orderTrackingDetailSchema>

export function parseOrderTrackingDetail(raw: unknown): OrderTrackingDetail | null {
  const r = orderTrackingDetailSchema.safeParse(raw)
  return r.success ? r.data : null
}

/**
 * Loads `orders.tracking_detail` in a follow-up query. The main order `select(...)`
 * must not list this column: if the migration adding it has not been applied,
 * PostgREST rejects the entire request (PGRST204) and the order page 404s.
 */
export async function fetchOptionalOrderTrackingDetailJson(
  supabase: SupabaseClient,
  args:
    | { orderId: string; role: "buyer"; buyerId: string }
    | { orderId: string; role: "seller"; sellerId: string },
): Promise<unknown | null> {
  let q = supabase.from("orders").select("tracking_detail").eq("id", args.orderId)
  q = args.role === "buyer" ? q.eq("buyer_id", args.buyerId) : q.eq("seller_id", args.sellerId)
  const { data, error } = await q.maybeSingle()
  if (error) return null
  return data?.tracking_detail ?? null
}
