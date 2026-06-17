import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { checkShopifyConnectAccess } from "@/lib/services/shopifyAuthorize"
import {
  isShopifyConfigured,
  normalizeShopDomain,
  SHOPIFY_DEFAULT_SCOPES,
  shopifyApiKey,
  shopifyOAuthRedirectUri,
} from "@/lib/shopify/config"
import { signShopifyOAuthState } from "@/lib/shopify/crypto"
import { shopifyConnectQuerySchema } from "@/lib/validations/shopify"

/**
 * GET /api/integrations/shopify/connect?shop=brand.myshopify.com
 * Starts Shopify OAuth for the signed-in seller.
 */
export async function GET(request: NextRequest) {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: "Shopify integration is not configured" }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const access = await checkShopifyConnectAccess(supabase, user.id)
  if (!access.allowed) {
    return NextResponse.json({ error: access.reason }, { status: 403 })
  }

  const shopParam = request.nextUrl.searchParams.get("shop") ?? ""
  const parsed = shopifyConnectQuerySchema.safeParse({ shop: shopParam })
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid Shopify store domain" }, { status: 400 })
  }

  const shop = normalizeShopDomain(parsed.data.shop)
  if (!shop) {
    return NextResponse.json({ error: "Invalid Shopify store domain" }, { status: 400 })
  }

  const state = signShopifyOAuthState({
    userId: user.id,
    shop,
    nonce: randomBytes(16).toString("hex"),
  })

  const params = new URLSearchParams({
    client_id: shopifyApiKey(),
    scope: SHOPIFY_DEFAULT_SCOPES,
    redirect_uri: shopifyOAuthRedirectUri(),
    state,
  })

  const authorizeUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`
  return NextResponse.redirect(authorizeUrl)
}
