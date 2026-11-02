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

/**
 * Ensures a Shopify Sales Channel connection exists for this Reswell account.
 * Best-effort: logs and returns null when the Partner app is not yet a sales
 * channel (channel_config not deployed) or the API rejects the mutation.
 */
export async function ensureShopifySalesChannelConnection(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
}): Promise<string | null> {
  const { connection, serviceSupabase } = input
  if (connection.channel_gid?.trim()) {
    return connection.channel_gid.trim()
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
    if (match?.id) {
      await persistChannelGid(serviceSupabase, connection.id, match.id)
      return match.id
    }
  } catch (error) {
    // App may not be a sales channel yet — fall through to create.
    console.warn("[shopify] list channels", error)
  }

  try {
    const accountName =
      connection.shop_name?.trim() ||
      connection.shop_domain.replace(/\.myshopify\.com$/i, "")
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
    if (!channelId) return null
    await persistChannelGid(serviceSupabase, connection.id, channelId)
    return channelId
  } catch (error) {
    console.warn("[shopify] channelCreate", {
      shopDomain: connection.shop_domain,
      error,
    })
    return null
  }
}

async function persistChannelGid(
  supabase: SupabaseClient,
  connectionId: string,
  channelGid: string,
): Promise<void> {
  const { error } = await supabase
    .from("shopify_connections")
    .update({
      channel_gid: channelGid,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId)
  if (error) {
    console.error("[shopify] persist channel_gid", { connectionId, error })
  }
}
