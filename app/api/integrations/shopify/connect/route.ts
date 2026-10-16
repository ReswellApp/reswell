import { NextRequest, NextResponse } from "next/server"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { normalizeShopifyDomain } from "@/lib/shopify/config"
import type { ShopifyConnectErrorDetail } from "@/lib/shopify/connect-errors"
import { startShopifyOAuth } from "@/lib/services/shopifyOAuth"
import { shopifyConnectQuerySchema } from "@/lib/validations/shopify"

function dashboardError(detail: ShopifyConnectErrorDetail) {
  const url = new URL("/dashboard/shopify", publicSiteOrigin())
  url.searchParams.set("error", "1")
  url.searchParams.set("detail", detail)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const auth = await requireShopifyMerchant()
  if (!auth.ok) {
    if (auth.response.status === 401) {
      const signInUrl = new URL("/auth/login", publicSiteOrigin())
      signInUrl.searchParams.set(
        "redirect",
        request.nextUrl.pathname + request.nextUrl.search,
      )
      return NextResponse.redirect(signInUrl)
    }
    return dashboardError(
      auth.response.status === 403 ? "not_approved" : "unavailable",
    )
  }

  const parsed = shopifyConnectQuerySchema.safeParse({
    shop: request.nextUrl.searchParams.get("shop") ?? "",
  })
  const shopDomain = parsed.success
    ? normalizeShopifyDomain(parsed.data.shop)
    : null
  if (!shopDomain) return dashboardError("invalid_shop")

  try {
    const url = await startShopifyOAuth({
      userId: auth.user.id,
      shopDomain,
    })
    return NextResponse.redirect(url)
  } catch (error) {
    console.error("[shopify] connect", {
      userId: auth.user.id,
      shopDomain,
      error,
    })
    const message = error instanceof Error ? error.message : ""
    return dashboardError(
      message.includes("different Shopify store")
        ? "already_linked"
        : message.includes("different Reswell account")
          ? "store_taken"
          : "start_failed",
    )
  }
}
