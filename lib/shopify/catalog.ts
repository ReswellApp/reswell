import {
  shopifyGraphqlRequest,
  throwOnShopifyUserErrors,
} from "@/lib/shopify/admin-graphql"
import type {
  ShopifyCatalogProduct,
  ShopifyCatalogVariant,
  ShopifyInventoryLevel,
} from "@/lib/shopify/types"

type Money = string | number | null

type RawInventoryLevel = {
  location?: {
    id?: string
    name?: string | null
    isActive?: boolean | null
  } | null
  quantities?: Array<{ name?: string; quantity?: number }> | null
}

type RawVariant = {
  id?: string
  title?: string | null
  sku?: string | null
  price?: Money
  compareAtPrice?: Money
  inventoryQuantity?: number | null
  image?: { url?: string | null } | null
  inventoryItem?: {
    id?: string
    inventoryLevels?: { nodes?: RawInventoryLevel[] | null } | null
  } | null
}

type RawProduct = {
  id?: string
  title?: string | null
  description?: string | null
  vendor?: string | null
  productType?: string | null
  status?: string | null
  updatedAt?: string | null
  featuredMedia?: {
    preview?: { image?: { url?: string | null } | null } | null
  } | null
  variants?: {
    nodes?: RawVariant[] | null
    pageInfo?: { hasNextPage?: boolean | null } | null
  } | null
}

const PRODUCT_SUMMARY_FIELDS = `
  id
  title
  description
  vendor
  productType
  status
  updatedAt
  featuredMedia {
    preview { image { url } }
  }
  variants(first: 100) {
    nodes {
      id
      title
      sku
      price
      compareAtPrice
      inventoryQuantity
      image { url }
      inventoryItem { id }
    }
    pageInfo { hasNextPage }
  }
`

const PRODUCT_DETAIL_FIELDS = `
  id
  title
  description
  vendor
  productType
  status
  updatedAt
  featuredMedia {
    preview { image { url } }
  }
  variants(first: 100) {
    nodes {
      id
      title
      sku
      price
      compareAtPrice
      image { url }
      inventoryItem {
        id
        inventoryLevels(first: 50) {
          nodes {
            location { id name isActive }
            quantities(names: ["available"]) { name quantity }
          }
        }
      }
    }
    pageInfo { hasNextPage }
  }
`

function numberFromMoney(value: Money): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function shopifyAvailableInventory(
  levels: ShopifyInventoryLevel[],
): number {
  return levels.reduce(
    (sum, level) => sum + Math.max(0, Math.floor(level.available)),
    0,
  )
}

function mapInventoryLevels(raw: RawInventoryLevel[] | null | undefined) {
  const levels: ShopifyInventoryLevel[] = []
  for (const row of raw ?? []) {
    const locationId = row.location?.id?.trim()
    if (!locationId || row.location?.isActive === false) continue
    const available =
      row.quantities?.find((quantity) => quantity.name === "available")
        ?.quantity ?? 0
    levels.push({
      locationId,
      locationName: row.location?.name?.trim() || "Shopify location",
      available: Math.max(0, Math.floor(Number(available) || 0)),
    })
  }
  return levels
}

function mapVariant(
  raw: RawVariant,
  fallbackImage: string | null,
): ShopifyCatalogVariant | null {
  const id = raw.id?.trim()
  const inventoryItemId = raw.inventoryItem?.id?.trim()
  if (!id || !inventoryItemId) return null
  return {
    id,
    title: raw.title?.trim() || "Default",
    sku: raw.sku?.trim() || null,
    price: numberFromMoney(raw.price),
    compareAtPrice:
      raw.compareAtPrice == null ? null : numberFromMoney(raw.compareAtPrice),
    inventoryItemId,
    inventoryLevels: mapInventoryLevels(
      raw.inventoryItem?.inventoryLevels?.nodes,
    ),
    available: Math.max(
      0,
      Math.floor(
        Number(
          raw.inventoryQuantity ??
            mapInventoryLevels(raw.inventoryItem?.inventoryLevels?.nodes).reduce(
              (sum, level) => sum + level.available,
              0,
            ),
        ) || 0,
      ),
    ),
    imageUrl: raw.image?.url?.trim() || fallbackImage,
  }
}

function mapProduct(raw: RawProduct): ShopifyCatalogProduct | null {
  const id = raw.id?.trim()
  const title = raw.title?.trim()
  if (!id || !title) return null
  if (raw.variants?.pageInfo?.hasNextPage) {
    throw new Error(
      `"${title}" has more than 100 variants and cannot be imported yet.`,
    )
  }
  const imageUrl = raw.featuredMedia?.preview?.image?.url?.trim() || null
  const variants = (raw.variants?.nodes ?? [])
    .map((variant) => mapVariant(variant, imageUrl))
    .filter((variant): variant is ShopifyCatalogVariant => variant !== null)
  return {
    id,
    title,
    description: raw.description?.trim() || title,
    vendor: raw.vendor?.trim() || null,
    productType: raw.productType?.trim() || null,
    status: raw.status?.trim() || "DRAFT",
    updatedAt: raw.updatedAt?.trim() || new Date(0).toISOString(),
    imageUrl,
    variants,
    selected: false,
    selectedSection: null,
  }
}

export async function fetchShopifyProducts(input: {
  shopDomain: string
  accessToken: string
  query?: string
  after?: string | null
}): Promise<{
  products: ShopifyCatalogProduct[]
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
}> {
  const data = await shopifyGraphqlRequest<{
    products: {
      nodes?: RawProduct[] | null
      pageInfo?: {
        hasNextPage?: boolean | null
        endCursor?: string | null
      } | null
    }
  }>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    query: `
      query ReswellProducts($after: String, $query: String) {
        products(
          first: 25,
          after: $after,
          query: $query,
          sortKey: UPDATED_AT,
          reverse: true
        ) {
          nodes { ${PRODUCT_SUMMARY_FIELDS} }
          pageInfo { hasNextPage endCursor }
        }
      }
    `,
    variables: {
      after: input.after ?? null,
      query: input.query?.trim() || null,
    },
  })
  return {
    products: (data.products.nodes ?? [])
      .map(mapProduct)
      .filter((product): product is ShopifyCatalogProduct => product !== null),
    pageInfo: {
      hasNextPage: data.products.pageInfo?.hasNextPage === true,
      endCursor: data.products.pageInfo?.endCursor?.trim() || null,
    },
  }
}

export async function fetchShopifyProduct(input: {
  shopDomain: string
  accessToken: string
  productId: string
}): Promise<ShopifyCatalogProduct | null> {
  const data = await shopifyGraphqlRequest<{ product: RawProduct | null }>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    query: `
      query ReswellProduct($id: ID!) {
        product(id: $id) { ${PRODUCT_DETAIL_FIELDS} }
      }
    `,
    variables: { id: input.productId },
  })
  return data.product ? mapProduct(data.product) : null
}

export async function fetchShopifyInventoryLevels(input: {
  shopDomain: string
  accessToken: string
  inventoryItemId: string
}): Promise<ShopifyInventoryLevel[]> {
  const data = await shopifyGraphqlRequest<{
    inventoryItem: {
      inventoryLevels?: { nodes?: RawInventoryLevel[] | null } | null
    } | null
  }>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    query: `
      query ReswellInventory($id: ID!) {
        inventoryItem(id: $id) {
          inventoryLevels(first: 50) {
            nodes {
              location { id name isActive }
              quantities(names: ["available"]) { name quantity }
            }
          }
        }
      }
    `,
    variables: { id: input.inventoryItemId },
  })
  return mapInventoryLevels(data.inventoryItem?.inventoryLevels?.nodes)
}

export async function decrementShopifyInventory(input: {
  shopDomain: string
  accessToken: string
  inventoryItemId: string
  locationId: string
  currentAvailable: number
  quantity: number
  idempotencyKey: string
  orderId: string
}): Promise<void> {
  const result = await shopifyGraphqlRequest<{
    inventoryAdjustQuantities: {
      userErrors: Array<{ field?: string[] | null; message?: string | null }>
    }
  }>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    query: `
      mutation ReswellInventoryDecrement(
        $input: InventoryAdjustQuantitiesInput!,
        $idempotencyKey: String!
      ) {
        inventoryAdjustQuantities(input: $input)
          @idempotent(key: $idempotencyKey) {
          userErrors { field message }
        }
      }
    `,
    variables: {
      idempotencyKey: input.idempotencyKey,
      input: {
        reason: "correction",
        name: "available",
        referenceDocumentUri: `gid://reswell/Order/${input.orderId}`,
        changes: [
          {
            inventoryItemId: input.inventoryItemId,
            locationId: input.locationId,
            delta: -Math.max(1, Math.floor(input.quantity)),
            changeFromQuantity: Math.max(
              0,
              Math.floor(input.currentAvailable),
            ),
          },
        ],
      },
    },
  })
  throwOnShopifyUserErrors(result.inventoryAdjustQuantities.userErrors)
}
