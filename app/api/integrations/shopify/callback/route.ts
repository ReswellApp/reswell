import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import {
  DEFAULT_SHOPIFY_SECTION_MAPPINGS,
  listShopifySectionMappingsForUser,
  replaceShopifySectionMappings,
} from "@/lib/db/shopify-section-mappings"
import {
  toPublicShopifyConnection,
  upsertShopifyConnection,
} from "@/lib/db/shopify-connections"
import {
  exchangeShopifyOAuthCode,
  fetchShopifyShopName,
  registerShopifyWebhooks,
} from "@/lib/shopify/admin-api"
import { normalizeShopDomain } from "@/lib/shopify/config"
import { verifyShopifyOAuthState } from "@/lib/shopify/crypto"
import { enqueueShopifySyncJob } from "@/lib/db/shopify-sync-jobs"

/**
 * GET /api/integrations/shopify/callback
 * Shopify OAuth redirect — stores connection and registers webhooks.
 */
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")
  const state = request.nextUrl.searchParams.get("state")
  const shopRaw = request.nextUrl.searchParams.get("shop")

  const dashboardUrl = `${publicSiteOrigin()}/dashboard/integrations/shopify`

  if (!code || !state || !shopRaw) {
    return NextResponse.redirect(`${dashboardUrl}?error=missing_oauth_params`)
  }

  const verified = verifyShopifyOAuthState(state)
  if (!verified) {
    return NextResponse.redirect(`${dashboardUrl}?error=invalid_state`)
  }

  const shop = normalizeShopDomain(shopRaw)
  if (!shop || shop !== verified.shop) {
    return NextResponse.redirect(`${dashboardUrl}?error=shop_mismatch`)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== verified.userId) {
    return NextResponse.redirect(`${dashboardUrl}?error=session_mismatch`)
  }

  try {
    const token = await exchangeShopifyOAuthCode({ shopDomain: shop, code })
    const shopName = await fetchShopifyShopName(shop, token.access_token)
    const serviceSupabase = createServiceRoleClient()

    const connection = await upsertShopifyConnection(serviceSupabase, {
      userId: user.id,
      shopDomain: shop,
      accessToken: token.access_token,
      scopes: token.scope,
      shopName,
    })

    const existingMappings = await listShopifySectionMappingsForUser(
      serviceSupabase,
      user.id,
      connection.id,
    )
    if (existingMappings.length === 0) {
      await replaceShopifySectionMappings(
        serviceSupabase,
        user.id,
        connection.id,
        DEFAULT_SHOPIFY_SECTION_MAPPINGS,
      )
    }

    const webhookUrl = `${publicSiteOrigin()}/api/webhooks/shopify`
    await registerShopifyWebhooks({
      shopDomain: shop,
      accessToken: token.access_token,
      callbackUrl: webhookUrl,
    })

    if (connection.auto_sync_enabled || connection.sync_mode !== "manual") {
      await enqueueShopifySyncJob(serviceSupabase, {
        userId: user.id,
        connectionId: connection.id,
        jobType: "full_catalog_sync",
        dedupeKey: `full_catalog_sync:${connection.id}`,
        payload: { connectionId: connection.id },
      })
    }

    return NextResponse.redirect(`${dashboardUrl}?connected=1`)
  } catch (error) {
    console.error("[shopify callback]", error)
    return NextResponse.redirect(`${dashboardUrl}?error=oauth_failed`)
  }
}
