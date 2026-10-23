import { mobileSaleLabelSchema } from "@reswell/api-contract"
import type { SupabaseClient } from "@supabase/supabase-js"
import { listingsUseSantaBarbaraDropoff } from "@/lib/dropoff-santa-barbara"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { resolveOrderShippingLabelPdf } from "@/lib/services/resolveOrderShippingLabelPdf"
import { createServiceRoleClient } from "@/lib/supabase/server"

const LABEL_BUCKET = "order-shipping-labels"
const SIGNED_URL_SECONDS = 120

type LabelOrder = {
  id: string
  tracking_number: string | null
  listings: unknown
  order_items: Array<{ listings: unknown }> | null
}

function embeddedListing(value: unknown): { dropoff_location_id?: string | null; dropoff_locations?: { slug?: string | null } | Array<{ slug?: string | null }> | null } | null {
  if (!value || typeof value !== "object") return null
  return Array.isArray(value) ? (value[0] as never) ?? null : (value as never)
}

async function loadSellerOrder(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<{ ok: true; order: LabelOrder } | { ok: false; status: number; error: string }> {
  const { data, error } = await supabase
    .from("orders")
    .select(
      `
      id,
      tracking_number,
      listings ( dropoff_location_id, dropoff_locations ( slug ) ),
      order_items ( listings ( dropoff_location_id, dropoff_locations ( slug ) ) )
    `,
    )
    .eq("id", orderId)
    .eq("seller_id", userId)
    .maybeSingle()

  if (error) return { ok: false, status: 500, error: "Unable to load this sale right now" }
  if (!data) return { ok: false, status: 404, error: "Sale not found" }
  return { ok: true, order: data as LabelOrder }
}

function isSantaBarbara(order: LabelOrder): boolean {
  const listings = [
    embeddedListing(order.listings),
    ...(order.order_items ?? []).map((item) => embeddedListing(item.listings)),
  ]
  return listingsUseSantaBarbaraDropoff(listings)
}

export async function mobileSaleHasLabel(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  trackingNumber: string | null,
): Promise<boolean> {
  const loaded = await loadSellerOrder(supabase, userId, orderId)
  if (!loaded.ok || isSantaBarbara(loaded.order)) return false
  try {
    const resolved = await resolveOrderShippingLabelPdf(createServiceRoleClient(), {
      orderId,
      trackingNumber: trackingNumber ?? loaded.order.tracking_number,
    })
    return Boolean(resolved?.label_pdf_url || resolved?.label_storage_path)
  } catch (error) {
    console.error("[mobile-api] sale label check failed", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return false
  }
}

export async function getMobileSaleLabelUrlService(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<MobileApiResult<{ url: string }>> {
  const loaded = await loadSellerOrder(supabase, userId, orderId)
  if (!loaded.ok) return loaded
  if (isSantaBarbara(loaded.order)) {
    return {
      ok: false,
      status: 403,
      error: "No seller label is available for Santa Barbara drop-off. Reswell packs and ships the board after drop-off.",
    }
  }

  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch (error) {
    console.error("[mobile-api] sale label service role failed", {
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return { ok: false, status: 500, error: "Unable to open the shipping label right now" }
  }

  const resolved = await resolveOrderShippingLabelPdf(service, {
    orderId,
    trackingNumber: loaded.order.tracking_number,
  })
  if (!resolved) return { ok: false, status: 404, error: "No shipping label for this order" }

  const storagePath = resolved.label_storage_path?.trim()
  if (storagePath) {
    const signed = await service.storage.from(LABEL_BUCKET).createSignedUrl(storagePath, SIGNED_URL_SECONDS)
    if (signed.error || !signed.data?.signedUrl) {
      return { ok: false, status: 500, error: "Unable to open the shipping label right now" }
    }
    const parsed = mobileSaleLabelSchema.safeParse({ url: signed.data.signedUrl })
    if (!parsed.success) return { ok: false, status: 500, error: "Unable to open the shipping label right now" }
    return { ok: true, data: parsed.data }
  }

  const pdfUrl = resolved.label_pdf_url?.trim()
  if (!pdfUrl) return { ok: false, status: 404, error: "No shipping label for this order" }
  const parsed = mobileSaleLabelSchema.safeParse({ url: pdfUrl })
  if (!parsed.success) return { ok: false, status: 404, error: "No shipping label for this order" }
  return { ok: true, data: parsed.data }
}
