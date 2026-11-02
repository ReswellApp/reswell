import type { SupabaseClient } from "@supabase/supabase-js"
import { shopifyGraphqlRequest } from "@/lib/shopify/admin-graphql"
import {
  shopifyFeedbackMessages,
  type ShopifyProductFeedbackState,
} from "@/lib/shopify/resource-feedback"
import type { ShopifyCatalogProduct, ShopifyConnectionRow } from "@/lib/shopify/types"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"

type FeedbackResult = {
  bulkProductResourceFeedbackCreate: {
    userErrors: Array<{ field?: string[] | null; message?: string | null }>
  }
}

/**
 * Report product setup issues in Shopify admin (Sales Channel 5.7.3).
 * Best-effort: no-ops when the app lacks write_resource_feedbacks or is not a SC yet.
 */
export async function reportShopifyProductFeedback(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  product: Pick<ShopifyCatalogProduct, "id" | "updatedAt">
  state: ShopifyProductFeedbackState
  messages?: string[]
}): Promise<void> {
  const messages =
    input.state === "REQUIRES_ACTION"
      ? shopifyFeedbackMessages(input.messages ?? [])
      : []
  if (input.state === "REQUIRES_ACTION" && messages.length === 0) return

  let accessToken: string
  try {
    accessToken = await getShopifyAccessToken(
      input.serviceSupabase,
      input.connection,
    )
  } catch (error) {
    console.warn("[shopify] resource feedback token", error)
    return
  }

  try {
    const data = await shopifyGraphqlRequest<FeedbackResult>({
      shopDomain: input.connection.shop_domain,
      accessToken,
      query: `#graphql
        mutation ReswellProductFeedback($feedbackInput: [ProductResourceFeedbackInput!]!) {
          bulkProductResourceFeedbackCreate(feedbackInput: $feedbackInput) {
            userErrors { field message }
          }
        }
      `,
      variables: {
        feedbackInput: [
          {
            productId: input.product.id,
            productUpdatedAt: input.product.updatedAt,
            feedbackGeneratedAt: new Date().toISOString(),
            state: input.state,
            ...(messages.length > 0 ? { messages } : {}),
          },
        ],
      },
    })
    if (data.bulkProductResourceFeedbackCreate.userErrors.length > 0) {
      console.warn("[shopify] resource feedback userErrors", {
        shopDomain: input.connection.shop_domain,
        productId: input.product.id,
        errors: data.bulkProductResourceFeedbackCreate.userErrors,
      })
    }
  } catch (error) {
    console.warn("[shopify] resource feedback", {
      shopDomain: input.connection.shop_domain,
      productId: input.product.id,
      error,
    })
  }
}

export function shopifyPublishBlockingMessages(
  product: ShopifyCatalogProduct,
): string[] {
  const messages: string[] = []
  if (!product.imageUrl) {
    messages.push("Needs at least one image.")
  }
  if (product.variants.length === 0) {
    messages.push("Needs at least one variant.")
  }
  if (product.variants.length > 100) {
    messages.push("Reswell supports products with up to 100 variants.")
  }
  if (!product.title.trim()) {
    messages.push("Needs a product title.")
  }
  return messages
}
