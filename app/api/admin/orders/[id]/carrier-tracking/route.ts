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

  let deliveryStatus: string | null = null
  let deliveryStatusUpdated = false

  if (result.live) {
    try {
      const persist = await persistOrderCarrierTrackingSnapshot(
        serviceSupabase,
        parsed.data,
        result.detail,
      )
      deliveryStatus = persist.deliveryStatus
      deliveryStatusUpdated = persist.deliveryStatusUpdated
    } catch (e) {
      console.error("[admin carrier-tracking] persist snapshot:", e)
    }
  }

  if (!deliveryStatus) {
    const { data: orderRow } = await serviceSupabase
      .from("orders")
      .select("delivery_status")
      .eq("id", parsed.data)
      .maybeSingle()
    deliveryStatus =
      typeof (orderRow as { delivery_status?: unknown } | null)?.delivery_status === "string"
        ? (orderRow as { delivery_status: string }).delivery_status
        : null
  }

  return NextResponse.json({
    data: result.detail,
    live: result.live,
    fetchError: result.fetchError ?? null,
    deliveryStatus,
    deliveryStatusUpdated,
  })
}
