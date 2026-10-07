import { createServiceRoleClient } from "@/lib/supabase/server"
import { dbGetShopifyCredentialByWebhookRouteKey } from "@/lib/db/shopifyCredentials"
import { dbGetShopifyConnectionByDomain } from "@/lib/db/shopifyConnections"
import { dbInsertShopifyWebhookEvent } from "@/lib/db/shopifyQueue"
import {
  decryptShopifySecret,
  verifyShopifyWebhookHmacWithSecrets,
} from "@/lib/shopify/crypto"

export async function ingestShopifyWebhook(input: {
  shopDomain: string
  webhookId: string
  topic: string
  payload: Record<string, unknown>
}): Promise<"inserted" | "duplicate"> {
  const serviceSupabase = createServiceRoleClient()
  const connection = await dbGetShopifyConnectionByDomain(
    serviceSupabase,
    input.shopDomain,
  )
  return dbInsertShopifyWebhookEvent(serviceSupabase, {
    connectionId: connection?.id ?? null,
    ...input,
  })
}

export async function ingestShopifyManualWebhook(input: {
  routeKey: string
  shopDomain: string
  webhookId: string
  topic: string
  payload: Record<string, unknown>
  rawBody: string
  suppliedHmac: string | null
}): Promise<
  | { ok: true; duplicate: "inserted" | "duplicate" }
  | { ok: false; error: string; status: number }
> {
  const serviceSupabase = createServiceRoleClient()
  const credential = await dbGetShopifyCredentialByWebhookRouteKey(
    serviceSupabase,
    input.routeKey,
  )
  if (!credential || credential.provider !== "merchant_custom") {
    return { ok: false, error: "Unknown webhook route", status: 404 }
  }
  if (
    !credential.client_secret_ciphertext ||
    !credential.client_secret_iv ||
    !credential.client_secret_tag
  ) {
    return { ok: false, error: "Webhook route is misconfigured", status: 503 }
  }

  const clientSecret = decryptShopifySecret({
    ciphertext: credential.client_secret_ciphertext,
    iv: credential.client_secret_iv,
    tag: credential.client_secret_tag,
    keyVersion: credential.encryption_key_version,
  })

  if (
    !verifyShopifyWebhookHmacWithSecrets(
      input.rawBody,
      input.suppliedHmac,
      [clientSecret],
    )
  ) {
    return { ok: false, error: "Invalid signature", status: 401 }
  }

  const connection = await dbGetShopifyConnectionByDomain(
    serviceSupabase,
    input.shopDomain,
  )
  if (!connection || connection.id !== credential.connection_id) {
    return { ok: false, error: "Shop mismatch", status: 400 }
  }

  const duplicate = await dbInsertShopifyWebhookEvent(serviceSupabase, {
    connectionId: connection.id,
    shopDomain: input.shopDomain,
    webhookId: input.webhookId,
    topic: input.topic,
    payload: input.payload,
  })
  return { ok: true, duplicate }
}
