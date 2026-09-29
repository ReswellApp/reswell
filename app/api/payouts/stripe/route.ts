import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { cashOutToStripeConnectedAccount } from "@/lib/services/stripeConnect"
import { syncStripeConnectBankPayoutsForUser } from "@/lib/services/stripeConnectBankPayoutSync"
import { stripeConnectCashOutBodySchema } from "@/lib/validations/stripe-connect"
import { trackKlaviyoPayout } from "@/lib/klaviyo/track-payout"

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

  try {
    await syncStripeConnectBankPayoutsForUser(user.id)
  } catch (e) {
    console.error("[payouts stripe] bank payout sync failed", e)
  }

  const columns =
    "id, amount, fee_amount, payout_speed, stripe_transfer_id, stripe_payout_id, status, bank_payout_status, expected_arrival_at, created_at"
  const listed = await supabase
    .from("stripe_connect_transfers")
    .select(columns)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (listed.error) {
    const message = listed.error.message ?? ""
    const missingDepositColumns =
      message.includes("bank_payout_status") || message.includes("expected_arrival_at")
    if (!missingDepositColumns) {
      console.error("[payouts stripe] transfer history", listed.error)
      return NextResponse.json({ history: [] })
    }

    console.error("[payouts stripe] deposit columns missing; returning transfer history without them", listed.error)
    const legacy = await supabase
      .from("stripe_connect_transfers")
      .select(
        "id, amount, fee_amount, payout_speed, stripe_transfer_id, stripe_payout_id, status, created_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
    if (legacy.error) {
      console.error("[payouts stripe] transfer history", legacy.error)
      return NextResponse.json({ history: [] })
    }
    return NextResponse.json({ history: legacy.data ?? [] })
  }

  return NextResponse.json({
    history: listed.data ?? [],
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
    parsed.data.externalAccountId,
  )
  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        ...(result.errorDetail ? { errorDetail: result.errorDetail } : {}),
        ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      },
      { status: result.status ?? 400 },
    )
  }

  void trackKlaviyoPayout({
    userId: user.id,
    userEmail: user.email ?? null,
    method: "stripe_bank",
    speed: result.speed,
    amountUsd: result.amountUsd,
    feeUsd: result.feeUsd,
    netUsd: result.netToBankUsd,
    destination: null,
    stripeTransferId: result.transferId,
    payoutId: result.stripePayoutId,
    availableBalanceAfterUsd: result.availableBalanceAfter,
    uniqueId: `payout-stripe-${result.transferId}`,
  })

  return NextResponse.json({
    success: true,
    transferId: result.transferId,
    amountUsd: result.amountUsd,
    message: result.message,
    feeUsd: result.feeUsd,
    netToBankUsd: result.netToBankUsd,
    speed: result.speed,
    stripePayoutId: result.stripePayoutId,
    availableBalanceAfter: result.availableBalanceAfter,
    lifetimeCashedOutAfter: result.lifetimeCashedOutAfter,
  })
}
