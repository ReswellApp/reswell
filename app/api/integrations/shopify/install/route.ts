import { NextRequest, NextResponse } from "next/server"
import {
  isShopifyPublicOAuthConfigured,
  isShopifyPublicOAuthEnabled,
  normalizeShopifyDomain,
} from "@/lib/shopify/config"
import { verifyShopifyOAuthHmac } from "@/lib/shopify/crypto"
import { shopifyInstallQuerySchema } from "@/lib/validations/shopify"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import {
  isShopifyStoreLinkedForLaunch,
  startPublicShopifyInstall,
} from "@/lib/services/shopifyPublicInstall"

export async function GET(request: NextRequest) {
  if (!isShopifyPublicOAuthEnabled() || !isShopifyPublicOAuthConfigured()) {
    return NextResponse.json(
      { error: "Shopify public install is not available" },
      { status: 503 },
    )
  }

  if (!verifyShopifyOAuthHmac(request.nextUrl.searchParams)) {
    return NextResponse.json({ error: "Invalid install request" }, { status: 400 })
  }

  const parsed = shopifyInstallQuerySchema.safeParse({
    shop: request.nextUrl.searchParams.get("shop") ?? "",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing shop domain" }, { status: 400 })
  }
  const shopDomain = normalizeShopifyDomain(parsed.data.shop)
  if (!shopDomain) {
    return NextResponse.json({ error: "Invalid shop domain" }, { status: 400 })
  }

  if (await isShopifyStoreLinkedForLaunch(shopDomain, null)) {
    const home = new URL("/shopify/app", publicSiteOrigin())
    home.searchParams.set("shop", shopDomain)
    const host = request.nextUrl.searchParams.get("host")?.trim()
    const timestamp = request.nextUrl.searchParams.get("timestamp")?.trim()
    const hmac = request.nextUrl.searchParams.get("hmac")?.trim()
    if (host) home.searchParams.set("host", host)
    if (timestamp) home.searchParams.set("timestamp", timestamp)
    if (hmac) home.searchParams.set("hmac", hmac)
    return NextResponse.redirect(home)
  }

  try {
    const url = await startPublicShopifyInstall(shopDomain)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error("[shopify] install", error)
    return NextResponse.json(
      { error: "Could not start Shopify install" },
      { status: 500 },
    )
  }
}
