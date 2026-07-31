import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAdminOrEmployee } from "@/lib/brands/admin-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getOrderCarrierTrackingForAdmin } from "@/lib/services/orderCarrierTracking"
import { persistOrderCarrierTrackingSnapshot } from "@/lib/services/persistOrderCarrierTracking"

const orderIdSchema = z.string().uuid()

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireAdminOrEmployee()
  if (!gate.ok) {
    return gate.response
  }

  const parsed = orderIdSchema.safeParse((await context.params).id)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const serviceSupabase = createServiceRoleClient()
  const result = await getOrderCarrierTrackingForAdmin(serviceSupabase, parsed.data)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  let marketplace: {
    delivery_status: string | null
    carrier_delivered_at: string | null
  } | null = null

  if (result.live) {
    try {
      await persistOrderCarrierTrackingSnapshot(serviceSupabase, parsed.data, result.detail)
      const { data: orderRow } = await serviceSupabase
        .from("orders")
        .select("delivery_status, carrier_delivered_at")
        .eq("id", parsed.data)
        .maybeSingle()
      if (orderRow) {
        marketplace = {
          delivery_status:
            typeof (orderRow as { delivery_status?: unknown }).delivery_status === "string"
              ? (orderRow as { delivery_status: string }).delivery_status
              : null,
          carrier_delivered_at:
            typeof (orderRow as { carrier_delivered_at?: unknown }).carrier_delivered_at ===
            "string"
              ? (orderRow as { carrier_delivered_at: string }).carrier_delivered_at
              : null,
        }
      }
    } catch (e) {
      console.error("[admin carrier-tracking] persist snapshot:", e)
    }
  }

  return NextResponse.json({
    data: result.detail,
    live: result.live,
    fetchError: result.fetchError ?? null,
    marketplace,
  })
}
