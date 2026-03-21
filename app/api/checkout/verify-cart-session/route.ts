import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe-server"
import { completeCartCheckoutFromSession } from "@/lib/checkout/cart-stripe-completion"

/**
 * Confirms a shop cart Stripe session and marks the order paid (success page fallback when webhook is delayed).
 */
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

  let supabaseAdmin
  try {
    supabaseAdmin = createServiceRoleClient()
  } catch {
    return NextResponse.json(
      {
        error:
          "Order confirmation requires SUPABASE_SERVICE_ROLE_KEY on the server. Add it to .env.local and restart.",
      },
      { status: 503 }
    )
  }

  const session = await stripe.checkout.sessions.retrieve(session_id)

  if (session.metadata?.user_id !== user.id) {
    return NextResponse.json({ error: "Invalid checkout session" }, { status: 400 })
  }

  const result = await completeCartCheckoutFromSession(supabaseAdmin, session)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ success: true, duplicate: result.duplicate ?? false })
}
