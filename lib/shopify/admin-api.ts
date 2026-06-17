import { SHOPIFY_API_VERSION } from "@/lib/shopify/config"
import type { ShopifyRestProduct } from "@/lib/shopify/types"

export class ShopifyApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message)
    this.name = "ShopifyApiError"
  }
}

async function shopifyAdminFetch(
  shopDomain: string,
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}${path}`
  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  })
}

export async function exchangeShopifyOAuthCode(opts: {
  shopDomain: string
  code: string
}): Promise<{ access_token: string; scope: string }> {
  const { shopifyApiKey, shopifyApiSecret } = await import("@/lib/shopify/config")
  const res = await fetch(`https://${opts.shopDomain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: shopifyApiKey(),
      client_secret: shopifyApiSecret(),
      code: opts.code,
    }),
    cache: "no-store",
  })

  if (!res.ok) {
    const body = await res.text()
    throw new ShopifyApiError("OAuth token exchange failed", res.status, body)
  }

  return (await res.json()) as { access_token: string; scope: string }
}

export async function fetchShopifyShopName(
  shopDomain: string,
  accessToken: string,
): Promise<string | null> {
  const res = await shopifyAdminFetch(shopDomain, accessToken, "/shop.json")
  if (!res.ok) return null
  const json = (await res.json()) as { shop?: { name?: string } }
  return json.shop?.name?.trim() ?? null
}

export async function listShopifyProducts(opts: {
  shopDomain: string
  accessToken: string
  limit?: number
  pageInfo?: string | null
}): Promise<{ products: ShopifyRestProduct[]; nextPageInfo: string | null }> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 250)
  const params = new URLSearchParams({ limit: String(limit) })
  if (opts.pageInfo) {
    params.set("page_info", opts.pageInfo)
  }

  const res = await shopifyAdminFetch(
    opts.shopDomain,
    opts.accessToken,
    `/products.json?${params.toString()}`,
  )

  if (!res.ok) {
    const body = await res.text()
    throw new ShopifyApiError("Failed to list Shopify products", res.status, body)
  }

  const json = (await res.json()) as { products?: ShopifyRestProduct[] }
  const linkHeader = res.headers.get("link")
  let nextPageInfo: string | null = null
  if (linkHeader) {
    const match = /<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"/.exec(linkHeader)
    if (match?.[1]) nextPageInfo = decodeURIComponent(match[1])
  }

  return { products: json.products ?? [], nextPageInfo }
}

export async function fetchShopifyProduct(opts: {
  shopDomain: string
  accessToken: string
  productId: string | number
}): Promise<ShopifyRestProduct | null> {
  const res = await shopifyAdminFetch(
    opts.shopDomain,
    opts.accessToken,
    `/products/${opts.productId}.json`,
  )
  if (res.status === 404) return null
  if (!res.ok) {
    const body = await res.text()
    throw new ShopifyApiError("Failed to fetch Shopify product", res.status, body)
  }
  const json = (await res.json()) as { product?: ShopifyRestProduct }
  return json.product ?? null
}

export async function fetchShopifyProductCollections(opts: {
  shopDomain: string
  accessToken: string
  productId: string | number
}): Promise<string[]> {
  const res = await shopifyAdminFetch(
    opts.shopDomain,
    opts.accessToken,
    `/collects.json?product_id=${opts.productId}&limit=250`,
  )
  if (!res.ok) return []

  const json = (await res.json()) as { collects?: Array<{ collection_id: number }> }
  const collectionIds = (json.collects ?? []).map((c) => c.collection_id)
  const titles: string[] = []

  for (const collectionId of collectionIds) {
    const colRes = await shopifyAdminFetch(
      opts.shopDomain,
      opts.accessToken,
      `/collections/${collectionId}.json`,
    )
    if (!colRes.ok) continue
    const colJson = (await colRes.json()) as { collection?: { title?: string } }
    const title = colJson.collection?.title?.trim()
    if (title) titles.push(title)
  }

  return titles
}

const SHOPIFY_WEBHOOK_TOPICS = [
  "products/create",
  "products/update",
  "products/delete",
  "inventory_levels/update",
] as const

export async function registerShopifyWebhooks(opts: {
  shopDomain: string
  accessToken: string
  callbackUrl: string
}): Promise<void> {
  for (const topic of SHOPIFY_WEBHOOK_TOPICS) {
    const res = await shopifyAdminFetch(opts.shopDomain, opts.accessToken, "/webhooks.json", {
      method: "POST",
      body: JSON.stringify({
        webhook: {
          topic,
          address: opts.callbackUrl,
          format: "json",
        },
      }),
    })
    if (!res.ok && res.status !== 422) {
      const body = await res.text()
      console.warn("[shopify] webhook register failed", { topic, status: res.status, body })
    }
  }
}

export async function createShopifyDraftOrder(opts: {
  shopDomain: string
  accessToken: string
  lineItem: {
    variantId: string | number
    quantity: number
    price: string
    title: string
  }
  customerEmail?: string | null
  note?: string
}): Promise<{ draftOrderId: number | null }> {
  const res = await shopifyAdminFetch(opts.shopDomain, opts.accessToken, "/draft_orders.json", {
    method: "POST",
    body: JSON.stringify({
      draft_order: {
        line_items: [
          {
            variant_id: Number(opts.lineItem.variantId),
            quantity: opts.lineItem.quantity,
            price: opts.lineItem.price,
            title: opts.lineItem.title,
          },
        ],
        email: opts.customerEmail ?? undefined,
        note: opts.note ?? "Created from Reswell marketplace order",
        use_customer_default_address: true,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new ShopifyApiError("Failed to create Shopify draft order", res.status, body)
  }

  const json = (await res.json()) as { draft_order?: { id?: number } }
  return { draftOrderId: json.draft_order?.id ?? null }
}
