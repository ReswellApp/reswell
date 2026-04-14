import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "Surf brands directory",
    subhead: "Explore shapers and surfboard brands on Reswell — profiles from our catalog.",
    footer: "reswell.app · Brands",
    tone: "light",
  })
}
