import { createClient } from "@/lib/supabase/server"
import { brandShareImageResponse, BRAND_OG_SIZE } from "@/lib/og/brand-share-image"

export const size = BRAND_OG_SIZE
export const contentType = "image/png"

export default async function Image(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params
  const supabase = await createClient()
  const { data } = await supabase.from("forum_threads").select("title").eq("slug", slug).maybeSingle()
  const headline = data?.title?.trim() ? data.title.trim() : "Board Talk"
  return brandShareImageResponse({
    headline,
    subhead: "Community discussion on Reswell",
    footer: "reswell.app · Board Talk",
    tone: "dark",
  })
}
