import { createServiceRoleClient } from "@/lib/supabase/server"
import { dbConsumePublicShopifyOAuthState } from "@/lib/db/shopifyConnections"
import { dbUpsertShopifyPendingInstallation } from "@/lib/db/shopifyPendingInstallations"
import { SHOPIFY_MVP_SCOPES, shopifyApiKey, shopifyApiSecret } from "@/lib/shopify/config"
import {
  createShopifyClaimSecret,
  encryptShopifySecret,
  hashShopifyOAuthState,
} from "@/lib/shopify/crypto"
import {
  createShopifyInstallUrl,
  fetchShopIdentity,
  registerShopifyWebhooks,
} from "@/lib/services/shopifyOAuth"

type ShopifyTokenResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  refresh_token_expires_in?: number
  scope?: string
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
  code: string,
): Promise<ShopifyTokenResponse> {
  const response = await fetch(
    `https://${shopDomain}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: shopifyApiKey(),
        client_secret: shopifyApiSecret(),
        code,
        expiring: "1",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    },
  )
  if (!response.ok) {
    throw new Error(`Shopify OAuth token exchange failed (${response.status})`)
  }
  return (await response.json()) as ShopifyTokenResponse
}

export async function startPublicShopifyInstall(shopDomain: string): Promise<string> {
  const serviceSupabase = createServiceRoleClient()
  return createShopifyInstallUrl({
    serviceSupabase,
    userId: null,
    shopDomain,
    flowType: "public_install",
  })
}

export async function finishPublicShopifyInstall(input: {
  shopDomain: string
  code: string
  state: string
}): Promise<{ claimSecret: string; shopDomain: string; shopName: string | null }> {
  const serviceSupabase = createServiceRoleClient()
  const stateValid = await dbConsumePublicShopifyOAuthState(serviceSupabase, {
    stateHash: hashShopifyOAuthState(input.state),
    shopDomain: input.shopDomain,
  })
  if (!stateValid) {
    throw new Error("Shopify OAuth state is invalid or expired")
  }

  const token = await requestShopifyToken(input.shopDomain, input.code)
  if (!token.access_token?.trim()) {
    throw new Error("Shopify did not return an access token")
  }
  const identity = await fetchShopIdentity(input.shopDomain, token.access_token)
  const scopes = (token.scope ?? SHOPIFY_MVP_SCOPES.join(","))
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean)
  const claim = createShopifyClaimSecret()
  const tokenFields = encryptedTokenFields(token)

  await dbUpsertShopifyPendingInstallation(serviceSupabase, {
    shopGid: identity.shopGid,
    shopDomain: input.shopDomain,
    shopName: identity.shopName,
    claimSecretHash: claim.claimSecretHash,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    ...tokenFields,
    scopes,
  })

  try {
    await registerShopifyWebhooks(input.shopDomain, token.access_token)
  } catch (error) {
    console.error("[shopify] pending-install webhook setup", error)
  }

  return {
    claimSecret: claim.claimSecret,
    shopDomain: input.shopDomain,
    shopName: identity.shopName,
  }
}
