/**
 * Server-only: Klaviyo Events API — fires when an in-store POS sale completes for a captured customer.
 *
 * **Metric name in Klaviyo:** `POS Receipt` — use as the flow trigger (Flows → Metric) to email the
 * customer their receipt. Template variables: `{{ event.receipt_url }}`, `{{ event.Title }}`,
 * `{{ event.store_name }}`, `{{ event.amount }}`, `{{ event.create_account_url }}`.
 *
 * Profile on the event is the **walk-in customer** (email + name from the store customer record).
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

export type KlaviyoPosReceiptPayload = {
  orderId: string
  customerEmail: string
  customerFirstName: string | null
  customerLastName: string | null
  storeName: string
  listingTitle: string
  amountUsd: number
  receiptUrl: string
}

export async function trackKlaviyoPosReceipt(payload: KlaviyoPosReceiptPayload): Promise<void> {
  const origin = publicSiteOrigin()
  const createAccountUrl = `${origin}/auth/sign-up?email=${encodeURIComponent(payload.customerEmail)}`

  await sendKlaviyoServerEvent({
    metricName: "POS Receipt",
    profile: {
      email: payload.customerEmail,
    },
    uniqueId: `pos-receipt-${payload.orderId}`,
    value: Number.isFinite(payload.amountUsd) ? payload.amountUsd : undefined,
    valueCurrency: "USD",
    properties: {
      order_id: payload.orderId,
      Title: payload.listingTitle,
      store_name: payload.storeName,
      amount: payload.amountUsd,
      receipt_url: payload.receiptUrl,
      create_account_url: createAccountUrl,
      first_name: payload.customerFirstName ?? "",
      last_name: payload.customerLastName ?? "",
    },
  })
}
