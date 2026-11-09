import type { SupabaseClient } from "@supabase/supabase-js"
import { dbUpdateShopifySourceOfTruth } from "@/lib/db/shopifyConnections"
import {
  shopifyGraphqlRequest,
  throwOnShopifyUserErrors,
} from "@/lib/shopify/admin-graphql"
import {
  parseShopifySourceOfTruth,
  SHOPIFY_SOURCE_METAFIELD_KEY,
  SHOPIFY_SOURCE_METAFIELD_NAMESPACE,
} from "@/lib/shopify/billing"
import type {
  ShopifyConnectionRow,
  ShopifySourceOfTruth,
} from "@/lib/shopify/types"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"

async function ensureSourceMetafieldDefinition(
  shopDomain: string,
  accessToken: string,
): Promise<void> {
  const data = await shopifyGraphqlRequest<{
    metafieldDefinitionCreate: {
      userErrors: Array<{ field?: string[] | null; message?: string | null }>
    }
  }>({
    shopDomain,
    accessToken,
    query: `
      mutation ReswellSourceDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          userErrors { field message }
        }
      }
    `,
    variables: {
      definition: {
        name: "Reswell source of truth",
        namespace: SHOPIFY_SOURCE_METAFIELD_NAMESPACE,
        key: SHOPIFY_SOURCE_METAFIELD_KEY,
        description: "shopify or reswell. Reswell copies this both ways.",
        type: "single_line_text_field",
        ownerType: "SHOP",
        access: { admin: "MERCHANT_READ_WRITE" },
      },
    },
  })
  const message = data.metafieldDefinitionCreate.userErrors
    .map((error) => error.message ?? "")
    .join(" ")
    .toLowerCase()
  if (message.includes("already") || message.includes("taken") || message.includes("in use")) {
    return
  }
  throwOnShopifyUserErrors(data.metafieldDefinitionCreate.userErrors)
}

export async function pushShopifySourceOfTruth(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  accessToken?: string
  sourceOfTruth: ShopifySourceOfTruth
}): Promise<void> {
  if (!input.connection.shop_gid) return
  const accessToken =
    input.accessToken ??
    (await getShopifyAccessToken(input.serviceSupabase, input.connection))
  try {
    await ensureSourceMetafieldDefinition(input.connection.shop_domain, accessToken)
  } catch (error) {
    console.error("[shopify] source metafield definition", error)
  }
  const data = await shopifyGraphqlRequest<{
    metafieldsSet: {
      userErrors: Array<{ field?: string[] | null; message?: string | null }>
    }
  }>({
    shopDomain: input.connection.shop_domain,
    accessToken,
    query: `
      mutation ReswellSetSource($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          userErrors { field message }
        }
      }
    `,
    variables: {
      metafields: [
        {
          ownerId: input.connection.shop_gid,
          namespace: SHOPIFY_SOURCE_METAFIELD_NAMESPACE,
          key: SHOPIFY_SOURCE_METAFIELD_KEY,
          type: "single_line_text_field",
          value: input.sourceOfTruth,
        },
      ],
    },
  })
  throwOnShopifyUserErrors(data.metafieldsSet.userErrors)
}

export async function pullShopifySourceOfTruth(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
}): Promise<ShopifySourceOfTruth> {
  const accessToken = await getShopifyAccessToken(
    input.serviceSupabase,
    input.connection,
  )
  const data = await shopifyGraphqlRequest<{
    shop: {
      metafield?: { value?: string | null } | null
    }
  }>({
    shopDomain: input.connection.shop_domain,
    accessToken,
    query: `
      query ReswellSourceMetafield($namespace: String!, $key: String!) {
        shop {
          metafield(namespace: $namespace, key: $key) { value }
        }
      }
    `,
    variables: {
      namespace: SHOPIFY_SOURCE_METAFIELD_NAMESPACE,
      key: SHOPIFY_SOURCE_METAFIELD_KEY,
    },
  })
  const remote = parseShopifySourceOfTruth(data.shop.metafield?.value)
  if (remote && remote !== input.connection.source_of_truth) {
    await dbUpdateShopifySourceOfTruth(
      input.serviceSupabase,
      input.connection.id,
      remote,
    )
    return remote
  }
  return input.connection.source_of_truth
}

export function shopifyMetafieldMatchesSource(input: {
  namespace?: string | null
  key?: string | null
}): boolean {
  if (input.key !== SHOPIFY_SOURCE_METAFIELD_KEY) return false
  const namespace = input.namespace ?? ""
  return (
    namespace === SHOPIFY_SOURCE_METAFIELD_NAMESPACE ||
    namespace.startsWith("app--")
  )
}
