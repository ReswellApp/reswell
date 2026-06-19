import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe-server"
import { getStoreStaffRole } from "@/lib/db/consignmentStores"
import { cancelReaderAction } from "@/lib/services/stripeTerminal"

const cancelSchema = z.object({
  paymentIntentId: z.string().trim().min(1),
  readerId: z.string().trim().optional(),
})

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

  const parsed = cancelSchema.safeParse(body)
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

  const storeId = pi.metadata?.store_id?.trim()
  if (pi.metadata?.sales_channel !== "pos" || !storeId) {
    return NextResponse.json({ error: "Not a POS payment" }, { status: 400 })
  }
  const role = await getStoreStaffRole(supabase, storeId, user.id)
  if (!role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (pi.status === "succeeded") {
    return NextResponse.json({ error: "Payment already completed." }, { status: 409 })
  }

  if (parsed.data.readerId) {
    await cancelReaderAction(parsed.data.readerId)
  }
  try {
    await stripe.paymentIntents.cancel(pi.id)
  } catch {
    // PI may not be cancelable; reader action cancel above is the important part.
  }

  return NextResponse.json({ data: { canceled: true } })
}
