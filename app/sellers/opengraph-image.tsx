import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "Surf sellers on Reswell",
    subhead: "Browse local shops and peer sellers — gear, profiles, and verified shops.",
    footer: "reswell.app · Sellers",
    tone: "light",
  })
}
