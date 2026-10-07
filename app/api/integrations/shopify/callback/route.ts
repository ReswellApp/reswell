import { NextRequest, NextResponse } from "next/server"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { normalizeShopifyDomain } from "@/lib/shopify/config"
import { verifyShopifyOAuthHmac } from "@/lib/shopify/crypto"
import { finishShopifyOAuth } from "@/lib/services/shopifyOAuth"

function dashboardRedirect(
  result: "connected" | "error",
  detail?: string,
) {
  const url = new URL("/dashboard/integrations/shopify", publicSiteOrigin())
  url.searchParams.set(result, "1")
  if (detail) url.searchParams.set("detail", detail)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  if (!verifyShopifyOAuthHmac(request.nextUrl.searchParams)) {
    return dashboardRedirect("error", "invalid_callback")
  }

  const auth = await requireShopifyMerchant()
  if (!auth.ok) return auth.response

  const code = request.nextUrl.searchParams.get("code")?.trim()
  const state = request.nextUrl.searchParams.get("state")?.trim()
  const shopDomain = normalizeShopifyDomain(
    request.nextUrl.searchParams.get("shop") ?? "",
  )
  if (!code || !state || !shopDomain) {
    return dashboardRedirect("error", "missing_callback_fields")
  }

  try {
    await finishShopifyOAuth({
      userId: auth.user.id,
      shopDomain,
      code,
      state,
    })
    return dashboardRedirect("connected")
  } catch (error) {
    console.error("[shopify] callback", error)
    return dashboardRedirect("error", "connection_failed")
  }
}
