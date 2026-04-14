import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default async function Image(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  if (slug === "boards") {
    return brandShareImageResponse({
      headline: "Surfboards for sale",
      subhead: "Browse used and new boards from local sellers — shortboards, longboards, grovelers, and more.",
      footer: "reswell.app · Boards",
      tone: "light",
    })
  }
  return brandShareImageResponse({
    headline: "Reswell",
    subhead: "Buy & sell surfboards on the peer-to-peer marketplace.",
    footer: "reswell.app",
    tone: "light",
  })
}
