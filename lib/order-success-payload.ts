import type { SupabaseClient } from "@supabase/supabase-js"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { capitalizeWords, formatCategory, formatCondition } from "@/lib/listing-labels"
import type { CheckoutOrderSuccessPayload } from "@/components/checkout-order-success"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

type ShippingAddressJson = {
  name?: string | null
  phone?: string | null
  email?: string | null
  address?: {
    line1?: string | null
    line2?: string | null
    city?: string | null
    state?: string | null
    postal_code?: string | null
    country?: string | null
  } | null
} | null

function primaryImage(images: Array<{ url: string; is_primary: boolean | null }> | null | undefined) {
  if (!images?.length) return null
  const primary = images.find((i) => i.is_primary)
  return (primary ?? images[0]).url
}

function formatAddressLines(addr: NonNullable<ShippingAddressJson>["address"]) {
  if (!addr) return null
  const line1 = [addr.line1, addr.line2].filter(Boolean).join(", ")
  const cityLine = [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")
  const parts = [line1, cityLine, addr.country].filter((p): p is string => Boolean(p && String(p).trim()))
  return parts.length ? parts : null
}

type SuccessListingEmbed = {
  id: string
  title: string | null
  slug?: string | null
  section: string
  condition?: string | null
  price: string | number
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: string | number | null
  listing_images: Array<{ url: string; is_primary: boolean | null }> | null
}

type OrderSuccessOrderRow = {
  id: string
  order_num: string | null
  amount: number | string
  shipping_amount: number | string | null
  created_at: string
  fulfillment_method: string | null
  pickup_code: string | null
  seller_id: string | null
  shipping_address: ShippingAddressJson
  listings:
    | SuccessListingEmbed
    | SuccessListingEmbed[]
    | null
  order_items?:
    | Array<{
        sort_order: number | null
        listings: SuccessListingEmbed | SuccessListingEmbed[] | null
      }>
    | null
}

function listingFromRelation(raw: SuccessListingEmbed | SuccessListingEmbed[] | null | undefined): SuccessListingEmbed | null {
  if (!raw) return null
  return Array.isArray(raw) ? raw[0] ?? null : raw
}

function mapOrderRowToCheckoutPayload(
  order: OrderSuccessOrderRow,
  buyerEmail: string | null | undefined,
): CheckoutOrderSuccessPayload {
  const rawItems = order.order_items
  const itemRows = Array.isArray(rawItems)
    ? [...rawItems].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    : []

  const linesFromItems: CheckoutOrderSuccessPayload["orderLines"] = []
  for (const row of itemRows) {
    const listing = listingFromRelation(row.listings)
    if (!listing) continue
    const title = listing.title ? capitalizeWords(listing.title) : "Item"
    const conditionLabel = listing.condition ? formatCondition(listing.condition) : null
    linesFromItems.push({
      listingId: listing.id,
      title,
      imageUrl: primaryImage(listing.listing_images),
      subtitle: conditionLabel,
      categoryLabel: formatCategory(listing.section)?.trim() || null,
    })
  }

  const fallbackListing = listingFromRelation(order.listings)

  const orderLines: CheckoutOrderSuccessPayload["orderLines"] =
    linesFromItems.length > 0
      ? linesFromItems
      : fallbackListing
        ? [
            {
              listingId: fallbackListing.id,
              title: fallbackListing.title ? capitalizeWords(fallbackListing.title) : "Item",
              imageUrl: primaryImage(fallbackListing.listing_images),
              subtitle: fallbackListing.condition ? formatCondition(fallbackListing.condition) : null,
              categoryLabel: formatCategory(fallbackListing.section)?.trim() || null,
            },
          ]
        : []

  const primaryListing =
    fallbackListing ?? (itemRows.length > 0 ? listingFromRelation(itemRows[0]?.listings) : null)

  const total = Number(order.amount)
  const fulfillment = order.fulfillment_method === "shipping" || order.fulfillment_method === "pickup"
    ? order.fulfillment_method
    : null

  let itemPrice = total
  let shippingCost = 0
  const storedShipping = Math.max(
    0,
    Math.round((Number(order.shipping_amount ?? 0) || 0) * 100) / 100,
  )
  if (storedShipping > 0 && storedShipping <= total) {
    shippingCost = storedShipping
    itemPrice = Math.round((total - shippingCost) * 100) / 100
  } else if (primaryListing) {
    const resolved = resolvePayableAmount(
      {
        price: primaryListing.price,
        section: primaryListing.section,
        shipping_available: primaryListing.shipping_available,
        local_pickup: primaryListing.local_pickup,
        shipping_price: primaryListing.shipping_price,
      },
      fulfillment,
    )
    if (resolved.ok && Math.abs(resolved.total - total) < 0.02) {
      itemPrice = resolved.itemPrice
      shippingCost = resolved.shipping
    }
  }

  const displayNumber = formatOrderNumForCustomer(order.order_num, order.id)

  const ship = order.shipping_address
  const addr = ship?.address
  const addressLines = addr ? formatAddressLines(addr) : null
  const shippingOneLine = addressLines
    ? [ship?.name, addressLines.join(", ")].filter(Boolean).join(", ")
    : null

  const pickupCode =
    fulfillment === "pickup" && typeof order.pickup_code === "string" && order.pickup_code.trim()
      ? order.pickup_code.trim()
      : null

  const listingIdForLinks = orderLines[0]?.listingId ?? fallbackListing?.id ?? null

  return {
    orderId: order.id,
    displayNumber,
    buyerEmail: buyerEmail?.trim() ?? null,
    total,
    itemPrice,
    shippingCost,
    fulfillmentMethod: fulfillment,
    pickupCode,
    sellerId: order.seller_id?.trim() ? order.seller_id : null,
    listingId: listingIdForLinks,
    orderLines,
    shipping: ship
      ? {
          oneLine: shippingOneLine,
          name: ship.name ?? null,
          addressLines,
          email: ship.email ?? null,
        }
      : null,
  }
}

/**
 * Loads marketplace order data for the purchase success UI (buyer-only).
 * Returns null if the order does not exist or does not belong to this buyer.
 */
export async function fetchBuyerOrderSuccessPayload(
  supabase: SupabaseClient,
  buyerId: string,
  buyerEmail: string | null | undefined,
  orderId: string,
): Promise<CheckoutOrderSuccessPayload | null> {
  const trimmed = orderId.trim()
  if (!trimmed) return null

  const { data: row, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      amount,
      shipping_amount,
      created_at,
      fulfillment_method,
      pickup_code,
      seller_id,
      shipping_address,
      listings (
        id,
        title,
        slug,
        section,
        condition,
        price,
        shipping_available,
        local_pickup,
        shipping_price,
        listing_images ( url, is_primary )
      ),
      order_items (
        sort_order,
        listings (
          id,
          title,
          slug,
          section,
          condition,
          price,
          shipping_available,
          local_pickup,
          shipping_price,
          listing_images ( url, is_primary )
        )
      )
    `,
    )
    .eq("id", trimmed)
    .eq("buyer_id", buyerId)
    .maybeSingle()

  if (error || !row) {
    return null
  }

  return mapOrderRowToCheckoutPayload(row as unknown as OrderSuccessOrderRow, buyerEmail)
}
