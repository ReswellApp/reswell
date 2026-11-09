import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "Recently sold",
    subhead: "Surfboards, fins, leashes, and the rest of the gear that recently sold on Reswell.",
    footer: "reswell.app · Sold",
    tone: "light",
  })
}
