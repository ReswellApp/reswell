import { NextRequest, NextResponse } from "next/server"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { requireShopifyMerchant } from "@/lib/shopify/authorize"
import { finishMerchantShopifyBilling } from "@/lib/services/shopifyMerchantSettings"

export async function GET(request: NextRequest) {
  const url = new URL("/dashboard/shopify", publicSiteOrigin())
  const auth = await requireShopifyMerchant()
  if (!auth.ok) {
    if (auth.response.status === 401) {
      const signIn = new URL("/auth/login", publicSiteOrigin())
      signIn.searchParams.set(
        "redirect",
        request.nextUrl.pathname + request.nextUrl.search,
      )
      return NextResponse.redirect(signIn)
    }
    url.searchParams.set("billing", "declined")
    return NextResponse.redirect(url)
  }
  try {
    const result = await finishMerchantShopifyBilling({ userId: auth.user.id })
    url.searchParams.set(
      "billing",
      result.ok && result.data.billingStatus === "active" ? "approved" : "declined",
    )
  } catch (error) {
    console.error("[shopify] billing return", error)
    url.searchParams.set("billing", "declined")
  }
  return NextResponse.redirect(url)
}
