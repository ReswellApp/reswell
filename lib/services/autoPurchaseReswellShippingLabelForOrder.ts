import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  recordOrderShippingLabelFailure,
  resolveOpenOrderShippingLabelFailures,
  type OrderShippingLabelFailureStage,
} from "@/lib/db/orderShippingLabelFailures"
import { getLatestAdminLabelUrlsForOrder } from "@/lib/db/adminOrderShippingLabels"
import { getLatestOrderShippingLabelUrlsForOrder } from "@/lib/db/orderShippingLabels"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import { attachOrderShippingLabel } from "@/lib/services/attachOrderShippingLabel"
import { autoDispatchOrderIfTrackingReady } from "@/lib/services/markOrderShipped"
import { purchaseLabelWithRateId } from "@/lib/services/orderShippingLabel"
import {
  effectiveBoardShippingMode,
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"
import { getCheapestReswellRateForListing } from "@/lib/services/reswellListingShippingRate"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  orderShippingJsonToRateQuoteAddress,
  rateQuoteFieldsToShippingInput,
} from "@/lib/shipping/rate-address"

const MAX_PDF_BYTES = 15 * 1024 * 1024

function isLikelyPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-"
}

async function downloadAndStoreLabelPdf(params: {
  supabase: SupabaseClient
  orderId: string
  pdfUrl: string
}): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  let pdfRes: Response
  try {
    pdfRes = await fetch(params.pdfUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "application/pdf,*/*" },
    })
  } catch (e) {
    console.error("[autoPurchaseReswellShippingLabelForOrder] fetch pdf:", e)
    return { ok: false, error: "Could not download label PDF from ShipEngine." }
  }

  if (!pdfRes.ok) {
    return {
      ok: false,
      error: `ShipEngine PDF download failed (${pdfRes.status}).`,
    }
  }

  const buf = Buffer.from(await pdfRes.arrayBuffer())
  if (buf.length > MAX_PDF_BYTES) {
    return { ok: false, error: "Label PDF too large (max 15 MB)." }
  }
  if (!isLikelyPdf(buf)) {
    return { ok: false, error: "ShipEngine download was not a PDF." }
  }

  const storagePath = `${params.orderId}/${randomUUID()}.pdf`
  const { error: upErr } = await params.supabase.storage
    .from("order-shipping-labels")
    .upload(storagePath, buf, {
      contentType: "application/pdf",
      upsert: false,
    })

  if (upErr) {
    console.error("[autoPurchaseReswellShippingLabelForOrder] storage:", upErr)
    return { ok: false, error: "Could not store label PDF." }
  }

  return { ok: true, storagePath }
}

async function orderAlreadyHasPreparedLabel(
  supabase: SupabaseClient,
  orderId: string,
): Promise<boolean> {
  const [marketplace, admin] = await Promise.all([
    getLatestOrderShippingLabelUrlsForOrder(supabase, orderId),
    getLatestAdminLabelUrlsForOrder(supabase, orderId),
  ])
  return Boolean(
    marketplace?.label_pdf_url ||
      marketplace?.label_storage_path ||
      admin?.label_pdf_url ||
      admin?.label_storage_path,
  )
}

/**
 * After a peer surfboard order with Reswell-calculated shipping, purchase the cheapest
 * ShipEngine label, store the PDF in order_shipping_labels, and expose it on the seller sale page.
 *
 * Safe to call multiple times — skips when a label already exists.
 * Failures are logged only; order completion must not depend on this.
 */
export async function autoPurchaseReswellShippingLabelForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const tag = `[autoPurchaseReswellShippingLabelForOrder:${orderId}]`

  const fail = async (stage: OrderShippingLabelFailureStage, errorMessage: string) => {
    console.error(`${tag} ${stage}:`, errorMessage)
    await recordOrderShippingLabelFailure(supabase, { orderId, stage, errorMessage })
  }

  if (!isShipEngineConfigured()) {
    await fail(
      "shipengine_not_configured",
      "ShipEngine is not configured (missing SHIPENGINE_API_KEY). Set the key and create the label manually.",
    )
    return
  }

  if (await orderAlreadyHasPreparedLabel(supabase, orderId)) {
    await resolveOpenOrderShippingLabelFailures(supabase, orderId)
    return
  }

  const { data: order, error: orderErr } = await supabase
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
      shipping_address,
      listings (
        ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT}
      )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    console.error(`${tag} order load:`, orderErr?.message ?? "not found")
    return
  }

  const o = order as unknown as {
    id: string
    order_num: string | null
    buyer_id: string
    seller_id: string
    listing_id: string
    fulfillment_method: string | null
    delivery_status: string
    shipping_address: unknown
    listings: Record<string, unknown> | Record<string, unknown>[] | null
  }

  if (o.fulfillment_method !== "shipping") return
  if (o.delivery_status !== "pending") return

  const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings
  if (!listing || (listing as { section?: string }).section !== "surfboards") return

  const listingForQuote = listing as unknown as PeerListingForShippingQuote
  if (effectiveBoardShippingMode(listingForQuote) !== "reswell") return

  const shipToFields = orderShippingJsonToRateQuoteAddress(o.shipping_address)
  if (!shipToFields) {
    await fail(
      "incomplete_address",
      "This order does not have a complete buyer shipping address. Add the address on the order, then create the label manually.",
    )
    return
  }
  const shipTo = rateQuoteFieldsToShippingInput(shipToFields)

  const sellerShipFromName = await fetchSellerShipFromLabelName(supabase, o.seller_id)
  const quoted = await getCheapestReswellRateForListing({
    listing: listingForQuote,
    shipTo,
    diagnosticTag: `auto-reswell-label:${o.id}`,
    sellerShipFromName,
  })

  if (!quoted.ok) {
    await fail("rate_quote", quoted.error)
    return
  }

  const rateId = quoted.cheapest.rate_id
  if (!rateId) {
    await fail("rate_id", "ShipEngine returned no purchasable rate id for this shipment.")
    return
  }

  const purchased = await purchaseLabelWithRateId(rateId)
  if (!purchased.ok) {
    await fail("label_purchase", purchased.error)
    return
  }

  let labelPdfUrl: string | null = purchased.result.labelUrl
  let labelStoragePath: string | null = null

  if (labelPdfUrl) {
    const stored = await downloadAndStoreLabelPdf({
      supabase,
      orderId: o.id,
      pdfUrl: labelPdfUrl,
    })
    if (stored.ok) {
      labelStoragePath = stored.storagePath
      labelPdfUrl = null
    } else {
      console.warn(`${tag} PDF storage failed (${stored.error}); keeping ShipEngine URL.`)
    }
  }

  const attached = await attachOrderShippingLabel({
    supabase,
    orderId: o.id,
    origin: "auto_reswell_checkout",
    labelPdfUrl,
    labelStoragePath,
    trackingNumber: purchased.result.trackingNumber,
    trackingCarrier: purchased.result.trackingCarrier,
    shipengineRateId: rateId,
  })

  if (!attached.ok) {
    await fail("attach_label", attached.error)
    return
  }

  // Match manual tracking save: pending + tracking must become `shipped` so the 7-day
  // unshipped auto-cancel job does not refund buyers after a label was purchased.
  await autoDispatchOrderIfTrackingReady(supabase, o.id, o.seller_id)

  console.info(`${tag} label attached for seller sale page.`)
}
