import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStoreStaffRole } from "@/lib/db/consignmentStores"
import { captureStoreCustomer } from "@/lib/services/storeCustomers"
import { signPosReceiptToken } from "@/lib/services/posReceiptToken"
import { trackKlaviyoPosReceipt } from "@/lib/klaviyo/track-pos-receipt"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import type { StoreCustomerCaptureInput } from "@/lib/validations/consignment"

export type SendPosReceiptEmailResult =
  | { ok: true; customerEmail: string }
  | { ok: false; error: string }

type OrderReceiptRow = {
  id: string
  amount: number | string
  sales_channel: string | null
  consignment_store_id: string | null
  store_customer_id: string | null
  listings: { title: string | null } | null
  consignment_stores: { name: string } | null
  store_customers: {
    email: string
    first_name: string | null
    last_name: string | null
  } | null
}

/**
 * Sends the Klaviyo "POS Receipt" email for a settled in-store order. Requires a linked
 * `store_customers` row with an email address.
 */
export async function sendPosReceiptEmailForOrder(
  service: SupabaseClient,
  orderId: string,
): Promise<SendPosReceiptEmailResult> {
  const { data, error } = await service
    .from("orders")
    .select(
      "id, amount, sales_channel, consignment_store_id, store_customer_id, listings (title), consignment_stores (name), store_customers (email, first_name, last_name)",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: "Order not found." }
  }

  const order = data as unknown as OrderReceiptRow
  if (order.sales_channel !== "pos") {
    return { ok: false, error: "Receipt email is only available for in-store sales." }
  }

  const email = order.store_customers?.email?.trim()
  if (!email) {
    return { ok: false, error: "Add a customer email before sending a receipt." }
  }

  const token = signPosReceiptToken(orderId)
  if (!token) {
    return { ok: false, error: "Receipt email is not configured." }
  }

  const receiptUrl = `${publicSiteOrigin()}/receipt/${token}`
  const amountUsd = Number(order.amount)

  await trackKlaviyoPosReceipt({
    orderId,
    customerEmail: email,
    customerFirstName: order.store_customers?.first_name ?? null,
    customerLastName: order.store_customers?.last_name ?? null,
    storeName: order.consignment_stores?.name ?? "your shop",
    listingTitle: order.listings?.title ?? "your purchase",
    amountUsd: Number.isFinite(amountUsd) ? amountUsd : 0,
    receiptUrl,
  })

  return { ok: true, customerEmail: email }
}

export type EmailPosReceiptForOrderResult =
  | { ok: true; customerEmail: string }
  | { ok: false; error: string; status: number }

/**
 * Staff action: save/update the walk-in customer on the shop's private list, link them to the
 * POS order if needed, then email the receipt. Shop-scoped via store staff checks.
 */
export async function emailPosReceiptForOrder(
  staffProfileId: string,
  orderId: string,
  customer?: Omit<StoreCustomerCaptureInput, "storeId">,
): Promise<EmailPosReceiptForOrderResult> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const { data: orderRaw, error: orderErr } = await service
    .from("orders")
    .select("id, sales_channel, consignment_store_id, store_customer_id")
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !orderRaw) {
    return { ok: false, error: "Order not found.", status: 404 }
  }

  const order = orderRaw as {
    id: string
    sales_channel: string | null
    consignment_store_id: string | null
    store_customer_id: string | null
  }

  if (order.sales_channel !== "pos" || !order.consignment_store_id) {
    return { ok: false, error: "Receipt email is only available for in-store sales.", status: 400 }
  }

  const role = await getStoreStaffRole(service, order.consignment_store_id, staffProfileId)
  if (!role) {
    return { ok: false, error: "Forbidden", status: 403 }
  }

  if (customer?.email && customer.firstName) {
    const captured = await captureStoreCustomer(staffProfileId, {
      storeId: order.consignment_store_id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phoneE164: customer.phoneE164,
    })
    if (!captured.ok) {
      return { ok: false, error: captured.error, status: captured.status }
    }
    if (!order.store_customer_id) {
      await service
        .from("orders")
        .update({ store_customer_id: captured.customerId })
        .eq("id", orderId)
    }
  }

  const sent = await sendPosReceiptEmailForOrder(service, orderId)
  if (!sent.ok) {
    return { ok: false, error: sent.error, status: 400 }
  }

  return { ok: true, customerEmail: sent.customerEmail }
}
