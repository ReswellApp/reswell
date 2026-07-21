import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getOrderCarrierTrackingForParticipant } from "@/lib/services/orderCarrierTracking"
import { persistOrderCarrierTrackingSnapshot } from "@/lib/services/persistOrderCarrierTracking"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await props.params
  if (!orderId?.trim() || !UUID_RE.test(orderId.trim())) {
    return NextResponse.json({ error: "Invalid order id" }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const result = await getOrderCarrierTrackingForParticipant(supabase, orderId.trim(), user.id)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  let deliveryStatus: string | null = null
  let deliveryStatusUpdated = false

  if (result.live) {
    try {
      const serviceSupabase = createServiceRoleClient()
      const persist = await persistOrderCarrierTrackingSnapshot(
        serviceSupabase,
        orderId.trim(),
        result.detail,
      )
      deliveryStatus = persist.deliveryStatus
      deliveryStatusUpdated = persist.deliveryStatusUpdated
    } catch (e) {
      console.error("[carrier-tracking] persist snapshot:", e)
    }
  }

  if (!deliveryStatus) {
    const { data: orderRow } = await supabase
      .from("orders")
      .select("delivery_status")
      .eq("id", orderId.trim())
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
