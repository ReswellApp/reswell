import { NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { startMerchantShopifyBilling } from "@/lib/services/shopifyMerchantSettings"

export async function POST() {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  const result = await startMerchantShopifyBilling({ userId: auth.user.id })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}
