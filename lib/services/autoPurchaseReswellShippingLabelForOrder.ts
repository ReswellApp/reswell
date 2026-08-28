import type { SupabaseClient } from "@supabase/supabase-js"
import {
  recordOrderShippingLabelFailure,
  resolveOpenOrderShippingLabelFailures,
  type OrderShippingLabelFailureStage,
} from "@/lib/db/orderShippingLabelFailures"
import { getLatestAdminLabelUrlsForOrder } from "@/lib/db/adminOrderShippingLabels"
import { getLatestOrderShippingLabelUrlsForOrder } from "@/lib/db/orderShippingLabels"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import {
  listOrderShipmentsWithItems,
  type OrderShipmentWithItems,
} from "@/lib/db/orderShipments"
import { attachOrderShippingLabel } from "@/lib/services/attachOrderShippingLabel"
import { ensureReswellShippingLabelReadyThreadNotification } from "@/lib/services/postReswellShippingLabelReadyNotification"
import { resolveOrderLabelParcelFromListings } from "@/lib/services/orderShippingLabel"
import type { ListingPackedParcelSource } from "@/lib/reswell-packed-parcel-from-listing"
import { logPackBandLabelTelemetry } from "@/lib/shipping/pack-band-telemetry"
import { purchaseShipEngineLabelForOrderOnce } from "@/lib/services/purchaseShipEngineLabelForOrderOnce"
import {
  downloadAndStoreLabelPdf,
  downloadAndStorePaperlessQr,
} from "@/lib/services/storeOrderShippingLabelAssets"
import {
  effectiveBoardShippingMode,
  PEER_SURFBOARD_CHECKOUT_LISTING_SELECT,
  type PeerListingForShippingQuote,
} from "@/lib/services/peerListingShippingQuote"
import { getCheapestReswellRateForListings } from "@/lib/services/reswellListingShippingRate"
import { getStripe } from "@/lib/stripe-server"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import {
  orderShippingJsonToRateQuoteAddress,
  rateQuoteFieldsToShippingInput,
} from "@/lib/shipping/rate-address"
import { TOGETHER_PACKAGE_KEY } from "@/lib/shipping/packaging-mode"
import type { CheckoutShippingPackageRate } from "@/lib/services/checkoutShippingQuoteToken"
import { insertOrderShipmentsForOrder } from "@/lib/db/orderShipments"
import {
  DEFAULT_SHIPPING_PACKAGING_MODE,
  resolveShippingPackagingMode,
} from "@/lib/shipping/packaging-mode"

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

function parsePackageRatesFromPiMeta(raw: string | null | undefined): CheckoutShippingPackageRate[] {
  const text = raw?.trim()
  if (!text) return []
  try {
    const parsed = JSON.parse(text) as unknown
    if (!Array.isArray(parsed)) return []
    const out: CheckoutShippingPackageRate[] = []
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue
      const r = entry as Record<string, unknown>
      const listingId = typeof r.listingId === "string" ? r.listingId.trim() : ""
      const rateId = typeof r.rateId === "string" ? r.rateId.trim() : ""
      const shippingCents =
        typeof r.shippingCents === "number" && Number.isFinite(r.shippingCents)
          ? Math.round(r.shippingCents)
          : 0
      if (!listingId || !rateId) continue
      out.push({
        listingId,
        rateId,
        shippingCents,
        serviceCode: typeof r.serviceCode === "string" ? r.serviceCode : null,
      })
    }
    return out
  } catch {
    return []
  }
}

async function shipmentHasPreparedLabel(
  supabase: SupabaseClient,
  shipmentId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("order_shipping_labels")
    .select("id, label_pdf_url, label_storage_path, tracking_number")
    .eq("shipment_id", shipmentId)
    .limit(4)

  for (const row of data ?? []) {
    const r = row as {
      label_pdf_url?: string | null
      label_storage_path?: string | null
      tracking_number?: string | null
    }
    if (
      r.tracking_number?.trim() ||
      r.label_pdf_url?.trim() ||
      r.label_storage_path?.trim()
    ) {
      return true
    }
  }
  return false
}

async function purchaseAndAttachOneLabel(params: {
  supabase: SupabaseClient
  orderId: string
  listingId: string
  listingsForParcel: PeerListingForShippingQuote[]
  rateId: string
  packageKey: string
  shipmentId: string
  orderItemId: string | null
  bandId?: string | null
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const purchased = await purchaseShipEngineLabelForOrderOnce({
    supabase: params.supabase,
    orderId: params.orderId,
    ownerKey: `auto_reswell:${params.orderId}:${params.packageKey}`,
    rateId: params.rateId,
    packageKey: params.packageKey,
  })
  if (!purchased.ok) {
    return { ok: false, error: purchased.error }
  }
  if (purchased.alreadyPurchased) {
    return { ok: true }
  }

  {
    const labelParcel = resolveOrderLabelParcelFromListings(
      params.listingsForParcel as unknown as ListingPackedParcelSource[],
    )
    if (labelParcel.ok) {
      logPackBandLabelTelemetry({
        listingId: params.listingId,
        orderId: params.orderId,
        tierId: labelParcel.parcel.tierId,
        bandId: params.bandId ?? null,
        dims: {
          lengthIn: labelParcel.parcel.lengthIn,
          widthIn: labelParcel.parcel.widthIn,
          heightIn: labelParcel.parcel.heightIn,
          weightLb: labelParcel.parcel.weightLb,
        },
        labelCostUsd: purchased.result.costAmount,
      })
    }
  }

  let labelPdfUrl: string | null = purchased.result.labelUrl
  let labelStoragePath: string | null = null
  let paperlessQrUrl: string | null = purchased.result.paperlessQrUrl
  let paperlessQrStoragePath: string | null = null

  if (labelPdfUrl) {
    const stored = await downloadAndStoreLabelPdf({
      supabase: params.supabase,
      orderId: params.orderId,
      pdfUrl: labelPdfUrl,
    })
    if (stored.ok) {
      labelStoragePath = stored.storagePath
      labelPdfUrl = null
    } else {
      console.warn(
        `[autoPurchaseReswellShippingLabelForOrder:${params.orderId}] PDF storage failed (${stored.error}); keeping ShipEngine URL.`,
      )
    }
  }

  if (paperlessQrUrl) {
    const storedQr = await downloadAndStorePaperlessQr({
      supabase: params.supabase,
      orderId: params.orderId,
      qrUrl: paperlessQrUrl,
    })
    if (storedQr.ok) {
      paperlessQrStoragePath = storedQr.storagePath
      paperlessQrUrl = null
    } else {
      console.warn(
        `[autoPurchaseReswellShippingLabelForOrder:${params.orderId}] paperless QR storage failed (${storedQr.error}); keeping ShipEngine URL.`,
      )
    }
  }

  const attached = await attachOrderShippingLabel({
    supabase: params.supabase,
    orderId: params.orderId,
    origin: "auto_reswell_checkout",
    shipmentId: params.shipmentId,
    orderItemId: params.orderItemId,
    labelPdfUrl,
    labelStoragePath,
    trackingNumber: purchased.result.trackingNumber,
    trackingCarrier: purchased.result.trackingCarrier,
    shipengineRateId: params.rateId,
    paperlessQrUrl,
    paperlessQrStoragePath,
    paperlessInstructions: purchased.result.paperlessInstructions,
    paperlessHandoffCode: purchased.result.paperlessHandoffCode,
  })

  if (!attached.ok) {
    return { ok: false, error: attached.error }
  }
  return { ok: true }
}

async function ensureShipmentsExist(
  supabase: SupabaseClient,
  orderId: string,
  packagingModeRaw: string | null,
): Promise<OrderShipmentWithItems[]> {
  let shipments = await listOrderShipmentsWithItems(supabase, orderId)
  if (shipments.length > 0) return shipments

  const { data: items } = await supabase
    .from("order_items")
    .select("id, listing_id, sort_order")
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })

  const lines = (items ?? []).map((row) => {
    const r = row as { id: string; listing_id: string }
    return { orderItemId: r.id, listingId: r.listing_id }
  })
  if (lines.length === 0) return []

  const created = await insertOrderShipmentsForOrder({
    supabase,
    orderId,
    packagingMode: resolveShippingPackagingMode(packagingModeRaw, DEFAULT_SHIPPING_PACKAGING_MODE),
    lines,
  })
  if (!created.ok) {
    console.error(`[autoPurchaseReswellShippingLabelForOrder:${orderId}] ensure shipments:`, created.error)
    return []
  }
  return listOrderShipmentsWithItems(supabase, orderId)
}

/**
 * After a peer order with Reswell-calculated shipping, purchase ShipEngine label(s)
 * per shipment, store PDFs, and expose them on the seller sale page.
 *
 * Safe to call multiple times — skips shipments that already have labels.
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

  try {
    if (!isShipEngineConfigured()) {
      await fail(
        "shipengine_not_configured",
        "ShipEngine is not configured (missing SHIPENGINE_API_KEY). Set the key and create the label manually.",
      )
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
      shipping_packaging_mode,
      stripe_checkout_session_id,
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
      shipping_packaging_mode: string | null
      stripe_checkout_session_id: string | null
      listings: Record<string, unknown> | Record<string, unknown>[] | null
    }

    if (o.fulfillment_method !== "shipping") return
    if (o.delivery_status !== "pending" && o.delivery_status !== "shipped") return

    const listing = Array.isArray(o.listings) ? o.listings[0] : o.listings
    const listingSection = (listing as { section?: string } | null)?.section
    if (!listing || !isPeerListingSection(listingSection)) return

    const shipments = await ensureShipmentsExist(supabase, o.id, o.shipping_packaging_mode)
    if (shipments.length === 0) {
      // Fallback: legacy single-label path when order_items/shipments missing.
      if (await orderAlreadyHasPreparedLabel(supabase, orderId)) {
        await resolveOpenOrderShippingLabelFailures(supabase, orderId)
        await ensureReswellShippingLabelReadyThreadNotification(supabase, orderId)
      }
      return
    }

    const listingById = new Map<string, PeerListingForShippingQuote>()
    const { data: itemListingRows } = await supabase
      .from("order_items")
      .select(`listing_id, listings ( ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT} )`)
      .eq("order_id", o.id)

    for (const raw of itemListingRows ?? []) {
      const row = raw as { listing_id?: string; listings?: unknown }
      const l = Array.isArray(row.listings) ? row.listings[0] : row.listings
      if (row.listing_id && l) {
        listingById.set(row.listing_id, l as PeerListingForShippingQuote)
      }
    }
    if (!listingById.has(o.listing_id)) {
      listingById.set(o.listing_id, listing as unknown as PeerListingForShippingQuote)
    }

    const allListings = [...listingById.values()]
    if (!allListings.some((l) => effectiveBoardShippingMode(l) === "reswell")) return

    const pendingShipments: OrderShipmentWithItems[] = []
    for (const shipment of shipments) {
      if (await shipmentHasPreparedLabel(supabase, shipment.id)) continue
      pendingShipments.push(shipment)
    }

    if (pendingShipments.length === 0) {
      await resolveOpenOrderShippingLabelFailures(supabase, orderId)
      await ensureReswellShippingLabelReadyThreadNotification(supabase, orderId)
      return
    }

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

    let togetherRateFromPi: string | null = null
    let packageRatesFromPi: CheckoutShippingPackageRate[] = []
    const paymentIntentId = o.stripe_checkout_session_id?.trim()
    if (paymentIntentId) {
      try {
        const stripe = getStripe()
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
        togetherRateFromPi = pi.metadata.shipengine_rate_id?.trim() || null
        packageRatesFromPi = parsePackageRatesFromPiMeta(pi.metadata.shipengine_package_rates)
      } catch (e) {
        console.warn(`${tag} could not read payment intent for selected rate:`, e)
      }
    }
    const rateByListing = new Map(packageRatesFromPi.map((r) => [r.listingId, r.rateId]))

    let anyFailure = false

    for (const shipment of pendingShipments) {
      const shipmentListings = shipment.listing_ids
        .map((id) => listingById.get(id))
        .filter((l): l is PeerListingForShippingQuote => l != null)

      const listingsForQuote =
        shipmentListings.length > 0
          ? shipmentListings
          : [listing as unknown as PeerListingForShippingQuote]

      if (!listingsForQuote.some((l) => effectiveBoardShippingMode(l) === "reswell")) {
        continue
      }

      let rateId =
        shipment.shipengine_rate_id?.trim() ||
        (shipment.packaging_kind === "together"
          ? togetherRateFromPi
          : rateByListing.get(shipment.listing_ids[0] ?? "") ?? null)

      if (!rateId) {
        const quoted = await getCheapestReswellRateForListings({
          listings: listingsForQuote,
          shipTo,
          diagnosticTag: `auto-reswell-label:${o.id}:${shipment.id}`,
          sellerShipFromName,
          section: listingsForQuote[0]?.section ?? listingSection ?? null,
        })
        if (!quoted.ok) {
          anyFailure = true
          await fail("rate_quote", `${shipment.id}: ${quoted.error}`)
          continue
        }
        rateId = quoted.cheapest.rate_id
      }

      if (!rateId) {
        anyFailure = true
        await fail("rate_id", `No purchasable rate for shipment ${shipment.id}.`)
        continue
      }

      const primaryListingId = shipment.listing_ids[0] ?? o.listing_id
      const primaryListing = listingById.get(primaryListingId) ?? listingsForQuote[0]!

      const result = await purchaseAndAttachOneLabel({
        supabase,
        orderId: o.id,
        listingId: primaryListingId,
        listingsForParcel: listingsForQuote,
        rateId,
        packageKey: shipment.id,
        shipmentId: shipment.id,
        orderItemId: shipment.order_item_ids[0] ?? null,
        bandId: primaryListing.shipping_package_band,
      })
      if (!result.ok) {
        anyFailure = true
        await fail("label_purchase", `${shipment.id}: ${result.error}`)
      }
    }

    if (!anyFailure) {
      await resolveOpenOrderShippingLabelFailures(supabase, orderId)
      await ensureReswellShippingLabelReadyThreadNotification(supabase, orderId)
      console.info(`${tag} shipment labels attached for seller sale page.`)
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error during label purchase"
    await fail("label_purchase", message)
  }
}

/** Checkout hook — awaits label purchase so serverless handlers do not exit early. */
export async function purchaseReswellShippingLabelAfterCheckout(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  try {
    await autoPurchaseReswellShippingLabelForOrder(supabase, orderId)
  } catch (e) {
    console.error(`[purchaseReswellShippingLabelAfterCheckout:${orderId}]`, e)
  }
}

/** @deprecated Prefer shipment.id as package_key. Kept for lock-key clarity. */
export const LEGACY_TOGETHER_PACKAGE_KEY = TOGETHER_PACKAGE_KEY
