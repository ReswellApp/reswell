import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

const trackingEventSchema = z.object({
  occurred_at: z.string().optional(),
  description: z.string().nullable().optional(),
  city_locality: z.string().nullable().optional(),
  state_province: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
})

const MAX_TRACKING_EVENTS = 25

export type ShipEngineTrackingDataInput = {
  status_code?: string | null
  status_description?: string | null
  carrier_status_description?: string | null
  estimated_delivery_date?: string | null
  actual_delivery_date?: string | null
  exception_description?: string | null
  events?: Array<{
    occurred_at?: string
    description?: string | null
    city_locality?: string | null
    state_province?: string | null
    postal_code?: string | null
    country_code?: string | null
  }>
}

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

export function buildOrderTrackingDetailFromShipEngineData(
  data: ShipEngineTrackingDataInput,
): OrderTrackingDetail {
  const rawEvents = Array.isArray(data.events) ? data.events : []
  const sorted = [...rawEvents].sort((a, b) => {
    const ta = a.occurred_at ? Date.parse(a.occurred_at) : 0
    const tb = b.occurred_at ? Date.parse(b.occurred_at) : 0
    return tb - ta
  })
  const events = sorted.slice(0, MAX_TRACKING_EVENTS).map((e) => ({
    occurred_at: e.occurred_at,
    description: e.description ?? null,
    city_locality: e.city_locality ?? null,
    state_province: e.state_province ?? null,
    postal_code: e.postal_code ?? null,
    country_code: e.country_code ?? null,
  }))

  return {
    source: "shipengine",
    status_code: data.status_code ?? null,
    status_description: data.status_description ?? null,
    carrier_status_description: data.carrier_status_description ?? null,
    estimated_delivery_date: data.estimated_delivery_date ?? null,
    actual_delivery_date: data.actual_delivery_date ?? null,
    exception_description: data.exception_description ?? null,
    events,
    updated_at: new Date().toISOString(),
  }
}

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
