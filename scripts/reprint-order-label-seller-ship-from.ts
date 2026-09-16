/**
 * One-off: void a marketplace label and repurchase from the seller’s saved street address.
 *
 * Usage:
 *   npx tsx scripts/reprint-order-label-seller-ship-from.ts <order_id>
 *   npx tsx scripts/reprint-order-label-seller-ship-from.ts <order_id> --apply
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import { deleteShipEngineLabelPurchaseLockForReplacement } from "@/lib/db/shipEngineLabelPurchaseLocks"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import { attachOrderShippingLabel } from "@/lib/services/attachOrderShippingLabel"
import { getCheapestReswellRateForListings } from "@/lib/services/reswellListingShippingRate"
import { purchaseShipEngineLabelForOrderOnce } from "@/lib/services/purchaseShipEngineLabelForOrderOnce"
import { resolveSellerShipFromAddress } from "@/lib/services/sellerShipFromAddress"
import { voidShipEngineLabelForOrder } from "@/lib/services/voidShipEngineLabelForOrder"
import {
  downloadAndStoreLabelPdf,
  downloadAndStorePaperlessQr,
} from "@/lib/services/storeOrderShippingLabelAssets"
import {
  orderShippingJsonToRateQuoteAddress,
  rateQuoteFieldsToShippingInput,
} from "@/lib/shipping/rate-address"
import { createServiceRoleClient } from "@/lib/supabase/server"

function loadEnvFile(relativePath: string): void {
  const filePath = resolve(process.cwd(), relativePath)
  try {
    const content = readFileSync(filePath, "utf8")
    for (const line of content.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!value) continue
      if (process.env[key]?.trim()) continue
      process.env[key] = value
    }
  } catch {
    // optional
  }
}

function oneLine(addr: {
  line1: string
  line2?: string | null
  city: string
  state: string | null
  postal_code: string
}): string {
  return [addr.line1, addr.line2, [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ")
}

async function main() {
  loadEnvFile(".env.production.local")
  loadEnvFile(".env.local")
  loadEnvFile(".env")

  const orderId = process.argv[2]?.trim() ?? ""
  const apply = process.argv.includes("--apply")
  if (!orderId) {
    console.error("Usage: npx tsx scripts/reprint-order-label-seller-ship-from.ts <order_id> [--apply]")
    process.exit(1)
  }

  const supabase = createServiceRoleClient()

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      order_num,
      seller_id,
      listing_id,
      fulfillment_method,
      delivery_status,
      shipping_address,
      tracking_number,
      tracking_carrier,
      listings ( ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT} )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (orderErr || !order) {
    console.error("Order not found", orderErr?.message)
    process.exit(1)
  }

  const listing = Array.isArray(order.listings) ? order.listings[0] : order.listings
  if (!listing) {
    console.error("Listing not found")
    process.exit(1)
  }

  const sellerAddr = await resolveSellerShipFromAddress(supabase, order.seller_id as string)
  if (!sellerAddr.ok) {
    console.error("Seller has no ship-from address:", sellerAddr.error)
    process.exit(1)
  }

  const shipToFields = orderShippingJsonToRateQuoteAddress(order.shipping_address)
  if (!shipToFields) {
    console.error("Buyer shipping address is incomplete")
    process.exit(1)
  }

  const sellerShipFromName = await fetchSellerShipFromLabelName(supabase, order.seller_id as string)
  const quoted = await getCheapestReswellRateForListings({
    listings: [listing],
    shipTo: rateQuoteFieldsToShippingInput(shipToFields),
    diagnosticTag: `reprint-seller-ship-from:${orderId}`,
    sellerShipFromName,
    sellerShipFromAddress: sellerAddr.address,
    selectedServiceCode: "usps_ground_advantage",
    section: (listing as { section?: string }).section ?? null,
  })

  if (!quoted.ok) {
    console.error("Rate quote failed:", quoted.error)
    process.exit(1)
  }

  const { data: shipment } = await supabase
    .from("order_shipments")
    .select("id")
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()

  const { data: items } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })
    .limit(1)

  const shipmentId = typeof shipment?.id === "string" ? shipment.id : null
  const orderItemId = (items?.[0] as { id?: string } | undefined)?.id ?? null

  console.log({
    apply,
    orderId,
    orderNum: order.order_num,
    currentTracking: order.tracking_number,
    currentCarrier: order.tracking_carrier,
    deliveryStatus: order.delivery_status,
    sellerName: sellerShipFromName,
    shipFrom: oneLine(sellerAddr.address),
    shipTo: `${shipToFields.name} · ${shipToFields.address_line1} · ${shipToFields.city_locality}, ${shipToFields.state_province} ${shipToFields.postal_code}`,
    rate: {
      id: quoted.cheapest.rate_id,
      carrier: quoted.cheapest.carrierName,
      service: quoted.cheapest.serviceName,
      serviceCode: quoted.cheapest.serviceCode,
      amount: quoted.cheapest.totalAmount,
    },
    shipmentId,
    orderItemId,
  })

  if (!apply) {
    console.log("Dry run only. Re-run with --apply to void and purchase.")
    return
  }

  if (!quoted.cheapest.rate_id) {
    console.error("Quoted rate has no purchasable rate_id")
    process.exit(1)
  }

  const voided = await voidShipEngineLabelForOrder({
    supabase,
    orderId,
    explicitLabelId: null,
  })
  if (!voided.ok) {
    console.error("Void failed:", voided.error)
    process.exit(1)
  }
  console.log("void", voided.data)

  await supabase
    .from("orders")
    .update({
      tracking_number: null,
      tracking_carrier: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)

  if (shipmentId) {
    await supabase
      .from("order_shipments")
      .update({
        tracking_number: null,
        tracking_carrier: null,
        tracking_detail: null,
        delivery_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipmentId)
  }

  // purchase-once treats any remaining marketplace label tracking as "already bought".
  const { error: clearLabelErr } = await supabase
    .from("order_shipping_labels")
    .update({
      tracking_number: null,
      tracking_carrier: null,
    })
    .eq("order_id", orderId)
    .not("tracking_number", "is", null)
  if (clearLabelErr) {
    console.error("Could not clear voided label tracking:", clearLabelErr.message)
    process.exit(1)
  }

  const lockCleared = await deleteShipEngineLabelPurchaseLockForReplacement({
    supabase,
    orderId,
  })
  if (!lockCleared.ok) {
    console.error("Could not clear purchase lock:", lockCleared.error)
    process.exit(1)
  }

  const purchased = await purchaseShipEngineLabelForOrderOnce({
    supabase,
    orderId,
    ownerKey: `admin_seller_shipfrom_replace:${orderId}:${Date.now()}`,
    rateId: quoted.cheapest.rate_id,
    packageKey: shipmentId ?? undefined,
  })
  if (!purchased.ok) {
    console.error("Purchase failed:", purchased.error)
    process.exit(1)
  }
  if (purchased.alreadyPurchased) {
    console.error("Purchase-once treated this as already purchased.")
    process.exit(1)
  }

  let labelPdfUrl: string | null = purchased.result.labelUrl
  let labelStoragePath: string | null = null
  let paperlessQrUrl: string | null = purchased.result.paperlessQrUrl
  let paperlessQrStoragePath: string | null = null

  if (labelPdfUrl) {
    const stored = await downloadAndStoreLabelPdf({
      supabase,
      orderId,
      pdfUrl: labelPdfUrl,
    })
    if (stored.ok) {
      labelStoragePath = stored.storagePath
      labelPdfUrl = null
    } else {
      console.warn("PDF storage failed; keeping ShipEngine URL:", stored.error)
    }
  }

  if (paperlessQrUrl) {
    const storedQr = await downloadAndStorePaperlessQr({
      supabase,
      orderId,
      qrUrl: paperlessQrUrl,
    })
    if (storedQr.ok) {
      paperlessQrStoragePath = storedQr.storagePath
      paperlessQrUrl = null
    }
  }

  const attached = await attachOrderShippingLabel({
    supabase,
    orderId,
    origin: "auto_reswell_checkout",
    shipmentId,
    orderItemId,
    labelPdfUrl,
    labelStoragePath,
    trackingNumber: purchased.result.trackingNumber,
    trackingCarrier: purchased.result.trackingCarrier,
    shipengineRateId: quoted.cheapest.rate_id,
    paperlessQrUrl,
    paperlessQrStoragePath,
    paperlessInstructions: purchased.result.paperlessInstructions,
    paperlessHandoffCode: purchased.result.paperlessHandoffCode,
    insuranceProvider: purchased.result.insuranceProvider,
    insuredValueAmount: purchased.result.insuredValueAmount,
    insuranceCostAmount: purchased.result.insuranceCostAmount,
    insuranceClaimUrl: purchased.result.insuranceClaimUrl,
    shipengineLabelId: purchased.result.shipengineLabelId,
    shipengineShipmentId: purchased.result.shipengineShipmentId,
    labelCostUsd: purchased.result.costAmount,
    labelCostCurrency: purchased.result.costCurrency,
  })
  if (!attached.ok) {
    console.error("Attach failed:", attached.error)
    process.exit(1)
  }

  console.log({
    newTracking: purchased.result.trackingNumber,
    newCarrier: purchased.result.trackingCarrier,
    labelUrl: purchased.result.labelUrl,
    labelStoragePath,
    cost: purchased.result.costAmount,
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
