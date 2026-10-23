import { NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { disconnectMerchantShopify } from "@/lib/services/shopifyConnection"

export async function POST() {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  if (!auth.canManageConnection) {
    return NextResponse.json({ error: "You don't have access to that." }, { status: 403 })
  }
  const result = await disconnectMerchantShopify(auth.accountId)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    )
  }
  return NextResponse.json({ data: result.data })
}
