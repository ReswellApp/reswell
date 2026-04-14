import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "New surf gear on Reswell",
    subhead: "Shop marketplace new inventory from sellers — secure checkout and messaging in one place.",
    footer: "reswell.app · Shop",
    tone: "light",
  })
}
