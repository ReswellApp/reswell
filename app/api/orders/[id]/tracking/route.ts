import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { saveOrderTracking } from "@/lib/services/markOrderShipped"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: orderId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = (await request.json()) as {
    tracking_number?: string
    tracking_carrier?: string
  }

  const trackingNumber = body.tracking_number?.trim()
  if (!trackingNumber) {
    return NextResponse.json({ error: "Tracking number is required" }, { status: 400 })
  }

  const carrier = body.tracking_carrier?.trim() || null
  const result = await saveOrderTracking(
    supabase,
    orderId,
    user.id,
    trackingNumber,
    carrier,
  )

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ success: true })
}
