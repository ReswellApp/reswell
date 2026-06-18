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
  "app/uninstalled",
  "customers/data_request",
  "customers/redact",
  "shop/redact",
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

export interface ShopifyOrderAddress {
  firstName?: string | null
  lastName?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  zip?: string | null
  country?: string | null
  phone?: string | null
}

export interface ShopifyOrderLineItemInput {
  variantId: string | number
  quantity: number
  price: string
  title: string
}

/**
 * Create a real (not draft) Shopify order marked paid — Reswell already collected payment via Stripe.
 * Tagged + noted with the Reswell order id so the seller can reconcile and we can dedupe.
 */
export async function createShopifyOrder(opts: {
  shopDomain: string
  accessToken: string
  lineItems: ShopifyOrderLineItemInput[]
  customerEmail?: string | null
  shippingAddress?: ShopifyOrderAddress | null
  reswellOrderId: string
  note?: string
  shippingTitle?: string
  shippingPrice?: string
}): Promise<{ orderId: number | null; orderName: string | null }> {
  const shipping_address = opts.shippingAddress
    ? {
        first_name: opts.shippingAddress.firstName ?? undefined,
        last_name: opts.shippingAddress.lastName ?? undefined,
        address1: opts.shippingAddress.address1 ?? undefined,
        address2: opts.shippingAddress.address2 ?? undefined,
        city: opts.shippingAddress.city ?? undefined,
        province: opts.shippingAddress.province ?? undefined,
        zip: opts.shippingAddress.zip ?? undefined,
        country: opts.shippingAddress.country ?? undefined,
        phone: opts.shippingAddress.phone ?? undefined,
      }
    : undefined

  const res = await shopifyAdminFetch(opts.shopDomain, opts.accessToken, "/orders.json", {
    method: "POST",
    body: JSON.stringify({
      order: {
        line_items: opts.lineItems.map((li) => ({
          variant_id: Number(li.variantId),
          quantity: li.quantity,
          price: li.price,
          title: li.title,
        })),
        email: opts.customerEmail ?? undefined,
        financial_status: "paid",
        inventory_behaviour: "decrement_obeying_policy",
        send_receipt: false,
        send_fulfillment_receipt: false,
        shipping_address,
        shipping_lines:
          opts.shippingPrice != null
            ? [{ title: opts.shippingTitle ?? "Reswell shipping", price: opts.shippingPrice }]
            : undefined,
        note: opts.note ?? `Reswell order ${opts.reswellOrderId}`,
        tags: `reswell, reswell:order:${opts.reswellOrderId}`,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new ShopifyApiError("Failed to create Shopify order", res.status, body)
  }

  const json = (await res.json()) as { order?: { id?: number; name?: string } }
  return { orderId: json.order?.id ?? null, orderName: json.order?.name ?? null }
}

/** Cancel a Shopify order (e.g. Reswell-side refund). Best-effort idempotent. */
export async function cancelShopifyOrder(opts: {
  shopDomain: string
  accessToken: string
  orderId: string | number
  reason?: "customer" | "fraud" | "inventory" | "declined" | "other"
}): Promise<void> {
  const res = await shopifyAdminFetch(
    opts.shopDomain,
    opts.accessToken,
    `/orders/${opts.orderId}/cancel.json`,
    {
      method: "POST",
      body: JSON.stringify({ reason: opts.reason ?? "other", email: false }),
    },
  )
  if (!res.ok && res.status !== 422) {
    const body = await res.text()
    throw new ShopifyApiError("Failed to cancel Shopify order", res.status, body)
  }
}

/**
 * Create a fulfillment with tracking on a Shopify order (modern fulfillment-orders API).
 * Pushes the Reswell-purchased ShipEngine tracking number into the seller's Shopify admin.
 */
export async function createShopifyFulfillmentWithTracking(opts: {
  shopDomain: string
  accessToken: string
  orderId: string | number
  trackingNumber: string
  trackingCompany?: string | null
  trackingUrl?: string | null
}): Promise<{ fulfillmentId: number | null }> {
  const foRes = await shopifyAdminFetch(
    opts.shopDomain,
    opts.accessToken,
    `/orders/${opts.orderId}/fulfillment_orders.json`,
  )
  if (!foRes.ok) {
    const body = await foRes.text()
    throw new ShopifyApiError("Failed to load fulfillment orders", foRes.status, body)
  }
  const foJson = (await foRes.json()) as {
    fulfillment_orders?: Array<{ id: number; status: string }>
  }
  const openFo = (foJson.fulfillment_orders ?? []).filter(
    (fo) => fo.status === "open" || fo.status === "in_progress",
  )
  if (openFo.length === 0) {
    return { fulfillmentId: null }
  }

  const res = await shopifyAdminFetch(opts.shopDomain, opts.accessToken, "/fulfillments.json", {
    method: "POST",
    body: JSON.stringify({
      fulfillment: {
        line_items_by_fulfillment_order: openFo.map((fo) => ({ fulfillment_order_id: fo.id })),
        tracking_info: {
          number: opts.trackingNumber,
          company: opts.trackingCompany ?? undefined,
          url: opts.trackingUrl ?? undefined,
        },
        notify_customer: false,
      },
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new ShopifyApiError("Failed to create Shopify fulfillment", res.status, body)
  }
  const json = (await res.json()) as { fulfillment?: { id?: number } }
  return { fulfillmentId: json.fulfillment?.id ?? null }
}

/** Look up a variant's inventory_item_id (needed to adjust inventory levels). */
export async function fetchShopifyVariantInventoryItem(opts: {
  shopDomain: string
  accessToken: string
  variantId: string | number
}): Promise<{ inventoryItemId: number | null }> {
  const res = await shopifyAdminFetch(
    opts.shopDomain,
    opts.accessToken,
    `/variants/${opts.variantId}.json`,
  )
  if (!res.ok) return { inventoryItemId: null }
  const json = (await res.json()) as { variant?: { inventory_item_id?: number } }
  return { inventoryItemId: json.variant?.inventory_item_id ?? null }
}

/** First/primary location id for the shop (single-location adjustment default). */
export async function fetchShopifyPrimaryLocationId(opts: {
  shopDomain: string
  accessToken: string
}): Promise<number | null> {
  const res = await shopifyAdminFetch(opts.shopDomain, opts.accessToken, "/locations.json")
  if (!res.ok) return null
  const json = (await res.json()) as { locations?: Array<{ id: number; active?: boolean }> }
  const active = (json.locations ?? []).find((l) => l.active !== false)
  return active?.id ?? json.locations?.[0]?.id ?? null
}

/** Decrement (or adjust) available inventory for a variant at a location. */
export async function adjustShopifyInventory(opts: {
  shopDomain: string
  accessToken: string
  inventoryItemId: string | number
  locationId: string | number
  availableAdjustment: number
}): Promise<void> {
  const res = await shopifyAdminFetch(
    opts.shopDomain,
    opts.accessToken,
    "/inventory_levels/adjust.json",
    {
      method: "POST",
      body: JSON.stringify({
        inventory_item_id: Number(opts.inventoryItemId),
        location_id: Number(opts.locationId),
        available_adjustment: opts.availableAdjustment,
      }),
    },
  )
  if (!res.ok) {
    const body = await res.text()
    throw new ShopifyApiError("Failed to adjust Shopify inventory", res.status, body)
  }
}

/** Execute a GraphQL Admin API query (used for bulk catalog operations). */
export async function shopifyGraphql<T>(opts: {
  shopDomain: string
  accessToken: string
  query: string
  variables?: Record<string, unknown>
}): Promise<T> {
  const { shopifyGraphqlEndpoint } = await import("@/lib/shopify/config")
  const res = await fetch(shopifyGraphqlEndpoint(opts.shopDomain), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": opts.accessToken,
    },
    body: JSON.stringify({ query: opts.query, variables: opts.variables ?? {} }),
    cache: "no-store",
  })
  if (!res.ok) {
    const body = await res.text()
    throw new ShopifyApiError("Shopify GraphQL request failed", res.status, body)
  }
  const json = (await res.json()) as { data?: T; errors?: unknown }
  if (json.errors) {
    throw new ShopifyApiError("Shopify GraphQL returned errors", 200, JSON.stringify(json.errors))
  }
  return json.data as T
}
