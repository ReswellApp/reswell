import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripeConnectAccountByUserId } from "@/lib/db/stripeConnect"
import {
  createConnectHostedOnboardingLink,
  ensureExpressConnectedAccount,
} from "@/lib/services/stripeConnect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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

  let row = await getStripeConnectAccountByUserId(supabase, user.id)
  if (!row) {
    const ensured = await ensureExpressConnectedAccount(supabase, user.id, user.email ?? null)
    if ("error" in ensured) {
      return NextResponse.json({ error: ensured.error }, { status: 400 })
    }
    row = await getStripeConnectAccountByUserId(supabase, user.id)
  }

  if (!row?.stripe_account_id) {
    return NextResponse.json({ error: "No payout profile found" }, { status: 400 })
  }

  const link = await createConnectHostedOnboardingLink(row.stripe_account_id)
  if ("error" in link) {
    return NextResponse.json({ error: link.error }, { status: 502 })
  }

  return NextResponse.json({ url: link.url })
}
