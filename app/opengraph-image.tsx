import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "Reswell — Buy & sell surfboards",
    subhead: "Peer-to-peer marketplace: list your board, browse local shapes, and shop from verified sellers.",
    footer: "reswell.app",
    tone: "light",
  })
}
