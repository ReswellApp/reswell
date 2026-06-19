import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import { getStoreStaffRole } from "@/lib/db/consignmentStores"
import { posSaleFinalizeSchema } from "@/lib/validations/consignment"
import { completePosOrderFromPaymentIntent } from "@/lib/services/posSale"

/**
 * Polled by the register after the reader collects payment. Returns the live PI status so the UI can
 * keep waiting, and settles the order the moment it succeeds (idempotent; the webhook also settles).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = posSaleFinalizeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const stripe = getStripe()
  let pi
  try {
    pi = await stripe.paymentIntents.retrieve(parsed.data.paymentIntentId)
  } catch {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 })
  }

  if (pi.metadata?.sales_channel !== "pos") {
    return NextResponse.json({ error: "Not a POS payment" }, { status: 400 })
  }

  const storeId = pi.metadata?.store_id?.trim()
  if (!storeId) {
    return NextResponse.json({ error: "POS payment missing store" }, { status: 400 })
  }
  const role = await getStoreStaffRole(supabase, storeId, user.id)
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (pi.status !== "succeeded") {
    return NextResponse.json({ data: { status: pi.status, settled: false } })
  }

  const result = await completePosOrderFromPaymentIntent(pi)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    data: { status: "succeeded", settled: true, orderId: result.orderId },
  })
}
