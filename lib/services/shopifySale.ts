import type { SupabaseClient } from "@supabase/supabase-js"
import { dbEnqueueShopifyJob } from "@/lib/db/shopifyQueue"
import {
  dbGetShopifySaleRecord,
  dbInsertShopifySaleRecord,
  dbUpdateShopifySaleRecord,
  type ShopifySaleRecord,
} from "@/lib/db/shopifySales"
import { listingSoldViaCheckoutUpdate } from "@/lib/listing-sold-state"
import {
  shopifyGraphqlRequest,
  throwOnShopifyUserErrors,
} from "@/lib/shopify/admin-graphql"
import {
  isReswellOriginatedShopifyOrder,
  shopifySaleIdempotencyKey,
  shopifyUsageAmountUsd,
  SHOPIFY_ORDER_TAG,
  RESWELL_ORDER_ATTRIBUTE,
} from "@/lib/shopify/billing"
import type {
  ShopifyConnectionRow,
  ShopifySaleCollectVia,
  ShopifySourceOfTruth,
} from "@/lib/shopify/types"
import {
  createShopifyUsageRecord,
  ShopifyBillingRequiredError,
} from "@/lib/services/shopifyBilling"
import { getShopifyAccessToken } from "@/lib/services/shopifyOAuth"

type SaleLine = {
  listingId: string
  productId: string
  variantId: string
  inventoryItemId: string
  quantity: number
  unitPrice: number
}

function money(amount: number) {
  return { amount: amount.toFixed(2), currencyCode: "USD" }
}

async function loadSaleLines(
  supabase: SupabaseClient,
  connectionId: string,
  orderId: string,
): Promise<SaleLine[]> {
  const { data: items, error } = await supabase
    .from("order_items")
    .select("listing_id, quantity, item_price")
    .eq("order_id", orderId)
  if (error) throw new Error(error.message)
  const listingIds = (items ?? []).map((item) => String(item.listing_id))
  if (listingIds.length === 0) return []
  const { data: mappings, error: mappingError } = await supabase
    .from("shopify_product_mappings")
    .select(
      "listing_id, shopify_product_gid, shopify_variant_gid, shopify_inventory_item_gid",
    )
    .eq("connection_id", connectionId)
    .eq("selected", true)
    .in("listing_id", listingIds)
  if (mappingError) throw new Error(mappingError.message)
  const byListing = new Map(
    (mappings ?? []).map((mapping) => [String(mapping.listing_id), mapping]),
  )
  const lines: SaleLine[] = []
  for (const item of items ?? []) {
    const mapping = byListing.get(String(item.listing_id))
    if (!mapping) continue
    const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1))
    const unitPrice = Math.round(Number(item.item_price) * 100) / 100
    lines.push({
      listingId: String(item.listing_id),
      productId: String(mapping.shopify_product_gid),
      variantId: String(mapping.shopify_variant_gid),
      inventoryItemId: String(mapping.shopify_inventory_item_gid),
      quantity,
      unitPrice,
    })
  }
  return lines
}

async function primaryLocationId(
  shopDomain: string,
  accessToken: string,
): Promise<string> {
  const data = await shopifyGraphqlRequest<{
    locations: { nodes: Array<{ id?: string | null; isActive?: boolean | null }> }
  }>({
    shopDomain,
    accessToken,
    query: `
      query ReswellPrimaryLocation {
        locations(first: 5) {
          nodes { id isActive }
        }
      }
    `,
  })
  const location = data.locations.nodes.find((node) => node.isActive !== false && node.id)
  if (!location?.id) throw new Error("Shopify shop has no active location")
  return location.id
}

async function createPaidShopifyOrder(input: {
  shopDomain: string
  accessToken: string
  orderId: string
  lines: SaleLine[]
}): Promise<string> {
  const total = input.lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  )
  const data = await shopifyGraphqlRequest<{
    orderCreate: {
      order?: { id?: string | null } | null
      userErrors: Array<{ field?: string[] | null; message?: string | null }>
    }
  }>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    idempotencyKey: shopifySaleIdempotencyKey(input.orderId),
    query: `
      mutation ReswellOrderCreate($order: OrderCreateOrderInput!, $options: OrderCreateOptionsInput) {
        orderCreate(order: $order, options: $options) {
          order { id }
          userErrors { field message }
        }
      }
    `,
    variables: {
      order: {
        currency: "USD",
        financialStatus: "PAID",
        tags: [SHOPIFY_ORDER_TAG],
        note: `Reswell order ${input.orderId}`,
        sourceIdentifier: input.orderId,
        customAttributes: [
          { key: RESWELL_ORDER_ATTRIBUTE, value: input.orderId },
        ],
        lineItems: input.lines.map((line) => ({
          variantId: line.variantId,
          quantity: line.quantity,
          priceSet: { shopMoney: money(line.unitPrice) },
        })),
        transactions: [
          {
            kind: "SALE",
            status: "SUCCESS",
            amountSet: { shopMoney: money(Math.round(total * 100) / 100) },
          },
        ],
      },
      options: {
        inventoryBehaviour: "DECREMENT_IGNORING_POLICY",
        sendReceipt: false,
        sendFulfillmentReceipt: false,
      },
    },
  })
  throwOnShopifyUserErrors(data.orderCreate.userErrors)
  const id = data.orderCreate.order?.id?.trim()
  if (!id) throw new Error("Shopify did not return an order")
  return id
}

async function zeroInventory(input: {
  shopDomain: string
  accessToken: string
  inventoryItemId: string
  locationId: string
}): Promise<void> {
  const inventory = await shopifyGraphqlRequest<{
    inventorySetQuantities: {
      userErrors: Array<{ field?: string[] | null; message?: string | null }>
    }
  }>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    query: `
      mutation ReswellZeroInventory($input: InventorySetQuantitiesInput!) {
        inventorySetQuantities(input: $input) {
          userErrors { field message }
        }
      }
    `,
    variables: {
      input: {
        name: "available",
        reason: "correction",
        quantities: [
          {
            inventoryItemId: input.inventoryItemId,
            locationId: input.locationId,
            quantity: 0,
          },
        ],
      },
    },
  })
  throwOnShopifyUserErrors(inventory.inventorySetQuantities.userErrors)
}

async function draftProduct(input: {
  shopDomain: string
  accessToken: string
  productId: string
}): Promise<void> {
  const status = await shopifyGraphqlRequest<{
    productChangeStatus: {
      userErrors: Array<{ field?: string[] | null; message?: string | null }>
    }
  }>({
    shopDomain: input.shopDomain,
    accessToken: input.accessToken,
    query: `
      mutation ReswellDraftProduct($productId: ID!) {
        productChangeStatus(productId: $productId, status: DRAFT) {
          userErrors { field message }
        }
      }
    `,
    variables: { productId: input.productId },
  })
  throwOnShopifyUserErrors(status.productChangeStatus.userErrors)
}

async function ensureSaleRecord(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  orderId: string
  collectVia: ShopifySaleCollectVia
  sourceOfTruth: ShopifySourceOfTruth
  lines: SaleLine[]
}): Promise<ShopifySaleRecord> {
  const existing = await dbGetShopifySaleRecord(
    input.serviceSupabase,
    input.orderId,
  )
  if (existing) return existing
  const itemPrice =
    Math.round(
      input.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) *
        100,
    ) / 100
  const usageAmount =
    input.collectVia === "shopify"
      ? input.lines.reduce(
          (sum, line) => sum + shopifyUsageAmountUsd(line.unitPrice * line.quantity),
          0,
        )
      : 0
  await dbInsertShopifySaleRecord(input.serviceSupabase, {
    orderId: input.orderId,
    connectionId: input.connection.id,
    sourceOfTruth: input.sourceOfTruth,
    collectVia: input.collectVia,
    itemPrice,
    usageAmount: Math.round(usageAmount * 100) / 100,
  })
  const record = await dbGetShopifySaleRecord(input.serviceSupabase, input.orderId)
  if (!record) throw new Error("Shopify sale record was not saved")
  return record
}

export async function pushReswellSaleToShopify(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  orderId: string
  collectVia: ShopifySaleCollectVia
  sourceOfTruth: ShopifySourceOfTruth
}): Promise<void> {
  const lines = await loadSaleLines(
    input.serviceSupabase,
    input.connection.id,
    input.orderId,
  )
  if (lines.length === 0) return
  const record = await ensureSaleRecord({ ...input, lines })
  if (record.status === "charged" || record.status === "skipped") return

  const accessToken = await getShopifyAccessToken(
    input.serviceSupabase,
    input.connection,
  )
  let status = record.status
  let orderGid = record.shopify_order_gid

  if (record.source_of_truth === "shopify" && !orderGid) {
    orderGid = await createPaidShopifyOrder({
      shopDomain: input.connection.shop_domain,
      accessToken,
      orderId: input.orderId,
      lines,
    })
    status = "ordered"
    await dbUpdateShopifySaleRecord(input.serviceSupabase, input.orderId, {
      status,
      shopifyOrderGid: orderGid,
    })
  }

  if (record.source_of_truth === "reswell" && status === "pending") {
    const locationId = await primaryLocationId(
      input.connection.shop_domain,
      accessToken,
    )
    const drafted = new Set<string>()
    for (const line of lines) {
      await zeroInventory({
        shopDomain: input.connection.shop_domain,
        accessToken,
        inventoryItemId: line.inventoryItemId,
        locationId,
      })
      if (drafted.has(line.productId)) continue
      drafted.add(line.productId)
      await draftProduct({
        shopDomain: input.connection.shop_domain,
        accessToken,
        productId: line.productId,
      })
    }
    status = "adjusted"
    await dbUpdateShopifySaleRecord(input.serviceSupabase, input.orderId, {
      status,
    })
  }

  if (record.collect_via === "stripe") {
    await dbUpdateShopifySaleRecord(input.serviceSupabase, input.orderId, {
      status: "skipped",
    })
    return
  }

  if (record.usage_record_gid) {
    await dbUpdateShopifySaleRecord(input.serviceSupabase, input.orderId, {
      status: "charged",
    })
    return
  }
  if (Number(record.usage_amount) <= 0) {
    await dbUpdateShopifySaleRecord(input.serviceSupabase, input.orderId, {
      status: "charged",
    })
    return
  }
  const lineItemId = input.connection.billing_line_item_gid
  if (!lineItemId) throw new ShopifyBillingRequiredError()
  const usageId = await createShopifyUsageRecord({
    shopDomain: input.connection.shop_domain,
    accessToken,
    subscriptionLineItemId: lineItemId,
    orderId: input.orderId,
    amountUsd: Number(record.usage_amount),
  })
  await dbUpdateShopifySaleRecord(input.serviceSupabase, input.orderId, {
    status: "charged",
    usageRecordGid: usageId,
  })
}

export async function applyShopifyOriginatedSale(input: {
  serviceSupabase: SupabaseClient
  connection: ShopifyConnectionRow
  payload: Record<string, unknown>
}): Promise<void> {
  const tags = typeof input.payload.tags === "string" ? input.payload.tags : null
  const note = typeof input.payload.note === "string" ? input.payload.note : null
  const noteAttributes = Array.isArray(input.payload.note_attributes)
    ? input.payload.note_attributes.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return []
        const record = entry as { name?: unknown; value?: unknown }
        return [
          {
            name: typeof record.name === "string" ? record.name : null,
            value: typeof record.value === "string" ? record.value : null,
          },
        ]
      })
    : []
  if (isReswellOriginatedShopifyOrder({ tags, note, noteAttributes })) return

  const lineItems = Array.isArray(input.payload.line_items)
    ? input.payload.line_items
    : []
  for (const item of lineItems) {
    if (!item || typeof item !== "object") continue
    const variantRaw = (item as { variant_id?: unknown }).variant_id
    const variantId =
      typeof variantRaw === "number" ||
      (typeof variantRaw === "string" && /^\d+$/.test(variantRaw))
        ? `gid://shopify/ProductVariant/${variantRaw}`
        : null
    if (!variantId) continue
    const { data, error } = await input.serviceSupabase
      .from("shopify_product_mappings")
      .select("id, listing_id, shopify_inventory_item_gid")
      .eq("connection_id", input.connection.id)
      .eq("shopify_variant_gid", variantId)
      .eq("selected", true)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) continue
    if (input.connection.source_of_truth === "reswell") {
      const { error: listingError } = await input.serviceSupabase
        .from("listings")
        .update(listingSoldViaCheckoutUpdate())
        .eq("id", data.listing_id)
        .eq("inventory_source", "reswell")
      if (listingError) throw new Error(listingError.message)
      continue
    }
    await dbEnqueueShopifyJob(input.serviceSupabase, {
      connectionId: input.connection.id,
      jobType: "inventory_sync",
      payload: { inventoryItemId: data.shopify_inventory_item_gid },
      dedupeKey: `inventory:${input.connection.id}:${data.shopify_inventory_item_gid}`,
    })
  }
}
