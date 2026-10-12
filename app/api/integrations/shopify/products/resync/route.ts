import { NextRequest, NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { resyncMerchantShopifyProduct } from "@/lib/services/shopifyConnection"
import { shopifyProductResyncSchema } from "@/lib/validations/shopify"

export async function POST(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = shopifyProductResyncSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Shopify product" }, { status: 400 })
  }
  const result = await resyncMerchantShopifyProduct({
    userId: auth.user.id,
    productId: parsed.data.productId,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}
