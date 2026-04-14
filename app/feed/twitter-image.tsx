import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "Marketplace feed",
    subhead: "Latest surfboard listings and recently sold boards on Reswell — live activity from the community.",
    footer: "reswell.app · Feed",
    tone: "light",
  })
}
