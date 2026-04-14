import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "Board Talk",
    subhead: "Community Q&A, gear talk, and surfboard discussions on Reswell.",
    footer: "reswell.app · Board Talk",
    tone: "dark",
  })
}
