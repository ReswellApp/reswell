import { PDFDocument } from "pdf-lib"
import type { SupabaseClient } from "@supabase/supabase-js"
import { saleHasPrintableOpenLabel } from "@/lib/sale-fulfillment-filters"
import { loadShippingLabelPdfBytes } from "@/lib/services/resolveOrderShippingLabelPdf"
import { SELLER_PRINT_SHIPPING_LABELS_MAX } from "@/lib/validations/seller-print-shipping-labels"

type SellerPrintLabelOrderRow = {
  id: string
  seller_id: string
  status: string
  delivery_status: string
  fulfillment_method: string | null
  tracking_number: string | null
  shipping_address: { address?: unknown } | null
}

export type SellerPrintShippingLabelsResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; error: string; status: number }

function orderHasShippingAddress(shippingAddress: SellerPrintLabelOrderRow["shipping_address"]): boolean {
  const address = shippingAddress?.address
  if (!address || typeof address !== "object") return false
  return Object.values(address as Record<string, unknown>).some(
    (value) => typeof value === "string" && value.trim().length > 0,
  )
}

async function mergeLabelPdfs(pdfs: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create()
  for (const bytes of pdfs) {
    const source = await PDFDocument.load(bytes)
    const pages = await merged.copyPages(source, source.getPageIndices())
    for (const page of pages) {
      merged.addPage(page)
    }
  }
  return merged.save()
}

/**
 * Loads seller-owned open shipment labels and merges them into one printable PDF.
 */
export async function buildSellerPrintableShippingLabelsPdf(params: {
  supabase: SupabaseClient
  serviceSupabase: SupabaseClient
  sellerId: string
  orderIds: string[]
}): Promise<SellerPrintShippingLabelsResult> {
  const uniqueIds = [...new Set(params.orderIds)]
  if (uniqueIds.length === 0) {
    return { ok: false, error: "Select at least one shipping label", status: 400 }
  }
  if (uniqueIds.length > SELLER_PRINT_SHIPPING_LABELS_MAX) {
    return {
      ok: false,
      error: `You can print up to ${SELLER_PRINT_SHIPPING_LABELS_MAX} labels at a time`,
      status: 400,
    }
  }

  const { data: orders, error } = await params.supabase
    .from("orders")
    .select("id, seller_id, status, delivery_status, fulfillment_method, tracking_number, shipping_address")
    .eq("seller_id", params.sellerId)
    .in("id", uniqueIds)

  if (error) {
    console.error("[sellerPrintShippingLabels] orders query:", error.message)
    return { ok: false, error: "Could not load sales", status: 500 }
  }

  const rows = (orders ?? []) as SellerPrintLabelOrderRow[]
  if (rows.length !== uniqueIds.length) {
    return { ok: false, error: "One or more sales were not found", status: 404 }
  }

  const printable = rows.filter((row) =>
    saleHasPrintableOpenLabel({
      fulfillmentMethod: row.fulfillment_method,
      deliveryStatus: row.delivery_status ?? "pending",
      orderStatus: row.status,
      hasShippingAddress: orderHasShippingAddress(row.shipping_address),
      hasPreparedShippingLabel: true,
    }),
  )

  if (printable.length !== rows.length) {
    return {
      ok: false,
      error: "Only open shipments with a created label can be printed from here.",
      status: 400,
    }
  }

  const byId = new Map(printable.map((row) => [row.id, row]))
  const pdfs: Uint8Array[] = []

  for (const orderId of uniqueIds) {
    const row = byId.get(orderId)
    if (!row) {
      return { ok: false, error: "One or more sales were not found", status: 404 }
    }

    const loaded = await loadShippingLabelPdfBytes(params.serviceSupabase, {
      orderId: row.id,
      trackingNumber: row.tracking_number,
    })
    if (!loaded.ok) {
      return { ok: false, error: "Could not load a shipping label PDF", status: 502 }
    }
    pdfs.push(loaded.bytes)
  }

  try {
    const bytes = await mergeLabelPdfs(pdfs)
    return { ok: true, bytes }
  } catch (e) {
    console.error("[sellerPrintShippingLabels] merge:", e)
    return { ok: false, error: "Could not combine shipping labels", status: 500 }
  }
}
