import type { SupabaseClient } from "@supabase/supabase-js"
import type { ShopifyCredentialRow } from "@/lib/shopify/types"

const CREDENTIAL_SELECT = [
  "id",
  "connection_id",
  "provider",
  "auth_mode",
  "status",
  "client_id_ciphertext",
  "client_id_iv",
  "client_id_tag",
  "client_secret_ciphertext",
  "client_secret_iv",
  "client_secret_tag",
  "access_token_ciphertext",
  "access_token_iv",
  "access_token_tag",
  "refresh_token_ciphertext",
  "refresh_token_iv",
  "refresh_token_tag",
  "encryption_key_version",
  "token_expires_at",
  "refresh_token_expires_at",
  "scopes",
  "app_gid",
  "app_installation_gid",
  "webhook_route_key",
  "last_verified_at",
].join(",")

export async function dbGetShopifyCredentialByWebhookRouteKey(
  supabase: SupabaseClient,
  routeKey: string,
): Promise<ShopifyCredentialRow | null> {
  const { data, error } = await supabase
    .from("shopify_credentials")
    .select(CREDENTIAL_SELECT)
    .eq("webhook_route_key", routeKey)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as ShopifyCredentialRow | null) ?? null
}

export async function dbGetActiveShopifyCredential(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<ShopifyCredentialRow | null> {
  const { data, error } = await supabase
    .from("shopify_credentials")
    .select(CREDENTIAL_SELECT)
    .eq("connection_id", connectionId)
    .eq("status", "active")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as unknown as ShopifyCredentialRow | null) ?? null
}

export async function dbInsertActiveShopifyCredential(
  supabase: SupabaseClient,
  input: {
    connectionId: string
    provider: "public_oauth" | "merchant_custom"
    authMode: "expiring_oauth" | "client_credentials"
    clientIdCiphertext?: string | null
    clientIdIv?: string | null
    clientIdTag?: string | null
    clientSecretCiphertext?: string | null
    clientSecretIv?: string | null
    clientSecretTag?: string | null
    accessTokenCiphertext: string
    accessTokenIv: string
    accessTokenTag: string
    refreshTokenCiphertext: string | null
    refreshTokenIv: string | null
    refreshTokenTag: string | null
    encryptionKeyVersion: number
    tokenExpiresAt: string | null
    refreshTokenExpiresAt: string | null
    scopes: string[]
    appGid?: string | null
    appInstallationGid?: string | null
    webhookRouteKey?: string
  },
): Promise<ShopifyCredentialRow> {
  await supabase
    .from("shopify_credentials")
    .update({
      status: "retired",
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("connection_id", input.connectionId)
    .eq("status", "active")

  const { data, error } = await supabase
    .from("shopify_credentials")
    .insert({
      connection_id: input.connectionId,
      provider: input.provider,
      auth_mode: input.authMode,
      status: "active",
      client_id_ciphertext: input.clientIdCiphertext ?? null,
      client_id_iv: input.clientIdIv ?? null,
      client_id_tag: input.clientIdTag ?? null,
      client_secret_ciphertext: input.clientSecretCiphertext ?? null,
      client_secret_iv: input.clientSecretIv ?? null,
      client_secret_tag: input.clientSecretTag ?? null,
      access_token_ciphertext: input.accessTokenCiphertext,
      access_token_iv: input.accessTokenIv,
      access_token_tag: input.accessTokenTag,
      refresh_token_ciphertext: input.refreshTokenCiphertext,
      refresh_token_iv: input.refreshTokenIv,
      refresh_token_tag: input.refreshTokenTag,
      encryption_key_version: input.encryptionKeyVersion,
      token_expires_at: input.tokenExpiresAt,
      refresh_token_expires_at: input.refreshTokenExpiresAt,
      scopes: input.scopes,
      app_gid: input.appGid ?? null,
      app_installation_gid: input.appInstallationGid ?? null,
      webhook_route_key: input.webhookRouteKey,
      last_verified_at: new Date().toISOString(),
    })
    .select(CREDENTIAL_SELECT)
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? "Could not save Shopify credential")
  }

  const { error: linkError } = await supabase
    .from("shopify_connections")
    .update({
      active_credential_id: (data as { id: string }).id,
      credential_provider: input.provider,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.connectionId)
  if (linkError) throw new Error(linkError.message)

  return data as unknown as ShopifyCredentialRow
}

export async function dbUpdateShopifyCredentialTokens(
  supabase: SupabaseClient,
  credentialId: string,
  input: {
    accessTokenCiphertext: string
    accessTokenIv: string
    accessTokenTag: string
    encryptionKeyVersion: number
    tokenExpiresAt: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from("shopify_credentials")
    .update({
      access_token_ciphertext: input.accessTokenCiphertext,
      access_token_iv: input.accessTokenIv,
      access_token_tag: input.accessTokenTag,
      encryption_key_version: input.encryptionKeyVersion,
      token_expires_at: input.tokenExpiresAt,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", credentialId)
  if (error) throw new Error(error.message)
}
