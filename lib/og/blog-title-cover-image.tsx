import { ImageResponse } from "next/og"
import { createClient } from "@/lib/supabase/server"
import { getPublishedArticleBySlugForSite } from "@/lib/services/blogPublic"
import { STANDARD_OG_SIZE } from "@/lib/og/og-size"
import { brandShareImageResponse } from "@/lib/og/brand-share-image"
import { blogTagAccents } from "@/lib/utils/blog-tag-accents"

function truncate(s: string, max: number): string {
  const t = s.trim()
  if (t.length <= max) return t
  return `${t.slice(0, max - 1).trim()}…`
}

/**
 * Share art for a blog post with no cover photo — title as the image.
 */
export async function blogTitleCoverImageResponse(slug: string) {
  const supabase = await createClient()
  const article = await getPublishedArticleBySlugForSite(supabase, slug)
  if (!article) {
    return brandShareImageResponse({
      headline: "Reswell",
      subhead: "Stories on gear, culture, and the marketplace.",
      footer: "reswell.app · Blog",
      tone: "dark",
    })
  }

  const accent = blogTagAccents(article.tag)
  const headline = truncate(article.title, 90)
  const tagLabel = article.tag.trim() || "Blog"

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          paddingLeft: 72,
          paddingRight: 72,
          paddingTop: 56,
          paddingBottom: 48,
          background: "linear-gradient(145deg, #04070E 0%, #0f2744 52%, #04070E 100%)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 10,
            background: `linear-gradient(180deg, ${accent.ogFrom} 0%, ${accent.ogTo} 100%)`,
          }}
        />
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#bae6fd",
          }}
        >
          {`Reswell · ${tagLabel}`}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: headline.length > 52 ? 48 : 58,
            fontWeight: 700,
            color: "#f8fafc",
            lineHeight: 1.1,
            letterSpacing: -1.5,
            maxWidth: 1000,
          }}
        >
          {headline}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 24,
            fontWeight: 600,
            color: "#94a3b8",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          reswell.app
        </div>
      </div>
    ),
    { ...STANDARD_OG_SIZE },
  )
}
