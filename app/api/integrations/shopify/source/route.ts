import { NextRequest, NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { setMerchantShopifySource } from "@/lib/services/shopifyMerchantSettings"
import { shopifySourceOfTruthSchema } from "@/lib/validations/shopify"

export async function POST(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = shopifySourceOfTruthSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose Shopify or Reswell" }, { status: 400 })
  }
  const result = await setMerchantShopifySource({
    userId: auth.user.id,
    sourceOfTruth: parsed.data.sourceOfTruth,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}
