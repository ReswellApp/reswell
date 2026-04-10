import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  createConnectAccountSessionClientSecret,
  ensureExpressConnectedAccount,
} from "@/lib/services/stripeConnect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Creates (if needed) a Connect Express account and returns an Account Session client secret
 * for embedded onboarding / account management — user stays on Reswell.
 */
export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY?.trim() || !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const ensured = await ensureExpressConnectedAccount(supabase, user.id, user.email ?? null)
  if ("error" in ensured) {
    return NextResponse.json({ error: ensured.error }, { status: 400 })
  }

  const session = await createConnectAccountSessionClientSecret(ensured.stripeAccountId)
  if ("error" in session) {
    return NextResponse.json({ error: session.error }, { status: 502 })
  }

  return NextResponse.json({ clientSecret: session.clientSecret })
}
