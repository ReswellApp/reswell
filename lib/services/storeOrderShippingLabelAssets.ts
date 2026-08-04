import { randomUUID } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"

const LABEL_BUCKET = "order-shipping-labels"
const MAX_ASSET_BYTES = 15 * 1024 * 1024

function isLikelyPdf(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-"
}

function isLikelyPng(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
}

function isLikelyJpeg(buf: Buffer): boolean {
  return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff
}

export async function downloadAndStoreLabelPdf(params: {
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
    console.error("[storeOrderShippingLabelAssets] fetch pdf:", e)
    return { ok: false, error: "Could not download label PDF from ShipEngine." }
  }

  if (!pdfRes.ok) {
    return { ok: false, error: `ShipEngine PDF download failed (${pdfRes.status}).` }
  }

  const buf = Buffer.from(await pdfRes.arrayBuffer())
  if (buf.length > MAX_ASSET_BYTES) {
    return { ok: false, error: "Label PDF too large (max 15 MB)." }
  }
  if (!isLikelyPdf(buf)) {
    return { ok: false, error: "ShipEngine download was not a PDF." }
  }

  const storagePath = `${params.orderId}/${randomUUID()}.pdf`
  const { error: upErr } = await params.supabase.storage.from(LABEL_BUCKET).upload(storagePath, buf, {
    contentType: "application/pdf",
    upsert: false,
  })

  if (upErr) {
    console.error("[storeOrderShippingLabelAssets] pdf storage:", upErr)
    return { ok: false, error: "Could not store label PDF." }
  }

  return { ok: true, storagePath }
}

export async function downloadAndStorePaperlessQr(params: {
  supabase: SupabaseClient
  orderId: string
  qrUrl: string
}): Promise<{ ok: true; storagePath: string } | { ok: false; error: string }> {
  let qrRes: Response
  try {
    qrRes = await fetch(params.qrUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(60_000),
      headers: { Accept: "image/png,image/jpeg,image/*,*/*" },
    })
  } catch (e) {
    console.error("[storeOrderShippingLabelAssets] fetch paperless qr:", e)
    return { ok: false, error: "Could not download paperless QR from ShipEngine." }
  }

  if (!qrRes.ok) {
    return { ok: false, error: `ShipEngine paperless QR download failed (${qrRes.status}).` }
  }

  const buf = Buffer.from(await qrRes.arrayBuffer())
  if (buf.length > MAX_ASSET_BYTES) {
    return { ok: false, error: "Paperless QR image too large (max 15 MB)." }
  }

  const contentTypeHeader = qrRes.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase()
  let ext: "png" | "jpg" = "png"
  let contentType = "image/png"

  if (isLikelyPng(buf) || contentTypeHeader === "image/png") {
    ext = "png"
    contentType = "image/png"
  } else if (
    isLikelyJpeg(buf) ||
    contentTypeHeader === "image/jpeg" ||
    contentTypeHeader === "image/jpg"
  ) {
    ext = "jpg"
    contentType = "image/jpeg"
  } else if (contentTypeHeader?.startsWith("image/")) {
    // Accept other image responses as PNG path for storage policy; content-type preserved when possible.
    ext = "png"
    contentType = contentTypeHeader === "image/jpg" ? "image/jpeg" : contentTypeHeader
  } else {
    return { ok: false, error: "ShipEngine paperless download was not an image." }
  }

  const storagePath = `${params.orderId}/${randomUUID()}-paperless.${ext}`
  const { error: upErr } = await params.supabase.storage.from(LABEL_BUCKET).upload(storagePath, buf, {
    contentType,
    upsert: false,
  })

  if (upErr) {
    console.error("[storeOrderShippingLabelAssets] paperless qr storage:", upErr)
    return { ok: false, error: "Could not store paperless QR." }
  }

  return { ok: true, storagePath }
}
