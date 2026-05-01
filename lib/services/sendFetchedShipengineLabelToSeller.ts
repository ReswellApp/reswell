import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { resolveOrderIdForAdminShipengineLabel } from "@/lib/db/adminShippingOrderResolve"
import { attachAdminShippingLabelToOrder } from "@/lib/services/adminOrderShippingLabelNotify"
import {
  fetchLabelById,
  fetchLabelDownloadsForShipment,
} from "@/lib/shipengine/label-lookup"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"

const MAX_BYTES = 15 * 1024 * 1024

function isLikelyPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-"
}

export async function sendFetchedShipengineLabelPdfToSeller(params: {
  supabase: SupabaseClient
  adminUserId: string
  shipmentId?: string
  labelId?: string
  explicitOrderId?: string | null
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  let fetched:
    | Awaited<ReturnType<typeof fetchLabelById>>
    | Awaited<ReturnType<typeof fetchLabelDownloadsForShipment>>

  if (params.labelId) {
    fetched = await fetchLabelById(params.labelId)
  } else if (params.shipmentId) {
    fetched = await fetchLabelDownloadsForShipment(params.shipmentId)
  } else {
    return { ok: false, error: "Missing shipment_id or label_id", status: 400 }
  }

  if (!fetched.ok) {
    return { ok: false, error: fetched.error, status: fetched.status }
  }

  const label = fetched.label

  if (label.voided) {
    return { ok: false, error: "This label is voided — do not send it to the seller.", status: 400 }
  }

  const pdfUrl = label.downloads.pdf?.trim() || null
  if (!pdfUrl) {
    return {
      ok: false,
      error:
        "No PDF URL from ShipEngine yet (try again when status is completed), or open Combined/PDF in ShipEngine.",
      status: 422,
    }
  }

  const resolved = await resolveOrderIdForAdminShipengineLabel({
    supabase: params.supabase,
    explicitOrderId: params.explicitOrderId?.trim() || null,
    trackingNumber: label.tracking_number,
  })

  if (!resolved.ok) {
    return { ok: false, error: resolved.error, status: resolved.status }
  }

  const orderId = resolved.orderId

  const { data: order, error: ordErr } = await params.supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      buyer_id,
      seller_id,
      listing_id,
      fulfillment_method,
      delivery_status,
      listings (
        ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (ordErr || !order) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  const o = order as unknown as {
    order_num: string | null
    buyer_id: string
    seller_id: string
    listing_id: string
    fulfillment_method: string | null
    delivery_status: string
    listings: Record<string, unknown> | Record<string, unknown>[] | null
  }

  if (o.fulfillment_method !== "shipping") {
    return { ok: false, error: "Order is not a shipping order", status: 400 }
  }
  if (o.delivery_status !== "pending") {
    return {
      ok: false,
      error: "Order is not awaiting shipment — label delivery is for pending shipments only.",
      status: 409,
    }
  }

  const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings
  if (!listing || (listing as { section?: string }).section !== "surfboards") {
    return { ok: false, error: "Labels are for surfboard shipping orders only.", status: 400 }
  }

  const listingTitle =
    typeof (listing as { title?: string }).title === "string"
      ? (listing as { title: string }).title.trim() || "Item"
      : "Item"

  let pdfRes: Response
  try {
    pdfRes = await fetch(pdfUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "application/pdf,*/*" },
    })
  } catch (e) {
    console.error("[sendFetchedShipengineLabelPdfToSeller] fetch pdf:", e)
    return {
      ok: false,
      error: "Could not download PDF from ShipEngine (link may have expired — fetch again).",
      status: 502,
    }
  }

  if (!pdfRes.ok) {
    return {
      ok: false,
      error: `ShipEngine PDF download failed (${pdfRes.status}). Fetch fresh links and try again.`,
      status: 502,
    }
  }

  const buf = Buffer.from(await pdfRes.arrayBuffer())
  if (buf.length > MAX_BYTES) {
    return { ok: false, error: "PDF too large (max 15 MB)", status: 400 }
  }
  if (!isLikelyPdf(buf)) {
    return {
      ok: false,
      error: "Download was not a PDF — try fetching label URLs again from ShipEngine.",
      status: 422,
    }
  }

  const path = `${orderId}/${randomUUID()}.pdf`

  const { error: upErr } = await params.supabase.storage.from("order-shipping-labels").upload(path, buf, {
    contentType: "application/pdf",
    upsert: false,
  })

  if (upErr) {
    console.error("[sendFetchedShipengineLabelPdfToSeller] storage:", upErr)
    return { ok: false, error: "Could not store PDF", status: 500 }
  }

  const attached = await attachAdminShippingLabelToOrder({
    supabase: params.supabase,
    adminUserId: params.adminUserId,
    order: {
      id: orderId,
      buyer_id: o.buyer_id,
      seller_id: o.seller_id,
      listing_id: o.listing_id,
    },
    listingTitle,
    displayOrderNum: formatOrderNumForCustomer(o.order_num, orderId),
    source: "manual_label_upload",
    labelPdfUrl: null,
    labelStoragePath: path,
    trackingNumber: label.tracking_number,
    trackingCarrier: label.carrier_code,
    shipengineRateId: null,
  })

  if (!attached.ok) {
    return { ok: false, error: attached.error, status: attached.status }
  }

  return { ok: true }
}
