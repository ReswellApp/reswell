import type { SupabaseClient } from "@supabase/supabase-js"
import type { ShopifyPendingInstallationPreview } from "@/lib/shopify/types"

export async function dbUpsertShopifyPendingInstallation(
  supabase: SupabaseClient,
  input: {
    shopGid: string
    shopDomain: string
    shopName: string | null
    claimSecretHash: string
    expiresAt: string
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
  },
): Promise<void> {
  const { error } = await supabase.from("shopify_pending_installations").upsert(
    {
      shop_gid: input.shopGid,
      shop_domain: input.shopDomain.toLowerCase(),
      shop_name: input.shopName,
      status: "ready",
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
      claim_secret_hash: input.claimSecretHash,
      expires_at: input.expiresAt,
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "shop_domain" },
  )
  if (error) throw new Error(error.message)
}

export async function dbGetShopifyPendingInstallationPreview(
  supabase: SupabaseClient,
  claimSecretHash: string,
): Promise<ShopifyPendingInstallationPreview | null> {
  const { data, error } = await supabase
    .from("shopify_pending_installations")
    .select("shop_domain, shop_name, status, expires_at")
    .eq("claim_secret_hash", claimSecretHash)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    shopDomain: data.shop_domain as string,
    shopName: (data.shop_name as string | null) ?? null,
    expiresAt: data.expires_at as string,
    ready: data.status === "ready",
  }
}

export async function dbClaimShopifyPendingInstallation(
  supabase: SupabaseClient,
  input: { claimSecretHash: string; userId: string },
): Promise<{ connectionId: string; shopDomain: string; shopName: string | null }> {
  const { data, error } = await supabase.rpc("claim_shopify_pending_installation", {
    p_claim_secret_hash: input.claimSecretHash,
    p_user_id: input.userId,
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== "object") {
    throw new Error("Shopify claim did not return a connection")
  }
  const record = row as Record<string, unknown>
  return {
    connectionId: String(record.connection_id),
    shopDomain: String(record.shop_domain),
    shopName:
      record.shop_name == null || record.shop_name === ""
        ? null
        : String(record.shop_name),
  }
}
