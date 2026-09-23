import "server-only"

import sharp from "sharp"
import { SERVER_IMAGE_CONVERT_MAX_BYTES } from "@/lib/utils/server-image-convert"
import type { SellCatalogScanImageInput } from "@/lib/services/sellCatalogImageUnderstand"

const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])
const SCAN_MAX_LONG_EDGE = 1280

export const SELL_CATALOG_SCAN_MAX_BYTES = SERVER_IMAGE_CONVERT_MAX_BYTES

export function isSellCatalogScanMediaType(
  value: string,
): value is SellCatalogScanImageInput["mediaType"] {
  return ALLOWED_MEDIA_TYPES.has(value)
}

export async function normalizeSellCatalogScanImage(
  buffer: Buffer,
): Promise<SellCatalogScanImageInput> {
  const out = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({
      width: SCAN_MAX_LONG_EDGE,
      height: SCAN_MAX_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer()

  return { bytes: new Uint8Array(out), mediaType: "image/jpeg" }
}
