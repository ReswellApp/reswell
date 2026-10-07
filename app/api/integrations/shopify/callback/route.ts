import { NextRequest, NextResponse } from "next/server"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { normalizeShopifyDomain } from "@/lib/shopify/config"
import { verifyShopifyOAuthHmac, hashShopifyOAuthState } from "@/lib/shopify/crypto"
import { shopifyClaimCookieOptions } from "@/lib/shopify/claim-cookie"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { dbPeekShopifyOAuthState } from "@/lib/db/shopifyConnections"
import { finishShopifyOAuth } from "@/lib/services/shopifyOAuth"
import { finishPublicShopifyInstall } from "@/lib/services/shopifyPublicInstall"

function dashboardRedirect(
  result: "connected" | "error",
  detail?: string,
) {
  const url = new URL("/dashboard/shopify", publicSiteOrigin())
  url.searchParams.set(result, "1")
  if (detail) url.searchParams.set("detail", detail)
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  if (!verifyShopifyOAuthHmac(request.nextUrl.searchParams)) {
    return dashboardRedirect("error", "invalid_callback")
  }

  const code = request.nextUrl.searchParams.get("code")?.trim()
  const state = request.nextUrl.searchParams.get("state")?.trim()
  const shopDomain = normalizeShopifyDomain(
    request.nextUrl.searchParams.get("shop") ?? "",
  )
  if (!code || !state || !shopDomain) {
    return dashboardRedirect("error", "missing_callback_fields")
  }

  const serviceSupabase = createServiceRoleClient()
  const peek = await dbPeekShopifyOAuthState(
    serviceSupabase,
    hashShopifyOAuthState(state),
  )

  if (!peek) {
    return dashboardRedirect("error", "invalid_state")
  }

  if (peek.shopDomain !== shopDomain) {
    return dashboardRedirect("error", "shop_mismatch")
  }

  if (peek.flowType === "public_install") {
    try {
      const pending = await finishPublicShopifyInstall({
        shopDomain,
        code,
        state,
      })
      const url = new URL("/shopify/claim", publicSiteOrigin())
      const response = NextResponse.redirect(url)
      const cookie = shopifyClaimCookieOptions(pending.claimSecret)
      response.cookies.set(cookie.name, cookie.value, {
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite,
        path: cookie.path,
        maxAge: cookie.maxAge,
      })
      return response
    } catch (error) {
      console.error("[shopify] public callback", error)
      const url = new URL("/shopify/claim", publicSiteOrigin())
      url.searchParams.set("error", "connection_failed")
      return NextResponse.redirect(url)
    }
  }

  const auth = await requireShopifyMerchant()
  if (!auth.ok) {
    const signInUrl = new URL("/auth/login", publicSiteOrigin())
    signInUrl.searchParams.set(
      "redirect",
      request.nextUrl.pathname + request.nextUrl.search,
    )
    return NextResponse.redirect(signInUrl)
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
