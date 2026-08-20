import { STANDARD_OG_SIZE } from "@/lib/og/og-size"
import { blogTitleCoverImageResponse } from "@/lib/og/blog-title-cover-image"

export const runtime = "nodejs"
export const size = STANDARD_OG_SIZE
export const contentType = "image/png"
export const alt = "Reswell blog"

export default async function Image(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  return blogTitleCoverImageResponse(slug)
}
