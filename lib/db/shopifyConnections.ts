import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  PublicShopifyConnection,
  ShopifyConnectionRow,
} from "@/lib/shopify/types"

const CONNECTION_SELECT = [
  "id",
  "user_id",
  "shop_domain",
  "shop_name",
  "status",
  "sync_enabled",
  "access_token_ciphertext",
  "access_token_iv",
  "access_token_tag",
  "refresh_token_ciphertext",
  "refresh_token_iv",
  "refresh_token_tag",
  "encryption_key_version",
  "token_expires_at",
  "refresh_token_expires_at",
  "token_refresh_locked_until",
  "scopes",
  "last_webhook_at",
  "last_reconciled_at",
  "last_error",
  "connected_at",
  "disconnected_at",
  "created_at",
  "updated_at",
].join(",")

export async function dbShopifyUserIsEligible(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("profiles")
    .select("shopify_connect_enabled")
    .eq("id", userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data?.shopify_connect_enabled === true
}

export async function dbInsertShopifyOAuthState(
  supabase: SupabaseClient,
  input: {
    stateHash: string
    userId: string
    shopDomain: string
    expiresAt: string
  },
): Promise<void> {
  const { error } = await supabase.from("shopify_oauth_states").insert({
    state_hash: input.stateHash,
    user_id: input.userId,
    shop_domain: input.shopDomain,
    expires_at: input.expiresAt,
  })
  if (error) throw new Error(error.message)
}

export async function dbConsumeShopifyOAuthState(
  supabase: SupabaseClient,
  input: {
    stateHash: string
    userId: string
    shopDomain: string
  },
): Promise<boolean> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("shopify_oauth_states")
    .update({ consumed_at: now })
    .eq("state_hash", input.stateHash)
    .eq("user_id", input.userId)
    .eq("shop_domain", input.shopDomain)
    .is("consumed_at", null)
    .gt("expires_at", now)
    .select("state_hash")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function dbDeleteExpiredShopifyOAuthStates(
  supabase: SupabaseClient,
): Promise<void> {
  await supabase
    .from("shopify_oauth_states")
    .delete()
    .lt("expires_at", new Date().toISOString())
}

export async function dbGetShopifyConnectionForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ShopifyConnectionRow | null> {
  const { data, error } = await supabase
    .from("shopify_connections")
    .select(CONNECTION_SELECT)
    .eq("user_id", userId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ShopifyConnectionRow | null) ?? null
}

export async function dbGetShopifyConnectionById(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<ShopifyConnectionRow | null> {
  const { data, error } = await supabase
    .from("shopify_connections")
    .select(CONNECTION_SELECT)
    .eq("id", connectionId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ShopifyConnectionRow | null) ?? null
}

export async function dbGetShopifyConnectionByDomain(
  supabase: SupabaseClient,
  shopDomain: string,
): Promise<ShopifyConnectionRow | null> {
  const { data, error } = await supabase
    .from("shopify_connections")
    .select(CONNECTION_SELECT)
    .eq("shop_domain", shopDomain)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as ShopifyConnectionRow | null) ?? null
}

export async function dbUpsertShopifyConnection(
  supabase: SupabaseClient,
  input: {
    userId: string
    shopDomain: string
    shopName: string | null
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
  },
): Promise<ShopifyConnectionRow> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("shopify_connections")
    .upsert(
      {
        user_id: input.userId,
        shop_domain: input.shopDomain,
        shop_name: input.shopName,
        status: "active",
        sync_enabled: true,
        access_token_ciphertext: input.accessTokenCiphertext,
        access_token_iv: input.accessTokenIv,
        access_token_tag: input.accessTokenTag,
        refresh_token_ciphertext: input.refreshTokenCiphertext,
        refresh_token_iv: input.refreshTokenIv,
        refresh_token_tag: input.refreshTokenTag,
        encryption_key_version: input.encryptionKeyVersion,
        token_expires_at: input.tokenExpiresAt,
        refresh_token_expires_at: input.refreshTokenExpiresAt,
        token_refresh_locked_until: null,
        scopes: input.scopes,
        last_error: null,
        connected_at: now,
        disconnected_at: null,
        updated_at: now,
      },
      { onConflict: "user_id" },
    )
    .select(CONNECTION_SELECT)
    .single()
  if (error || !data) {
    throw new Error(error?.message ?? "Could not save Shopify connection")
  }
  return data as ShopifyConnectionRow
}

export async function dbUpdateShopifyConnectionTokens(
  supabase: SupabaseClient,
  connectionId: string,
  input: {
    accessTokenCiphertext: string
    accessTokenIv: string
    accessTokenTag: string
    refreshTokenCiphertext: string | null
    refreshTokenIv: string | null
    refreshTokenTag: string | null
    encryptionKeyVersion: number
    tokenExpiresAt: string | null
    refreshTokenExpiresAt: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from("shopify_connections")
    .update({
      access_token_ciphertext: input.accessTokenCiphertext,
      access_token_iv: input.accessTokenIv,
      access_token_tag: input.accessTokenTag,
      refresh_token_ciphertext: input.refreshTokenCiphertext,
      refresh_token_iv: input.refreshTokenIv,
      refresh_token_tag: input.refreshTokenTag,
      encryption_key_version: input.encryptionKeyVersion,
      token_expires_at: input.tokenExpiresAt,
      refresh_token_expires_at: input.refreshTokenExpiresAt,
      token_refresh_locked_until: null,
      status: "active",
      last_error: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
  if (error) throw new Error(error.message)
}

export async function dbClaimShopifyTokenRefresh(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<boolean> {
  const now = new Date()
  const expiredBefore = now.toISOString()
  const lockedUntil = new Date(now.getTime() + 60_000).toISOString()
  const { data, error } = await supabase
    .from("shopify_connections")
    .update({
      token_refresh_locked_until: lockedUntil,
      updated_at: expiredBefore,
    })
    .eq("id", connectionId)
    .or(
      `token_refresh_locked_until.is.null,token_refresh_locked_until.lt.${expiredBefore}`,
    )
    .select("id")
    .maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function dbReleaseShopifyTokenRefresh(
  supabase: SupabaseClient,
  connectionId: string,
  errorMessage?: string,
): Promise<void> {
  await supabase
    .from("shopify_connections")
    .update({
      token_refresh_locked_until: null,
      ...(errorMessage ? { last_error: errorMessage.slice(0, 1000) } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
}

export async function dbMarkShopifyConnectionStatus(
  supabase: SupabaseClient,
  connectionId: string,
  input: {
    status: ShopifyConnectionRow["status"]
    syncEnabled?: boolean
    error?: string | null
  },
): Promise<void> {
  const disconnected = input.status === "disconnected"
  const { error } = await supabase
    .from("shopify_connections")
    .update({
      status: input.status,
      ...(input.syncEnabled == null
        ? {}
        : { sync_enabled: input.syncEnabled }),
      last_error: input.error?.slice(0, 1000) ?? null,
      disconnected_at: disconnected ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
  if (error) throw new Error(error.message)
}

export async function dbTouchShopifyWebhook(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<void> {
  await supabase
    .from("shopify_connections")
    .update({
      last_webhook_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
}

export async function dbTouchShopifyReconciled(
  supabase: SupabaseClient,
  connectionId: string,
): Promise<void> {
  const now = new Date().toISOString()
  await supabase
    .from("shopify_connections")
    .update({
      last_reconciled_at: now,
      last_error: null,
      updated_at: now,
    })
    .eq("id", connectionId)
}

export async function dbListShopifyConnectionsDueForReconcile(
  supabase: SupabaseClient,
  staleBefore: string,
  limit = 100,
): Promise<ShopifyConnectionRow[]> {
  const { data, error } = await supabase
    .from("shopify_connections")
    .select(CONNECTION_SELECT)
    .eq("status", "active")
    .eq("sync_enabled", true)
    .or(`last_reconciled_at.is.null,last_reconciled_at.lt.${staleBefore}`)
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data ?? []) as ShopifyConnectionRow[]
}

export function toPublicShopifyConnection(
  connection: ShopifyConnectionRow,
): PublicShopifyConnection {
  return {
    id: connection.id,
    shop_domain: connection.shop_domain,
    shop_name: connection.shop_name,
    status: connection.status,
    sync_enabled: connection.sync_enabled,
    scopes: connection.scopes,
    last_webhook_at: connection.last_webhook_at,
    last_reconciled_at: connection.last_reconciled_at,
    last_error: connection.last_error,
    connected_at: connection.connected_at,
  }
}
