import { createServiceRoleClient } from "@/lib/supabase/server"
import { dbInsertActiveShopifyCredential } from "@/lib/db/shopifyCredentials"
import {
  dbGetShopifyConnectionForUser,
  dbMarkShopifyConnectionStatus,
  dbShopifyUserManualCanaryEnabled,
  dbUpsertShopifyConnection,
} from "@/lib/db/shopifyConnections"
import { dbReviveDeadShopifyInventoryJobs } from "@/lib/db/shopifyQueue"
import {
  SHOPIFY_MVP_SCOPES,
  isShopifyManualCanaryEnabled,
  normalizeShopifyDomain,
  shopifyManualWebhookUri,
} from "@/lib/shopify/config"
import { encryptShopifySecret } from "@/lib/shopify/crypto"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"
import {
  fetchShopIdentity,
  registerShopifyWebhooks,
} from "@/lib/services/shopifyOAuth"
type ShopifyTokenResponse = {
  access_token?: string
  expires_in?: number
  scope?: string
}

function expiresAt(seconds: number | undefined): string | null {
  if (!Number.isFinite(seconds) || Number(seconds) <= 0) return null
  return new Date(Date.now() + Number(seconds) * 1000).toISOString()
}

async function requestClientCredentialsToken(input: {
  shopDomain: string
  clientId: string
  clientSecret: string
}): Promise<ShopifyTokenResponse> {
  const response = await fetch(
    `https://${input.shopDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: input.clientId,
        client_secret: input.clientSecret,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!response.ok) {
    throw new Error(
      `Shopify client-credentials exchange failed (${response.status})`,
    )
  }
  return (await response.json()) as ShopifyTokenResponse
}

export async function connectMerchantCustomShopifyApp(input: {
  userId: string
  shop: string
  clientId: string
  clientSecret: string
}): Promise<ShopifyConnectionRow> {
  if (!isShopifyManualCanaryEnabled()) {
    throw new Error("Merchant custom Shopify connect is disabled")
  }

  const shopDomain = normalizeShopifyDomain(input.shop)
  if (!shopDomain) {
    throw new Error("Enter a valid myshopify.com domain")
  }

  const serviceSupabase = createServiceRoleClient()
  const allowlisted = await dbShopifyUserManualCanaryEnabled(
    serviceSupabase,
    input.userId,
  )
  if (!allowlisted) {
    throw new Error("Your account is not approved for the Shopify dev pilot")
  }

  const existing = await dbGetShopifyConnectionForUser(
    serviceSupabase,
    input.userId,
  )
  if (existing && existing.shop_domain !== shopDomain) {
    throw new Error(
      "This Reswell account is already linked to a different Shopify store",
    )
  }

  const token = await requestClientCredentialsToken({
    shopDomain,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  })
  if (!token.access_token?.trim()) {
    throw new Error("Shopify did not return an access token")
  }

  const identity = await fetchShopIdentity(shopDomain, token.access_token)
  const access = encryptShopifySecret(token.access_token)
  const clientIdSecret = encryptShopifySecret(input.clientId)
  const clientSecretSecret = encryptShopifySecret(input.clientSecret)
  const scopes = (token.scope ?? SHOPIFY_MVP_SCOPES.join(","))
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)

  const connection = await dbUpsertShopifyConnection(serviceSupabase, {
    userId: input.userId,
    shopDomain,
    shopGid: identity.shopGid,
    shopName: identity.shopName,
    accessTokenCiphertext: access.ciphertext,
    accessTokenIv: access.iv,
    accessTokenTag: access.tag,
    refreshTokenCiphertext: null,
    refreshTokenIv: null,
    refreshTokenTag: null,
    encryptionKeyVersion: access.keyVersion,
    tokenExpiresAt: expiresAt(token.expires_in),
    refreshTokenExpiresAt: null,
    scopes,
    credentialProvider: "merchant_custom",
  })

  const credential = await dbInsertActiveShopifyCredential(serviceSupabase, {
    connectionId: connection.id,
    provider: "merchant_custom",
    authMode: "client_credentials",
    clientIdCiphertext: clientIdSecret.ciphertext,
    clientIdIv: clientIdSecret.iv,
    clientIdTag: clientIdSecret.tag,
    clientSecretCiphertext: clientSecretSecret.ciphertext,
    clientSecretIv: clientSecretSecret.iv,
    clientSecretTag: clientSecretSecret.tag,
    accessTokenCiphertext: access.ciphertext,
    accessTokenIv: access.iv,
    accessTokenTag: access.tag,
    refreshTokenCiphertext: null,
    refreshTokenIv: null,
    refreshTokenTag: null,
    encryptionKeyVersion: access.keyVersion,
    tokenExpiresAt: expiresAt(token.expires_in),
    refreshTokenExpiresAt: null,
    scopes,
  })

  await dbReviveDeadShopifyInventoryJobs(serviceSupabase, connection.id)

  const webhookUrl = shopifyManualWebhookUri(credential.webhook_route_key)
  try {
    await registerShopifyWebhooks(shopDomain, token.access_token, webhookUrl)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await dbMarkShopifyConnectionStatus(serviceSupabase, connection.id, {
      status: "error",
      syncEnabled: false,
      error: `Webhook setup failed: ${message}`,
    })
    throw error
  }

  return connection
}
