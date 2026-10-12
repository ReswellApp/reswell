import { NextRequest, NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import {
  ShopifyManualConnectError,
  connectMerchantCustomShopifyApp,
} from "@/lib/services/shopifyManualConnect"
import { shopifyManualConnectBodySchema } from "@/lib/validations/shopify"

export async function POST(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const parsed = shopifyManualConnectBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid shop domain and Dev Dashboard client credentials" },
      { status: 400 },
    )
  }

  try {
    const connection = await connectMerchantCustomShopifyApp({
      userId: auth.user.id,
      shop: parsed.data.shop,
      clientId: parsed.data.clientId,
      clientSecret: parsed.data.clientSecret,
    })
    return NextResponse.json({
      data: {
        shopDomain: connection.shop_domain,
        shopName: connection.shop_name,
        provider: connection.credential_provider,
      },
    })
  } catch (error) {
    if (error instanceof ShopifyManualConnectError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("[shopify] manual-connect", { userId: auth.user.id, error })
    return NextResponse.json(
      { error: "Could not connect your Shopify store. Try again." },
      { status: 500 },
    )
  }
}
