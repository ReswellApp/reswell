import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "Collections",
    subhead: "Editorial features, press, and surf stories from Reswell.",
    footer: "reswell.app · Collections",
    tone: "dark",
  })
}
