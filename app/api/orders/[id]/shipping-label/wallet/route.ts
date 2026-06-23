import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"
import { purchaseSellerShippingLabelWithWallet } from "@/lib/services/sellerShippingLabelCheckout"
import { sellerShippingLabelWalletBodySchema } from "@/lib/validations/seller-shipping-label-checkout"

export const dynamic = "force-dynamic"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const raw = (await params).id
  const orderId = decodeURIComponent(typeof raw === "string" ? raw.trim() : "").trim()
  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Invalid order" }, { status: 400 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = sellerShippingLabelWalletBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await purchaseSellerShippingLabelWithWallet({
    supabase,
    orderId,
    sellerId: user.id,
    rateId: parsed.data.rate_id,
    sellerAddressId: parsed.data.seller_address_id,
    parcel: parsed.data.parcel,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    data: {
      labelUrl: result.labelUrl,
      trackingNumber: result.trackingNumber,
      orderDisplayNum: result.orderDisplayNum,
      alreadyProcessed: result.alreadyProcessed,
      amountUsd: result.amountUsd,
      walletBalanceAfter: result.walletBalanceAfter,
    },
  })
}
