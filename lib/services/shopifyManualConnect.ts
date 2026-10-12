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
  missingShopifyReadScopes,
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

/** `message` is safe to show the merchant. */
export class ShopifyManualConnectError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = "ShopifyManualConnectError"
    this.status = status
  }
}

function clientCredentialsFailureMessage(status: number): string {
  if (status === 404) {
    return "Shopify could not find that store. Check the your-store.myshopify.com domain."
  }
  if (status === 400 || status === 401 || status === 403) {
    return "Shopify rejected the client ID or secret. Copy both from your Dev Dashboard app's Settings, and make sure the app is installed on this store."
  }
  return "Shopify did not respond. Try again in a minute."
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
    throw new ShopifyManualConnectError(
      clientCredentialsFailureMessage(response.status),
      response.status >= 500 ? 502 : 400,
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
    throw new ShopifyManualConnectError(
      "Manual setup is turned off on Reswell right now.",
      403,
    )
  }

  const shopDomain = normalizeShopifyDomain(input.shop)
  if (!shopDomain) {
    throw new ShopifyManualConnectError(
      "Enter your store's permanent your-store.myshopify.com domain.",
      400,
    )
  }

  const serviceSupabase = createServiceRoleClient()
  const allowlisted = await dbShopifyUserManualCanaryEnabled(
    serviceSupabase,
    input.userId,
  )
  if (!allowlisted) {
    throw new ShopifyManualConnectError(
      "Your account needs Reswell approval for manual setup.",
      403,
    )
  }

  const existing = await dbGetShopifyConnectionForUser(
    serviceSupabase,
    input.userId,
  )
  if (existing && existing.shop_domain !== shopDomain) {
    throw new ShopifyManualConnectError(
      "This Reswell account is already linked to a different Shopify store. Disconnect it first.",
      409,
    )
  }

  const token = await requestClientCredentialsToken({
    shopDomain,
    clientId: input.clientId,
    clientSecret: input.clientSecret,
  })
  if (!token.access_token?.trim()) {
    throw new ShopifyManualConnectError(
      "Shopify did not return an access token. Check that the app is installed on this store.",
      400,
    )
  }

  const scopes = (token.scope ?? SHOPIFY_MVP_SCOPES.join(","))
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
  const missingScopes = missingShopifyReadScopes(scopes)
  if (missingScopes.length > 0) {
    throw new ShopifyManualConnectError(
      `Your Dev Dashboard app is missing ${missingScopes.join(", ")}. Add the scopes, release a new version, reinstall it on the store, then try again.`,
      400,
    )
  }

  const identity = await fetchShopIdentity(shopDomain, token.access_token)
  const access = encryptShopifySecret(token.access_token)
  const clientIdSecret = encryptShopifySecret(input.clientId)
  const clientSecretSecret = encryptShopifySecret(input.clientSecret)

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
    console.error("[shopify] manual webhook setup", {
      userId: input.userId,
      shopDomain,
      error,
    })
    throw new ShopifyManualConnectError(
      "Shopify accepted the credentials, but webhook setup failed. Try again.",
      502,
    )
  }

  return connection
}
