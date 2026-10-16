import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "On sale",
    subhead: "Marked-down surf gear on Reswell — listings with a public price drop.",
    footer: "reswell.app · Sale",
    tone: "light",
  })
}
