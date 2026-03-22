import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe-server"
import { completeSurfboardCheckoutFromSession } from "@/lib/checkout/surfboard-stripe-completion"

export async function POST(request: NextRequest) {
  const supabaseAuth = await createClient()
  const {
    data: { user },
  } = await supabaseAuth.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { session_id } = await request.json()
  if (!session_id || typeof session_id !== "string") {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 })
  }

  const stripe = getStripe()
  if (!stripe) {
    return NextResponse.json({ error: "Card payments are not configured" }, { status: 503 })
  }

  const session = await stripe.checkout.sessions.retrieve(session_id)

  let db
  try {
    db = createServiceRoleClient()
  } catch {
    db = supabaseAuth
  }

  const result = await completeSurfboardCheckoutFromSession(db, session, {
    assertBuyerId: user.id,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({
    success: true,
    duplicate: result.duplicate ?? false,
    purchase_id: result.purchase_id,
    listing_id: result.listing_id,
    listing_title: result.listing_title,
    amount: result.amount,
    fulfillment_method: result.fulfillment_method,
    listing_section: result.listing_section,
    purchased_at: result.purchased_at,
  })
}
