import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default function Image() {
  return brandShareImageResponse({
    headline: "Surfers directory",
    subhead: "Explore surfer profiles on Reswell — stories, bios, and marketplace search.",
    footer: "reswell.app · Surfers",
    tone: "light",
  })
}
