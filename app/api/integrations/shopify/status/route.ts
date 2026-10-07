import { NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { getShopifyConnectionStatus } from "@/lib/services/shopifyConnection"

export async function GET() {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  const result = await getShopifyConnectionStatus(auth.user.id)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    )
  }
  return NextResponse.json({ data: result.data })
}
