import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cashOutToStripeConnectedAccount } from "@/lib/services/stripeConnect"
import { stripeConnectCashOutBodySchema } from "@/lib/validations/stripe-connect"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: rows } = await supabase
    .from("stripe_connect_transfers")
    .select(
      "id, amount, fee_amount, payout_speed, stripe_transfer_id, stripe_payout_id, status, created_at",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({
    history: rows ?? [],
  })
}

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY?.trim()) {
    return NextResponse.json({ error: "Stripe payouts are not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = stripeConnectCashOutBodySchema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid amount"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const result = await cashOutToStripeConnectedAccount(
    supabase,
    user.id,
    parsed.data.amount,
    parsed.data.speed,
  )
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status ?? 400 },
    )
  }

  return NextResponse.json({
    success: true,
    transferId: result.transferId,
    message: result.message,
    feeUsd: result.feeUsd,
    netToBankUsd: result.netToBankUsd,
    speed: result.speed,
    stripePayoutId: result.stripePayoutId,
  })
}
