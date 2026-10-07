import type { SupabaseClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  dbClaimShopifyTokenRefresh,
  dbConsumeShopifyOAuthState,
  dbDeleteExpiredShopifyOAuthStates,
  dbGetShopifyConnectionById,
  dbGetShopifyConnectionForUser,
  dbInsertShopifyOAuthState,
  dbMarkShopifyConnectionStatus,
  dbReleaseShopifyTokenRefresh,
  dbUpdateShopifyConnectionTokens,
  dbUpsertShopifyConnection,
} from "@/lib/db/shopifyConnections"
import { dbUnpublishAllShopifyListingsForConnection } from "@/lib/db/shopifyCatalog"
import { dbReviveDeadShopifyInventoryJobs } from "@/lib/db/shopifyQueue"
import {
  shopifyGraphqlRequest,
  throwOnShopifyUserErrors,
} from "@/lib/shopify/admin-graphql"
import {
  SHOPIFY_MVP_SCOPES,
  shopifyApiKey,
  shopifyApiSecret,
  shopifyOAuthRedirectUri,
  shopifyWebhookUri,
} from "@/lib/shopify/config"
import {
  createShopifyOAuthState,
  decryptShopifySecret,
  encryptShopifySecret,
  hashShopifyOAuthState,
} from "@/lib/shopify/crypto"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"

type ShopifyTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
  scope?: string
}

class ShopifyOAuthRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = "ShopifyOAuthRequestError"
  }
}

function expiresAt(seconds: number | undefined): string | null {
  if (!Number.isFinite(seconds) || Number(seconds) <= 0) return null
  return new Date(Date.now() + Number(seconds) * 1000).toISOString()
}

function encryptedTokenFields(input: ShopifyTokenResponse) {
  if (!input.access_token?.trim()) {
    throw new Error("Shopify token response did not include an access token")
  }
  const access = encryptShopifySecret(input.access_token)
  const refresh = input.refresh_token?.trim()
    ? encryptShopifySecret(input.refresh_token)
    : null
  return {
    accessTokenCiphertext: access.ciphertext,
    accessTokenIv: access.iv,
    accessTokenTag: access.tag,
    refreshTokenCiphertext: refresh?.ciphertext ?? null,
    refreshTokenIv: refresh?.iv ?? null,
    refreshTokenTag: refresh?.tag ?? null,
    encryptionKeyVersion: access.keyVersion,
    tokenExpiresAt: expiresAt(input.expires_in),
    refreshTokenExpiresAt: expiresAt(input.refresh_token_expires_in),
  }
}

async function requestShopifyToken(
  shopDomain: string,
  params: URLSearchParams,
): Promise<ShopifyTokenResponse> {
  const response = await fetch(
    `https://${shopDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!response.ok) {
    throw new ShopifyOAuthRequestError(
      `Shopify OAuth request failed (${response.status})`,
      response.status,
    )
  }
  return (await response.json()) as ShopifyTokenResponse
}

export async function createShopifyInstallUrl(input: {
  serviceSupabase: SupabaseClient
  userId: string
  shopDomain: string
}): Promise<string> {
  const state = createShopifyOAuthState()
  await dbDeleteExpiredShopifyOAuthStates(input.serviceSupabase)
  await dbInsertShopifyOAuthState(input.serviceSupabase, {
    stateHash: state.stateHash,
    userId: input.userId,
    shopDomain: input.shopDomain,
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  })

  const params = new URLSearchParams({
    client_id: shopifyApiKey(),
    scope: SHOPIFY_MVP_SCOPES.join(","),
    redirect_uri: shopifyOAuthRedirectUri(),
    state: state.state,
  })
  return `https://${input.shopDomain}/admin/oauth/authorize?${params.toString()}`
}

export async function startShopifyOAuth(input: {
  userId: string
  shopDomain: string
}): Promise<string> {
  const serviceSupabase = createServiceRoleClient()
  const existing = await dbGetShopifyConnectionForUser(
    serviceSupabase,
    input.userId,
  )
  if (existing && existing.shop_domain !== input.shopDomain) {
    throw new Error(
      "This Reswell account is already linked to a different Shopify store",
    )
  }
  return createShopifyInstallUrl({ serviceSupabase, ...input })
}

export async function consumeShopifyOAuthState(input: {
  serviceSupabase: SupabaseClient
  userId: string
  shopDomain: string
  state: string
}): Promise<boolean> {
  return dbConsumeShopifyOAuthState(input.serviceSupabase, {
    stateHash: hashShopifyOAuthState(input.state),
    userId: input.userId,
    shopDomain: input.shopDomain,
  })
}

async function fetchShopName(
  shopDomain: string,
  accessToken: string,
): Promise<string | null> {
  const data = await shopifyGraphqlRequest<{ shop: { name?: string | null } }>({
    shopDomain,
    accessToken,
    query: `query ReswellShopIdentity { shop { name } }`,
  })
  return data.shop.name?.trim() || null
}

const REQUIRED_WEBHOOKS = [
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
  "INVENTORY_LEVELS_UPDATE",
  "APP_UNINSTALLED",
] as const

async function registerShopifyWebhooks(
  shopDomain: string,
  accessToken: string,
): Promise<void> {
  const existing = await shopifyGraphqlRequest<{
    webhookSubscriptions: {
      nodes: Array<{ topic: string; endpoint?: { callbackUrl?: string | null } | null }>
    }
  }>({
    shopDomain,
    accessToken,
    query: `
      query ReswellWebhookSubscriptions {
        webhookSubscriptions(first: 100) {
          nodes {
            topic
            endpoint {
              ... on WebhookHttpEndpoint { callbackUrl }
            }
          }
        }
      }
    `,
  })
  const callbackUrl = shopifyWebhookUri()
  const installed = new Set(
    existing.webhookSubscriptions.nodes
      .filter((node) => node.endpoint?.callbackUrl === callbackUrl)
      .map((node) => node.topic),
  )

  for (const topic of REQUIRED_WEBHOOKS) {
    if (installed.has(topic)) continue
    const result = await shopifyGraphqlRequest<{
      webhookSubscriptionCreate: {
        userErrors: Array<{ field?: string[] | null; message?: string | null }>
      }
    }>({
      shopDomain,
      accessToken,
      query: `
        mutation ReswellCreateWebhook(
          $topic: WebhookSubscriptionTopic!,
          $subscription: WebhookSubscriptionInput!
        ) {
          webhookSubscriptionCreate(
            topic: $topic,
            webhookSubscription: $subscription
          ) {
            userErrors { field message }
          }
        }
      `,
      variables: {
        topic,
        subscription: { uri: callbackUrl, format: "JSON" },
      },
    })
    throwOnShopifyUserErrors(result.webhookSubscriptionCreate.userErrors)
  }
}

export async function completeShopifyOAuth(input: {
  serviceSupabase: SupabaseClient
  userId: string
  shopDomain: string
  code: string
}): Promise<ShopifyConnectionRow> {
  const token = await requestShopifyToken(
    input.shopDomain,
    new URLSearchParams({
      client_id: shopifyApiKey(),
      client_secret: shopifyApiSecret(),
      code: input.code,
      expiring: "1",
    }),
  )
  if (!token.access_token) {
    throw new Error("Shopify did not return an access token")
  }

  const shopName = await fetchShopName(input.shopDomain, token.access_token)
  const connection = await dbUpsertShopifyConnection(input.serviceSupabase, {
    userId: input.userId,
    shopDomain: input.shopDomain,
    shopName,
    ...encryptedTokenFields(token),
    scopes: (token.scope ?? SHOPIFY_MVP_SCOPES.join(","))
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean),
  })
  await dbReviveDeadShopifyInventoryJobs(
    input.serviceSupabase,
    connection.id,
  )
  try {
    await registerShopifyWebhooks(input.shopDomain, token.access_token)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await dbMarkShopifyConnectionStatus(input.serviceSupabase, connection.id, {
      status: "error",
      syncEnabled: false,
      error: `Webhook setup failed: ${message}`,
    })
    throw error
  }
  return connection
}

export async function finishShopifyOAuth(input: {
  userId: string
  shopDomain: string
  code: string
  state: string
}): Promise<ShopifyConnectionRow> {
  const serviceSupabase = createServiceRoleClient()
  const stateValid = await consumeShopifyOAuthState({
    serviceSupabase,
    userId: input.userId,
    shopDomain: input.shopDomain,
    state: input.state,
  })
  if (!stateValid) throw new Error("Shopify OAuth state is invalid or expired")
  return completeShopifyOAuth({
    serviceSupabase,
    userId: input.userId,
    shopDomain: input.shopDomain,
    code: input.code,
  })
}

function decryptAccessToken(connection: ShopifyConnectionRow): string {
  return decryptShopifySecret({
    ciphertext: connection.access_token_ciphertext,
    iv: connection.access_token_iv,
    tag: connection.access_token_tag,
    keyVersion: connection.encryption_key_version,
  })
}

function decryptRefreshToken(connection: ShopifyConnectionRow): string | null {
  if (
    !connection.refresh_token_ciphertext ||
    !connection.refresh_token_iv ||
    !connection.refresh_token_tag
  ) {
    return null
  }
  return decryptShopifySecret({
    ciphertext: connection.refresh_token_ciphertext,
    iv: connection.refresh_token_iv,
    tag: connection.refresh_token_tag,
    keyVersion: connection.encryption_key_version,
  })
}

function tokenNeedsRefresh(connection: ShopifyConnectionRow): boolean {
  if (!connection.token_expires_at) return false
  return Date.parse(connection.token_expires_at) <= Date.now() + 10 * 60_000
}

export async function getShopifyAccessToken(
  serviceSupabase: SupabaseClient,
  connection: ShopifyConnectionRow,
): Promise<string> {
  if (!tokenNeedsRefresh(connection)) return decryptAccessToken(connection)

  const refreshToken = decryptRefreshToken(connection)
  if (!refreshToken) {
    await dbMarkShopifyConnectionStatus(serviceSupabase, connection.id, {
      status: "reauthorization_required",
      syncEnabled: false,
      error: "Shopify authorization expired. Reconnect the store.",
    })
    await dbUnpublishAllShopifyListingsForConnection(
      serviceSupabase,
      connection.id,
    )
    throw new Error("Shopify store must be reconnected")
  }

  const refreshLockId = randomUUID()
  const claimed = await dbClaimShopifyTokenRefresh(
    serviceSupabase,
    connection.id,
    refreshLockId,
  )
  if (!claimed) {
    await new Promise((resolve) => setTimeout(resolve, 400))
    const refreshed = await dbGetShopifyConnectionById(
      serviceSupabase,
      connection.id,
    )
    if (refreshed && !tokenNeedsRefresh(refreshed)) {
      return decryptAccessToken(refreshed)
    }
    throw new Error("Shopify credential refresh is already running")
  }

  try {
    const token = await requestShopifyToken(
      connection.shop_domain,
      new URLSearchParams({
        grant_type: "refresh_token",
        client_id: shopifyApiKey(),
        client_secret: shopifyApiSecret(),
        refresh_token: refreshToken,
      }),
    )
    await dbUpdateShopifyConnectionTokens(
      serviceSupabase,
      connection.id,
      refreshLockId,
      encryptedTokenFields(token),
    )
    if (!token.access_token) throw new Error("Shopify refresh returned no token")
    return token.access_token
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (error instanceof ShopifyOAuthRequestError && error.status === 401) {
      await dbMarkShopifyConnectionStatus(serviceSupabase, connection.id, {
        status: "reauthorization_required",
        syncEnabled: false,
        error: "Shopify authorization expired. Reconnect the store.",
      })
      await dbUnpublishAllShopifyListingsForConnection(
        serviceSupabase,
        connection.id,
      )
      throw error
    }
    await dbReleaseShopifyTokenRefresh(
      serviceSupabase,
      connection.id,
      refreshLockId,
      message,
    )
    throw error
  }
}
