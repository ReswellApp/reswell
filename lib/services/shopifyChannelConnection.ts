import type { SupabaseClient } from "@supabase/supabase-js"
import { shopifyGraphqlRequest } from "@/lib/shopify/admin-graphql"
import { RESWELL_CHANNEL_SPECIFICATION_HANDLE } from "@/lib/shopify/sales-channel"
import type { ShopifyConnectionRow } from "@/lib/shopify/types"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"

type ChannelCreateResult = {
  channelCreate: {
    channel: { id: string; handle: string } | null
    userErrors: Array<{ field?: string[] | null; message: string; code?: string }>
  }
}

type ChannelsListResult = {
  channels: {
    nodes: Array<{
      id: string
      handle: string
      accountId: string | null
      specificationHandle: string | null
    }>
  }
}

export type ShopifyChannelRef = {
  id: string
  handle: string
}

function channelHandleForAccount(userId: string): string {
  const compact = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 16).toLowerCase()
  return `reswell-us-${compact || "merchant"}`
}

/**
 * Ensures a Shopify Sales Channel connection exists for this Reswell account.
 * Best-effort: logs and returns null when the Partner app is not yet a sales
 * channel (channel_config not deployed) or the API rejects the mutation.
 */
export async function ensureShopifySalesChannelConnection(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
}): Promise<ShopifyChannelRef | null> {
  const { connection, serviceSupabase } = input
  if (connection.channel_gid?.trim() && connection.channel_handle?.trim()) {
    return {
      id: connection.channel_gid.trim(),
      handle: connection.channel_handle.trim(),
    }
  }

  let accessToken: string
  try {
    accessToken = await getShopifyAccessToken(serviceSupabase, connection)
  } catch (error) {
    console.error("[shopify] channelCreate token", error)
    return null
  }

  try {
    const existing = await shopifyGraphqlRequest<ChannelsListResult>({
      shopDomain: connection.shop_domain,
      accessToken,
      query: `#graphql
        query ReswellChannels {
          channels(first: 25) {
            nodes {
              id
              handle
              accountId
              specificationHandle
            }
          }
        }
      `,
    })
    const match = existing.channels.nodes.find(
      (node) =>
        node.specificationHandle === RESWELL_CHANNEL_SPECIFICATION_HANDLE ||
        node.accountId === connection.user_id ||
        node.handle.includes("reswell"),
    )
    if (match?.id && match.handle) {
      await persistChannelRef(serviceSupabase, connection.id, {
        id: match.id,
        handle: match.handle,
      })
      return { id: match.id, handle: match.handle }
    }
  } catch (error) {
    // App may not be a sales channel yet — fall through to create.
    console.warn("[shopify] list channels", error)
  }

  try {
    const accountName =
      connection.shop_name?.trim() ||
      connection.shop_domain.replace(/\.myshopify\.com$/i, "")
    const handle = channelHandleForAccount(connection.user_id)
    const data = await shopifyGraphqlRequest<ChannelCreateResult>({
      shopDomain: connection.shop_domain,
      accessToken,
      query: `#graphql
        mutation ReswellChannelCreate($input: ChannelCreateInput!) {
          channelCreate(input: $input) {
            channel {
              id
              handle
            }
            userErrors {
              field
              message
              code
            }
          }
        }
      `,
      variables: {
        input: {
          handle,
          specificationHandle: RESWELL_CHANNEL_SPECIFICATION_HANDLE,
          accountId: connection.user_id,
          accountName: `Reswell · ${accountName}`,
        },
      },
    })

    const errors = data.channelCreate.userErrors
    if (errors.length > 0) {
      console.warn("[shopify] channelCreate userErrors", {
        shopDomain: connection.shop_domain,
        errors,
      })
      return null
    }
    const channelId = data.channelCreate.channel?.id?.trim()
    const channelHandle =
      data.channelCreate.channel?.handle?.trim() || handle
    if (!channelId) return null
    const ref = { id: channelId, handle: channelHandle }
    await persistChannelRef(serviceSupabase, connection.id, ref)
    return ref
  } catch (error) {
    console.warn("[shopify] channelCreate", {
      shopDomain: connection.shop_domain,
      error,
    })
    return null
  }
}

async function persistChannelRef(
  supabase: SupabaseClient,
  connectionId: string,
  channel: ShopifyChannelRef,
): Promise<void> {
  const { error } = await supabase
    .from("shopify_connections")
    .update({
      channel_gid: channel.id,
      channel_handle: channel.handle,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
  if (error) {
    console.error("[shopify] persist channel ref", { connectionId, error })
  }
}
