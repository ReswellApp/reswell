import { NextRequest, NextResponse } from "next/server"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { normalizeShopifyDomain } from "@/lib/shopify/config"
import { startShopifyOAuth } from "@/lib/services/shopifyOAuth"
import { shopifyConnectQuerySchema } from "@/lib/validations/shopify"

export async function GET(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response

  const parsed = shopifyConnectQuerySchema.safeParse({
    shop: request.nextUrl.searchParams.get("shop") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Enter a valid Shopify store domain" },
      { status: 400 },
    )
  }
  const shopDomain = normalizeShopifyDomain(parsed.data.shop)
  if (!shopDomain) {
    return NextResponse.json(
      { error: "Enter a valid myshopify.com domain" },
      { status: 400 },
    )
  }

  try {
    const url = await startShopifyOAuth({
      userId: auth.user.id,
      shopDomain,
    })
    return NextResponse.redirect(url)
  } catch (error) {
    console.error("[shopify] connect", error)
    return NextResponse.json(
      { error: "Could not start Shopify connection" },
      { status: 500 },
    )
  }
}
