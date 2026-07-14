import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripeConnectStatusForUser } from "@/lib/services/stripeConnect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Forces a Stripe → DB sync after embedded Connect onboarding/management exits.
 * Clients may call this once or poll briefly until `cashOutReady` is true.
 */
export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const status = await getStripeConnectStatusForUser(supabase, user.id)
    return NextResponse.json(status)
  } catch (e) {
    console.error("[stripe connect sync]", e)
    return NextResponse.json({ error: "Could not sync payout status" }, { status: 502 })
  }
}
