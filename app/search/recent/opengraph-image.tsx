import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "Recently listed surfboards",
    subhead: "Fresh listings from active sellers — browse the newest boards on Reswell.",
    footer: "reswell.app · Search",
    tone: "light",
  })
}
