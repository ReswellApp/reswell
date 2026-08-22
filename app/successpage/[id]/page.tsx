import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { privatePageMetadata } from "@/lib/site-metadata"
import { createClient } from "@/lib/supabase/server"
import { fetchBuyerOrderSuccessPayload } from "@/lib/order-success-payload"
import { CheckoutOrderSuccess } from "@/components/checkout-order-success"
import { CheckoutOrderSuccessPickup } from "@/components/checkout-order-success-pickup"
import { GooglePurchaseConversionScript } from "@/components/google-ads/google-purchase-conversion-script"
import { StripPurchaseConversionParam } from "@/components/google-ads/strip-purchase-conversion-param"
import { GooglePurchaseEventScript } from "@/components/google-analytics/google-purchase-event-script"
import { MetaPurchaseEventScript } from "@/components/meta/meta-purchase-event-script"
import { getPostHogServerClient } from "@/lib/posthog-server"
import {
  buildOrderSuccessPath,
  searchParamsReportPurchaseConversion,
} from "@/lib/google-ads/purchase-success-path"

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const { id } = await props.params
  return privatePageMetadata({
    title: "Order confirmation — Reswell",
    description:
      "Receipt, pickup or shipping details, and messaging for your completed Reswell purchase.",
    path: `/successpage/${id}`,
  })
}

/**
 * Post-purchase confirmation: loads the order by Supabase `orders.id` for the signed-in buyer.
 */
export default async function PurchaseSuccessPage(props: PageProps) {
  const { id } = await props.params
  const searchParams = await props.searchParams
  if (!id?.trim()) {
    notFound()
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const fromCheckout = searchParamsReportPurchaseConversion(searchParams)
  const successPath = fromCheckout
    ? buildOrderSuccessPath(id.trim(), { reportPurchase: true })
    : buildOrderSuccessPath(id.trim())

  if (!user) {
    redirect(`/auth/login?redirect=${encodeURIComponent(successPath)}`)
  }

  const payload = await fetchBuyerOrderSuccessPayload(supabase, user.id, user.email, id)
  if (!payload) {
    notFound()
  }

  const firePurchasePixels = fromCheckout && payload.reportAdPurchaseConversion

  if (firePurchasePixels) {
    const posthog = getPostHogServerClient()
    if (posthog) {
      posthog.capture({
        distinctId: user.id,
        event: "purchase_completed",
        properties: {
          order_id: payload.orderId,
          total_amount: payload.total,
          item_price: payload.itemPrice,
          shipping_cost: payload.shippingCost,
          fulfillment_method: payload.fulfillmentMethod,
          item_count: payload.orderLines.length,
          listing_ids: payload.orderLines.map((l) => l.listingId).filter(Boolean),
          categories: [...new Set(payload.orderLines.map((l) => l.categoryLabel).filter(Boolean))],
        },
      })
      await posthog.flush()
    }
  }

  const conversionTracking = firePurchasePixels ? (
    <>
      <StripPurchaseConversionParam />
      <GooglePurchaseConversionScript orderId={payload.orderId} value={payload.total} />
      <GooglePurchaseEventScript
        orderId={payload.orderId}
        value={payload.itemPrice}
        shipping={payload.shippingCost}
        items={payload.orderLines.map((line) => ({
          itemId: line.listingId,
          itemName: line.title,
          itemCategory: line.categoryLabel,
          price: line.itemPrice,
          quantity: line.quantity,
        }))}
      />
      <MetaPurchaseEventScript
        orderId={payload.orderId}
        value={payload.total}
        contentIds={payload.orderLines
          .map((line) => line.listingId)
          .filter((id): id is string => Boolean(id))}
      />
    </>
  ) : fromCheckout ? (
    <StripPurchaseConversionParam />
  ) : null

  if (payload.fulfillmentMethod === "pickup") {
    return (
      <>
        {conversionTracking}
        <CheckoutOrderSuccessPickup data={payload} />
      </>
    )
  }

  return (
    <>
      {conversionTracking}
      <CheckoutOrderSuccess data={payload} />
    </>
  )
}
