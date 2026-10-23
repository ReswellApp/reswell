import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { checkoutWithAdminReswellBucks } from "@/lib/services/reswellBucksCheckout"
import { reswellBucksCheckoutSchema } from "@/lib/validations/reswell-bucks-checkout"

export const dynamic = "force-dynamic"

/**
 * Admin pilot: pay a peer listing with Reswell Bucks.
 * Settlement is one database transaction with a balanced journal.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = reswellBucksCheckoutSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const result = await checkoutWithAdminReswellBucks({
      supabase,
      user,
      input: parsed.data,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({
      data: {
        orderId: result.orderId,
        orderNum: result.orderNum,
        replayed: result.replayed,
        newBalanceUsd: result.newBalanceUsd,
      },
    })
  } catch (err) {
    console.error("[wallet/checkout]", err)
    return NextResponse.json({ error: "Could not complete Reswell Bucks checkout." }, { status: 500 })
  }
}
