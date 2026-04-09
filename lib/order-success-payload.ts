import type { SupabaseClient } from "@supabase/supabase-js"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { capitalizeWords, formatCategory, formatCondition } from "@/lib/listing-labels"
import type { CheckoutOrderSuccessPayload } from "@/components/checkout-order-success"

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
  const parts = [line1, cityLine, addr.country].filter((p) => p && String(p).trim())
  return parts.length ? parts : null
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
      created_at,
      fulfillment_method,
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
      )
    `,
    )
    .eq("id", trimmed)
    .eq("buyer_id", buyerId)
    .maybeSingle()

  if (error || !row) {
    return null
  }

  const order = row as {
    id: string
    order_num: string | null
    amount: number | string
    created_at: string
    fulfillment_method: string | null
    shipping_address: ShippingAddressJson
    listings:
      | {
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
      | Array<{
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
        }>
      | null
  }

  const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings
  const total = Number(order.amount)
  const fulfillment = order.fulfillment_method === "shipping" || order.fulfillment_method === "pickup"
    ? order.fulfillment_method
    : null

  let itemPrice = total
  let shippingCost = 0
  if (listing) {
    const resolved = resolvePayableAmount(
      {
        price: listing.price,
        section: listing.section,
        shipping_available: listing.shipping_available,
        local_pickup: listing.local_pickup,
        shipping_price: listing.shipping_price,
      },
      fulfillment,
    )
    if (resolved.ok && Math.abs(resolved.total - total) < 0.02) {
      itemPrice = resolved.itemPrice
      shippingCost = resolved.shipping
    }
  }

  const created = new Date(order.created_at)
  const year = created.getFullYear()
  const shortId = order.id.replace(/-/g, "").slice(0, 8).toUpperCase()
  const displayNumber =
    order.order_num && order.order_num.trim()
      ? `ORD-${order.order_num.trim()}`
      : `ORD-${year}-${shortId}`

  const ship = order.shipping_address
  const addr = ship?.address
  const addressLines = addr ? formatAddressLines(addr) : null
  const shippingOneLine = addressLines
    ? [ship?.name, addressLines.join(", ")].filter(Boolean).join(", ")
    : null

  const title = listing?.title ? capitalizeWords(listing.title) : "Item"
  const conditionLabel = listing?.condition ? formatCondition(listing.condition) : null

  return {
    orderId: order.id,
    displayNumber,
    buyerEmail: buyerEmail?.trim() ?? null,
    total,
    itemPrice,
    shippingCost,
    fulfillmentMethod: fulfillment,
    listing: listing
      ? {
          title,
          imageUrl: primaryImage(listing.listing_images),
          subtitle: conditionLabel,
          categoryLabel: formatCategory(listing.section)?.trim() || null,
        }
      : null,
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
