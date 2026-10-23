import { NextRequest, NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import {
  listMerchantReswellPublishListings,
  publishMerchantReswellListing,
} from "@/lib/services/shopifyMerchantSettings"
import { shopifyReswellPublishSchema } from "@/lib/validations/shopify"

export async function GET() {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  const result = await listMerchantReswellPublishListings({ userId: auth.user.id })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}

export async function POST(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  const parsed = shopifyReswellPublishSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose a Reswell listing" }, { status: 400 })
  }
  const result = await publishMerchantReswellListing({
    userId: auth.user.id,
    listingId: parsed.data.listingId,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json({ data: result.data })
}
